import { NextRequest, NextResponse } from "next/server";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import { encodeState } from "@/lib/state";
import { assertVaultIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { vault, payout } = await req.json();
  if (!vault || !payout) return NextResponse.json({ error: "vault & payout required" }, { status: 400 });
  await assertVaultIdentity(vault, 2); // valida que es un vault twitter

  const r = await ReclaimProofRequest.init(
    process.env.RECLAIM_APP_ID!,
    process.env.RECLAIM_APP_SECRET!,
    process.env.RECLAIM_PROVIDER_ID_TWITTER!,
  );
  // El front reconstruye con fromJsonString, muestra el QR (getRequestUrl) y corre startSession.
  // providerVersion viaja para que /verify use la config recomendada del SDK.
  return NextResponse.json({
    reclaimConfigJson: r.toJsonString(),
    providerVersion: r.getProviderVersion(),
    state: encodeState({ vault, payout }),
  });
}
