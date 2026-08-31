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
  decodeEventLog,
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
  { type: "function", name: "curve", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pendingAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  // El vault emite esto en `_pull()` SOLO si movio algo. Es la unica fuente honesta de "cuanto
  // se barrio de verdad": la simulacion previa es una prediccion, no un hecho.
  {
    type: "event",
    name: "Harvested",
    inputs: [{ name: "amount", type: "uint256", indexed: false }],
  },
];

const curveAbi = [
  { type: "function", name: "deployer", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];

const ZERO = "0x0000000000000000000000000000000000000000";

const args = process.argv.slice(2);
const SEND = args.includes("--send");
const watchIdx = args.indexOf("--watch");
let WATCH_S = 0;
if (watchIdx >= 0) {
  const raw = args[watchIdx + 1];
  // `--watch --send` (los flags al reves) hacia `Number("--send")` = NaN, `while (NaN > 0)` es
  // falso, y el proceso corria UNA pasada y salia con codigo 0 — el operador creia haber dejado
  // un daemon y tenia un one-shot, sin ninguna advertencia.
  if (raw === undefined) {
    WATCH_S = 900;
  } else if (/^\d+$/.test(raw)) {
    WATCH_S = Number(raw);
  } else {
    console.error(`--watch necesita segundos, recibi: "${raw}". Uso: --send --watch 900`);
    process.exit(1);
  }
  if (WATCH_S <= 0) {
    console.error("--watch tiene que ser mayor que cero");
    process.exit(1);
  }
}

/** Piso: un harvest cuesta ~0,000116 ETH de gas (medido), asi que no vale mover menos que esto. */
const MIN_HARVEST_WEI = parseWeiEnv("MIN_HARVEST_WEI", "200000000000000"); // 0,0002 ETH

/**
 * `??` no cubre la cadena VACIA, y `BigInt("")` es 0n: con `MIN_HARVEST_WEI=` en el env (que es
 * lo que pasa si alguien descomenta la linea del .env.example sin pegar el valor) el piso caia a
 * cero y el keeper mandaba una transaccion por vault en cada ciclo, quemando gas para siempre.
 * Y si alguien lo escribe en ETH (`0.0002`, que es como lo describe el propio comentario),
 * `BigInt` tiraba SyntaxError al cargar el modulo. Las dos entradas ahora se validan.
 */
function parseWeiEnv(name, fallback) {
  const raw = (process.env[name] ?? "").trim();
  if (raw === "") return BigInt(fallback);
  if (!/^\d+$/.test(raw)) {
    console.error(`${name} tiene que ser un entero EN WEI (no ETH, no decimales). Recibi: "${raw}"`);
    process.exit(1);
  }
  return BigInt(raw);
}

/** Piso de gas del propio keeper: por debajo de esto no vale la pena ni intentar. */
const MIN_KEEPER_BALANCE_WEI = parseWeiEnv("MIN_KEEPER_BALANCE_WEI", "2000000000000000"); // 0,002 ETH

/** El RPC público está detrás de Cloudflare y corta las ráfagas. Hay que espaciar. */
const RPC_GAP_MS = Number(process.env.RPC_GAP_MS ?? 250);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Suma los `Harvested(amount)` que emitio el vault en esta transaccion. Sin evento: cero. */
function harvestedFromReceipt(receipt) {
  let total = 0n;
  for (const log of receipt.logs ?? []) {
    try {
      const ev = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "Harvested") total += ev.args.amount;
    } catch {
      // logs de otros contratos en la misma tx (el escrow de pons, la curva)
    }
  }
  return total;
}

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
    // Antes se comparaba contra CERO, que 1 wei ya pasa. Un harvest cuesta ~0,000116 ETH.
    if (bal < MIN_KEEPER_BALANCE_WEI) {
      console.error(
        `el keeper no tiene gas suficiente (piso ${formatEther(MIN_KEEPER_BALANCE_WEI)} ETH) — no mando nada`,
      );
      return;
    }
  }

  let harvested = 0n;
  let sent = 0;
  let skipped = 0;

  let failed = 0;
  for (let i = 0n; i < total; i++) {
    // Un try POR VAULT: antes, una falla a mitad de pasada abortaba todos los vaults restantes
    // de ese ciclo y ni siquiera imprimia el resumen. Como `allVaults` esta ordenado por
    // antiguedad, la COLA —los vaults mas nuevos— era sistematicamente la que no se barria.
    try {
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

    // CANARIO DEL REDIRECT. `curve.deployer()` es el `creatorFeeRecipient` vigente. Si deja de
    // ser este vault, el owner de pons redirigio las fees — que es exactamente el evento contra
    // el que este keeper existe para defender. Sin este chequeo se veria igual que "no hay nada
    // que barrer": el `try/catch` vacio de `_sweepCurve()` se traga el revert y el vault se
    // contaria como `skipped`, en silencio.
    await sleep(RPC_GAP_MS);
    const recipient = await publicClient.readContract({
      address: await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "curve" }),
      abi: curveAbi,
      functionName: "deployer",
    });
    if (recipient.toLowerCase() !== vault.toLowerCase()) {
      console.error(
        `  ${vault}  !! ALERTA: las creator fees ya NO apuntan a este vault (ahora: ${recipient}).\n` +
          `     Es el redirect del owner de pons. Este keeper ya no puede barrer esa curva.`,
      );
      failed++;
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

    if (!SEND) {
      harvested += would;
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
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // SOLO SE CUENTA LO QUE SE MOVIO DE VERDAD.
      //
      // La version anterior sumaba `would` (la SIMULACION) antes de intentar la transaccion, asi
      // que un keeper que fallaba todo igual imprimia un total saludable en ETH. Y habia un caso
      // peor y silencioso: una tx EXITOSA que mueve cero, porque entre la simulacion y el envio
      // otro barrio la curva — muy alcanzable, el operador de pons barre en concurrencia. El
      // log salia impecable.
      //
      // El vault emite `Harvested(amount)` solo si movio algo: sin evento, se movio cero.
      if (receipt.status !== "success") {
        console.error(`  ${vault}  FALLO: la transaccion revirtio (tx ${hash})`);
        failed++;
        continue;
      }
      const moved = harvestedFromReceipt(receipt);
      harvested += moved;
      if (moved === 0n) {
        console.log(`  ${vault}  →  0 ETH (otro barrio primero)   tx ${hash}`);
      } else {
        console.log(`  ${vault}  →  ${formatEther(moved)} ETH   tx ${hash}`);
        sent++;
      }
    } catch (e) {
      console.error(`  ${vault}  FALLO: ${String(e).split("\n")[0]}`);
      failed++;
    }
    } catch (e) {
      console.error(`  vault #${i}  FALLO (sigo con los demas): ${String(e).split("\n")[0]}`);
      failed++;
    }
  }

  console.log(
    `resumen: ${SEND ? `${sent} barrido(s)` : "dry-run"} · ${formatEther(harvested)} ETH ` +
      `${SEND ? "movidos DE VERDAD" : "estimados"} · ${skipped} sin nada que hacer` +
      (failed ? ` · ⚠️ ${failed} con problemas` : ""),
  );
}

// La PRIMERA pasada tambien va dentro del try. Antes estaba afuera, asi que un rate-limit en
// rafaga la mataba con exit 1 y un stack crudo de viem — sin haber entrado nunca al modo watch,
// o sea con el barrido apagado. Y barrer seguido es la unica mitigacion del redirect retroactivo
// de pons, asi que un keeper que se apaga solo no es un bug de tooling.
let first = true;
do {
  if (!first) await sleep(WATCH_S * 1000);
  first = false;
  try {
    await pass();
  } catch (e) {
    console.error("pasada fallida:", String(e).split("\n")[0]);
    if (WATCH_S === 0) process.exitCode = 1;
  }
} while (WATCH_S > 0);
