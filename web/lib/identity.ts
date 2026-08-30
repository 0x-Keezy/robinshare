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

/// Verifica que la direccion sea un vault EMITIDO POR NUESTRA FACTORY.
/// Sin esto, cualquiera despliega un contrato que finge ser un vault (identityType/identityValue
/// propios) y se lleva una firma del attester. Es la segunda capa: la primera es que el digest
/// se calcula en el server (lib/bind.ts), no se le pide al contrato.
///
/// Usa el registro `isVault` de la factory. La version anterior hacia identityHashFor+getVaults,
/// que ademas de ser O(n) dependia de reimplementar la normalizacion de handles del contrato:
/// cualquier desajuste habria hecho fallar el chequeo en silencio.
export async function assertVaultFromFactory(vault: Address): Promise<void> {
  const factory = factoryAddress();
  if (!factory) throw new Error("factory address not configured");
  const ok = (await publicClient.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "isVault",
    args: [vault],
  })) as boolean;
  if (!ok) throw new Error(`vault ${vault} not from factory`);
}
