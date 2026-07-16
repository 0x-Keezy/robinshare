"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bangers, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { Marquee } from "@/components/Marquee";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { useHideNav } from "@/lib/useHideNav";
import { useScrollSync } from "@/lib/scrollProgress";

/*
 * MANGA — el shonen (registro tinta-sobre-blanco del bake-off).
 * Página como CAPÍTULO de manga: paneles con borde de tinta gruesa y sombra de
 * imprenta, halftone, speed lines, onomatopeyas, el arquero ilustrado (asset Gemini,
 * fondo blanco = se funde solo con la página). Verde eléctrico como ÚNICO color.
 */

const bangers = Bangers({ weight: "400", subsets: ["latin"], variable: "--f-display" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--f-body" });
const plex = IBM_Plex_Mono({ weight: ["400"], subsets: ["latin"], variable: "--f-mono" });

const PAPER = "#FAFAF6";
const INKB = "#111311";
const GREEN = "#00D954";
const DIM = "rgba(17,19,17,0.72)";
const ZERO = "0x0000000000000000000000000000000000000000";

// sombra de imprenta (offset sólido, no blur)
const PANEL: React.CSSProperties = {
  background: "#fff",
  border: `4px solid ${INKB}`,
  boxShadow: `8px 8px 0 ${INKB}`,
};

function Onoma({ children, rotate = -8, color = GREEN }: { children: string; rotate?: number; color?: string }) {
  return (
    <span
      aria-hidden
      className="inline-block select-none px-3 py-1"
      style={{
        fontFamily: "var(--f-display)",
        fontSize: "clamp(1.6rem,4vw,2.6rem)",
        color: "#fff",
        background: color,
        border: `3px solid ${INKB}`,
        boxShadow: `5px 5px 0 ${INKB}`,
        transform: `rotate(${rotate}deg)`,
        letterSpacing: "0.04em",
        WebkitTextStroke: `1.5px ${INKB}`,
      }}
    >
      {children}
    </span>
  );
}

export function MangaHome() {
  useScrollSync();
  const navHidden = useHideNav();
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();

  return (
    <main
      className={`${bangers.variable} ${sans.variable} ${plex.variable} relative`}
      style={{ background: PAPER, color: INKB, fontFamily: "var(--f-body)" }}
    >
      {/* halftone de fondo */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.55]"
        style={{
          backgroundImage: `radial-gradient(rgba(17,19,17,0.11) 1.2px, transparent 1.2px)`,
          backgroundSize: "14px 14px",
        }}
      />

      {/* nav — barra de capítulo */}
      <nav
        className="fixed inset-x-0 top-0 z-40 transition-transform duration-300"
        style={{ transform: navHidden ? "translateY(-100%)" : "none" }}
      >
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="flex items-center justify-between px-4 py-2.5" style={{ ...PANEL, boxShadow: `5px 5px 0 ${INKB}` }}>
            <span style={{ fontFamily: "var(--f-display)", letterSpacing: "0.06em" }} className="text-2xl">
              FLEDGE
              <span className="ml-2 text-sm" style={{ color: DIM, fontFamily: "var(--f-mono)" }}>
                ch. 4663
              </span>
            </span>
            <Link
              href="/create"
              className="px-4 py-1.5 text-lg uppercase"
              style={{
                fontFamily: "var(--f-display)",
                background: GREEN,
                color: "#fff",
                border: `3px solid ${INKB}`,
                boxShadow: `4px 4px 0 ${INKB}`,
                WebkitTextStroke: `1px ${INKB}`,
              }}
            >
              Launch!!
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10">
        {/* SPLASH PAGE — hero */}
        <section className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 pb-10 pt-28 lg:grid-cols-[1.05fr_1fr]">
          {/* speed lines del splash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-conic-gradient(from 0deg at 72% 42%, rgba(17,19,17,0.06) 0deg 1.2deg, transparent 1.2deg 7deg)",
            }}
          />
          <div className="relative">
            <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.22em", color: DIM }} className="text-xs uppercase">
              Weekly Sherwood · Robinhood Chain
            </div>
            <h1
              style={{ fontFamily: "var(--f-display)", lineHeight: 0.94, letterSpacing: "0.02em" }}
              className="mt-4 text-[clamp(3.2rem,9vw,7rem)] uppercase"
            >
              The fees go
              <br />
              to the{" "}
              <span
                style={{
                  color: GREEN,
                  WebkitTextStroke: `2.5px ${INKB}`,
                  textShadow: `4px 4px 0 ${INKB}`,
                }}
              >
                builder!!
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed" style={{ color: DIM }}>
              Launch a coin for someone who ships. Every trade sends a slice into an on-chain
              vault with their name on it — GitHub, X, or wallet. Only they can claim it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                href="/create"
                className="px-7 py-3 text-2xl uppercase"
                style={{
                  fontFamily: "var(--f-display)",
                  background: GREEN,
                  color: "#fff",
                  border: `4px solid ${INKB}`,
                  boxShadow: `6px 6px 0 ${INKB}`,
                  WebkitTextStroke: `1.5px ${INKB}`,
                }}
              >
                Launch a coin!
              </Link>
              <a href="#scoreboard" className="text-lg font-bold underline decoration-4 underline-offset-4" style={{ color: INKB }}>
                I was funded →
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.16em]" style={{ fontFamily: "var(--f-mono)", color: DIM }}>
              <span>0 owner keys</span>
              <span>71 tests ✓</span>
              <span>100ms blocks</span>
              <span>custody: none</span>
            </div>
          </div>

          {/* el panel del arquero */}
          <Reveal>
            <div className="relative">
              <div className="relative overflow-hidden" style={PANEL}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/manga/archer.jpg" alt="" className="block w-full" draggable={false} />
                <div className="absolute -right-2 top-5 rotate-6">
                  <Onoma rotate={6}>FWOOSH!!</Onoma>
                </div>
              </div>
              <div
                className="absolute -bottom-5 left-6 px-3 py-1 text-sm font-bold uppercase"
                style={{ background: "#fff", border: `3px solid ${INKB}`, boxShadow: `4px 4px 0 ${INKB}` }}
              >
                “Your fees. Their vault.”
              </div>
            </div>
          </Reveal>
        </section>

        {/* separador speed-lines */}
        <div aria-hidden className="h-8" style={{ background: `repeating-linear-gradient(105deg, ${INKB} 0 3px, transparent 3px 26px)` }} />

        {/* CAPÍTULOS — cómo funciona */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 style={{ fontFamily: "var(--f-display)" }} className="text-center text-[clamp(2.4rem,6vw,4rem)] uppercase">
            How it works!!
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {[
              { ch: "Ch.1", t: "The Mark", d: "Pick a builder — GitHub, X, or wallet. Their coin drops on Flap in seconds. They don't even know yet!", rot: -1.5 },
              { ch: "Ch.2", t: "The Tithe", d: "Every buy & sell pays up: a slice of the tax streams into their vault. Automatic. Untouchable.", rot: 1 },
              { ch: "Ch.3", t: "The Claim", d: "They prove the name — signature, OAuth, or the X oracle — and sweep the gold. Nobody else. Ever.", rot: -0.5 },
            ].map((c, i) => (
              <Reveal key={c.ch} delay={i * 100}>
                <div className="h-full p-6" style={{ ...PANEL, transform: `rotate(${c.rot}deg)` }}>
                  <div style={{ fontFamily: "var(--f-mono)", color: DIM }} className="text-xs uppercase tracking-[0.2em]">
                    {c.ch}
                  </div>
                  <h3 style={{ fontFamily: "var(--f-display)", letterSpacing: "0.03em" }} className="mt-2 text-3xl uppercase">
                    <span style={{ color: GREEN, WebkitTextStroke: `1.5px ${INKB}` }}>{c.t}</span>
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed" style={{ color: DIM }}>
                    {c.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* marquee del capítulo */}
        <div className="border-y-4 py-2" style={{ borderColor: INKB, background: "#fff" }}>
          <Marquee duration={22}>
            <span style={{ fontFamily: "var(--f-display)", letterSpacing: "0.08em" }} className="text-2xl uppercase">
              <span style={{ WebkitTextStroke: `1px ${INKB}`, color: "transparent" }}>Every trade pays the builder ★ </span>
              <span style={{ color: GREEN, WebkitTextStroke: `1px ${INKB}` }}>Sworn on-chain ★ </span>
              <span style={{ WebkitTextStroke: `1px ${INKB}`, color: "transparent" }}>Only they can claim ★ </span>
            </span>
          </Marquee>
        </div>

        {/* SCOREBOARD — lookup */}
        <section id="scoreboard" className="mx-auto max-w-4xl px-4 py-24">
          <Reveal>
            <div className="relative p-8 sm:p-10" style={PANEL}>
              <div className="absolute -top-6 left-8">
                <Onoma rotate={-4}>KA-CHING!</Onoma>
              </div>
              <h2 style={{ fontFamily: "var(--f-display)" }} className="mt-2 text-[clamp(2.2rem,5.4vw,3.6rem)] uppercase">
                Gold under <span style={{ color: GREEN, WebkitTextStroke: `2px ${INKB}` }}>your name?</span>
              </h2>
              <p className="mt-2 max-w-md text-[15px]" style={{ color: DIM }}>
                Check the vaults sworn to your GitHub, X, or wallet — and claim what&apos;s yours.
              </p>

              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
                    Identity
                  </span>
                  <select
                    suppressHydrationWarning
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                    className="bg-white px-3 py-2.5 focus:outline-none"
                    style={{ border: `3px solid ${INKB}`, fontFamily: "var(--f-mono)" }}
                  >
                    <option value="github">GitHub</option>
                    <option value="twitter">X (Twitter)</option>
                    <option value="wallet">Wallet</option>
                  </select>
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
                    Name on the vault
                  </span>
                  <input
                    suppressHydrationWarning
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && lookup()}
                    placeholder={type === "wallet" ? "0x…" : "@handle"}
                    className="bg-white px-3 py-2.5 text-lg placeholder:opacity-40 focus:outline-none"
                    style={{ border: `3px solid ${INKB}`, fontFamily: "var(--f-mono)" }}
                  />
                </label>
                <button
                  onClick={lookup}
                  disabled={loading || !value}
                  className="px-6 py-2.5 text-xl uppercase disabled:opacity-40"
                  style={{
                    fontFamily: "var(--f-display)",
                    background: GREEN,
                    color: "#fff",
                    border: `3px solid ${INKB}`,
                    boxShadow: `5px 5px 0 ${INKB}`,
                    WebkitTextStroke: `1px ${INKB}`,
                  }}
                >
                  {loading ? "…" : "Check!!"}
                </button>
              </div>

              {error && (
                <p className="mt-4 text-sm font-bold" style={{ color: "#C0271D" }}>
                  {error}
                </p>
              )}
              {rows && rows.length === 0 && (
                <p className="mt-7 font-medium" style={{ color: DIM }}>
                  No vault yet… be the hero who launches it!
                </p>
              )}
              {rows && rows.length > 0 && (
                <ul className="mt-7 flex flex-col gap-4">
                  {rows.map((r) => (
                    <li key={r.vault} className="flex flex-wrap items-center justify-between gap-3 p-4" style={{ border: `3px solid ${INKB}` }}>
                      <div className="min-w-0">
                        <div className="truncate text-xs" style={{ fontFamily: "var(--f-mono)", color: DIM }}>
                          {r.vault}
                        </div>
                        <div style={{ fontFamily: "var(--f-display)", color: GREEN, WebkitTextStroke: `1.5px ${INKB}` }} className="text-3xl">
                          {r.pendingLabel} ETH
                        </div>
                        {r.bound !== ZERO && (
                          <div className="text-xs" style={{ fontFamily: "var(--f-mono)", color: DIM }}>
                            bound to {r.bound}
                          </div>
                        )}
                      </div>
                      <Link
                        href={`/claim/${r.vault}`}
                        className="px-5 py-2 text-lg uppercase"
                        style={{
                          fontFamily: "var(--f-display)",
                          background: GREEN,
                          color: "#fff",
                          border: `3px solid ${INKB}`,
                          boxShadow: `4px 4px 0 ${INKB}`,
                          WebkitTextStroke: `1px ${INKB}`,
                        }}
                      >
                        Claim!
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Reveal>
        </section>

        {/* PRÓXIMO CAPÍTULO — cierre */}
        <section className="mx-auto max-w-6xl px-4 pb-16 text-center">
          <Reveal>
            <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 0.95 }} className="text-[clamp(2.8rem,8vw,5.6rem)] uppercase">
              Next chapter:
              <br />
              <span style={{ color: GREEN, WebkitTextStroke: `2.5px ${INKB}`, textShadow: `4px 4px 0 ${INKB}` }}>
                your favorite dev gets paid.
              </span>
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <Link
              href="/create"
              className="mt-9 inline-block px-8 py-3.5 text-2xl uppercase"
              style={{
                fontFamily: "var(--f-display)",
                background: GREEN,
                color: "#fff",
                border: `4px solid ${INKB}`,
                boxShadow: `7px 7px 0 ${INKB}`,
                WebkitTextStroke: `1.5px ${INKB}`,
              }}
            >
              Launch a coin for someone!!
            </Link>
          </Reveal>
          <footer className="mx-auto mt-16 max-w-xl border-t-4 pt-5 text-xs leading-6" style={{ borderColor: INKB, fontFamily: "var(--f-mono)", color: DIM }}>
            FLEDGE — permissionless & non-custodial. Funds release only to the wallet that proves
            the name. Not affiliated with Robinhood or Flap. — fin del capítulo —
          </footer>
        </section>
      </div>
    </main>
  );
}
