import { describe, it, expect } from "vitest";
import { hashTypedData } from "viem";
import { bindDigestLocal, bindTypedData } from "@/lib/bind";

const VAULT = "0x1111111111111111111111111111111111111111" as const;
const EVIL = "0x3333333333333333333333333333333333333333" as const;
const PAYOUT = "0x2222222222222222222222222222222222222222" as const;

describe("bindDigestLocal", () => {
  it("usa el dominio EIP-712 exacto del contrato", () => {
    const td = bindTypedData(VAULT, PAYOUT, 0n, 1000n);
    expect(td.domain).toEqual({
      name: "SocialFeeEscrow",
      version: "1",
      chainId: 4663,
      verifyingContract: VAULT,
    });
    expect(td.primaryType).toBe("Bind");
    expect(td.types.Bind).toEqual([
      { name: "payoutWallet", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ]);
  });

  it("coincide con hashTypedData de viem", () => {
    const td = bindTypedData(VAULT, PAYOUT, 7n, 1000n);
    expect(bindDigestLocal(VAULT, PAYOUT, 7n, 1000n)).toBe(hashTypedData(td));
  });

  it("el digest depende del vault: dos vaults nunca comparten digest", () => {
    const a = bindDigestLocal(VAULT, PAYOUT, 7n, 1000n);
    const b = bindDigestLocal(EVIL, PAYOUT, 7n, 1000n);
    expect(a).not.toBe(b);
  });
});
