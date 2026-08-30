import { NextRequest, NextResponse } from "next/server";
import { encodeState } from "@/lib/state";
import { assertVaultIdentity, assertVaultFromFactory } from "@/lib/identity";
import type { Address } from "viem";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const vault = req.nextUrl.searchParams.get("vault") as Address | null;
  const payout = req.nextUrl.searchParams.get("payout") as Address | null;
  if (!vault || !payout) {
    return NextResponse.json({ error: "vault & payout required" }, { status: 400 });
  }
  // Valida tipo Y PROCEDENCIA antes de mandar a GitHub: sin el chequeo de factory, cualquier
  // contrato que declare identityType()=1 pasa y termina consiguiendo una firma del attester.
  try {
    const { identityValue } = await assertVaultIdentity(vault, 1);
    await assertVaultFromFactory(vault, 1, identityValue);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${process.env.APP_BASE_URL}/api/attest/github/callback`);
  url.searchParams.set("state", encodeState({ vault, payout }));
  // scope vacio: solo identidad publica (login)
  return NextResponse.redirect(url);
}
