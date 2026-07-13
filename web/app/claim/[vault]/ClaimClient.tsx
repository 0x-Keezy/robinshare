"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEther, type Address, type Hex } from "viem";
import { useAccount, useConnect, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { publicClient } from "@/lib/chain";
import { escrowAbi } from "@/lib/abis";
import { RSShell, RS } from "@/components/RSShell";

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

const ctaCls = "rounded-full px-7 py-3 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const ctaStyle = { background: RS.GREEN_CTA, color: RS.GREEN_CTA_TEXT } as const;
const ghostCls = "rounded-full border-2 px-7 py-3 font-bold transition-colors";
const ghostStyle = { background: "transparent", borderColor: RS.INK, color: RS.INK } as const;

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

  if (!s)
    return (
      <RSShell>
        <main className="mx-auto w-full max-w-2xl px-6 py-14">
          <p style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }} className="text-sm">
            Loading vault…
          </p>
        </main>
      </RSShell>
    );

  const isBound = s.bound !== ZERO;
  const label = s.identityType === 0 ? "wallet" : s.identityType === 1 ? `github:${s.identityValue}` : `x:${s.identityValue}`;

  return (
    <RSShell>
      <main className="mx-auto w-full max-w-2xl px-6 py-14">
        <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: RS.GREEN_TEXT }} className="text-xs font-medium uppercase">
          Claim · {label}
        </div>
        <h1
          style={{ fontFamily: "var(--f-display)", lineHeight: 1 }}
          className="mt-3 text-[clamp(1.9rem,7vw,3rem)] uppercase tracking-tight"
        >
          This vault is yours to prove.
        </h1>
        {s.description && (
          <p className="mt-3 max-w-md" style={{ color: RS.DIM }}>
            {s.description}
          </p>
        )}

        <div className="mt-10 rounded-2xl border p-6 sm:p-8" style={{ borderColor: RS.HAIR }}>
          <div
            style={{ fontFamily: "var(--f-display)", fontVariantNumeric: "tabular-nums" }}
            className="text-[clamp(2rem,6vw,3.2rem)] tracking-tight"
          >
            {formatEther(s.pending)} ETH
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.14em]" style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }}>
            pending · {formatEther(s.totalPaid)} ETH paid out
            {isBound ? ` · bound to ${s.bound.slice(0, 6)}…${s.bound.slice(-4)}` : ""}
          </div>

          <div className="mt-7 flex flex-col gap-3">
            {!isConnected ? (
              <button onClick={() => connect({ connector: injected() })} className={ghostCls} style={ghostStyle}>
                Connect wallet
              </button>
            ) : (
              <>
                {/* Ya probada la identidad: cualquiera puede empujar los fees a la wallet bound */}
                {isBound && (
                  <button onClick={() => sendTx("sweep")} disabled={isPending || s.pending === 0n} className={ctaCls} style={ctaStyle}>
                    Sweep to {s.bound.slice(0, 6)}…{s.bound.slice(-4)}
                  </button>
                )}

                {/* Social: hay voucher listo -> Claim; si no, verificar */}
                {!isBound && s.identityType !== 0 && voucher && (
                  <button
                    onClick={() => sendTx("claimAndBind", [voucher.payout, BigInt(voucher.deadline), voucher.signature])}
                    disabled={isPending}
                    className={ctaCls}
                    style={ctaStyle}
                  >
                    Claim to {voucher.payout.slice(0, 6)}…{voucher.payout.slice(-4)}
                  </button>
                )}
                {!isBound && s.identityType === 1 && !voucher && (
                  <button onClick={verifyGithub} className={ctaCls} style={ctaStyle}>
                    Verify with GitHub
                  </button>
                )}
                {!isBound && s.identityType === 2 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm leading-relaxed" style={{ color: RS.DIM }}>
                      Post this exact text on X from{" "}
                      <span className="font-semibold" style={{ color: RS.INK }}>
                        @{s.identityValue}
                      </span>
                      , then paste the tweet link. Flap&apos;s oracle verifies it and the fees release
                      to your connected wallet.
                    </p>
                    <div
                      className="break-all rounded-xl border p-4 text-xs leading-relaxed"
                      style={{ borderColor: RS.HAIR, fontFamily: "var(--f-mono)", color: RS.DIM }}
                    >
                      {tweetText ?? "loading tweet text…"}
                    </div>
                    <div className="flex gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                      <button
                        onClick={() => tweetText && navigator.clipboard.writeText(tweetText)}
                        disabled={!tweetText}
                        className="rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] disabled:opacity-40"
                        style={{ borderColor: RS.HAIR, color: RS.DIM }}
                      >
                        Copy
                      </button>
                      <a
                        href={`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText ?? "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] ${tweetText ? "" : "pointer-events-none opacity-40"}`}
                        style={{ borderColor: RS.HAIR, color: RS.DIM }}
                      >
                        Open X
                      </a>
                    </div>
                    <label className="flex flex-col gap-2">
                      <span className="text-[10px] uppercase" style={{ fontFamily: "var(--f-mono)", color: RS.FAINT, letterSpacing: "0.16em" }}>
                        Tweet link
                      </span>
                      <input
                        value={tweetUrl}
                        onChange={(e) => setTweetUrl(e.target.value)}
                        placeholder="x.com/…/status/…"
                        className="w-full border-0 border-b-2 bg-transparent py-2 text-sm placeholder:opacity-35 focus:outline-none"
                        style={{ borderColor: RS.INK, color: RS.INK, fontFamily: "var(--f-mono)" }}
                      />
                    </label>
                    <button onClick={proveAndClaimTwitter} disabled={isPending || !tweetText || !tweetUrl} className={ctaCls} style={ctaStyle}>
                      Verify tweet &amp; claim
                    </button>
                  </div>
                )}
                {!isBound && s.identityType === 0 && (
                  <p className="text-sm leading-relaxed" style={{ color: RS.FAINT }}>
                    This is a wallet vault — its fees can only ever go to {s.bound.slice(0, 6)}…{s.bound.slice(-4)}.
                    Sweep above once it has a balance.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {msg && (
          <p className="mt-5 text-sm" style={{ color: RS.DIM }}>
            {msg}
          </p>
        )}
        {txHash && (
          <a
            href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-sm font-medium underline decoration-1 underline-offset-4 hover:opacity-70"
            style={{ color: RS.INK }}
          >
            View transaction →
          </a>
        )}

        <p className="mt-10">
          <Link
            href="/"
            className="text-sm font-medium underline decoration-1 underline-offset-4 hover:opacity-70"
            style={{ color: RS.DIM }}
          >
            ← All vaults
          </Link>
        </p>
      </main>
    </RSShell>
  );
}
