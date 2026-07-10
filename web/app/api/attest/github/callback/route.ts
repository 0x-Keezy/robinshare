import { NextRequest, NextResponse } from "next/server";
import { decodeState } from "@/lib/state";
import { assertVaultIdentity, handleMatches } from "@/lib/identity";
import { signBindVoucher } from "@/lib/attester";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = decodeState(req.nextUrl.searchParams.get("state") ?? "");
  if (!code || !state) return NextResponse.json({ error: "bad state" }, { status: 400 });

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const { access_token } = await tokenRes.json();
  if (!access_token) return NextResponse.json({ error: "oauth exchange failed" }, { status: 502 });

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "fledge-attester" },
  });
  const { login } = await userRes.json();

  const { identityValue } = await assertVaultIdentity(state.vault, 1);
  if (!login || !handleMatches(identityValue, login)) {
    return NextResponse.json({ error: "github login does not match vault identity" }, { status: 403 });
  }

  const voucher = await signBindVoucher(state.vault, state.payout);
  // devolvemos el voucher al claim page via fragment (#) — no toca los logs del server
  const back = new URL(`${process.env.APP_BASE_URL}/claim/${state.vault}`);
  back.hash = new URLSearchParams({ ...voucher, payout: state.payout }).toString();
  return NextResponse.redirect(back);
}
