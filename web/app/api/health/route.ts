import { NextResponse } from "next/server";
import { publicClient, factoryAddress } from "@/lib/chain";
import { factoryAbi } from "@/lib/abis";
import { attesterAddress } from "@/lib/attester";

export const dynamic = "force-dynamic";

/// GET /api/health — valida la config del attester ANTES de que falle un claim en prod.
/// El footgun que atrapa: si el ATTESTER_PK del server no corresponde al attester VIGENTE de la
/// factory, todo claim de GitHub revierte "bad attester signature" en silencio.
///
/// (En el rail de Flap el attester era inmutable. En el de pons es ROTABLE — por el attester
/// vigente o por `attesterAdmin` — asi que un mismatch puede aparecer despues de una rotacion, y
/// se arregla rotando o cambiando la env, sin redeployar nada.)
export async function GET() {
  const checks: Record<string, unknown> = {};
  let ok = true;

  const factory = factoryAddress();
  checks.factory = factory ?? "MISSING (set NEXT_PUBLIC_FACTORY_ADDRESS)";
  if (!factory) ok = false;

  // server attester (derivado de ATTESTER_PK) — solo el ADDRESS, nunca la key
  let serverAttester: string | null = null;
  try {
    serverAttester = attesterAddress();
    checks.serverAttester = serverAttester;
  } catch {
    checks.serverAttester = "MISSING (set ATTESTER_PK)";
    ok = false;
  }

  // attester canónico de la factory on-chain
  if (factory) {
    try {
      const onchain = (await publicClient.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "attester",
      })) as string;
      checks.factoryAttester = onchain;
      if (serverAttester) {
        const match = onchain.toLowerCase() === serverAttester.toLowerCase();
        checks.attesterMatches = match;
        if (!match) {
          ok = false;
          checks.hint =
            "ATTESTER_PK no corresponde al attester vigente de la factory. Los claims de GitHub revertirán. Poné la key correcta en el env, o rotá el attester on-chain con rotateAttester(). No hace falta redeployar.";
        }
      }
    } catch (e) {
      checks.factoryAttester = `unreadable: ${e instanceof Error ? e.message : String(e)}`;
      ok = false;
    }
  }

  checks.env = {
    githubOAuth: !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET,
    // Twitter usa el oráculo PÚBLICO de Flap (XGeneralVerifier) → no requiere env.
    stateSecret: !!process.env.ATTESTER_STATE_SECRET,
    appBaseUrl: process.env.APP_BASE_URL ?? "MISSING",
  };

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
