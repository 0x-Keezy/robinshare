"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Instrument_Serif, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { useScrollSync } from "@/lib/scrollProgress";

const SherwoodScene = dynamic(() => import("./SherwoodScene"), { ssr: false });

const serif = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--f-display" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--f-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

const PINE = "#030805";
const CREAM = "#f2efe6";
const SIGNAL = "#00C805";
const GOLD = "#d9a441";
const ZERO = "0x0000000000000000000000000000000000000000";
const HAIR = "rgba(242,239,230,0.14)";

// hairline que MUERE en los bordes (regla del vault: nunca una línea recta full-width)
const hairline = (o = 0.22) =>
  `linear-gradient(to right, transparent, rgba(242,239,230,${o}) 28%, rgba(242,239,230,${o}) 72%, transparent)`;

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/*
 * Preloader-obra (lección Aegis): % honesto (fuentes + primer frame WebGL + piso
 * temporal), reveal por IRIS anclado al punto de luz de la gate (~50% 46%), doble
 * señal: el contenido del hero entra al 50% del reveal (un solo movimiento).
 */
function Preloader({ onReveal, onDone, reduce }: { onReveal: () => void; onDone: () => void; reduce: boolean }) {
  const [pct, setPct] = useState(0);
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    const signals = { fonts: false, frame: false, floor: false };
    const t0 = performance.now();
    document.fonts.ready.then(() => (signals.fonts = true));
    setTimeout(() => (signals.floor = true), 900);
    const poll = setInterval(() => {
      if ((window as unknown as { __sherwoodReady?: boolean }).__sherwoodReady) signals.frame = true;
      if (performance.now() - t0 > 4500) signals.frame = true; // no colgar si WebGL falla
    }, 100);

    let raf = 0;
    let shown = 0;
    const tick = () => {
      if (disposed) return;
      const real = ((signals.fonts ? 1 : 0) + (signals.frame ? 1 : 0) + (signals.floor ? 1 : 0)) / 3;
      shown += (real * 100 - shown) * 0.08;
      setPct(Math.min(100, Math.round(shown)));
      if (shown >= 99.4 && real === 1) {
        reveal();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const reveal = () => {
      const el = overlay.current;
      if (!el) return onDone();
      if (reduce) {
        onReveal();
        onDone();
        return;
      }
      const D = 950;
      const start = performance.now();
      let signaled = false;
      const anim = () => {
        if (disposed) return;
        const t = Math.min(1, (performance.now() - start) / D);
        const e = 1 - Math.pow(1 - t, 3); // expo-out (familia del portal Aegis)
        const r = e * 165; // vmax
        el.style.maskImage = el.style.webkitMaskImage = `radial-gradient(circle at 50% 46%, transparent ${r}vmax, black ${r}vmax)`;
        if (t >= 0.5 && !signaled) {
          signaled = true;
          onReveal();
        }
        if (t < 1) requestAnimationFrame(anim);
        else onDone();
      };
      requestAnimationFrame(anim);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      clearInterval(poll);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: PINE }}
    >
      <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.3em", color: "rgba(242,239,230,0.45)" }} className="text-[11px] uppercase">
        Robinhood Chain
      </div>
      <div style={{ fontFamily: "var(--f-display)", color: CREAM }} className="mt-3 text-6xl tracking-tight">
        Fledge
      </div>
      <div
        style={{ fontFamily: "var(--f-display)", color: SIGNAL, fontVariantNumeric: "tabular-nums" }}
        className="mt-8 text-3xl"
      >
        {pct}%
      </div>
      <div style={{ fontFamily: "var(--f-mono)", color: "rgba(242,239,230,0.4)" }} className="mt-3 text-xs tracking-[0.2em] uppercase">
        Nock · draw · loose
      </div>
    </div>
  );
}

/* -------------------------------- página -------------------------------- */

