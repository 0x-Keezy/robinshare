#!/usr/bin/env node
/**
 * keeper.mjs — barre las creator fees de cada vault de RobinShare, cada tanto.
 *
 * POR QUE EXISTE. En pons las fees NO llegan solas al vault. Se acumulan en la curva del token, y
 * alguien tiene que empujarlas:
 *
 *     trades → se acumulan EN LA CURVA → sweepCurve() → escrow de pons → pull() → vault
 *
 * El operador de pons no lo hace a tiempo: medido, en una ventana de 404 s tradearon 118 curvas y
 * se barrieron 15. Eso importa por dos cosas distintas:
 *
 *   1. La página del claim muestra menos de lo que hay. `pendingAmount()` cuenta lo que está en
 *      el vault más lo acreditado en el escrow, pero NO lo que sigue en la curva. (No se pierde:
 *      `claimAndBind` y `withdraw()` barren por dentro. Pero el número que ve el dev es falso.)
 *   2. La que de verdad importa: el owner de pons puede reapuntar el `creatorFeeRecipient` de
 *      cualquier token con 3 días de aviso, y **el cambio es retroactivo sobre todo lo que no se
 *      haya barrido**. Barrer seguido achica esa ventana a casi nada. Es la única mitigación que
 *      existe, y el spec la nombra como tal.
 *
 * `harvest()` es PERMISSIONLESS: esta wallet no necesita ningún privilegio, sólo gas. Si se
 * pierde, no se pierde nada más que la automatización.
 *
 * USO
 *   cd web
 *   KEEPER_PK=0x... NEXT_PUBLIC_FACTORY_ADDRESS=0x... node scripts/keeper.mjs          # dry-run
 *   KEEPER_PK=0x... NEXT_PUBLIC_FACTORY_ADDRESS=0x... node scripts/keeper.mjs --send   # de verdad
 *   ... --send --watch 900        # y cada 15 minutos, para dejarlo corriendo
 *
 * Por default NO manda nada: imprime qué haría. Hay que pedir `--send` explícitamente.
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const factoryAbi = [
  { type: "function", name: "allVaultsLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "allVaults",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }],
  },
];

const vaultAbi = [
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pendingAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

const ZERO = "0x0000000000000000000000000000000000000000";

const args = process.argv.slice(2);
const SEND = args.includes("--send");
const watchIdx = args.indexOf("--watch");
const WATCH_S = watchIdx >= 0 ? Number(args[watchIdx + 1] ?? 900) : 0;

/** Piso: no gastar ~0,00004 ETH de gas para mover menos que eso. */
const MIN_HARVEST_WEI = BigInt(process.env.MIN_HARVEST_WEI ?? "200000000000000"); // 0,0002 ETH

/** El RPC público está detrás de Cloudflare y corta las ráfagas. Hay que espaciar. */
const RPC_GAP_MS = Number(process.env.RPC_GAP_MS ?? 250);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`falta ${name}`);
    process.exit(1);
  }
  return v;
}

const FACTORY = requireEnv("NEXT_PUBLIC_FACTORY_ADDRESS");
const publicClient = createPublicClient({ chain: robinhood, transport: http(RPC) });

let account = null;
let wallet = null;
if (SEND) {
  account = privateKeyToAccount(requireEnv("KEEPER_PK"));
  wallet = createWalletClient({ account, chain: robinhood, transport: http(RPC) });
}

async function pass() {
  const started = new Date().toISOString();
  let total;
  try {
    total = await publicClient.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "allVaultsLength",
    });
  } catch (e) {
    // El error crudo de viem es un stack de 40 lineas. Quien corre esto a las 3am necesita
    // saber QUE mirar, no como falla el decoder.
    console.error(
      [
        `no pude leer la factory en ${FACTORY} (${RPC}).`,
        `  · ¿es la direccion de la RobinShareVaultFactory, y no la de pons?`,
        `  · ¿esta deployada en esta red?`,
        `  · si el RPC devuelve HTML, es el rate-limit de Cloudflare: subí RPC_GAP_MS.`,
        `  detalle: ${String(e).split("\n")[0]}`,
      ].join("\n"),
    );
    return;
  }

  console.log(`\n[${started}] ${total} vault(s) en la factory${SEND ? "" : "  ·  DRY-RUN (usá --send)"}`);

  if (SEND) {
    const bal = await publicClient.getBalance({ address: account.address });
    console.log(`keeper ${account.address} · saldo ${formatEther(bal)} ETH`);
    if (bal === 0n) {
      console.error("el keeper no tiene gas — no hay nada que hacer");
      return;
    }
  }

  let harvested = 0n;
  let sent = 0;
  let skipped = 0;

  for (let i = 0n; i < total; i++) {
    await sleep(RPC_GAP_MS);
    const vault = await publicClient.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "allVaults",
      args: [i],
    });

    await sleep(RPC_GAP_MS);
    const token = await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "token" });
    if (token.toLowerCase() === ZERO) {
      // sin moneda atada, `sweepCurve()` es un no-op: no hay curva que barrer
      skipped++;
      continue;
    }

    // Simular `harvest()` dice EXACTAMENTE cuánto saldría, incluido lo que hoy está en la curva
    // — que es justo lo que `pendingAmount()` no ve. Es un eth_call: no cuesta gas.
    let would = 0n;
    try {
      await sleep(RPC_GAP_MS);
      const sim = await publicClient.simulateContract({
        address: vault,
        abi: vaultAbi,
        functionName: "harvest",
        account: account?.address ?? "0x000000000000000000000000000000000000dEaD",
      });
      would = sim.result ?? 0n;
    } catch (e) {
      console.log(`  ${vault}  simulación falló: ${String(e).split("\n")[0]}`);
      skipped++;
      continue;
    }

    if (would < MIN_HARVEST_WEI) {
      skipped++;
      continue;
    }

    harvested += would;
    if (!SEND) {
      console.log(`  ${vault}  →  barrería ${formatEther(would)} ETH`);
      continue;
    }

    try {
      const hash = await wallet.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "harvest",
        chain: robinhood,
      });
      console.log(`  ${vault}  →  ${formatEther(would)} ETH   tx ${hash}`);
      sent++;
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      console.error(`  ${vault}  FALLO: ${String(e).split("\n")[0]}`);
    }
  }

  console.log(
    `resumen: ${SEND ? `${sent} barrido(s)` : "dry-run"} · ${formatEther(harvested)} ETH ` +
      `· ${skipped} sin nada que hacer`,
  );
}

await pass();
while (WATCH_S > 0) {
  await sleep(WATCH_S * 1000);
  try {
    await pass();
  } catch (e) {
    console.error("pasada fallida:", String(e).split("\n")[0]);
  }
}
