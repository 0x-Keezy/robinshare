"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEther, type Address, type Hex } from "viem";
import { useAccount, useConnect, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { publicClient } from "@/lib/chain";
import { escrowAbi } from "@/lib/abis";

const ZERO = "0x0000000000000000000000000000000000000000";

type Voucher = { signature: Hex; deadline: string; payout: Address };

type State = {
  identityType: number;
  identityValue: string;
  pending: bigint;
  bound: Address;
  totalPaid: bigint;
  description: string;
};

export function ClaimClient({ vault }: { vault: Address }) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();

  const [s, setS] = useState<State | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [tweetText, setTweetText] = useState<string | null>(null); // ruta X: el texto exacto a tuitear
  const [tweetUrl, setTweetUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);

  const refresh = useCallback(async () => {
    const [identityType, identityValue, pending, bound, totalPaid, description] = await Promise.all([
      publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "identityType" }),
      publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "identityValue" }),
      publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "pendingAmount" }),
      publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "boundWallet" }),
      publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "totalPaid" }),
      publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "description" }),
    ]);
    setS({
      identityType: Number(identityType),
      identityValue: identityValue as string,
      pending: pending as bigint,
      bound: bound as Address,
      totalPaid: totalPaid as bigint,
      description: description as string,
    });
  }, [vault]);

  // Ruta X (XGeneralVerifier de Flap): lee el texto exacto a tuitear para la wallet conectada.
  const loadTweetText = useCallback(async () => {
    if (!address) return;
    const t = await publicClient.readContract({
      address: vault,
      abi: escrowAbi,
      functionName: "expectedTweet",
      args: [address],
    });
    setTweetText(t as string);
  }, [address, vault]);

  useEffect(() => {
    refresh().catch((e) => setMsg(String(e)));
  }, [refresh]);

  // ruta X: al conectar en un vault twitter, cargar el texto exacto a tuitear
  useEffect(() => {
    if (s?.identityType === 2 && isConnected) loadTweetText().catch(() => {});
  }, [s?.identityType, isConnected, loadTweetText]);

  // voucher de retorno del OAuth de GitHub (viene en el fragment #)
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const signature = p.get("signature") as Hex | null;
    const deadline = p.get("deadline");
    const payout = p.get("payout") as Address | null;
    if (signature && deadline && payout) {
      setVoucher({ signature, deadline, payout });
      history.replaceState(null, "", window.location.pathname); // limpia el fragment
    }
  }, []);

  async function sendTx(fn: "sweep" | "claimAndBind" | "claimByProof", args: readonly unknown[] = []) {
    setMsg(null);
    try {
      const hash = await writeContractAsync({ address: vault, abi: escrowAbi, functionName: fn, args } as never);
      setTxHash(hash);
      setMsg("Sent — waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash });
      setMsg("Done.");
      setVoucher(null);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  function verifyGithub() {
    if (!address) return;
    window.location.href = `/api/attest/github/start?vault=${vault}&payout=${address}`;
  }

  async function proveAndClaimTwitter() {
    if (!address || !tweetText || !tweetUrl) return;
    setMsg("Asking Flap's oracle to verify your tweet…");
    try {
      const res = await fetch("/api/x-prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetUrl, substring: tweetText }),
      });
      const p = await res.json();
      if (!res.ok || !p.signature) {
        setMsg(`Verification failed: ${p.error ?? "oracle rejected the tweet"}`);
        return;
      }
      const proof = {
        tweetId: BigInt(p.tweet_id),
        xHandle: p.x_handle as string,
        xId: BigInt(p.x_id),
        substring: p.substring as string,
      };
      await sendTx("claimByProof", [proof, p.signature]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  if (!s) return <main className="mx-auto max-w-2xl px-6 py-16 text-neutral-400">Loading vault…</main>;

  const isBound = s.bound !== ZERO;
  const label = s.identityType === 0 ? "wallet" : s.identityType === 1 ? `github:${s.identityValue}` : `x:${s.identityValue}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← all vaults
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Claim — {label}</h1>
      <p className="mt-2 text-sm text-neutral-400">{s.description}</p>

      <div className="mt-6 rounded-lg border border-neutral-800 p-5">
        <div className="text-3xl font-semibold">{formatEther(s.pending)} ETH</div>
        <div className="mt-1 text-sm text-neutral-500">
          pending · {formatEther(s.totalPaid)} ETH paid out{isBound ? ` · bound to ${s.bound}` : ""}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {!isConnected ? (
            <button
              onClick={() => connect({ connector: injected() })}
              className="rounded-md bg-white px-4 py-2 font-medium text-black"
            >
              Connect wallet
            </button>
          ) : (
            <>
              {/* Ya probada la identidad: cualquiera puede empujar los fees a la wallet bound */}
              {isBound && (
                <button
                  onClick={() => sendTx("sweep")}
                  disabled={isPending || s.pending === 0n}
                  className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-black disabled:opacity-40"
                >
                  Sweep to {s.bound.slice(0, 6)}…{s.bound.slice(-4)}
                </button>
              )}

              {/* Social: hay voucher listo -> Claim; si no, verificar */}
              {!isBound && s.identityType !== 0 && voucher && (
                <button
                  onClick={() => sendTx("claimAndBind", [voucher.payout, BigInt(voucher.deadline), voucher.signature])}
                  disabled={isPending}
                  className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-black disabled:opacity-40"
                >
                  Claim to {voucher.payout.slice(0, 6)}…{voucher.payout.slice(-4)}
                </button>
              )}
              {!isBound && s.identityType === 1 && !voucher && (
                <button onClick={verifyGithub} className="rounded-md bg-white px-4 py-2 font-medium text-black">
                  Verify with GitHub
                </button>
              )}
              {!isBound && s.identityType === 2 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-neutral-400">
                    Post this exact text on X from{" "}
                    <span className="text-neutral-200">@{s.identityValue}</span>, then paste the tweet link. Flap&apos;s
                    oracle verifies it and the fees are released to your connected wallet.
                  </p>
                  <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-300 break-all">
                    {tweetText ?? "loading tweet text…"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => tweetText && navigator.clipboard.writeText(tweetText)}
                      disabled={!tweetText}
                      className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 disabled:opacity-40"
                    >
                      Copy
                    </button>
                    <a
                      href={`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText ?? "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 ${tweetText ? "" : "pointer-events-none opacity-40"}`}
                    >
                      Open X
                    </a>
                  </div>
                  <input
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    placeholder="paste the tweet link (x.com/…/status/…)"
                    className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={proveAndClaimTwitter}
                    disabled={isPending || !tweetText || !tweetUrl}
                    className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-black disabled:opacity-40"
                  >
                    Verify tweet & claim
                  </button>
                </div>
              )}
              {!isBound && s.identityType === 0 && (
                <p className="text-sm text-neutral-500">
                  This is a wallet vault — its fees can only ever go to {s.bound}. Use Sweep above once it has a balance.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {msg && <p className="mt-4 text-sm text-neutral-300">{msg}</p>}
      {txHash && (
        <a
          href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-sm text-emerald-400 underline"
        >
          view transaction
        </a>
      )}
    </main>
  );
}
