import { describe, it, expect, vi } from "vitest";

process.env.ATTESTER_STATE_SECRET = "test-secret";
const { encodeState, decodeState } = await import("../lib/state");

describe("state HMAC", () => {
  const p = {
    vault: "0x1111111111111111111111111111111111111111",
    payout: "0x2222222222222222222222222222222222222222",
  } as const;

  it("roundtrip", () => {
    expect(decodeState(encodeState(p))).toMatchObject(p);
  });

  it("rechaza tampering", () => {
    const s = encodeState(p);
    const tampered = s.slice(0, -4) + "AAAA";
    expect(decodeState(tampered)).toBeNull();
  });

  it("expira", () => {
    vi.useFakeTimers();
    const s = encodeState(p);
    vi.advanceTimersByTime(21 * 60 * 1000);
    expect(decodeState(s)).toBeNull();
    vi.useRealTimers();
  });
});
