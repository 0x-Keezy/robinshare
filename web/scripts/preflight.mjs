#!/usr/bin/env node
/**
 * preflight.mjs — "¿puedo lanzar hoy?", en un solo comando.
 *
 * Chequea TODO lo que se puede saber sin gastar un wei y sin firmar nada: que el rail de pons
 * siga donde lo dejamos, que las wallets tengan lo que tienen que tener, que la factory (si ya
 * está deployada) esté bien cableada, y que la web esté conectada.
 *
 * NO manda transacciones. NO necesita ninguna private key: se le pasan DIRECCIONES.
 *
 * USO
 *   cd web
 *   DEPLOYER_ADDRESS=0x... ATTESTER_ADDRESS=0x... node scripts/preflight.mjs
 *
 *   # y después del deploy, sumando lo que ya exista:
 *   DEPLOYER_ADDRESS=0x... ATTESTER_ADDRESS=0x... \
 *   NEXT_PUBLIC_FACTORY_ADDRESS=0x... APP_BASE_URL=https://robinshare.vercel.app \
 *   RELAYER_ADDRESS=0x... KEEPER_ADDRESS=0x... node scripts/preflight.mjs
 *
 * Sale con código 1 si falta algo BLOQUEANTE, 0 si se puede lanzar.
 */

import { createPublicClient, defineChain, formatEther, http, isAddress } from "viem";

const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const PONS = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";
const XVER = "0xccDaB0d5Bc6E0aCb8B157cffFA062688Aa849c17";

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ponsAbi = [
  { type: "function", name: "launchEnabled", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "launchFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxCreatorTaxBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "launchConfigCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "canLaunch",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }],
  },
];

