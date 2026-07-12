"use client";

import { useState } from "react";
import { formatEther, type Address } from "viem";
import { publicClient, factoryAddress } from "@/lib/chain";
import { escrowAbi, factoryAbi } from "@/lib/abis";

export type IdType = "wallet" | "github" | "twitter";
export type VaultRow = { vault: Address; pending: bigint; bound: Address; pendingLabel: string };

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/// Lógica funcional del lookup de vaults por identidad. Compartida por las 3 direcciones
/// de arte — la máquina wagmi/viem no cambia, solo su presentación.
export function useVaultLookup() {
  const [type, setType] = useState<IdType>("github");
  const [value, setValue] = useState("");
  const [rows, setRows] = useState<VaultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setError(null);
    setRows(null);
    const factory = factoryAddress();
    if (!factory) {
      setError("NEXT_PUBLIC_FACTORY_ADDRESS is not set.");
      return;
    }
    if (!value.trim()) return;
    setLoading(true);
    try {
      const isWallet = type === "wallet";
      const identityHash = (await publicClient.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "identityHashFor",
        args: [type, isWallet ? "" : value, isWallet ? (value as Address) : ZERO],
      })) as `0x${string}`;

      const vaults = (await publicClient.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "getVaults",
        args: [identityHash],
      })) as Address[];

      const out: VaultRow[] = await Promise.all(
        vaults.map(async (vault) => {
          const [pending, bound] = await Promise.all([
            publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "pendingAmount" }),
            publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "boundWallet" }),
          ]);
          return {
            vault,
            pending: pending as bigint,
            bound: bound as Address,
            pendingLabel: formatEther(pending as bigint),
          };
        }),
      );
      setRows(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return { type, setType, value, setValue, rows, error, loading, lookup };
}
