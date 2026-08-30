import { hashTypedData, type Address, type Hex, type TypedDataDefinition } from "viem";
import { robinhoodChain } from "./chain";

/// Typed-data del voucher de bind. Debe coincidir EXACTAMENTE con el contrato:
///   EIP712("SocialFeeEscrow", "1")
///   BIND_TYPEHASH = keccak256("Bind(address payoutWallet,uint256 nonce,uint256 deadline)")
/// El server lo construye ACA y nunca se lo pide al contrato: si se lo pidiera, un contrato
/// hostil podria devolver el digest de OTRO vault y quedarse con una firma valida contra el.
export function bindTypedData(
  vault: Address,
  payout: Address,
  nonce: bigint,
  deadline: bigint,
): TypedDataDefinition {
  return {
    domain: {
      name: "SocialFeeEscrow",
      version: "1",
      chainId: robinhoodChain.id,
      verifyingContract: vault,
    },
    types: {
      Bind: [
        { name: "payoutWallet", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Bind",
    message: { payoutWallet: payout, nonce, deadline },
  };
}

export function bindDigestLocal(
  vault: Address,
  payout: Address,
  nonce: bigint,
  deadline: bigint,
): Hex {
  return hashTypedData(bindTypedData(vault, payout, nonce, deadline));
}
