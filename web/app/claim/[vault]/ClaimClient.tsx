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

// ---------------------------------------------------------------------------
// Demo mode (?demo=1) — illustrative claim flow for capture/promo purposes.
// The product hasn't launched yet, so there's no real vault to read on-chain;
// this seeds an illustrative state and lets the cursor drive Connect → Verify
// → Claim without touching a wallet or the chain. Prod path (no query param)
// is untouched below.
// ---------------------------------------------------------------------------
const DEMO_PAYOUT = "0x8f3ac1b0d4e29ff9a2c77b1d9e4a6f0b2c1e091b" as Address;
const DEMO_TX_HASH = "0x7c3f9a1e2d4b8f605ac9e3d71f4b8a2c5e9d0f3a6b8c1d4e7f9a0b2c3d4e5f61" as Hex;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Voucher = { signature: Hex; deadline: string; payout: Address };

type State = {
  identityType: number;
  identityValue: string;
  pending: bigint;
  bound: Address;
  totalPaid: bigint;
  description: string;
};

const ctaCls =
  "rounded-full px-7 py-3 font-bold transition-all duration-150 will-change-transform disabled:cursor-not-allowed disabled:opacity-60 hover:scale-105 hover:brightness-110 active:scale-95 active:brightness-95";
const ctaStyle = { background: RS.GREEN_CTA, color: RS.GREEN_CTA_TEXT } as const;
const ghostCls =
  "rounded-full border-2 px-7 py-3 font-bold transition-all duration-150 will-change-transform hover:scale-105 hover:bg-white/5 active:scale-95";
const ghostStyle = { background: "transparent", borderColor: RS.INK, color: RS.INK } as const;

