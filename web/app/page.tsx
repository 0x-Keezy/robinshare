"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEther, type Address } from "viem";
import { publicClient, factoryAddress } from "@/lib/chain";
import { escrowAbi, factoryAbi } from "@/lib/abis";

type Row = { vault: Address; pending: bigint; bound: Address };

export default function Home() {
  const [type, setType] = useState<"wallet" | "github" | "twitter">("github");
  const [value, setValue] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const factory = factoryAddress();

  async function lookup() {
    setError(null);
    setRows(null);
    if (!factory) {
      setError("NEXT_PUBLIC_FACTORY_ADDRESS no configurada.");
      return;
    }
    setLoading(true);
    try {
      const isWallet = type === "wallet";
      const identityHash = (await publicClient.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "identityHashFor",
        args: [
          type,
          isWallet ? "" : value,
          isWallet ? (value as Address) : "0x0000000000000000000000000000000000000000",
        ],
      })) as `0x${string}`;

      const vaults = (await publicClient.readContract({
        address: factory,
        abi: factoryAbi,
        functionName: "getVaults",
        args: [identityHash],
      })) as Address[];

      const out: Row[] = await Promise.all(
        vaults.map(async (vault) => {
          const [pending, bound] = await Promise.all([
            publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "pendingAmount" }),
            publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "boundWallet" }),
          ]);
          return { vault, pending: pending as bigint, bound: bound as Address };
        }),
      );
      setRows(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">FLEDGE</h1>
      <p className="mt-2 text-neutral-400">
        Trading fees, escrowed to a wallet, GitHub or X identity on Robinhood Chain. Find the vaults that fund you and
        claim them.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
        >
          <option value="github">GitHub</option>
          <option value="twitter">X (Twitter)</option>
          <option value="wallet">Wallet</option>
        </select>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder={type === "wallet" ? "0x wallet address" : "handle (no @ needed)"}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
        />
        <button
          onClick={lookup}
          disabled={loading || !value}
          className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-black disabled:opacity-40"
        >
          {loading ? "Looking…" : "Find vaults"}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {rows && rows.length === 0 && <p className="mt-8 text-neutral-500">No vaults yet for this identity.</p>}

      {rows && rows.length > 0 && (
        <ul className="mt-8 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.vault} className="rounded-lg border border-neutral-800 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-sm text-neutral-300">{r.vault}</div>
                  <div className="mt-1 text-lg font-semibold">{formatEther(r.pending)} ETH pending</div>
                  {r.bound !== "0x0000000000000000000000000000000000000000" && (
                    <div className="mt-1 text-xs text-neutral-500">bound to {r.bound}</div>
                  )}
                </div>
                <Link href={`/claim/${r.vault}`} className="rounded-md bg-white px-4 py-2 font-medium text-black">
                  Claim
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
