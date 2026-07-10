import { NextRequest, NextResponse } from "next/server";
import { verifyProof } from "@reclaimprotocol/js-sdk";
import { decodeState } from "@/lib/state";
import { assertVaultIdentity, handleMatches } from "@/lib/identity";
import { signBindVoucher } from "@/lib/attester";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { proof, providerVersion, state: rawState } = await req.json();
  const state = decodeState(rawState ?? "");
  if (!proof || !state) return NextResponse.json({ error: "bad state" }, { status: 400 });

  // providerId se PINEA server-side; solo la version viene del cliente. Aunque el cliente
  // mienta la version, no puede forjar un proof valido para un username que no controla
  // (verifyProof valida la firma del attestor de Reclaim).
  const config = providerVersion ?? { providerId: process.env.RECLAIM_PROVIDER_ID_TWITTER };
  const { isVerified, data, error } = await verifyProof(proof, config);
  if (!isVerified) {
    return NextResponse.json({ error: `invalid proof: ${error ?? "unknown"}` }, { status: 403 });
  }

  const params = (data?.[0]?.extractedParameters ?? {}) as Record<string, string>;
  const username = params.username ?? params.screen_name;

  const { identityValue } = await assertVaultIdentity(state.vault, 2);
  if (!username || !handleMatches(identityValue, username)) {
    return NextResponse.json({ error: "x username does not match vault identity" }, { status: 403 });
  }

  const voucher = await signBindVoucher(state.vault, state.payout);
  return NextResponse.json({ ...voucher, payout: state.payout, vault: state.vault });
}
