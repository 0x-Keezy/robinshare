"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pirata_One, EB_Garamond, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { useHideNav } from "@/lib/useHideNav";
import { useScrollSync } from "@/lib/scrollProgress";

/*
 * DECREE — el decreto (registro claro-cálido medieval del bake-off).
 * Pergamino fotográfico como materia de la página entera, blackletter + Garamond,
 * cláusulas romanas, sello de cera esmeralda que se ESTAMPA al entrar al viewport.
 * Un documento, no una landing: la voz es un edicto.
 */

const pirata = Pirata_One({ weight: "400", subsets: ["latin"], variable: "--f-display" });
const garamond = EB_Garamond({ subsets: ["latin"], style: ["normal", "italic"], variable: "--f-body" });
const plex = IBM_Plex_Mono({ weight: ["400"], subsets: ["latin"], variable: "--f-mono" });

const INK = "#2E2415";
const INK_DIM = "rgba(46,36,21,0.72)";
const INK_FAINT = "rgba(46,36,21,0.5)";
const WAX = "#1F7A3D"; // cera esmeralda
const WAX_DARK = "#14512A";
const RULE = "rgba(46,36,21,0.35)";
const ZERO = "0x0000000000000000000000000000000000000000";

function Ornament() {
  return (
    <div aria-hidden className="my-2 flex items-center justify-center gap-4" style={{ color: RULE }}>
      <span className="h-px w-24" style={{ background: `linear-gradient(to left, ${RULE}, transparent)` }} />
      <span className="text-xl">❦</span>
      <span className="h-px w-24" style={{ background: `linear-gradient(to right, ${RULE}, transparent)` }} />
    </div>
  );
}

