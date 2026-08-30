import type { Address } from "viem";
import { publicClient, factoryAddress } from "./chain";
import { escrowAbi, factoryAbi } from "./abis";

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

const TYPE_STR: Record<1 | 2, string> = { 1: "github", 2: "twitter" };
const ZERO = "0x0000000000000000000000000000000000000000" as const;

/// Verifica que la direccion sea un vault EMITIDO POR NUESTRA FACTORY.
/// Sin esto, cualquiera despliega un contrato que finge ser un vault (identityType/identityValue
/// propios) y se lleva una firma del attester. Es la segunda capa: la primera es que el digest
/// se calcula en el server (lib/bind.ts), no se le pide al contrato.
export async function assertVaultFromFactory(
  vault: Address,
  identityType: 1 | 2,
  identityValue: string,
): Promise<void> {
  const factory = factoryAddress();
  if (!factory) throw new Error("factory address not configured");

  const identityHash = (await publicClient.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "identityHashFor",
    args: [TYPE_STR[identityType], identityValue, ZERO],
  })) as `0x${string}`;

  const vaults = (await publicClient.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "getVaults",
    args: [identityHash],
  })) as readonly Address[];

  const target = vault.toLowerCase();
  if (!vaults.some((v) => v.toLowerCase() === target)) {
    throw new Error(`vault ${vault} not from factory`);
  }
}
