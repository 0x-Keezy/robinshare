import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// env necesarias para los modulos importados
process.env.ATTESTER_STATE_SECRET = "test-secret";
process.env.ATTESTER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
process.env.GITHUB_CLIENT_ID = "gh_id";
process.env.GITHUB_CLIENT_SECRET = "gh_secret";
process.env.APP_BASE_URL = "https://fledge.test";
process.env.RECLAIM_PROVIDER_ID_TWITTER = "prov_x";

const VAULT = "0x1111111111111111111111111111111111111111";
const PAYOUT = "0x2222222222222222222222222222222222222222";

// identityType/identityValue del vault: por defecto github "torvalds"; se sobreescribe por test
let mockType = 1;
let mockValue = "torvalds";
vi.mock("@/lib/chain", () => ({
  publicClient: {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "identityType") return mockType;
      if (functionName === "identityValue") return mockValue;
      if (functionName === "bindDigest") return "0x" + "ab".repeat(32);
      return 0;
    }),
  },
}));
vi.mock("@/lib/attester", () => ({
  signBindVoucher: vi.fn(async () => ({ signature: "0xVOUCHER", deadline: "9999999999" })),
}));
const mockVerifyProof = vi.fn();
vi.mock("@reclaimprotocol/js-sdk", () => ({
  ReclaimProofRequest: {},
  verifyProof: (...a: unknown[]) => mockVerifyProof(...a),
}));

const { encodeState } = await import("@/lib/state");
const ghCallback = (await import("@/app/api/attest/github/callback/route")).GET;
const twVerify = (await import("@/app/api/attest/twitter/verify/route")).POST;

beforeEach(() => {
  mockType = 1;
  mockValue = "torvalds";
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("access_token")) return { json: async () => ({ access_token: "tok" }) };
      if (String(url).includes("api.github.com/user")) return { json: async () => ({ login: globalThis.__ghLogin }) };
      throw new Error("unexpected fetch " + url);
    }),
  );
});

describe("github callback", () => {
  it("login que matchea -> 302 con voucher en el fragment", async () => {
    (globalThis as Record<string, unknown>).__ghLogin = "Torvalds"; // case-insensitive match
    const st = encodeState({ vault: VAULT as `0x${string}`, payout: PAYOUT as `0x${string}` });
    const res = await ghCallback(new NextRequest(`https://fledge.test/cb?code=abc&state=${encodeURIComponent(st)}`));
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
});

describe("twitter verify", () => {
  const post = (body: unknown) =>
    new NextRequest("https://fledge.test/api/attest/twitter/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });

  it("proof valido + username matchea -> 200 con voucher", async () => {
    mockType = 2;
    mockValue = "0xkeezy";
    mockVerifyProof.mockResolvedValue({ isVerified: true, data: [{ extractedParameters: { username: "0xKeezy" } }] });
    const st = encodeState({ vault: VAULT as `0x${string}`, payout: PAYOUT as `0x${string}` });
    const res = await twVerify(post({ proof: { x: 1 }, providerVersion: { providerId: "p" }, state: st }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.signature).toBe("0xVOUCHER");
  });

  it("proof invalido -> 403", async () => {
    mockType = 2;
    mockVerifyProof.mockResolvedValue({ isVerified: false, error: "bad" });
    const st = encodeState({ vault: VAULT as `0x${string}`, payout: PAYOUT as `0x${string}` });
    const res = await twVerify(post({ proof: { x: 1 }, state: st }));
    expect(res.status).toBe(403);
  });

  it("username ajeno -> 403", async () => {
    mockType = 2;
    mockValue = "0xkeezy";
    mockVerifyProof.mockResolvedValue({ isVerified: true, data: [{ extractedParameters: { username: "impostor" } }] });
    const st = encodeState({ vault: VAULT as `0x${string}`, payout: PAYOUT as `0x${string}` });
    const res = await twVerify(post({ proof: { x: 1 }, state: st }));
    expect(res.status).toBe(403);
  });
});
