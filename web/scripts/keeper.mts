/**
 * keeper.mts — el mismo barrido que corre el cron, a mano.
 *
 *   cd web
 *   NEXT_PUBLIC_FACTORY_ADDRESS=0x... npx tsx scripts/keeper.mts            # dry-run
 *   KEEPER_PK=0x... NEXT_PUBLIC_FACTORY_ADDRESS=0x... npx tsx scripts/keeper.mts --send
 *
 * Sin `--send` no manda una sola transaccion: imprime que haria.
 *
 * POR QUE ES .mts Y NO .mjs. La logica vive en `lib/keeper.ts` y la comparten esta CLI y
 * `app/api/cron/keeper/route.ts`. Antes estaba entera aca, en un .mjs que node corre solo — y
 * cuando aparecio el cron, la alternativa era duplicarla. Dos implementaciones del mismo barrido
 * divergen, y la que corre en produccion seria justo la que nadie probo a mano. Un .mts con tsx
 * puede importar el TypeScript compartido; ese es todo el motivo del cambio de extension.
 *
 * EL CRON YA NO NECESITA ESTO. Vercel corre /api/cron/keeper cada 15 minutos (vercel.json). Esta
 * CLI queda para mirar el estado sin tocar nada, o para forzar una pasada.
 */
import { formatEther } from "viem";
import { runKeeperPass } from "../lib/keeper";
import { factoryAddress } from "../lib/chain";
import type { Hex } from "viem";

const send = process.argv.includes("--send");
const factory = factoryAddress();

if (!factory) {
  console.error("falta NEXT_PUBLIC_FACTORY_ADDRESS");
  process.exit(1);
}
if (send && !process.env.KEEPER_PK) {
  console.error("--send necesita KEEPER_PK (una wallet dedicada; harvest() no requiere privilegios)");
  process.exit(1);
}

const r = await runKeeperPass({
  factory,
  send,
  keeperPk: process.env.KEEPER_PK as Hex | undefined,
});

console.log(`\n${r.vaults} vault(s) en la factory${send ? "" : "  ·  DRY-RUN (usá --send)"}`);
if (r.aviso) console.log(`AVISO: ${r.aviso}`);
for (const d of r.detalle) {
  const monto = d.wei ? `${formatEther(BigInt(d.wei))} ETH` : "";
  console.log(`  ${d.vault}  ${d.estado.padEnd(11)} ${monto}${d.tx ? `  tx ${d.tx}` : ""}${d.detalle ? `  (${d.detalle})` : ""}`);
}
for (const a of r.alertas) console.error(`\n!! ${a}`);
console.log(`\nbarridos ${r.barridos} · fallidos ${r.fallidos} · total ${r.barridoEth} ETH`);
process.exit(r.ok ? 0 : 1);
