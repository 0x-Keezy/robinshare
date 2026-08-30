import { describe, it, expect, vi } from "vitest";
import { recoverAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bindDigestLocal } from "@/lib/bind";

// vi.mock se hoistea al tope del archivo, asi que el spy tiene que declararse con vi.hoisted:
// un `const` normal todavia no esta inicializado cuando corre la factory del mock.
const { readContract } = vi.hoisted(() => ({ readContract: vi.fn() }));
vi.mock("@/lib/chain", async (orig) => ({
  ...(await orig<typeof import("@/lib/chain")>()),
  publicClient: { readContract },
}));

const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
process.env.ATTESTER_PK = PK;

const EVIL = "0x3333333333333333333333333333333333333333" as const;
const VICTIM = "0x1111111111111111111111111111111111111111" as const;
const PAYOUT = "0x2222222222222222222222222222222222222222" as const;

/// Simula el contrato hostil: su bindNonce es 0, pero su bindDigest REENVIA al de la victima.
const VICTIM_DIGEST = bindDigestLocal(VICTIM, PAYOUT, 0n, 9999999999n);

readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
  if (functionName === "bindNonce") return 0n;
  if (functionName === "bindDigest") return VICTIM_DIGEST; // el reenvio hostil
  throw new Error(`unexpected read: ${functionName}`);
});

const { signBindVoucher } = await import("@/lib/attester");

describe("signBindVoucher", () => {
  it("firma el digest LOCAL del vault pedido, no el que devuelve el contrato", async () => {
    const { signature, deadline } = await signBindVoucher(EVIL, PAYOUT);
    const expected = bindDigestLocal(EVIL, PAYOUT, 0n, BigInt(deadline));
    const signer = await recoverAddress({ hash: expected, signature });
    expect(signer.toLowerCase()).toBe(privateKeyToAccount(PK).address.toLowerCase());
  });

  it("la firma NO sirve contra el vault de la victima", async () => {
    const { signature } = await signBindVoucher(EVIL, PAYOUT);
    const signer = await recoverAddress({ hash: VICTIM_DIGEST, signature });
    expect(signer.toLowerCase()).not.toBe(privateKeyToAccount(PK).address.toLowerCase());
  });

  it("nunca llama bindDigest en el contrato", async () => {
    readContract.mockClear();
    await signBindVoucher(EVIL, PAYOUT);
    const llamadas = readContract.mock.calls.map(
      (c) => (c[0] as { functionName: string }).functionName,
    );
    expect(llamadas).not.toContain("bindDigest");
    expect(llamadas).toContain("bindNonce");
  });

  it("el deadline esta en el futuro", async () => {
    const { deadline } = await signBindVoucher(EVIL, PAYOUT);
    expect(Number(deadline)).toBeGreaterThan(Date.now() / 1000);
  });
});
