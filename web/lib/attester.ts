import { sign, privateKeyToAccount } from "viem/accounts";
import { serializeSignature, type Address, type Hex } from "viem";
import { publicClient } from "./chain";
import { escrowAbi } from "./abis";

const DEADLINE_S = 15 * 60;

export function attesterAddress(): Address {
  return privateKeyToAccount(process.env.ATTESTER_PK as Hex).address;
}

/// Lee bindDigest del PROPIO vault (fuente unica de verdad del typed-data) y firma el hash.
export async function signBindVoucher(
  vault: Address,
  payout: Address,
): Promise<{ signature: Hex; deadline: string }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_S);
  const digest = (await publicClient.readContract({
    address: vault,
    abi: escrowAbi,
    functionName: "bindDigest",
    args: [payout, deadline],
  })) as Hex;
  const sig = await sign({ hash: digest, privateKey: process.env.ATTESTER_PK as Hex });
  return { signature: serializeSignature(sig), deadline: deadline.toString() };
}
