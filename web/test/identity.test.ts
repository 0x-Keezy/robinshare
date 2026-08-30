import { describe, it, expect, vi, beforeEach } from "vitest";

const FACTORY = "0x9999999999999999999999999999999999999999" as const;
const GOOD = "0x1111111111111111111111111111111111111111" as const;
const EVIL = "0x3333333333333333333333333333333333333333" as const;
const HASH = "0xabc0000000000000000000000000000000000000000000000000000000000001" as const;

// vi.hoisted: la factory del mock corre antes que los `const` del cuerpo del archivo.
const { readContract } = vi.hoisted(() => ({ readContract: vi.fn() }));
vi.mock("@/lib/chain", async (orig) => ({
  ...(await orig<typeof import("@/lib/chain")>()),
  publicClient: { readContract },
  factoryAddress: () => FACTORY,
}));

// GOTCHA (vitest 4): sobre un mock creado con vi.hoisted y usado dentro de una factory de
// vi.mock, mockClear() TAMBIEN descarta la implementacion — no solo el historial de llamadas.
// Por eso se re-aplica en cada beforeEach. Sin esto el primer test pasa y los siguientes
// revientan con "Cannot destructure property 'functionName' of 'undefined'".
const impl = async ({ functionName }: { functionName: string }) => {
  if (functionName === "identityHashFor") return HASH;
  if (functionName === "getVaults") return [GOOD];
  throw new Error(`unexpected read: ${functionName}`);
};
readContract.mockImplementation(impl);

const { assertVaultFromFactory } = await import("@/lib/identity");

describe("assertVaultFromFactory", () => {
  beforeEach(() => {
    readContract.mockClear();
    readContract.mockImplementation(impl);
  });

  it("acepta un vault registrado en la factory", async () => {
    await expect(assertVaultFromFactory(GOOD, 1, "torvalds")).resolves.toBeUndefined();
  });

  it("rechaza una direccion que no salio de la factory", async () => {
    await expect(assertVaultFromFactory(EVIL, 1, "torvalds")).rejects.toThrow(/not from factory/i);
  });

  it("compara sin distinguir mayusculas (checksum vs lowercase)", async () => {
    const upper = ("0x" + GOOD.slice(2).toUpperCase()) as `0x${string}`;
    await expect(assertVaultFromFactory(upper, 1, "torvalds")).resolves.toBeUndefined();
  });

  it("usa el typeStr correcto segun el tipo de identidad", async () => {
    await assertVaultFromFactory(GOOD, 1, "torvalds");
    const call = readContract.mock.calls.find(
      (c) => (c[0] as { functionName: string }).functionName === "identityHashFor",
    );
    expect((call![0] as { args: unknown[] }).args[0]).toBe("github");
  });
});