export function SherwoodHome() {
  useScrollSync();
  const reduce = useReducedMotion();
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();
  const [revealed, setRevealed] = useState(false);
  const [preGone, setPreGone] = useState(false);

  const inCls = (d: number) =>
    `transition-all duration-700 ${revealed ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-5 blur-[6px]"}` +
    ` [transition-delay:${d}ms]`;

  return (
    <main
      className={`${serif.variable} ${sans.variable} ${mono.variable} relative`}
      style={{ background: PINE, color: CREAM, fontFamily: "var(--f-body)" }}
    >
      <SherwoodScene reduce={reduce} />
      {!preGone && (
        <Preloader onReveal={() => setRevealed(true)} onDone={() => setPreGone(true)} reduce={reduce} />
      )}

      {/* nav — scrim superior para que el contenido que pasa por debajo no choque */}
      <nav
        className="fixed inset-x-0 top-0 z-20"
        style={{ background: "linear-gradient(to bottom, rgba(2,6,4,0.88) 20%, transparent)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className={`flex items-center gap-2 ${inCls(500)}`}>
            {/* pájaro origami de la marca */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M2 15 L12 7 L22 15" stroke={SIGNAL} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 11 L12 16 L17 11" stroke={SIGNAL} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em" }} className="text-xs uppercase">
              Fledge
            </span>
          </div>
          <Link
            href="/create"
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${inCls(620)}`}
            style={{ background: SIGNAL, color: "#04120a" }}
          >
            Launch a coin
          </Link>
        </div>
      </nav>

      {/* contenido: el DOM scrollea nativo SOBRE el canvas (3D = capa, DOM = página) */}
      <div className="relative z-10">
        {/* ACTO 1 — el claro del bosque */}
        <section className="relative min-h-[165vh]">
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 pt-20">
            {/* scrim local: legibilidad sin tapar el mundo (muere en los bordes) */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-[110vh] w-full"
              style={{
                background: "radial-gradient(90% 62% at 34% 46%, rgba(3,8,5,0.62), transparent 72%)",
              }}
            />
            <div className="relative max-w-3xl">
              <div
                className={inCls(150)}
                style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: SIGNAL }}
              >
                <span className="text-xs uppercase">Social fee escrow · Robinhood Chain</span>
              </div>
              <h1
                style={{ fontFamily: "var(--f-display)", lineHeight: 0.96, fontWeight: 400 }}
                className={`mt-6 text-[clamp(3.2rem,8.6vw,7.6rem)] tracking-tight ${inCls(280)}`}
              >
                <span
                  className="block"
                  style={{ WebkitTextStroke: `1.5px ${CREAM}`, color: "transparent" }}
                >
                  Take from the fees.
                </span>
                <span className="block" style={{ color: SIGNAL, fontStyle: "italic" }}>
                  Give to the builder.
                </span>
              </h1>
              <p className={`mt-8 max-w-md text-lg ${inCls(430)}`} style={{ color: "rgba(242,239,230,0.75)" }}>
                Launch a coin for someone who ships. A slice of every trade escrows to their GitHub,
                X, or wallet — and only they can ever claim it.
              </p>
              <div className={`mt-9 flex flex-wrap items-center gap-4 ${inCls(560)}`}>
                <Link
                  href="/create"
                  className="rounded-full px-6 py-3 text-base font-semibold"
                  style={{ background: SIGNAL, color: "#04120a" }}
                >
                  Launch a coin
                </Link>
                <a
                  href="#ledger"
                  className="text-base font-medium underline decoration-1 underline-offset-4"
                  style={{ color: CREAM }}
                >
                  I was funded →
                </a>
              </div>
            </div>
            {/* hint DENTRO del primer viewport */}
            <div
              className={`pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 ${inCls(700)}`}
              style={{ fontFamily: "var(--f-mono)", color: "rgba(242,239,230,0.4)" }}
            >
              <span className="text-[10px] uppercase tracking-[0.3em]">Scroll into the forest</span>
              <span aria-hidden className="block h-10 w-px" style={{ background: hairline(0.35) }} />
            </div>
          </div>
        </section>

        {/* ACTO 2 — el mecanismo (ledger editorial, no cards) */}
        <section className="relative min-h-[120vh]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-full"
              style={{
                background: "radial-gradient(80% 55% at 50% 42%, rgba(3,8,5,0.68), transparent 78%)",
              }}
            />
            <div className="relative">
              <Reveal>
                <div
                  style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: "rgba(242,239,230,0.45)" }}
                  className="text-xs uppercase"
                >
                  How it works
                </div>
                <h2
                  style={{ fontFamily: "var(--f-display)", lineHeight: 1 }}
                  className="mt-4 max-w-2xl text-[clamp(2.2rem,5vw,3.8rem)]"
                >
                  The fees ride to <span style={{ color: SIGNAL, fontStyle: "italic" }}>whoever earned them</span>.
                </h2>
              </Reveal>
              <div className="mt-14 flex flex-col">
                {[
                  {
                    k: "01 · Mark",
                    t: "Name the builder",
                    d: "Pick someone who ships — by their GitHub, their X, or a wallet. Their coin goes live on Flap in seconds.",
                  },
                  {
                    k: "02 · Tax",
                    t: "Every trade pays them",
                    d: "A slice of the trading tax drips into an on-chain vault held in their name. Automatic, permissionless, non-custodial.",
                  },
                  {
                    k: "03 · Claim",
                    t: "Only they collect",
                    d: "They prove the name is theirs — signature, OAuth, or the X oracle — and sweep the gold to any wallet. No one else can touch it.",
                  },
                ].map((row, i) => (
                  <Reveal key={row.k} delay={i * 110}>
                    <div
                      className="grid gap-3 py-8 sm:grid-cols-[180px_260px_1fr] sm:gap-8"
                      style={{ borderTop: "1px solid transparent", borderImage: `${hairline()} 1` }}
                    >
                      <span style={{ fontFamily: "var(--f-mono)", color: SIGNAL }} className="text-sm uppercase tracking-[0.18em]">
                        {row.k}
                      </span>
                      <h3 style={{ fontFamily: "var(--f-display)" }} className="text-3xl">
                        {row.t}
                      </h3>
                      <p className="max-w-xl text-[15px] leading-relaxed" style={{ color: "rgba(242,239,230,0.68)" }}>
                        {row.d}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ACTO 3 — la flecha */}
        <section className="relative min-h-[130vh]">
          <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6">
            <div className="relative max-w-xl">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-16 -inset-y-20"
                style={{ background: "radial-gradient(80% 70% at 40% 50%, rgba(3,8,5,0.62), transparent 75%)" }}
              />
              <div className="relative">
                <Reveal>
                  <div
                    style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: "rgba(242,239,230,0.45)" }}
                    className="text-xs uppercase"
                  >
                    The claim
                  </div>
                  <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 0.98 }} className="mt-4 text-[clamp(2.6rem,6vw,4.6rem)]">
                    One arrow.{" "}
                    <span style={{ color: SIGNAL, fontStyle: "italic" }}>One name on it.</span>
                  </h2>
                </Reveal>
                <Reveal delay={140}>
                  <p className="mt-7 max-w-md text-lg leading-relaxed" style={{ color: "rgba(242,239,230,0.72)" }}>
                    The vault is sworn to a single identity. A wallet signs. A GitHub logs in. An X
                    handle proves itself through the on-chain oracle. Nothing else opens it — not
                    us, not the launcher, not Robinhood.
                  </p>
                </Reveal>
                <Reveal delay={260}>
                  <div className="mt-8 flex flex-wrap gap-3" style={{ fontFamily: "var(--f-mono)" }}>
                    {["wallet signature", "github oauth", "x oracle proof"].map((m) => (
                      <span
                        key={m}
                        className="rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.14em]"
                        style={{ borderColor: HAIR, color: "rgba(242,239,230,0.7)" }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ACTO 4 — el ledger (lookup) — la flecha ya clavó: acá está el oro */}
        <section id="ledger" className="relative min-h-[125vh]">
          <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-24">
            <Reveal>
              <div
                className="relative overflow-hidden rounded-2xl p-8 sm:p-12"
                style={{ background: "rgba(2,6,4,0.78)", border: `1px solid ${HAIR}` }}
              >
                <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: hairline(0.4) }} />
                <div
                  style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: SIGNAL }}
                  className="text-xs uppercase"
                >
                  The ledger
                </div>
                <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="mt-4 text-[clamp(2.2rem,5vw,3.6rem)]">
                  Is there gold under <span style={{ color: GOLD, fontStyle: "italic" }}>your name</span>?
                </h2>
                <p className="mt-3 max-w-md" style={{ color: "rgba(242,239,230,0.66)" }}>
                  Check the vaults sworn to your GitHub, X, or wallet — and claim what is yours.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                    className="rounded-lg border bg-transparent px-4 py-3"
                    style={{ borderColor: HAIR, color: CREAM, fontFamily: "var(--f-mono)" }}
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
                    className="flex-1 rounded-lg border bg-transparent px-5 py-3 placeholder:opacity-40"
                    style={{ borderColor: HAIR, color: CREAM, fontFamily: "var(--f-mono)" }}
                  />
                  <button
                    onClick={lookup}
                    disabled={loading || !value}
                    className="rounded-lg px-6 py-3 font-semibold disabled:opacity-40"
                    style={{ background: SIGNAL, color: "#04120a" }}
                  >
                    {loading ? "Checking…" : "Check the ledger"}
                  </button>
                </div>

                {error && (
                  <p className="mt-4 text-sm" style={{ color: "#ff8f6b" }}>
                    {error}
                  </p>
                )}
                {rows && rows.length === 0 && (
                  <p className="mt-8" style={{ color: "rgba(242,239,230,0.5)" }}>
                    No vault under this name yet. Launch one for someone — or get someone to launch yours.
                  </p>
                )}
                {rows && rows.length > 0 && (
                  <ul className="mt-8 flex flex-col">
                    {rows.map((r) => (
                      <li
                        key={r.vault}
                        className="flex items-center justify-between gap-4 py-4"
                        style={{ borderTop: "1px solid transparent", borderImage: `${hairline()} 1` }}
                      >
                        <div>
                          <div className="text-xs" style={{ fontFamily: "var(--f-mono)", color: "rgba(242,239,230,0.55)" }}>
                            {r.vault}
                          </div>
                          <div
                            style={{ fontFamily: "var(--f-display)", color: GOLD, fontVariantNumeric: "tabular-nums" }}
                            className="mt-1 text-3xl"
                          >
                            {r.pendingLabel} ETH
                          </div>
                          {r.bound !== ZERO && (
                            <div className="mt-1 text-xs" style={{ color: "rgba(242,239,230,0.4)" }}>
                              bound to {r.bound}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/claim/${r.vault}`}
                          className="rounded-full px-5 py-2 font-semibold"
                          style={{ background: SIGNAL, color: "#04120a" }}
                        >
                          Claim
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ACTO 5 — el disparo final + footer */}
        <section className="relative">
          {/* scrim: la cámara termina dentro del claro — el texto necesita base oscura */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(75% 60% at 50% 45%, rgba(2,7,4,0.72), transparent 82%)" }}
          />
          <div className="relative mx-auto flex min-h-[90vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
            <Reveal>
              <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 0.96 }} className="text-[clamp(2.8rem,7vw,5.6rem)]">
                Loose your arrow<span style={{ color: SIGNAL }}>.</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-md text-lg" style={{ color: "rgba(242,239,230,0.7)" }}>
                Someone you follow ships every day and nobody pays them. Fix that in one transaction.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <Link
                href="/create"
                className="mt-9 inline-block rounded-full px-8 py-4 text-lg font-semibold"
                style={{ background: SIGNAL, color: "#04120a" }}
              >
                Launch a coin for someone
              </Link>
            </Reveal>
          </div>
          <footer className="mx-auto max-w-6xl px-6 pb-12 pt-8">
            <div aria-hidden className="mb-6 h-px" style={{ background: hairline(0.18) }} />
            <div
              className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              style={{ color: "rgba(242,239,230,0.42)", fontFamily: "var(--f-mono)" }}
            >
              <span className="uppercase tracking-[0.26em]">Fledge</span>
              <p className="max-w-xl leading-relaxed">
                Permissionless and non-custodial. Funds release only to the wallet that proves the
                recipient identity. Not affiliated with Robinhood or Flap.
              </p>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
