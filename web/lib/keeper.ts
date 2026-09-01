import { createWalletClient, decodeEventLog, formatEther, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, robinhoodChain } from "./chain";

/// UNA sola implementación del barrido, para el cron de Vercel y para el CLI.
///
/// POR QUÉ EXISTE ESTE ARCHIVO. En pons las fees NO llegan solas al vault:
///
///     trades → se acumulan EN LA CURVA → sweepCurve() → escrow de pons → pull() → vault
///
/// El operador de pons no lo hace a tiempo (medido: en 404 s tradearon 118 curvas y se barrieron
/// 15). Mientras no se barre, dos cosas: el builder ve MENOS de lo que gano en su página, y ese
/// saldo sin barrer es exactamente lo que el owner de pons puede reapuntar retroactivamente.
///
/// Antes esta lógica vivía sólo en `scripts/keeper.mjs`, que hay que correr con `--watch` en una
/// computadora prendida para siempre. Se extrajo acá para que el cron y el CLI sean el MISMO
/// código: dos implementaciones del mismo barrido divergen, y la que corre en producción sería la
/// que nadie probó.

const ZERO = "0x0000000000000000000000000000000000000000";

const factoryAbi = [
  { type: "function", name: "allVaultsLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allVaults", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

const vaultAbi = [
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "curve", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  /// El vault lo emite en `_pull()` SÓLO si movió algo. Es la única fuente honesta de "cuánto se
  /// barrió de verdad": la simulación previa es una predicción, no un hecho.
  { type: "event", name: "Harvested", inputs: [{ name: "amount", type: "uint256", indexed: false }] },
] as const;

const curveAbi = [
  { type: "function", name: "deployer", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

/// Piso por vault: por debajo de esto el gas del harvest se come lo barrido.
export const DEFAULT_MIN_HARVEST_WEI = 200_000_000_000_000n; // 0,0002 ETH
/// Piso del keeper: un harvest cuesta ~0,000116 ETH. Comparar contra cero deja pasar 1 wei.
export const DEFAULT_MIN_KEEPER_BALANCE_WEI = 2_000_000_000_000_000n; // 0,002 ETH
/// El RPC público está detrás de Cloudflare y corta las ráfagas.
export const DEFAULT_RPC_GAP_MS = 250;

export type KeeperOptions = {
  factory: Address;
  /// Sin `send`, es un dry-run: simula y reporta, no manda una sola transacción.
  send?: boolean;
  keeperPk?: Hex;
  minHarvestWei?: bigint;
  minKeeperBalanceWei?: bigint;
  rpcGapMs?: number;
  /// Presupuesto de tiempo. En un cron serverless la corrida se corta sola, y sin esto el proceso
  /// muere a mitad de un vault sin dejar rastro de qué llegó a hacer.
  deadlineMs?: number;
};

export type KeeperVaultResult = {
  vault: Address;
  estado: "barrido" | "sin-nada" | "cero" | "sin-moneda" | "fallo" | "REDIRIGIDO";
  wei?: string;
  tx?: Hex;
  detalle?: string;
};

export type KeeperResult = {
  ok: boolean;
  vaults: number;
  revisados: number;
  barridos: number;
  fallidos: number;
  /// Lo que se movió DE VERDAD, leído de los eventos, no de la simulación.
  barridoWei: string;
  barridoEth: string;
  /// Vaults cuyas fees ya no apuntan al vault: es el redirect del owner de pons.
  alertas: string[];
  detalle: KeeperVaultResult[];
  aviso?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// Suma los `Harvested(amount)` de una transacción. Sin evento: cero.
function harvestedFromReceipt(logs: readonly { data: Hex; topics: readonly Hex[] }[]): bigint {
  let total = 0n;
  for (const log of logs) {
    try {
      const ev = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (ev.eventName === "Harvested") total += ev.args.amount as bigint;
    } catch {
      // logs de otros contratos en la misma tx
    }
  }
  return total;
}

export async function runKeeperPass(opts: KeeperOptions): Promise<KeeperResult> {
  const gap = opts.rpcGapMs ?? DEFAULT_RPC_GAP_MS;
  const minHarvest = opts.minHarvestWei ?? DEFAULT_MIN_HARVEST_WEI;
  const minBalance = opts.minKeeperBalanceWei ?? DEFAULT_MIN_KEEPER_BALANCE_WEI;
  const hastaMs = opts.deadlineMs ? Date.now() + opts.deadlineMs : Infinity;

  const detalle: KeeperVaultResult[] = [];
  const alertas: string[] = [];
  let barridos = 0;
  let fallidos = 0;
  let revisados = 0;
  let movido = 0n;

  const vacio = (aviso: string): KeeperResult => ({
    ok: false, vaults: 0, revisados: 0, barridos: 0, fallidos: 0,
    barridoWei: "0", barridoEth: "0", alertas, detalle, aviso,
  });

  let total: bigint;
  try {
    total = (await publicClient.readContract({
      address: opts.factory, abi: factoryAbi, functionName: "allVaultsLength",
    })) as bigint;
  } catch (e) {
    // El error crudo de viem es un stack de 40 líneas. Quien lee esto a las 3am necesita saber QUÉ
    // mirar, no cómo falla el decoder.
    return vacio(
      `no pude leer la factory en ${opts.factory}. ¿Es la RobinShareVaultFactory y no la de pons? ` +
        `¿Está deployada en esta red? Si el RPC devuelve HTML, es el rate-limit de Cloudflare. ` +
        `Detalle: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`,
    );
  }

  let account: ReturnType<typeof privateKeyToAccount> | null = null;
  let wallet: ReturnType<typeof createWalletClient> | null = null;
  if (opts.send) {
    if (!opts.keeperPk) return vacio("send=true pero no hay KEEPER_PK");
    account = privateKeyToAccount(opts.keeperPk);
    const bal = await publicClient.getBalance({ address: account.address });
    if (bal < minBalance) {
      return vacio(
        `el keeper ${account.address} tiene ${formatEther(bal)} ETH, por debajo del piso ` +
          `${formatEther(minBalance)}. No mando nada.`,
      );
    }
    wallet = createWalletClient({ account, chain: robinhoodChain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
  }

  for (let i = 0n; i < total; i++) {
    // Un try POR VAULT: antes, una falla a mitad de pasada abortaba los vaults restantes. Como
    // `allVaults` está ordenado por antigüedad, la COLA —los más nuevos— era sistemáticamente la
    // que no se barría.
    if (Date.now() > hastaMs) {
      return {
        ok: true, vaults: Number(total), revisados, barridos, fallidos,
        barridoWei: movido.toString(), barridoEth: formatEther(movido), alertas, detalle,
        aviso: `corte por tiempo tras ${revisados} de ${total} vaults — la próxima corrida sigue`,
      };
    }
    try {
      await sleep(gap);
      const vault = (await publicClient.readContract({
        address: opts.factory, abi: factoryAbi, functionName: "allVaults", args: [i],
      })) as Address;
      revisados++;

      await sleep(gap);
      const token = (await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "token" })) as Address;
      if (token.toLowerCase() === ZERO) {
        // sin moneda atada, `sweepCurve()` es un no-op: no hay curva que barrer
        detalle.push({ vault, estado: "sin-moneda" });
        continue;
      }

      // CANARIO DEL REDIRECT. `curve.deployer()` es el `creatorFeeRecipient` vigente. Si deja de
      // ser este vault, el owner de pons redirigió las fees — que es exactamente el evento contra
      // el que este keeper existe. Sin el chequeo se vería igual que "no hay nada que barrer": el
      // try/catch vacío de `_sweepCurve()` se traga el revert y el vault se cuenta como saltado.
      await sleep(gap);
      const curve = (await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "curve" })) as Address;
      await sleep(gap);
      const recipient = (await publicClient.readContract({ address: curve, abi: curveAbi, functionName: "deployer" })) as Address;
      if (recipient.toLowerCase() !== vault.toLowerCase()) {
        const msg = `${vault}: las creator fees ya NO apuntan a este vault (ahora: ${recipient}). Es el redirect del owner de pons.`;
        alertas.push(msg);
        detalle.push({ vault, estado: "REDIRIGIDO", detalle: recipient });
        fallidos++;
        continue;
      }

      // Simular `harvest()` dice EXACTAMENTE cuánto saldría, incluido lo que hoy está en la curva
      // — que es justo lo que `pendingAmount()` no ve. Es un eth_call: no cuesta gas.
      let would = 0n;
      try {
        await sleep(gap);
        const sim = await publicClient.simulateContract({
          address: vault, abi: vaultAbi, functionName: "harvest",
          account: account?.address ?? "0x000000000000000000000000000000000000dEaD",
        });
        would = (sim.result as bigint) ?? 0n;
      } catch (e) {
        detalle.push({ vault, estado: "fallo", detalle: `simulación: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` });
        continue;
      }

      if (would < minHarvest) {
        detalle.push({ vault, estado: "sin-nada", wei: would.toString() });
        continue;
      }

      if (!opts.send || !wallet || !account) {
        movido += would;
        detalle.push({ vault, estado: "barrido", wei: would.toString(), detalle: "DRY-RUN" });
        barridos++;
        continue;
      }

      const hash = await wallet.writeContract({
        address: vault, abi: vaultAbi, functionName: "harvest", chain: robinhoodChain, account,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        detalle.push({ vault, estado: "fallo", tx: hash, detalle: "la transacción revirtió" });
        fallidos++;
        continue;
      }
      // SÓLO SE CUENTA LO QUE SE MOVIÓ DE VERDAD. Sumar la simulación hacía que un keeper que
      // fallaba todo igual reportara un total saludable — y hay un caso peor y silencioso: una tx
      // EXITOSA que mueve cero, porque entre simular y enviar otro barrió la curva (el operador de
      // pons barre en concurrencia).
      const moved = harvestedFromReceipt(receipt.logs);
      movido += moved;
      if (moved === 0n) {
        detalle.push({ vault, estado: "cero", tx: hash, detalle: "otro barrió primero" });
      } else {
        detalle.push({ vault, estado: "barrido", wei: moved.toString(), tx: hash });
        barridos++;
      }
    } catch (e) {
      fallidos++;
      detalle.push({ vault: ZERO as Address, estado: "fallo", detalle: `vault #${i}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` });
    }
  }

  return {
    ok: fallidos === 0,
    vaults: Number(total),
    revisados,
    barridos,
    fallidos,
    barridoWei: movido.toString(),
    barridoEth: formatEther(movido),
    alertas,
    detalle,
  };
}