// easeOutCubic — used to animate the balance drain to zero on claim (demo only)
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function ClaimClient({ vault }: { vault: Address }) {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();

  // ?demo=1 — illustrative mode, see block above. Read synchronously from
  // the URL: safe because the SSR/pre-hydration render always shows the
  // "Loading vault…" branch regardless of isDemo (s is null either way), so
  // there's nothing for this to mismatch against.
  const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
  const [demoConnected, setDemoConnected] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  // identity-proof beat: "Verifying…" (spinner) -> "Verified ✓" (chip, brief hold) -> Claim button
  const [demoVerifying, setDemoVerifying] = useState(false);
  const [demoVerified, setDemoVerified] = useState(false);
  // payoff beat: while non-null, this ETH value overrides the displayed balance and
  // animates from the pending amount down to 0 (the "drain" — see handleClaimClick)
  const [demoDrainEth, setDemoDrainEth] = useState<number | null>(null);
  // terminal beat: once the demo claim resolves, the vault has no real on-chain
  // `bound` wallet to flip `isBound` true (this is a mock, nothing is written on
  // chain), so without this flag `pending` returning to 0n + `voucher` returning
  // to null makes the "Verify with GitHub" button's guard clause true again —
  // the UI would loop back to inviting a second verification right after a
  // successful claim. This flag is the demo-only terminal state: once true, the
  // CTA area stays retired and only the "Done." + "View transaction" already
  // rendered below the card speak for the outcome.
  const [demoClaimed, setDemoClaimed] = useState(false);

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
    if (isDemo) return; // seeded below instead of read from chain
    refresh().catch((e) => setMsg(String(e)));
  }, [refresh, isDemo]);

  // Demo seed — illustrative vault: a GitHub-identity vault with fees
  // pending, not yet bound to a payout wallet.
  useEffect(() => {
    if (!isDemo) return;
    setS({
      identityType: 1,
      identityValue: "arlo_dev",
      pending: 64900000000000000n, // 0.0649 ETH
      bound: ZERO as Address,
      totalPaid: 0n,
      description: "Fees for @arlo_dev — claimable via GitHub",
    });
  }, [isDemo]);

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

  // ---- demo-mode click handlers — same UI, mocked side effects ----
  async function handleConnectClick() {
    if (isDemo) {
      setDemoConnected(true);
      return;
    }
    connect({ connector: injected() });
  }

  async function handleVerifyGithubClick() {
    if (isDemo) {
      setDemoPending(true);
      setDemoVerifying(true); // beat 1: "Verifying…" spinner on the button itself
      await sleep(1100);
      setDemoVerifying(false);
      setDemoVerified(true); // beat 2: "Verified via GitHub ✓" chip — the identity proof, made visible
      await sleep(650);
      setVoucher({ signature: DEMO_TX_HASH, deadline: "9999999999", payout: DEMO_PAYOUT });
      setDemoVerified(false);
      setDemoPending(false);
      return;
    }
    verifyGithub();
  }

  // Animates a float ETH amount from `fromEth` to 0 over `ms`, driving demoDrainEth.
  // Uses setInterval keyed off wall-clock time rather than requestAnimationFrame:
  // rAF is throttled/paused by the browser on backgrounded or non-composited tabs
  // (which the Playwright capture page can be), which would hang this promise
  // forever. setInterval keeps ticking regardless, and since each tick reads real
  // elapsed time (not "one rAF frame"), the eased curve stays correct even if
  // some ticks are dropped or delayed.
  function animateDemoDrain(fromEth: number, ms: number) {
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const id = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / ms);
        setDemoDrainEth(fromEth * (1 - easeOutCubic(t)));
        if (t >= 1) {
          clearInterval(id);
          resolve();
        }
      }, 30);
    });
  }

  async function handleClaimClick() {
    if (!voucher) return;
    if (isDemo) {
      const fromEth = s ? Number(formatEther(s.pending)) : 0;
      setDemoPending(true);
      setMsg("Sent — waiting for confirmation…");
      await sleep(500);
      await animateDemoDrain(fromEth, 900); // the payoff: balance visibly sweeps to 0
      setDemoDrainEth(null);
      setTxHash(DEMO_TX_HASH);
      setS((prev) => (prev ? { ...prev, pending: 0n, totalPaid: prev.pending } : prev));
      setMsg("Done.");
      setVoucher(null);
      setDemoPending(false);
      setDemoClaimed(true);
      return;
    }
    await sendTx("claimAndBind", [voucher.payout, BigInt(voucher.deadline), voucher.signature]);
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
  const effectiveConnected = isDemo ? demoConnected : isConnected;
  const effectivePending = isDemo ? demoPending : isPending;

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

        <div className="relative mt-10 rounded-2xl border p-6 sm:p-8" style={{ borderColor: RS.HAIR }}>
          {isDemo && demoDrainEth !== null && (
            <span className="demo-eth-fly" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4.5 13.5 12 17.5l7.5-4L12 2Z" fill={RS.GREEN_CTA} />
                <path d="M12 17.5 4.5 13.5 12 22l7.5-8.5L12 17.5Z" fill={RS.GREEN_CTA} opacity="0.6" />
              </svg>
            </span>
          )}
          <div className="relative overflow-hidden">
            {isDemo && demoDrainEth !== null && <span className="demo-balance-sweep" aria-hidden />}
            <div
              style={{ fontFamily: "var(--f-display)", fontVariantNumeric: "tabular-nums" }}
              className={`text-[clamp(2rem,6vw,3.2rem)] tracking-tight ${
                isDemo && demoDrainEth !== null ? "demo-balance-draining" : ""
              }`}
            >
              {isDemo && demoDrainEth !== null ? demoDrainEth.toFixed(4) : formatEther(s.pending)} ETH
            </div>
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.14em]" style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }}>
            pending · {formatEther(s.totalPaid)} ETH paid out
            {isBound ? ` · bound to ${s.bound.slice(0, 6)}…${s.bound.slice(-4)}` : ""}
          </div>

          <div className="mt-7 flex flex-col gap-3">
            {!effectiveConnected ? (
              <button onClick={handleConnectClick} className={ghostCls} style={ghostStyle}>
                Connect wallet
              </button>
            ) : (
              <>
                {/* Ya probada la identidad: cualquiera puede empujar los fees a la wallet bound */}
                {isBound && (
                  <button onClick={() => sendTx("sweep")} disabled={effectivePending || s.pending === 0n} className={ctaCls} style={ctaStyle}>
                    Sweep to {s.bound.slice(0, 6)}…{s.bound.slice(-4)}
                  </button>
                )}

                {/* Social: hay voucher listo -> Claim; si no, verificar */}
                {!isBound && s.identityType !== 0 && voucher && (
                  <button
                    onClick={handleClaimClick}
                    disabled={effectivePending}
                    className={ctaCls}
                    style={ctaStyle}
                  >
                    Claim to {voucher.payout.slice(0, 6)}…{voucher.payout.slice(-4)}
                  </button>
                )}
                {!isBound && s.identityType === 1 && !voucher && !demoVerified && !demoClaimed && (
                  <button onClick={handleVerifyGithubClick} disabled={effectivePending} className={ctaCls} style={ctaStyle}>
                    {demoVerifying ? (
                      <span className="inline-flex items-center gap-2.5">
                        <span className="demo-spinner" aria-hidden />
                        Verifying…
                      </span>
                    ) : (
                      "Verify with GitHub"
                    )}
                  </button>
                )}
                {isDemo && demoVerified && !voucher && (
                  <div
                    className="demo-verified-chip inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                    style={{ background: "rgba(0,200,5,0.14)", color: RS.GREEN_TEXT }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        className="demo-check-path"
                        d="M5 12.5l4 4 10-10"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                    Verified via GitHub
                  </div>
                )}
                {/* terminal state: claimed, nothing left to prove or click — the
                    button area retires into a quiet confirmation instead of
                    looping back to "Verify with GitHub" (demoClaimed above) */}
                {isDemo && demoClaimed && (
                  <div
                    className="demo-verified-chip inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                    style={{ background: "rgba(204,255,0,0.14)", color: RS.INK }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        className="demo-check-path"
                        d="M5 12.5l4 4 10-10"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                    Claimed — fees released
                  </div>
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
          <p
            className={`mt-5 flex items-center gap-2 text-sm ${msg === "Done." ? "demo-done-pop" : ""}`}
            style={{ color: msg === "Done." ? RS.GREEN_TEXT : RS.DIM }}
          >
            {msg === "Done." && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
                <path
                  className="demo-check-path"
                  d="M7 12.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            )}
            {msg}
          </p>
        )}
        {txHash && (
          <a
            href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="demo-tx-link-in mt-2 block text-sm font-medium underline decoration-1 underline-offset-4 hover:opacity-70"
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
