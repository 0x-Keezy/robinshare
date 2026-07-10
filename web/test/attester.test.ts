import { describe, it, expect, vi } from "vitest";
import { recoverAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
process.env.ATTESTER_PK = PK;
const DIGEST = "0x59d9f24d2917efc17a4b3849d0a8a2f54e534b129d8f8bbc2b78fdbf120c863b" as const;

vi.mock("../lib/chain", () => ({
  publicClient: { readContract: vi.fn(async () => DIGEST) },
}));
const { signBindVoucher } = await import("../lib/attester");

describe("signBindVoucher", () => {
  it("firma el digest leido on-chain y el signer es el attester", async () => {
    const { signature, deadline } = await signBindVoucher(
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    );
    const signer = await recoverAddress({ hash: DIGEST, signature });
    expect(signer.toLowerCase()).toBe(privateKeyToAccount(PK).address.toLowerCase());
    expect(Number(deadline)).toBeGreaterThan(Date.now() / 1000);
  });
});