const factoryAbi = [
  { type: "function", name: "attester", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "attesterAdmin", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "feeEscrow", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "ponsFactory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "xVerifier", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "allVaultsLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
];

const client = createPublicClient({ chain: robinhood, transport: http(RPC) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Todo lo que toca la red pasa por aca: espaciado y con el error atrapado.
 *
 * El RPC publico esta detras de Cloudflare y corta las rafagas. Antes los `getBalance` de las
 * secciones 3 y 6 no estaban envueltos, asi que un 403 mataba el proceso con 30 lineas de stack
 * de viem, SIN veredicto y sin el hint de Cloudflare — justo lo contrario de lo que un preflight
 * tiene que hacer.
 */
/**
 * Diagnostico preciso de una direccion. `isAddress` de viem valida el CHECKSUM, asi que rechaza
 * una direccion con el casing mezclado mal — lo cual esta bien (casi siempre es un typo o un
 * paste corrupto), pero "no es una direccion valida" a secas no le dice a nadie que hacer.
 * Minusculas y checksum correcto pasan las dos, que es como llega una direccion pegada.
 */
function addressProblem(value) {
  if (!value) return "falta";
  const v = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) {
    return `no tiene la forma de una direccion (0x + 40 hex). Recibi: "${v}"`;
  }
  if (!isAddress(v)) {
    return `el checksum no cierra — suele ser un typo o un caracter perdido al copiar. Probá pegarla en MINÚSCULAS: ${v.toLowerCase()}`;
  }
  return null;
}

async function balanceOf(address) {
  try {
    await sleep(200);
    return await client.getBalance({ address });
  } catch {
    return null;
  }
}

let blockers = 0;
let warnings = 0;
const ok = (m) => console.log(`  ✅  ${m}`);
const warn = (m) => {
  warnings++;
  console.log(`  ⚠️   ${m}`);
};
const bad = (m) => {
  blockers++;
  console.log(`  ❌  ${m}`);
};
const section = (t) => console.log(`\n${t}`);

/**
 * Medido en fork: deploy ~0,00215 + launch (fee 0,0005 + ~0,0037 de gas) ≈ 0,0065 ETH. La
 * transaccion cara es `launchToken`, que despliega el token Y la curva (8,26M de gas) — el gas
 * es ~7x la fee, no un redondeo.
 *
 * Se separan dos umbrales a proposito: por debajo del MINIMO no alcanza y es bloqueante; entre el
 * minimo y el COMODO alcanza pero sin margen si pons sube la fee o el gas pica, y eso es una
 * advertencia. Antes 0,02 era bloqueante y rechazaba una wallet con 0,01, que habria alcanzado.
 */
const MIN_DEPLOYER_WEI = 8_000_000_000_000_000n; // 0,008 ETH — lo medido, con poco margen
const COMFY_DEPLOYER_WEI = 20_000_000_000_000_000n; // 0,02 ETH

async function main() {
  console.log("PREFLIGHT — RobinShare sobre pons v2 (Robinhood Chain 4663)");
  console.log(`RPC: ${RPC}`);

  // ── 1. la cadena ─────────────────────────────────────────────────────────
  section("1 · la cadena");
  try {
    const id = await client.getChainId();
    if (id === 4663) ok(`conectado a Robinhood Chain (${id})`);
    else bad(`el RPC responde chainId ${id}, esperaba 4663`);
  } catch (e) {
    bad(`no pude hablar con el RPC: ${String(e).split("\n")[0]}`);
    console.log("\n(si devuelve HTML es el rate-limit de Cloudflare — esperá y reintentá)");
    // El `return` salteaba el bloque de veredicto, que es donde vive el unico
    // `process.exitCode = 1` — asi que el script salia con 0 diciendo que no pudo conectarse.
    process.exitCode = 1;
    return;
  }

  // ── 2. el rail de pons ───────────────────────────────────────────────────
  section("2 · el rail de pons (estado MUTABLE: puede cambiar sin avisarnos)");
  let fee;
  try {
    await sleep(200);
    const enabled = await client.readContract({ address: PONS, abi: ponsAbi, functionName: "launchEnabled" });
    await sleep(200);
    fee = await client.readContract({ address: PONS, abi: ponsAbi, functionName: "launchFee" });
    await sleep(200);
    const maxTax = await client.readContract({ address: PONS, abi: ponsAbi, functionName: "maxCreatorTaxBps" });
    await sleep(200);
    const configs = await client.readContract({ address: PONS, abi: ponsAbi, functionName: "launchConfigCount" });

    if (enabled) {
      ok("el launch público de pons está ABIERTO");
    } else {
      // `canLaunch` = launchEnabled || whitelistedLaunchers[addr]. Con el gate cerrado, un
      // deployer whitelisteado SI puede lanzar: declararlo bloqueante seria un falso bloqueo.
      const d = process.env.DEPLOYER_ADDRESS;
      let whitelisted = false;
      if (d && isAddress(d)) {
        try {
          await sleep(200);
          whitelisted = await client.readContract({
            address: PONS, abi: ponsAbi, functionName: "canLaunch", args: [d],
          });
        } catch { /* se trata como no whitelisteado */ }
      }
      if (whitelisted) warn("pons tiene el launch público CERRADO, pero tu deployer está whitelisteado");
      else bad("pons tiene el launch público CERRADO — sólo direcciones whitelisteadas pueden lanzar");
    }

    if (fee === 500000000000000n) ok(`launchFee ${formatEther(fee)} ETH (igual a lo medido)`);
    else warn(`launchFee CAMBIÓ: ahora ${formatEther(fee)} ETH (lo medido era 0.0005)`);

    if (maxTax === 1000n) ok(`maxCreatorTaxBps ${maxTax} (igual a lo medido)`);
    else warn(`maxCreatorTaxBps CAMBIÓ: ahora ${maxTax} (lo medido era 1000)`);

    if (configs >= 1n) ok(`launchConfigCount ${configs}`);
    else bad("pons no tiene ningún launch config habilitado");
  } catch (e) {
    bad(`no pude leer la config de pons: ${String(e).split("\n")[0]}`);
  }

  // ── 3. las wallets ───────────────────────────────────────────────────────
  section("3 · las wallets (se pasan como DIRECCIONES, nunca como private keys)");

  const deployer = process.env.DEPLOYER_ADDRESS;
  const deployerProblem = addressProblem(deployer);
  if (deployerProblem) {
    bad(`DEPLOYER_ADDRESS (la wallet que deploya y lanza): ${deployerProblem}`);
  } else {
    const bal = await balanceOf(deployer);
    if (bal === null) warn(`no pude leer el saldo del deployer (RPC)`);
    else if (bal >= COMFY_DEPLOYER_WEI) ok(`deployer ${deployer} · ${formatEther(bal)} ETH`);
    else if (bal >= MIN_DEPLOYER_WEI)
      warn(`deployer ${deployer} · ${formatEther(bal)} ETH — alcanza (hace falta ~0.0065) pero sin margen`);
    else if (bal > 0n)
      bad(`deployer tiene ${formatEther(bal)} ETH — hacen falta al menos ${formatEther(MIN_DEPLOYER_WEI)}`);
    else bad(`deployer ${deployer} NO TIENE ETH en 4663`);
  }

  const attester = process.env.ATTESTER_ADDRESS;
  const attesterProblem = addressProblem(attester);
  if (attesterProblem) {
    bad(`ATTESTER_ADDRESS (wallet nueva de \`cast wallet new\`, SIN fondos): ${attesterProblem}`);
  } else {
    const bal = await balanceOf(attester);
    ok(`attester ${attester}`);
    if (bal !== null && bal > 0n) warn(`el attester tiene ${formatEther(bal)} ETH — debería estar vacío, sólo firma`);
    if (deployer && !deployerProblem && attester.toLowerCase() === deployer.toLowerCase()) {
      bad("ATTESTER_ADDRESS == DEPLOYER_ADDRESS. Tienen que ser wallets DISTINTAS: el attester es una llave de custodia sobre los vaults de GitHub");
    }
  }

  // Decision de Jose (PENDIENTES §3): `attesterAdmin` = wallet FRIA distinta del deployer y del
  // attester. Se verifica que sea asi, y despues del deploy que la de la cadena sea esa misma.
  const admin = process.env.ATTESTER_ADMIN;
  if (!admin) {
    warn("sin ATTESTER_ADMIN no puedo verificar la decisión de PENDIENTES §3");
  } else if (admin === "0" || /^0x0{40}$/.test(admin)) {
    warn("ATTESTER_ADMIN = 0x0 (sin sucesor). Ojo: PENDIENTES §3 decidió una wallet fría distinta");
  } else if (addressProblem(admin)) {
    bad(`ATTESTER_ADMIN: ${addressProblem(admin)}`);
  } else {
    ok(`attesterAdmin ${admin}`);
    if (deployer && admin.toLowerCase() === deployer.toLowerCase()) {
      bad("ATTESTER_ADMIN == DEPLOYER_ADDRESS — concentra deployar, lanzar y alcanzar los vaults de GitHub en una sola llave");
    }
    if (attester && admin.toLowerCase() === attester.toLowerCase()) {
      bad("ATTESTER_ADMIN == ATTESTER_ADDRESS — no da ninguna sucesión: si se pierde esa llave, se pierden las dos");
    }
  }

  // ── 4. la factory ────────────────────────────────────────────────────────
  section("4 · la factory");
  const factory = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!factory || !isAddress(factory)) {
    warn("todavía no hay factory deployada (es el próximo paso: script/DeployPons.s.sol)");
  } else {
    try {
      await sleep(200);
      const code = await client.getCode({ address: factory });
      if (!code || code === "0x") {
        bad(`no hay contrato en ${factory}`);
      } else {
        // En serie, no en `Promise.all`: era la UNICA rafaga del script y contradecia el
        // `sleep(200)` de todo el resto — justo la forma que dispara el challenge de Cloudflare,
        // y encima sobre la verificacion mas importante (un fallo aca marcaba BLOQUEANTE).
        const read = async (fn) => {
          await sleep(200);
          return client.readContract({ address: factory, abi: factoryAbi, functionName: fn });
        };
        const onchainAttester = await read("attester");
        const esc = await read("feeEscrow");
        const pf = await read("ponsFactory");
        const xv = await read("xVerifier");
        const n = await read("allVaultsLength");
        ok(`factory ${factory} · ${n} vault(s) creados`);
        if (esc.toLowerCase() === ESCROW.toLowerCase()) ok("feeEscrow correcto");
        else bad(`feeEscrow apunta a ${esc} — NO es el de pons`);
        if (pf.toLowerCase() === PONS.toLowerCase()) ok("ponsFactory correcto");
        else bad(`ponsFactory apunta a ${pf} — NO es pons`);
        if (xv.toLowerCase() === XVER.toLowerCase()) ok("xVerifier correcto");
        else warn(`xVerifier es ${xv} (los vaults de X dependen de esto)`);

        if (admin && isAddress(admin)) {
          const onchainAdmin = await read("attesterAdmin");
          if (onchainAdmin.toLowerCase() === admin.toLowerCase()) ok("attesterAdmin on-chain coincide");
          else bad(`el attesterAdmin de la factory es ${onchainAdmin}, distinto del que elegiste (${admin}) — es INMUTABLE, habría que redeployar`);
        }

        if (attester && onchainAttester.toLowerCase() !== attester.toLowerCase()) {
          bad(`el attester de la factory es ${onchainAttester}, pero ATTESTER_ADDRESS es ${attester} — TODO claim de GitHub va a fallar`);
        } else if (attester) {
          ok("el attester on-chain coincide con ATTESTER_ADDRESS");
        }
      }
    } catch (e) {
      bad(`no pude leer la factory: ${String(e).split("\n")[0]}`);
    }
  }

  // ── 5. la web ────────────────────────────────────────────────────────────
  section("5 · la web");
  const base = process.env.APP_BASE_URL;
  if (!base) {
    warn("sin APP_BASE_URL no puedo chequear la web deployada");
  } else {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/health`);
      const j = await res.json();
      const c = j.checks ?? {};

      // NO alcanza con mirar `j.ok`. `/api/health` calcula su `ok` contra SU PROPIA
      // NEXT_PUBLIC_FACTORY_ADDRESS: si Vercel tiene una factory distinta de la que estamos por
      // usar, devuelve ok:true porque su factory y su attester coinciden ENTRE SI — y el
      // preflight decia "LISTO" mientras cada vault que lancemos seria desconocido para esa web
      // (`/claim/<vault>` la rechaza con `isVault`). Hay que comparar los dos lados.
      if (!j.ok) {
        bad(`${base}/api/health da ${res.status}`);
        console.log(`      ${JSON.stringify(c)}`);
      } else {
        ok(`${base} respondiendo 200`);
      }

      if (factory && typeof c.factory === "string" && c.factory.startsWith("0x")) {
        if (c.factory.toLowerCase() === factory.toLowerCase()) {
          ok("la web apunta a la MISMA factory que vas a usar");
        } else {
          bad(
            `la web apunta a la factory ${c.factory}, pero vos vas a usar ${factory} — ` +
              `los vaults que lances no van a existir para /claim`,
          );
        }
      } else if (factory) {
        bad(`la web no tiene NEXT_PUBLIC_FACTORY_ADDRESS configurada (${c.factory})`);
      }

      if (attester && typeof c.factoryAttester === "string" && c.factoryAttester.startsWith("0x")) {
        if (c.factoryAttester.toLowerCase() !== attester.toLowerCase()) {
          bad(`el attester que ve la web es ${c.factoryAttester}, distinto de ATTESTER_ADDRESS`);
        }
      }

      // Estos se reportan en /api/health pero NO afectan su `ok`, asi que el health puede dar
      // 200 con el OAuth sin configurar — y sin OAuth el claim de GitHub es imposible, que es
      // justo el paso siguiente del runbook.
      const env = c.env ?? {};
      if (env.githubOAuth === false) bad("la web NO tiene el OAuth de GitHub configurado — el claim va a ser imposible");
      else if (env.githubOAuth) ok("OAuth de GitHub configurado");
      if (env.stateSecret === false) bad("falta ATTESTER_STATE_SECRET en la web");
      if (env.appBaseUrl === "MISSING") bad("falta APP_BASE_URL en la web");
    } catch (e) {
      bad(`no pude consultar ${base}: ${String(e).split("\n")[0]}`);
    }
  }

  // ── 6. las piezas opcionales ─────────────────────────────────────────────
  section("6 · relayer y keeper (opcionales — el producto funciona sin ellos)");
  for (const [label, envName, why] of [
    ["relayer", "RELAYER_ADDRESS", "sin él, el dev paga su propio gas para cobrar"],
    ["keeper", "KEEPER_ADDRESS", "sin él, hay que correr harvest() a mano"],
  ]) {
    const addr = process.env[envName];
    if (!addr || !isAddress(addr)) {
      warn(`${label}: sin fondear — ${why}`);
      continue;
    }
    const bal = await balanceOf(addr);
    if (bal === null) warn(`${label} ${addr}: no pude leer el saldo (RPC)`);
    else if (bal >= 2000000000000000n) ok(`${label} ${addr} · ${formatEther(bal)} ETH`);
    else warn(`${label} ${addr} tiene ${formatEther(bal)} ETH — por debajo del piso de 0.002, se declara apagado`);
  }

  // ── veredicto ────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(70));
  if (blockers === 0) {
    console.log(`LISTO PARA LANZAR${warnings ? `  (con ${warnings} advertencia(s) — leelas)` : ""}`);
    console.log("\nsiguiente paso:");
    // `cd ../contracts` y no `cd contracts`: esto se corre desde `web/`.
    if (!factory) {
      console.log("  cd ../contracts && ATTESTER_ADDRESS=$ATTESTER_ADDRESS \\");
      console.log("    forge script script/DeployPons.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK");
    } else {
      console.log("  cd ../contracts && FACTORY=$NEXT_PUBLIC_FACTORY_ADDRESS ... \\");
      console.log("    forge script script/LaunchPons.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK");
    }
  } else {
    console.log(`NO SE PUEDE LANZAR TODAVÍA — ${blockers} bloqueante(s), ${warnings} advertencia(s)`);
    process.exitCode = 1;
  }
  console.log("─".repeat(70));
}

await main();
