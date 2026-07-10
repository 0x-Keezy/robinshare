import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { POST } = await import("@/app/api/token-image/route");

function post(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest("http://localhost/api/token-image", { method: "POST", body: fd });
}

beforeEach(() => vi.restoreAllMocks());

describe("token-image SSRF guard", () => {
  it("rechaza sourceUrl que no es un avatar de github (SSRF)", async () => {
    for (const bad of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:8545",
      "https://evil.com/x.png",
      "https://github.com/../secret.png",
      "file:///etc/passwd",
    ]) {
      const res = await POST(post({ name: "x", symbol: "X", sourceUrl: bad }));
      expect(res.status, bad).toBe(400);
    }
  });

  it("pide imagen o sourceUrl", async () => {
    const res = await POST(post({ name: "x", symbol: "X" }));
    expect(res.status).toBe(400);
  });

  it("acepta un avatar de github valido y devuelve el cid de Flap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("github.com")) {
          return { ok: true, headers: { get: () => "image/png" }, arrayBuffer: async () => new ArrayBuffer(8) };
        }
        // flap upload
        return { json: async () => ({ data: { create: "bafyCID" } }) };
      }),
    );
    const res = await POST(post({ name: "Fund Dev", symbol: "GIFT", sourceUrl: "https://github.com/torvalds.png" }));
    expect(res.status).toBe(200);
    expect((await res.json()).cid).toBe("bafyCID");
  });
});
