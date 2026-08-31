import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hashTypedData, type Address } from "viem";
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

describe("la costura con el contrato", () => {
  /// EL TEST QUE FALTABA, Y ES EL QUE IMPORTA.
  ///
  /// El mismo digest EIP-712 se calcula en DOS lenguajes: en Solidity dentro de
  /// `RobinShareVault.bindDigest()` (lo que el contrato VERIFICA) y acá en TypeScript (con lo
  /// que el attester FIRMA, y con lo que el relayer decide si relaya). Si divergen en un solo
  /// byte, el attester firma algo que el contrato rechaza y TODO claim de GitHub falla en
  /// cadena, en silencio.
  ///
  /// Los tests de arriba NO lo cazaban: comparan `bindDigestLocal` contra `hashTypedData` del
  /// mismo objeto que acaban de construir, con el dominio escrito a mano. Dos puntas verdes y la
  /// costura sin probar.
  ///
  /// El vector lo genera la FUENTE DE VERDAD — `contracts/test/BindVector.t.sol` lo escribe
  /// leyendo `vault.bindDigest()` del contrato de verdad. Si cualquiera de los dos lados se
  /// mueve, esto se pone rojo.
  const vector = JSON.parse(
    readFileSync(join(process.cwd(), "..", "contracts", "test", "fixtures", "bind-vector.json"), "utf8"),
  ) as {
    chainId: number;
    vault: Address;
    payout: Address;
    nonce: number;
    deadline: number;
    digest: `0x${string}`;
  };

  it("reproduce EXACTAMENTE el digest que calcula el contrato", () => {
    expect(
      bindDigestLocal(vector.vault, vector.payout, BigInt(vector.nonce), BigInt(vector.deadline)),
    ).toBe(vector.digest);
  });

  it("el vector es de la cadena del producto (el chainId entra en el dominio)", () => {
    expect(vector.chainId).toBe(4663);
  });
});
