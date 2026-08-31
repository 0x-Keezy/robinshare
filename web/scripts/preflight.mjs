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

/** El deploy son ~0,00192 ETH; cada launch 0,0005 + gas de 2 tx más. Con esto sobra. */
const NEEDED_DEPLOYER_WEI = 20_000_000_000_000_000n; // 0,02 ETH

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

    if (enabled) ok("el launch público de pons está ABIERTO");
    else bad("pons tiene el launch público CERRADO — sólo direcciones whitelisteadas pueden lanzar");

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
  if (!deployer || !isAddress(deployer)) {
    bad("falta DEPLOYER_ADDRESS — es la wallet que deploya y lanza");
  } else {
    await sleep(200);
    const bal = await client.getBalance({ address: deployer });
    if (bal >= NEEDED_DEPLOYER_WEI) ok(`deployer ${deployer} · ${formatEther(bal)} ETH`);
    else if (bal > 0n) bad(`deployer tiene ${formatEther(bal)} ETH — hacen falta al menos ${formatEther(NEEDED_DEPLOYER_WEI)}`);
    else bad(`deployer ${deployer} NO TIENE ETH en 4663`);
  }

  const attester = process.env.ATTESTER_ADDRESS;
  if (!attester || !isAddress(attester)) {
    bad("falta ATTESTER_ADDRESS — wallet nueva y dedicada (`cast wallet new`), SIN fondos");
  } else {
    await sleep(200);
    const bal = await client.getBalance({ address: attester });
    ok(`attester ${attester}`);
    if (bal > 0n) warn(`el attester tiene ${formatEther(bal)} ETH — debería estar vacío, sólo firma`);
    if (deployer && attester.toLowerCase() === deployer.toLowerCase()) {
      bad("ATTESTER_ADDRESS == DEPLOYER_ADDRESS. Tienen que ser wallets DISTINTAS: el attester es una llave de custodia sobre los vaults de GitHub");
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
        await sleep(200);
        const [onchainAttester, esc, pf, xv, n] = await Promise.all([
          client.readContract({ address: factory, abi: factoryAbi, functionName: "attester" }),
          client.readContract({ address: factory, abi: factoryAbi, functionName: "feeEscrow" }),
          client.readContract({ address: factory, abi: factoryAbi, functionName: "ponsFactory" }),
          client.readContract({ address: factory, abi: factoryAbi, functionName: "xVerifier" }),
          client.readContract({ address: factory, abi: factoryAbi, functionName: "allVaultsLength" }),
        ]);
        ok(`factory ${factory} · ${n} vault(s) creados`);
        if (esc.toLowerCase() === ESCROW.toLowerCase()) ok("feeEscrow correcto");
        else bad(`feeEscrow apunta a ${esc} — NO es el de pons`);
        if (pf.toLowerCase() === PONS.toLowerCase()) ok("ponsFactory correcto");
        else bad(`ponsFactory apunta a ${pf} — NO es pons`);
        if (xv.toLowerCase() === XVER.toLowerCase()) ok("xVerifier correcto");
        else warn(`xVerifier es ${xv} (los vaults de X dependen de esto)`);

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
      if (j.ok) ok(`${base} respondiendo 200 y con el attester coincidiendo`);
      else {
        bad(`${base}/api/health da ${res.status}`);
        console.log(`      ${JSON.stringify(j.checks ?? j)}`);
      }
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
    await sleep(200);
    const bal = await client.getBalance({ address: addr });
    if (bal >= 2000000000000000n) ok(`${label} ${addr} · ${formatEther(bal)} ETH`);
    else warn(`${label} ${addr} tiene ${formatEther(bal)} ETH — por debajo del piso de 0.002, se declara apagado`);
  }

  // ── veredicto ────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(70));
  if (blockers === 0) {
    console.log(`LISTO PARA LANZAR${warnings ? `  (con ${warnings} advertencia(s) — leelas)` : ""}`);
    console.log("\nsiguiente paso:");
    if (!factory) {
      console.log("  cd contracts && ATTESTER_ADDRESS=$ATTESTER_ADDRESS \\");
      console.log("    forge script script/DeployPons.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK");
    } else {
      console.log("  cd contracts && FACTORY=$NEXT_PUBLIC_FACTORY_ADDRESS ... \\");
      console.log("    forge script script/LaunchPons.s.sol --rpc-url robinhood --broadcast --private-key $DEPLOYER_PK");
    }
  } else {
    console.log(`NO SE PUEDE LANZAR TODAVÍA — ${blockers} bloqueante(s), ${warnings} advertencia(s)`);
    process.exitCode = 1;
  }
  console.log("─".repeat(70));
}

await main();
