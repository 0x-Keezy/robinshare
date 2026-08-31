import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, robinhoodChain } from "@/lib/chain";
import { escrowAbi } from "@/lib/abis";
import {
  assertRelayable,
  claimInFlight,
  clearInFlight,
  isRefusal,
  markInFlight,
  parseRelayRequest,
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
export async function POST(req: NextRequest) {
  const pk = process.env.RELAYER_PK as Hex | undefined;
  if (!pk) {
    return NextResponse.json(
      { error: "relayer not configured", relayed: false },
      { status: 503 },
    );
  }

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

  if (claimInFlight(parsed.vault)) {
    return NextResponse.json({ error: "a claim for this vault is already in flight" }, { status: 429 });
  }

  const refusal = await assertRelayable(parsed);
  if (refusal) {
    return NextResponse.json({ error: refusal.reason }, { status: refusal.status });
  }

  const account = privateKeyToAccount(pk);

  // Piso de saldo: si el relayer está por quedarse sin gas, mejor decirlo que dejar el claim a
  // medio mandar. El usuario siempre puede firmar él mismo.
  const floor = process.env.RELAYER_MIN_BALANCE_WEI
    ? BigInt(process.env.RELAYER_MIN_BALANCE_WEI)
    : DEFAULT_MIN_RELAYER_BALANCE_WEI;
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance < floor) {
    return NextResponse.json(
      { error: "relayer is out of gas — claim it yourself from the page", relayed: false },
      { status: 503 },
    );
  }

  const args = [parsed.payout, BigInt(parsed.deadline), parsed.signature] as const;

  try {
    // Simular ANTES de firmar: un claim que revertiría no nos cuesta un wei.
    await publicClient.simulateContract({
      address: parsed.vault,
      abi: escrowAbi,
      functionName: "claimAndBind",
      args,
      account,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `claim would revert: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` },
      { status: 409 },
    );
  }

  markInFlight(parsed.vault);
  try {
    const wallet = createWalletClient({
      account,
      chain: robinhoodChain,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? undefined),
    });
    const hash = await wallet.writeContract({
      address: parsed.vault,
      abi: escrowAbi,
      chain: robinhoodChain,
      functionName: "claimAndBind",
      args,
    });
    return NextResponse.json({ relayed: true, hash });
  } catch (e) {
    clearInFlight(parsed.vault);
    return NextResponse.json(
      { error: e instanceof Error ? e.message.split("\n")[0] : String(e), relayed: false },
      { status: 502 },
    );
  }
}

/// GET /api/relay/claim — estado del relayer, para el health check y para que la UI sepa si
/// puede ofrecer el claim gratis. NUNCA devuelve la private key, sólo la dirección y el saldo.
export async function GET() {
  const pk = process.env.RELAYER_PK as Hex | undefined;
  if (!pk) return NextResponse.json({ enabled: false, reason: "RELAYER_PK not set" });
  try {
    const account = privateKeyToAccount(pk);
    const balance = await publicClient.getBalance({ address: account.address });
    const floor = process.env.RELAYER_MIN_BALANCE_WEI
      ? BigInt(process.env.RELAYER_MIN_BALANCE_WEI)
      : DEFAULT_MIN_RELAYER_BALANCE_WEI;
    return NextResponse.json({
      enabled: balance >= floor,
      address: account.address,
      balanceWei: balance.toString(),
      floorWei: floor.toString(),
    });
  } catch (e) {
    return NextResponse.json(
      { enabled: false, reason: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
