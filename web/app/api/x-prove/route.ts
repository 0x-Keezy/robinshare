import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Oráculo oficial de X de Flap (verifica el tweet y firma la prueba). Proxy server-side
// para evitar CORS desde el browser. Reemplaza a Reclaim en la ruta Twitter.
// El oráculo firma un dominio EIP-712 DISTINTO por chain: hay que pasar chain_id para que
// la firma valide contra el XGeneralVerifier de Robinhood (4663), no el de BSC (default 56).
const CHAIN_ID = 4663; // Robinhood Chain mainnet
const FLAP_X_ORACLE = `https://verifyx.taxed.fun/prove?chain_id=${CHAIN_ID}`;

/// POST { tweetUrl, substring } → extrae el tweet_id, pide la prueba firmada al oráculo de Flap.
/// El `substring` lo calcula el cliente con escrow.expectedTweet(payout) (view on-chain).
export async function POST(req: NextRequest) {
  try {
    const { tweetUrl, substring } = await req.json();
    if (!tweetUrl || !substring) {
      return NextResponse.json({ error: "tweetUrl & substring required" }, { status: 400 });
    }
    // tweet id = el número al final de /status/<id> (o el string si ya es numérico)
    const m = String(tweetUrl).match(/status\/(\d+)/);
    const tweetId = m ? m[1] : String(tweetUrl).match(/^\d+$/)?.[0];
    if (!tweetId) return NextResponse.json({ error: "could not parse tweet id from URL" }, { status: 400 });

    const res = await fetch(FLAP_X_ORACLE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweet_id: tweetId, substring }),
    });
    const json = await res.json();
    if (!res.ok || !json?.signature) {
      return NextResponse.json({ error: json?.error ?? "oracle rejected the tweet" }, { status: 400 });
    }
    // { tweet_id, x_handle, x_id, substring, signature, ipfs_cid }
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
