import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, robinhoodChain } from "@/lib/chain";
import { escrowAbi } from "@/lib/abis";
import {
  acquireClaimLock,
  assertRelayable,
  isRefusal,
  parseRelayRequest,
  releaseClaimLock,
  DEFAULT_MAX_FEE_PER_GAS_WEI,
  CLAIM_GAS_LIMIT,
  DEFAULT_MIN_RELAYER_BALANCE_WEI,
} from "@/lib/relay";

export const dynamic = "force-dynamic";

/// POST /api/relay/claim — manda el `claimAndBind` del dev y paga el gas.
///
/// Es la pieza que hace verdadera la promesa central: un builder que nunca tuvo ETH en Robinhood
/// Chain igual cobra. Toda la política anti-abuso vive en `lib/relay.ts`, con el porqué de cada
/// chequeo; esta ruta es sólo el cableado.
///
/// Si `RELAYER_PK` no está seteada, responde 503 y la web cae sola al camino de siempre (el dev
/// manda su propia transacción). O sea: se puede deployar sin relayer y prenderlo después.

function relayerAccount() {
  const pk = process.env.RELAYER_PK as Hex | undefined;
  if (!pk) return { error: "relayer not configured" as const };
  try {
    return { account: privateKeyToAccount(pk) };
  } catch {
    // Una PK mal formada tiraba FUERA de todo try y devolvía un 500 en vez del 503 con
    // fallback. El mensaje nunca incluye material de la llave.
    return { error: "RELAYER_PK is malformed" as const };
  }
}

export async function POST(req: NextRequest) {
  const relayer = relayerAccount();
  if ("error" in relayer) {
    return NextResponse.json({ error: relayer.error, relayed: false }, { status: 503 });
  }
  const account = relayer.account;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = parseRelayRequest(body);
  if (isRefusal(parsed)) {
    return NextResponse.json({ error: parsed.reason }, { status: parsed.status });
  }

  // EL CANDADO SE TOMA ACA, antes de cualquier `await` sobre la red.
  //
  // La version anterior chequeaba al entrar y marcaba recien despues de cuatro round-trips de
  // RPC: 25 pedidos concurrentes pasaban todos y se firmaban 25 transacciones (medido por un
  // revisor, en UNA sola instancia — un doble click alcanzaba). Node es monohilo entre `await`s,
  // asi que tomar el candado de forma sincrona cierra la carrera dentro de la instancia.
  const lockToken = Date.now();
  if (!acquireClaimLock(parsed.vault, lockToken)) {
    return NextResponse.json({ error: "a claim for this vault is already in flight" }, { status: 429 });
  }

  try {
    const refusal = await assertRelayable(parsed);
    if (refusal) {
      releaseClaimLock(parsed.vault, lockToken);
      return NextResponse.json({ error: refusal.reason }, { status: refusal.status });
    }

    // Piso de saldo: si el relayer está por quedarse sin gas, mejor decirlo que dejar el claim a
    // medio mandar. El usuario siempre puede firmar él mismo.
    const floor = process.env.RELAYER_MIN_BALANCE_WEI
      ? BigInt(process.env.RELAYER_MIN_BALANCE_WEI)
      : DEFAULT_MIN_RELAYER_BALANCE_WEI;
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance < floor) {
      releaseClaimLock(parsed.vault, lockToken);
      return NextResponse.json(
        { error: "relayer is out of gas — claim it yourself from the page", relayed: false },
        { status: 503 },
      );
    }

    // Techo de precio de gas. La barrera economica del diseño ("el launch cuesta mas que el gas")
    // es una afirmacion sobre el gas price y nada la sostenia: por encima de ~4,2 gwei se
    // invierte. Aca se ancla, y ademas evita pagar de mas en una congestion.
    const maxFeePerGas = process.env.RELAYER_MAX_FEE_WEI
      ? BigInt(process.env.RELAYER_MAX_FEE_WEI)
      : DEFAULT_MAX_FEE_PER_GAS_WEI;
    const fees = await publicClient.estimateFeesPerGas();
    if ((fees.maxFeePerGas ?? 0n) > maxFeePerGas) {
      releaseClaimLock(parsed.vault, lockToken);
      return NextResponse.json(
        { error: "gas is too expensive right now — claim it yourself from the page", relayed: false },
        { status: 503 },
      );
    }

    const args = [parsed.payout, BigInt(parsed.deadline), parsed.signature] as const;

    // Simular ANTES de firmar: un claim que revertiría no nos cuesta un wei. Se usa la MISMA
    // cuenta que después firma, para que la simulación valga.
    let request;
    try {
      const sim = await publicClient.simulateContract({
        address: parsed.vault,
        abi: escrowAbi,
        functionName: "claimAndBind",
        args,
        account,
        maxFeePerGas,
        // `gas` explicito: sin el, la estimacion acota por el gas limit del bloque (2^50 en esta
        // cadena) y el chequeo de saldo pide millones de ETH. Ver CLAIM_GAS_LIMIT.
        gas: CLAIM_GAS_LIMIT,
      });
      request = sim.request;
    } catch (e) {
      releaseClaimLock(parsed.vault, lockToken);
      return NextResponse.json(
        { error: `claim would revert: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` },
        { status: 409 },
      );
    }

    const wallet = createWalletClient({
      account,
      chain: robinhoodChain,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? undefined),
    });
    // Se manda EXACTAMENTE lo que se simuló.
    const hash = await wallet.writeContract(request);
    // El candado NO se suelta: la transacción ya salió, y la ventana de 90 s evita el reenvío.
    return NextResponse.json({ relayed: true, hash });
  } catch (e) {
    releaseClaimLock(parsed.vault, lockToken);
    return NextResponse.json(
      { error: e instanceof Error ? e.message.split("\n")[0] : String(e), relayed: false },
      { status: 502 },
    );
  }
}

/// GET /api/relay/claim — ¿puede la UI ofrecer el claim sin gas?
///
/// Devuelve SÓLO `enabled`. La versión anterior exponía la dirección y el saldo del relayer, que
/// es exactamente el tablero que un atacante querría para saber cuánto falta para vaciarlo — y
/// la UI nunca los usó. Es público en el explorer de todas formas, pero no hace falta servírselo.
export async function GET() {
  const relayer = relayerAccount();
  if ("error" in relayer) return NextResponse.json({ enabled: false });
  try {
    const floor = process.env.RELAYER_MIN_BALANCE_WEI
      ? BigInt(process.env.RELAYER_MIN_BALANCE_WEI)
      : DEFAULT_MIN_RELAYER_BALANCE_WEI;
    const balance = await publicClient.getBalance({ address: relayer.account.address });
    return NextResponse.json({ enabled: balance >= floor });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
