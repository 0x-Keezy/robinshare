"use client";

import { useState } from "react";
import Link from "next/link";
import { formatEther, type Address } from "viem";
import { publicClient, factoryAddress } from "@/lib/chain";
import { escrowAbi, factoryAbi } from "@/lib/abis";

type Row = { vault: Address; pending: bigint; bound: Address };

const STEPS = [
  {
    n: "1",
    t: "Launch",
    d: "Pick a recipient by their GitHub, X handle, or wallet. Their coin goes live on Flap in seconds.",
  },
  {
    n: "2",
    t: "Fees accrue",
    d: "Every buy and sell drips a slice of the trading tax into an on-chain escrow held for that identity. Fully automatic.",
  },
  {
    n: "3",
    t: "They claim",
    d: "They prove it's them — a GitHub login, an X proof, or their wallet — and sweep the ETH anywhere. No one else can touch it.",
  },
];

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
    if (!factory) return setError("NEXT_PUBLIC_FACTORY_ADDRESS is not set.");
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
    <main className="mx-auto w-full max-w-3xl px-6">
      {/* Hero */}
      <section className="pt-20 pb-14">
        <div className="text-xs font-medium uppercase tracking-widest text-emerald-400">
          Social fee escrow · Robinhood Chain
        </div>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Reward someone&apos;s work with a coin.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-neutral-400">
          See a great open-source project, a builder, an idea? Launch a coin for them on Flap. Every trade funnels the
          fees to that person — by their <span className="text-neutral-200">GitHub</span>,{" "}
          <span className="text-neutral-200">X</span>, or <span className="text-neutral-200">wallet</span>. They claim
          it whenever they want. No wallet needed upfront, and it can only ever go to them.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded-md bg-emerald-500 px-5 py-2.5 font-semibold text-black hover:bg-emerald-400"
          >
            Launch a coin →
          </Link>
          <a
            href="#claim"
            className="rounded-md border border-neutral-700 px-5 py-2.5 font-medium text-neutral-200 hover:border-neutral-500"
          >
            I was funded — claim
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-5 border-t border-neutral-900 py-14 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 text-sm font-semibold text-emerald-400">
              {s.n}
            </div>
            <div className="mt-3 font-semibold">{s.t}</div>
            <p className="mt-1 text-sm text-neutral-400">{s.d}</p>
          </div>
        ))}
      </section>

      {/* Claim / lookup */}
      <section id="claim" className="border-t border-neutral-900 py-14">
        <h2 className="text-2xl font-bold">Someone launched a coin for you?</h2>
        <p className="mt-2 text-neutral-400">
          Look up the escrows funding your GitHub, X, or wallet, and claim them.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
            className="rounded-md bg-white px-4 py-2 font-medium text-black disabled:opacity-40"
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
      </section>

      <footer className="border-t border-neutral-900 py-10 text-xs text-neutral-600">
        Permissionless and non-custodial. The escrow is immutable — funds can only ever be released to the wallet that
        proves the recipient&apos;s identity. Not affiliated with Robinhood or Flap.
      </footer>
    </main>
  );
}
