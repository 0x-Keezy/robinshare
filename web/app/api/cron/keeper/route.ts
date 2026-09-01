import { NextRequest, NextResponse } from "next/server";
import { factoryAddress } from "@/lib/chain";
import { runKeeperPass } from "@/lib/keeper";
import type { Hex } from "viem";

export const dynamic = "force-dynamic";
/// El barrido espacia las llamadas al RPC (Cloudflare corta las ráfagas), así que necesita más que
/// los 10 s por defecto. `runKeeperPass` respeta además su propio `deadlineMs` y corta limpio.
export const maxDuration = 60;

/// GET /api/cron/keeper — el keeper como cron de Vercel.
///
/// POR QUÉ ESTA RUTA EXISTE. Las creator fees de pons NO llegan solas al vault: se acumulan en la
/// curva hasta que alguien llama `harvest()`. Mientras nadie lo hace, el builder ve MENOS de lo que
/// ganó en su página de claim, y ese saldo sin barrer es exactamente lo que el owner de pons puede
/// reapuntar retroactivamente. La landing lo dice en voz alta; alguien tiene que hacerlo.
///
/// La versión anterior era `node scripts/keeper.mjs --send --watch 900`: una computadora prendida
/// para siempre. Eso no es una operación, es una promesa de que alguien se acuerde. Acá lo corre
/// Vercel.
///
/// SEGURIDAD. `harvest()` es permissionless —cualquiera puede pagar ese gas— así que esta ruta no
/// puede mover fondos a ningún lado que no sea el vault correspondiente. Aun así se exige el
/// secreto: sin él, un tercero podría hacerle quemar el gas del keeper a discreción.
///
/// Vercel manda `Authorization: Bearer $CRON_SECRET` en cada invocación programada.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado — la ruta está apagada" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const factory = factoryAddress();
  if (!factory) {
    return NextResponse.json({ error: "NEXT_PUBLIC_FACTORY_ADDRESS no configurada" }, { status: 503 });
  }

  const pk = process.env.KEEPER_PK as Hex | undefined;
  // Sin KEEPER_PK corre igual, en DRY-RUN: reporta cuánto habría barrido sin mandar nada. Sirve
  // para ver el tamaño del problema antes de fondear una wallet caliente.
  const result = await runKeeperPass({
    factory,
    send: Boolean(pk),
    keeperPk: pk,
    // Margen para que el corte propio ocurra ANTES del corte de Vercel, y la respuesta salga.
    deadlineMs: 45_000,
  });

  return NextResponse.json({ modo: pk ? "send" : "dry-run", ...result });
}
