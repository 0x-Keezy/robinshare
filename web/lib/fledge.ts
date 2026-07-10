import { encodeAbiParameters, getContractAddress, numberToHex, type Address, type Hex } from "viem";

// Direcciones Flap en Robinhood Chain (verificadas on-chain 2026-07-10).
export const VAULT_PORTAL = "0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B" as const;
export const PORTAL = "0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09" as const;
// keccak del bytecode del minimal-proxy (EIP-1167) que apunta al TaxTokenV3 impl (0x7777..3333).
// El address del token = CREATE2(PORTAL, salt, este hash) — verificado con match exacto en el fork.
export const TAX_PROXY_INITCODE_HASH =
  "0x6ce33cede557fe3331031c87bf9be28f493a6086cdc8770ac0a4c7dd7320dea7" as const;

export type IdentityType = "wallet" | "github" | "twitter";

/// Predice el address del tax token V6 para un salt (misma derivación que el portal).
export function predictToken(salt: Hex): Address {
  return getContractAddress({
    opcode: "CREATE2",
    from: PORTAL,
    salt,
    bytecodeHash: TAX_PROXY_INITCODE_HASH,
  });
}

/// Mina un salt cuyo token termine en vanity 0x7777. Async, cede el hilo por lotes
/// para no congelar la UI. Devuelve {salt, token}. Puro cómputo local (sin RPC).
export async function mineSalt(
  onProgress?: (tries: number) => void,
): Promise<{ salt: Hex; token: Address }> {
  for (let i = 1; ; i++) {
    const salt = numberToHex(BigInt(i), { size: 32 });
    const token = predictToken(salt);
    if ((BigInt(token) & 0xffffn) === 0x7777n) return { salt, token };
    if (i % 2000 === 0) {
      onProgress?.(i);
      await new Promise((r) => setTimeout(r, 0)); // yield al event loop
    }
  }
}

/// Codifica el vaultData (4 campos) que consume SocialFeeEscrowFactory.newVault.
/// El attester NO va acá: es canónico de la factory.
export function encodeVaultData(
  type: IdentityType,
  handle: string,
  wallet: Address,
  recoveryDays: number,
): Hex {
  return encodeAbiParameters(
    [{ type: "string" }, { type: "string" }, { type: "address" }, { type: "uint256" }],
    [
      type,
      type === "wallet" ? "" : handle,
      type === "wallet" ? wallet : "0x0000000000000000000000000000000000000000",
      BigInt(recoveryDays),
    ],
  );
}

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

/// Arma el struct NewTokenV6WithVaultParams con los valores fork-verificados.
/// taxBps en basis points (300 = 3%). devBuyWei = ETH inicial (msg.value).
export function buildLaunchParams(opts: {
  name: string;
  symbol: string;
  meta: string;
  salt: Hex;
  factory: Address;
  vaultData: Hex;
  taxBps: number;
  devBuyWei: bigint;
}) {
  return {
    name: opts.name,
    symbol: opts.symbol,
    meta: opts.meta,
    dexThresh: 1, // FOUR_FIFTHS
    salt: opts.salt,
    migratorType: 1, // V2_MIGRATOR
    quoteToken: ZERO,
    quoteAmt: opts.devBuyWei,
    permitData: "0x" as Hex,
    extensionID: ZERO32,
    extensionData: "0x" as Hex,
    dexId: 0, // DEX0
    lpFeeProfile: 0, // STANDARD
    buyTaxRate: opts.taxBps,
    sellTaxRate: opts.taxBps,
    taxDuration: 3153600000n, // ~100 años
    antiFarmerDuration: 259200n, // 3 días
    mktBps: 10000, // 100% del tax al escrow
    deflationBps: 0,
    dividendBps: 0,
    lpBps: 0,
    minimumShareBalance: 0n,
    dividendToken: ZERO,
    commissionReceiver: ZERO,
    tokenVersion: 6, // TOKEN_TAXED_V3
    vaultFactory: opts.factory,
    vaultData: opts.vaultData,
  } as const;
}
