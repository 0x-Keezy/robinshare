import { NextRequest, NextResponse } from "next/server";
import { encodeState, newNonce, OAUTH_NONCE_COOKIE } from "@/lib/state";
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
    await assertVaultIdentity(vault, 1);
    await assertVaultFromFactory(vault);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  // Ata el flujo AL NAVEGADOR que lo empezo.
  //
  // Sin esto, `payout` viene del query string y el `state` solo esta firmado, no ligado a nadie:
  // un atacante armaba `/start?vault=<el de la victima>&payout=<wallet del atacante>`, se quedaba
  // con la URL de GitHub que sale de aca, y se la mandaba al dev real. GitHub auto-aprueba a
  // quien ya autorizo la app, el callback valida que el login matchee la identidad del vault
  // —matchea, es el dev— y firma un voucher que paga al ATACANTE. El dev volvia a NUESTRA pagina
  // de claim, veia el CTA verde y con un click bindeaba el vault a la wallet del atacante.
  //
  // Con la cookie, el callback exige que quien vuelve sea el mismo navegador que arranco: la URL
  // reenviada llega sin ella y el flujo se corta antes de firmar nada.
  const nonce = newNonce();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${process.env.APP_BASE_URL}/api/attest/github/callback`);
  url.searchParams.set("state", encodeState({ vault, payout, nonce }));
  // scope vacio: solo identidad publica (login)
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    // `lax` y no `strict`: la vuelta desde github.com es una navegacion top-level de otro sitio,
    // y con `strict` el navegador no mandaria la cookie ni en el flujo legitimo.
    sameSite: "lax",
    path: "/api/attest",
    maxAge: 20 * 60,
  });
  return res;
}
