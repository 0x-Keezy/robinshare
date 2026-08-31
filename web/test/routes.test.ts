import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// env necesarias para los modulos importados
process.env.ATTESTER_STATE_SECRET = "test-secret";
process.env.ATTESTER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
process.env.GITHUB_CLIENT_ID = "gh_id";
process.env.GITHUB_CLIENT_SECRET = "gh_secret";
process.env.APP_BASE_URL = "https://fledge.test";

const VAULT = "0x1111111111111111111111111111111111111111";
const PAYOUT = "0x2222222222222222222222222222222222222222";

// identityType/identityValue del vault: por defecto github "torvalds"; se sobreescribe por test
let mockType = 1;
let mockValue = "torvalds";
const FACTORY = "0x9999999999999999999999999999999999999999";
const IDENTITY_HASH = "0x" + "cd".repeat(32);
let mockVaults: string[] = [VAULT];
vi.mock("@/lib/chain", () => ({
  publicClient: {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "identityType") return mockType;
      if (functionName === "identityValue") return mockValue;
      if (functionName === "isVault") return mockVaults.includes(VAULT);
      if (functionName === "identityHashFor") return IDENTITY_HASH;
      if (functionName === "getVaults") return mockVaults;
      if (functionName === "bindNonce") return 0n;
      if (functionName === "bindDigest") return "0x" + "ab".repeat(32);
      return 0;
    }),
  },
  factoryAddress: () => FACTORY,
}));
vi.mock("@/lib/attester", () => ({
  signBindVoucher: vi.fn(async () => ({ signature: "0xVOUCHER", deadline: "9999999999" })),
}));
const { encodeState } = await import("@/lib/state");
const ghCallback = (await import("@/app/api/attest/github/callback/route")).GET;

beforeEach(() => {
  mockType = 1;
  mockValue = "torvalds";
  mockVaults = [VAULT];
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("access_token")) return { json: async () => ({ access_token: "tok" }) };
      if (String(url).includes("api.github.com/user"))
        return { json: async () => ({ login: (globalThis as Record<string, unknown>).__ghLogin }) };
      throw new Error("unexpected fetch " + url);
    }),
  );
});

describe("github callback", () => {
  it("login que matchea -> 302 con voucher en el fragment", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "Torvalds"; // case-insensitive match
    // El nonce + la cookie son parte del camino feliz desde el fix de CSRF (ver el describe de
    // mas abajo): el callback exige volver al MISMO navegador que arranco el flujo.
    const st = encodeState({
      vault: VAULT as `0x${string}`,
      payout: PAYOUT as `0x${string}`,
      nonce: "n1",
    });
    const okReq = new NextRequest(`https://fledge.test/cb?code=abc&state=${encodeURIComponent(st)}`);
    okReq.cookies.set("rs_oauth_nonce", "n1");
    const res = await ghCallback(okReq);
    expect(res.status).toBe(307); // NextResponse.redirect
    const loc = res.headers.get("location")!;
    expect(loc).toContain(`/claim/${VAULT}`);
    expect(loc).toContain("signature=0xVOUCHER");
  });

  it("login ajeno -> 403 sin voucher", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "someone-else";
    const st = encodeState({ vault: VAULT as `0x${string}`, payout: PAYOUT as `0x${string}` });
    const res = await ghCallback(new NextRequest(`https://fledge.test/cb?code=abc&state=${encodeURIComponent(st)}`));
    expect(res.status).toBe(403);
  });

  it("state invalido -> 400", async () => {
    const res = await ghCallback(new NextRequest(`https://fledge.test/cb?code=abc&state=garbage`));
    expect(res.status).toBe(400);
  });

  it("vault que no salio de la factory -> 403 sin voucher", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "torvalds";
    mockVaults = ["0x4444444444444444444444444444444444444444"]; // VAULT no esta en la lista
    const st = encodeState({ vault: VAULT as `0x${string}`, payout: PAYOUT as `0x${string}` });
    const res = await ghCallback(new NextRequest(`https://fledge.test/cb?code=abc&state=${encodeURIComponent(st)}`));
    expect(res.status).toBe(403);
  });
});

describe("github callback — CSRF: el flujo tiene que volver al MISMO navegador", () => {
  // El ataque: el atacante arma /start?vault=<victima>&payout=<su wallet>, se queda con la URL
  // de GitHub y se la manda al dev real. GitHub auto-aprueba, el login MATCHEA la identidad del
  // vault (es el dev), y sin esta defensa el server firma un voucher que paga al atacante.
  const NONCE = "nonce-del-atacante";

  function req(state: string, cookie?: string) {
    const r = new NextRequest(`https://fledge.test/cb?code=abc&state=${encodeURIComponent(state)}`);
    if (cookie) r.cookies.set("rs_oauth_nonce", cookie);
    return r;
  }

  it("sin la cookie del navegador que lo empezo -> 403 y NINGUN voucher", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "torvalds";
    const st = encodeState({
      vault: VAULT as `0x${string}`,
      payout: PAYOUT as `0x${string}`,
      nonce: NONCE,
    });
    const res = await ghCallback(req(st)); // la victima abre el link: no tiene la cookie
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
  });

  it("con una cookie ajena -> 403", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "torvalds";
    const st = encodeState({
      vault: VAULT as `0x${string}`,
      payout: PAYOUT as `0x${string}`,
      nonce: NONCE,
    });
    const res = await ghCallback(req(st, "otro-nonce-cualquiera"));
    expect(res.status).toBe(403);
  });

  it("el flujo legitimo (misma cookie) sigue funcionando", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "torvalds";
    const st = encodeState({
      vault: VAULT as `0x${string}`,
      payout: PAYOUT as `0x${string}`,
      nonce: NONCE,
    });
    const res = await ghCallback(req(st, NONCE));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("signature=0xVOUCHER");
  });

  it("un state VIEJO sin nonce ya no sirve — el fix es fail-closed", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "torvalds";
    const st = encodeState({ vault: VAULT as `0x${string}`, payout: PAYOUT as `0x${string}` });
    const res = await ghCallback(req(st, NONCE));
    expect(res.status).toBe(403);
  });
});
