import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FLAP_UPLOAD = "https://flap.sh/api/upload?warmup=true";

/// Sube la imagen + metadata al /api/upload de Flap (abierto) y devuelve el CID que va
/// on-chain en `meta`. Se hace server-side para evitar CORS desde el browser.
///
/// Body (multipart/form-data): campos name, symbol, description, twitter?, website?,
/// telegram? y O BIEN un archivo `image`, O BIEN `sourceUrl` (p.ej. el avatar de GitHub).
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const name = String(form.get("name") ?? "");
    const symbol = String(form.get("symbol") ?? "");
    const description = String(form.get("description") ?? "");
    const twitter = String(form.get("twitter") ?? "");
    const website = String(form.get("website") ?? "");
    const telegram = String(form.get("telegram") ?? "");

    // Fuente de la imagen: archivo subido, o el AVATAR DE GITHUB del receptor.
    // sourceUrl se restringe a github.com/<handle>.png para evitar SSRF (el server
    // no debe hacer fetch a URLs arbitrarias del cliente: metadata del cloud, localhost, etc.).
    let file = form.get("image") as File | null;
    const sourceUrl = form.get("sourceUrl");
    if (!file && typeof sourceUrl === "string" && sourceUrl) {
      if (!/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\.png$/.test(sourceUrl)) {
        return NextResponse.json({ error: "sourceUrl must be a github avatar (github.com/<handle>.png)" }, { status: 400 });
      }
      const r = await fetch(sourceUrl, { redirect: "follow" });
      if (!r.ok) return NextResponse.json({ error: `image source ${r.status}` }, { status: 400 });
      const ct = r.headers.get("content-type") ?? "image/png";
      if (!ct.startsWith("image/")) {
        return NextResponse.json({ error: "source is not an image" }, { status: 400 });
      }
      const buf = await r.arrayBuffer();
      file = new File([buf], "token.png", { type: ct });
    }
    if (!file) return NextResponse.json({ error: "image or sourceUrl required" }, { status: 400 });

    // GraphQL multipart, mismo shape que usa flap.sh:
    const meta = { name, symbol, description, website, twitter, telegram };
    const out = new FormData();
    out.append(
      "operations",
      JSON.stringify({
        query: "mutation Create($file: Upload!, $meta: MetadataInput!) { create(file: $file, meta: $meta) }",
        variables: { file: null, meta },
      }),
    );
    out.append("map", JSON.stringify({ "0": ["variables.file"] }));
    out.append("0", file);

    const res = await fetch(FLAP_UPLOAD, { method: "POST", body: out });
    const json = await res.json();
    const cid: string | undefined = json?.data?.create;
    if (!cid) {
      return NextResponse.json({ error: json?.errors?.[0]?.message ?? "upload failed" }, { status: 502 });
    }
    return NextResponse.json({ cid });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
