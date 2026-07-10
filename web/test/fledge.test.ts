import { describe, it, expect } from "vitest";
import { encodeAbiParameters } from "viem";
import { predictToken, mineSalt, encodeVaultData, buildLaunchParams } from "@/lib/fledge";

// Valores verificados on-chain por el fork test de Solidity (contracts/test/Fork.t.sol) +
// contracts/scripts/mine-salt.mjs: salt 0x..2d76 -> token 0x4Ddc650a977Cd39F03A890aFd6985e76e8de7777
const KNOWN_SALT = ("0x" + (11638).toString(16).padStart(64, "0")) as `0x${string}`;
const KNOWN_TOKEN = "0x4Ddc650a977Cd39F03A890aFd6985e76e8de7777";

describe("fledge launch lib", () => {
  it("predictToken matchea la derivacion CREATE2 verificada on-chain", () => {
    expect(predictToken(KNOWN_SALT).toLowerCase()).toBe(KNOWN_TOKEN.toLowerCase());
  });

  it("mineSalt encuentra el primer salt con vanity 7777 (== el del fork test)", async () => {
    const { salt, token } = await mineSalt();
    expect(salt).toBe(KNOWN_SALT);
    expect(token.toLowerCase()).toBe(KNOWN_TOKEN.toLowerCase());
    expect(BigInt(token) & 0xffffn).toBe(0x7777n);
  });

  it("encodeVaultData (github) == abi.encode(string,string,address,uint256) que espera la factory", () => {
    const got = encodeVaultData("github", "@ToRvAlDs", "0x0000000000000000000000000000000000000000", 0);
    const expected = encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "address" }, { type: "uint256" }],
      ["github", "@ToRvAlDs", "0x0000000000000000000000000000000000000000", 0n],
    );
    // el handle NO se normaliza en el cliente — lo normaliza la factory on-chain (fuente unica)
    expect(got).toBe(expected);
  });

  it("encodeVaultData (wallet) vacia el handle y pone la wallet", () => {
    const w = "0x1111111111111111111111111111111111111111";
    const got = encodeVaultData("wallet", "ignorame", w, 30);
    const expected = encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "address" }, { type: "uint256" }],
      ["wallet", "", w, 30n],
    );
    expect(got).toBe(expected);
  });

  it("buildLaunchParams fija los valores fork-verificados", () => {
    const p = buildLaunchParams({
      name: "X",
      symbol: "X",
      meta: "{}",
      salt: KNOWN_SALT,
      factory: "0x2222222222222222222222222222222222222222",
      vaultData: "0x",
      taxBps: 300,
      devBuyWei: 10n ** 16n,
    });
    expect(p.dexThresh).toBe(1);
    expect(p.migratorType).toBe(1);
    expect(p.dexId).toBe(0);
    expect(p.tokenVersion).toBe(6);
    expect(p.mktBps).toBe(10000);
    expect(p.quoteToken).toBe("0x0000000000000000000000000000000000000000");
    expect(p.buyTaxRate).toBe(300);
    expect(p.quoteAmt).toBe(10n ** 16n);
  });
});
