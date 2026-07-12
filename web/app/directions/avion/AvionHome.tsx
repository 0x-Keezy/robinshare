"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { useVaultLookup } from "@/lib/useVaultLookup";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--f-display" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--f-body" });
const plex = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

const PAPER = "#f1e8d6";
const INK = "#1b2436";
const MAILRED = "#c0392b";
const MAILBLUE = "#2b4a7a";
const KRAFT = "#b6884a";
const ZERO = "0x0000000000000000000000000000000000000000";

const AIRMAIL_STRIPE =
  "repeating-linear-gradient(45deg, #c0392b 0 12px, transparent 12px 24px, #2b4a7a 24px 36px, transparent 36px 48px)";

// pájaro origami de 2 trazos (compartido con la marca)
function Bird({ size = 22, color = INK, w = 1.6 }: { size?: number; color?: string; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 15 L12 7 L22 15" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11 L12 16 L17 11" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// sello de cera — disco rojo con relieve, sombra de profundidad
function WaxSeal({ size = 132 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden style={{ filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.28))" }}>
      <defs>
        <radialGradient id="wax" cx="42%" cy="36%" r="72%">
          <stop offset="0%" stopColor="#e0503f" />
          <stop offset="55%" stopColor="#b7311f" />
          <stop offset="100%" stopColor="#7e1e12" />
        </radialGradient>
      </defs>
      {/* borde de cera irregular */}
      <circle cx="60" cy="60" r="52" fill="url(#wax)" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="#5c150c" strokeOpacity="0.5" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="43" fill="none" stroke="#f3c9c1" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
      {/* relieve: pájaro + iniciales */}
      <g transform="translate(60 54) scale(1.9)" opacity="0.92">
        <path d="M-10 4 L0 -4 L10 4" fill="none" stroke="#f3c9c1" strokeOpacity="0.85" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-5 1 L0 5 L5 1" fill="none" stroke="#f3c9c1" strokeOpacity="0.85" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="60" y="92" textAnchor="middle" fontSize="8" letterSpacing="2" fill="#f3c9c1" fillOpacity="0.8" fontFamily="monospace">FLEDGE</text>
    </svg>
  );
}

export function AvionHome() {
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [plane, setPlane] = useState({ x: 4, y: 78, a: 0, on: false });

  // avioncito que recorre la ruta punteada segun el scroll (getPointAtLength → robusto a viewport)
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    let len = 0;
    try {
      len = path.getTotalLength();
    } catch {
      return;
    }
    const VB_W = 1000;
    const VB_H = 320;
    const update = () => {
      const hero = heroRef.current;
      if (!hero) return;
      const span = Math.max(1, hero.offsetHeight * 0.92);
      const p = Math.min(1, Math.max(0, window.scrollY / span));
      const a = path.getPointAtLength(p * len);
      const b = path.getPointAtLength(Math.min(len, p * len + 6));
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      setPlane({ x: (a.x / VB_W) * 100, y: (a.y / VB_H) * 100, a: ang, on: true });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <main
      className={`${bricolage.variable} ${instrument.variable} ${plex.variable} min-h-screen`}
      style={{ background: PAPER, color: INK, fontFamily: "var(--f-body)" }}
    >
      {/* banda de correo aéreo — sello de marca superior */}
      <div aria-hidden style={{ height: 8, background: AIRMAIL_STRIPE }} />

      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Bird size={20} color={INK} />
          <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em" }} className="text-xs uppercase">
            Fledge
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="hidden rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] sm:inline"
            style={{ borderColor: MAILRED, color: MAILRED, fontFamily: "var(--f-mono)" }}
          >
            Par Avion
          </span>
          <Link href="/create" className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: INK, color: PAPER }}>
            Dispatch a coin
          </Link>
        </div>
      </nav>

      {/* hero */}
      <header ref={heroRef} className="relative mx-auto max-w-6xl overflow-hidden px-6 pt-10 pb-24 sm:pt-14">
        {/* ruta de vuelo punteada + avioncito */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-full w-full"
          viewBox="0 0 1000 320"
          preserveAspectRatio="none"
        >
          <path
            ref={pathRef}
            d="M-20 250 C 200 120, 420 300, 640 150 S 980 40, 1040 70"
            fill="none"
            stroke={KRAFT}
            strokeOpacity="0.5"
            strokeWidth="2"
            strokeDasharray="2 9"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {plane.on && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-0"
            style={{ left: `${plane.x}%`, top: `${plane.y}%`, transform: `translate(-50%,-50%) rotate(${plane.a}deg)` }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path d="M2 12 L22 3 L15 21 L11 13 Z" fill={MAILRED} />
              <path d="M11 13 L22 3" stroke="#7e1e12" strokeWidth="0.8" />
            </svg>
          </div>
        )}

        <div className="relative z-10 grid items-center gap-10 sm:grid-cols-[1.35fr_1fr]">
          <div>
            <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.22em", color: MAILRED }} className="text-xs uppercase">
              Social fee escrow · Robinhood Chain
            </div>
            <h1 style={{ fontFamily: "var(--f-display)", lineHeight: 0.98, fontWeight: 800 }} className="mt-5 text-[clamp(2.7rem,6.4vw,5rem)]">
              Dispatch a coin to <span style={{ color: MAILRED }}>someone worth backing.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg" style={{ color: "rgba(27,36,54,0.72)" }}>
              Address it to a builder, an open source dev, anyone — by their GitHub, their X, or a wallet. Every trade franks
              a little postage into escrow. It stays poste restante until they claim it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/create" className="rounded-full px-6 py-3 text-base font-semibold" style={{ background: INK, color: PAPER }}>
                Dispatch a coin
              </Link>
              <a href="#claim" className="text-base font-semibold underline decoration-1 underline-offset-4" style={{ color: MAILRED }}>
                Collect my mail
              </a>
            </div>
          </div>

          <div className="flex justify-center sm:justify-end">
            <div className="relative">
              <WaxSeal />
              <div
                className="absolute -right-3 -top-3 rotate-6 rounded border px-2 py-1 text-[9px] uppercase tracking-[0.2em]"
                style={{ borderColor: MAILBLUE, color: MAILBLUE, fontFamily: "var(--f-mono)", background: "rgba(43,74,122,0.06)" }}
              >
                Sealed
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* how it works — address / frank / deliver */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div
          style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.22em", color: "rgba(27,36,54,0.45)", borderColor: "rgba(27,36,54,0.14)" }}
          className="mb-10 border-t pt-6 text-xs uppercase"
        >
          How it works
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { t: "Address", d: "Name the recipient by their GitHub, X, or wallet. Their coin ships on Flap in seconds." },
            { t: "Frank", d: "Every buy and sell franks a slice of the trading tax into an on-chain escrow held in their name." },
            { t: "Deliver", d: "They prove who they are and the escrow is delivered, swept to any wallet they choose." },
          ].map((s, i) => (
            <Reveal as="div" delay={i * 100} key={s.t}>
              <div className="rounded-2xl border p-6" style={{ borderColor: "rgba(27,36,54,0.16)", background: "rgba(255,255,255,0.35)" }}>
                <div className="flex items-center gap-2" style={{ fontFamily: "var(--f-mono)", color: MAILRED }}>
                  <span className="text-sm">0{i + 1}</span>
                  <span aria-hidden style={{ height: 3, width: 3, borderRadius: 9, background: MAILRED }} />
                </div>
                <h3 style={{ fontFamily: "var(--f-display)", fontWeight: 700 }} className="mt-3 text-2xl">
                  {s.t}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "rgba(27,36,54,0.7)" }}>
                  {s.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* lookup — poste restante */}
      <section id="claim" className="mx-auto max-w-6xl px-6 py-14">
        <div
          className="relative overflow-hidden rounded-3xl p-8 sm:p-12"
          style={{ background: INK, color: PAPER }}
        >
          <div aria-hidden className="absolute inset-x-0 top-0" style={{ height: 6, background: AIRMAIL_STRIPE }} />
          <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.22em", color: "rgba(241,232,214,0.5)" }} className="text-xs uppercase">
            Poste restante
          </div>
          <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 800 }} className="mt-3 text-[clamp(2rem,5vw,3.4rem)]">
            Is there mail held for <span style={{ color: "#ff8a6b" }}>you</span>?
          </h2>
          <p className="mt-3 max-w-md text-base" style={{ color: "rgba(241,232,214,0.7)" }}>
            Look up the escrows waiting under your GitHub, X, or wallet, and collect what is addressed to you.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-xl border bg-transparent px-4 py-3"
              style={{ borderColor: "rgba(241,232,214,0.25)", color: PAPER, fontFamily: "var(--f-mono)" }}
            >
              <option style={{ color: "#000" }} value="github">GitHub</option>
              <option style={{ color: "#000" }} value="twitter">X (Twitter)</option>
              <option style={{ color: "#000" }} value="wallet">Wallet</option>
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder={type === "wallet" ? "0x wallet address" : "handle"}
              className="flex-1 rounded-xl border bg-transparent px-5 py-3 placeholder:opacity-40"
              style={{ borderColor: "rgba(241,232,214,0.25)", color: PAPER, fontFamily: "var(--f-mono)" }}
            />
            <button
              onClick={lookup}
              disabled={loading || !value}
              className="rounded-xl px-6 py-3 font-semibold disabled:opacity-40"
              style={{ background: MAILRED, color: PAPER }}
            >
              {loading ? "Checking…" : "Check the counter"}
            </button>
          </div>

          {error && <p className="mt-4 text-sm" style={{ color: "#ff8a6b" }}>{error}</p>}
          {rows && rows.length === 0 && (
            <p className="mt-8" style={{ color: "rgba(241,232,214,0.55)" }}>No mail held for this identity yet.</p>
          )}
          {rows && rows.length > 0 && (
            <ul className="mt-8 flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.vault} className="rounded-2xl border p-4" style={{ borderColor: "rgba(241,232,214,0.16)" }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm" style={{ fontFamily: "var(--f-mono)", color: "rgba(241,232,214,0.6)" }}>{r.vault}</div>
                      <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, color: "#ff8a6b" }} className="mt-1 text-3xl tabular-nums">
                        {r.pendingLabel} ETH
                      </div>
                      {r.bound !== ZERO && <div className="mt-1 text-xs" style={{ color: "rgba(241,232,214,0.45)" }}>bound to {r.bound}</div>}
                    </div>
                    <Link href={`/claim/${r.vault}`} className="rounded-full px-5 py-2 font-semibold" style={{ background: MAILRED, color: PAPER }}>
                      Collect
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-14 text-xs" style={{ color: "rgba(27,36,54,0.5)", fontFamily: "var(--f-mono)" }}>
        <div className="flex items-center gap-2">
          <Bird size={16} color="rgba(27,36,54,0.6)" />
          <span style={{ letterSpacing: "0.22em" }} className="uppercase">Fledge</span>
        </div>
        <p className="mt-3 max-w-2xl leading-relaxed">
          Permissionless and non-custodial. Funds can only ever be released to the wallet that proves the recipient
          identity. Not affiliated with Robinhood or Flap.
        </p>
      </footer>
    </main>
  );
}
