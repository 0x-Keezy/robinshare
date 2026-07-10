import type { Address } from "viem";
import { publicClient } from "./chain";
import { escrowAbi } from "./abis";

/// Lee identityType/Value DEL VAULT on-chain (nunca confiar en el cliente) y valida el tipo.
export async function assertVaultIdentity(
  vault: Address,
  expectedType: 1 | 2,
): Promise<{ identityValue: string }> {
  const [t, v] = await Promise.all([
    publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "identityType" }),
    publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "identityValue" }),
  ]);
  if (Number(t) !== expectedType) throw new Error(`vault identityType ${t} != expected ${expectedType}`);
  return { identityValue: (v as string).toLowerCase() };
}

export function handleMatches(onChainValue: string, provider: string): boolean {
  const norm = (s: string) => s.trim().replace(/^@/, "").toLowerCase();
  return norm(onChainValue) === norm(provider);
}