/* sello de cera que se ESTAMPA (cae con peso) al entrar al viewport */
function WaxSeal({ size = 120 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stamped, setStamped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStamped(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          setTimeout(() => setStamped(true), 250);
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="transition-all duration-500"
      style={{
        transform: stamped ? "scale(1) rotate(-6deg)" : "scale(1.6) rotate(4deg)",
        opacity: stamped ? 1 : 0,
        transitionTimingFunction: "cubic-bezier(0.2, 1.4, 0.4, 1)",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden style={{ filter: "drop-shadow(0 6px 10px rgba(46,36,21,0.35))" }}>
        <defs>
          <radialGradient id="waxg" cx="40%" cy="34%" r="75%">
            <stop offset="0%" stopColor="#2FA35A" />
            <stop offset="55%" stopColor={WAX} />
            <stop offset="100%" stopColor={WAX_DARK} />
          </radialGradient>
        </defs>
        <path
          d="M60 6 C82 4 112 20 113 52 C114 82 96 112 62 114 C30 116 6 96 7 62 C8 30 34 8 60 6 Z"
          fill="url(#waxg)"
        />
        <circle cx="60" cy="60" r="41" fill="none" stroke="#BFE8CD" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="3 5" />
        {/* flecha en relieve */}
        <g stroke="#DFF5E6" strokeOpacity="0.9" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M38 74 L78 44" />
          <path d="M78 44 L66 46 M78 44 L76 56" />
          <path d="M38 74 L46 72 M38 74 L40 66" strokeWidth="1.6" />
        </g>
        <text x="60" y="95" textAnchor="middle" fontSize="9" letterSpacing="3" fill="#DFF5E6" fillOpacity="0.85" fontFamily="serif">
          FLEDGE
        </text>
      </svg>
    </div>
  );
}

export function DecreeHome() {
  useScrollSync();
  const navHidden = useHideNav();
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();

  return (
    <main
      className={`${pirata.variable} ${garamond.variable} ${plex.variable} relative`}
      style={{ color: INK, fontFamily: "var(--f-body)" }}
    >
      {/* la materia: pergamino fotográfico a página completa */}
      <div
        aria-hidden
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url(/decree/parchment.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* velo cálido para legibilidad pareja */}
      <div aria-hidden className="fixed inset-0 z-0" style={{ background: "rgba(238,224,196,0.28)" }} />

      {/* nav sobrio */}
      <nav
        className="fixed inset-x-0 top-0 z-40 transition-transform duration-300"
        style={{
          background: "linear-gradient(to bottom, rgba(230,214,182,0.95) 0%, rgba(230,214,182,0.8) 60%, transparent)",
          transform: navHidden ? "translateY(-100%)" : "none",
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span style={{ fontFamily: "var(--f-display)" }} className="text-2xl tracking-wide">
            Fledge
          </span>
          <Link
            href="/create"
            className="rounded-sm border-2 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider"
            style={{ borderColor: INK, color: INK }}
          >
            Issue a decree
          </Link>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-3xl px-6">
        {/* EL EDICTO — hero */}
        <section className="flex min-h-screen flex-col items-center justify-center pt-20 text-center">
          <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.3em", color: INK_FAINT }} className="text-[11px] uppercase">
            Robinhood Chain · Anno 4663
          </div>
          <h1 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="mt-6 text-[clamp(3.4rem,10vw,7.5rem)]">
            The Fees Decree
          </h1>
          <Ornament />
          <p className="mt-2 max-w-xl text-2xl italic leading-relaxed" style={{ color: INK_DIM }}>
            «Be it known to all who trade: a tithe of every swap belongs, by right and by code,
            to the one who builds.»
          </p>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed" style={{ color: INK_DIM }}>
            Launch a coin for someone who ships. A slice of every trade escrows to their GitHub,
            X, or wallet — and only they may ever claim it.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-5">
            <Link
              href="/create"
              className="rounded-sm px-7 py-3 text-base font-semibold uppercase tracking-wider text-white shadow-md"
              style={{ background: WAX }}
            >
              Issue a decree
            </Link>
            <a href="#registro" className="text-lg italic underline decoration-1 underline-offset-4" style={{ color: INK }}>
              Am I named? →
            </a>
          </div>
          <div className="mt-14">
            <WaxSeal size={110} />
          </div>
        </section>

        {/* LAS CLÁUSULAS */}
        <section className="py-20">
          <Reveal>
            <h2 style={{ fontFamily: "var(--f-display)" }} className="text-center text-5xl">
              The Three Articles
            </h2>
            <Ornament />
          </Reveal>
          <div className="mt-10 flex flex-col gap-12">
            {[
              { n: "I", t: "Of the Naming", d: "The issuer shall name a builder — by GitHub, by X, or by wallet — and the coin shall be struck upon Flap within moments. The named need not know, nor sign, nor hold a key." },
              { n: "II", t: "Of the Tithe", d: "Upon every purchase and every sale, a portion of the tax shall ride, untouched by any hand, into a vault sworn to that name. Neither issuer nor scribe nor sovereign may divert it." },
              { n: "III", t: "Of the Claiming", d: "Only the named, upon proof — a signature, an oath of GitHub, or the oracle of X — may open the vault and carry the gold to any wallet of their choosing. No other soul may touch it." },
            ].map((c, i) => (
              <Reveal key={c.n} delay={i * 100}>
                <div className="grid gap-4 sm:grid-cols-[90px_1fr] sm:gap-8">
                  <div style={{ fontFamily: "var(--f-display)", color: WAX }} className="text-6xl leading-none sm:text-right">
                    {c.n}
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold" style={{ fontVariant: "small-caps" }}>
                      {c.t}
                    </h3>
                    <p className="mt-2 max-w-xl text-[17px] leading-relaxed" style={{ color: INK_DIM }}>
                      {c.d}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="mt-14 flex justify-center gap-10 text-center" style={{ fontFamily: "var(--f-mono)", color: INK_FAINT }}>
              <div>
                <div className="text-3xl" style={{ color: INK }}>0</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em]">admin keys</div>
              </div>
              <div>
                <div className="text-3xl" style={{ color: INK }}>51</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em]">tests green</div>
              </div>
              <div>
                <div className="text-3xl" style={{ color: INK }}>3</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em]">proofs of name</div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* EL REGISTRO — lookup */}
        <section id="registro" className="py-20">
          <Reveal>
            <h2 style={{ fontFamily: "var(--f-display)" }} className="text-center text-5xl">
              The Register
            </h2>
            <Ornament />
            <p className="mx-auto mt-2 max-w-md text-center text-[17px] italic" style={{ color: INK_DIM }}>
              Seek thy name among the vaults, and claim what is thine.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div
              className="mx-auto mt-10 max-w-2xl border-2 p-8"
              style={{ borderColor: RULE, background: "rgba(238,224,196,0.45)" }}
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.18em]" style={{ color: INK_FAINT }}>
                    Proof
                  </span>
                  <select
                    suppressHydrationWarning
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                    className="border-0 border-b-2 bg-transparent py-1.5 pr-6 text-lg focus:outline-none"
                    style={{ borderColor: INK, color: INK }}
                  >
                    <option value="github">GitHub</option>
                    <option value="twitter">X (Twitter)</option>
                    <option value="wallet">Wallet</option>
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.18em]" style={{ color: INK_FAINT }}>
                    Name
                  </span>
                  <input
                    suppressHydrationWarning
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && lookup()}
                    placeholder={type === "wallet" ? "0x…" : "thy handle"}
                    className="border-0 border-b-2 bg-transparent py-1.5 text-xl italic placeholder:opacity-40 focus:outline-none"
                    style={{ borderColor: INK, color: INK }}
                  />
                </label>
                <button
                  onClick={lookup}
                  disabled={loading || !value}
                  className="rounded-sm px-6 py-2.5 font-semibold uppercase tracking-wider text-white disabled:opacity-40"
                  style={{ background: WAX }}
                >
                  {loading ? "Seeking…" : "Seek"}
                </button>
              </div>

              {error && <p className="mt-4 text-sm" style={{ color: "#8E2F2F" }}>{error}</p>}
              {rows && rows.length === 0 && (
                <p className="mt-6 italic" style={{ color: INK_DIM }}>
                  No vault bears this name yet. Issue the decree thyself.
                </p>
              )}
              {rows && rows.length > 0 && (
                <ul className="mt-6 flex flex-col">
                  {rows.map((r) => (
                    <li key={r.vault} className="flex items-center justify-between gap-4 border-t py-4" style={{ borderColor: RULE }}>
                      <div className="min-w-0">
                        <div className="truncate text-xs" style={{ fontFamily: "var(--f-mono)", color: INK_FAINT }}>
                          {r.vault}
                        </div>
                        <div style={{ fontFamily: "var(--f-display)", color: WAX_DARK }} className="mt-1 text-3xl">
                          {r.pendingLabel} ETH
                        </div>
                        {r.bound !== ZERO && (
                          <div className="mt-1 text-xs" style={{ fontFamily: "var(--f-mono)", color: INK_FAINT }}>
                            bound to {r.bound}
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/claim/${r.vault}`}
                        className="rounded-sm px-5 py-2 font-semibold uppercase tracking-wide text-white"
                        style={{ background: WAX }}
                      >
                        Claim
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        </section>

        {/* CIERRE + firma */}
        <section className="pb-16 pt-10 text-center">
          <Reveal>
            <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="text-[clamp(2.6rem,7vw,4.6rem)]">
              So let it be written.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-4 max-w-md text-lg italic" style={{ color: INK_DIM }}>
              Someone you follow ships every day and nobody pays them. Set thy seal upon it.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <Link
              href="/create"
              className="mt-8 inline-block rounded-sm px-8 py-3.5 text-lg font-semibold uppercase tracking-wider text-white shadow-md"
              style={{ background: WAX }}
            >
              Issue a decree
            </Link>
          </Reveal>
          <div className="mt-14 flex items-center justify-center gap-8">
            <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${RULE}, transparent)` }} />
            <WaxSeal size={90} />
            <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${RULE}, transparent)` }} />
          </div>
          <footer className="mt-10 text-xs leading-6" style={{ fontFamily: "var(--f-mono)", color: INK_FAINT }}>
            Permissionless & non-custodial · funds release only to the wallet that proves the name
            <br />
            Not affiliated with Robinhood or Flap
          </footer>
        </section>
      </div>
    </main>
  );
}
