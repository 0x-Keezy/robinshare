"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archivo_Black, Archivo, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { LiveVaultFeed } from "@/components/LiveVaultFeed";
import { Marquee } from "@/components/Marquee";
import { Stat } from "@/components/Stat";
import { Magnetic } from "@/components/Magnetic";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { Scroll, useScrollSync } from "@/lib/scrollProgress";
import { useHideNav } from "@/lib/useHideNav";

const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--f-display" });
const body = Archivo({ subsets: ["latin"], variable: "--f-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

const BG = "#04070a";
const WHITE = "#f4f6f5";
const GREEN = "#00C805";
const ZERO = "0x0000000000000000000000000000000000000000";
const HAIR = "rgba(244,246,245,0.14)";

const hairline = (o = 0.2) =>
  `linear-gradient(to right, transparent, rgba(244,246,245,${o}) 28%, rgba(244,246,245,${o}) 72%, transparent)`;

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

// la pluma de la marca (la pluma de la gorra = el logo de Robinhood, como guiño SVG propio)
function Feather({ size = 20, color = GREEN }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 4 C14 4, 7 9, 5 20 L7 20 C8 14, 12 8, 20 4 Z"
        fill={color}
        opacity="0.9"
      />
      <path d="M5 20 C9 15, 14 10, 20 4" stroke={color} strokeWidth="0.6" opacity="0.6" />
    </svg>
  );
}

export function LegendHome() {
  useScrollSync();
  const navHidden = useHideNav();
  const reduce = useReducedMotion();
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();
  const feather = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  // LA PLUMA (foto sobre negro, mix-blend screen): flota en el hero y CAE con el
  // scroll — rotando suave — hasta posarse hacia el cierre. Un solo rAF scrubbed.
  useEffect(() => {
    let raf = 0;
    let cur = 0;
    const mouse = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const target = reduce ? 0.06 : Scroll.progress;
      cur += (target - cur) * 0.08;
      const p = cur;
      const t = performance.now() / 1000;
      if (feather.current) {
        const sway = reduce ? 0 : Math.sin(t * 0.5) * 2.2;
        const bob = reduce ? 0 : Math.sin(t * 0.8) * 10;
        const fall = p * 62; // vh que cae a lo largo de la página
        const rot = -8 + Math.sin(p * Math.PI * 2.2) * 14 + sway;
        feather.current.style.transform =
          `translate3d(calc(${mouse.x * 14}px + ${p * -6}vw), calc(${bob + mouse.y * 8}px + ${fall}vh), 0) rotate(${rot}deg)`;
      }
      if (glow.current) {
        glow.current.style.opacity = String(0.5 + Math.sin(t * 1.1) * 0.12);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, [reduce]);

  return (
    <main
      className={`${display.variable} ${body.variable} ${mono.variable} relative`}
      style={{ background: BG, color: WHITE, fontFamily: "var(--f-body)" }}
    >
      {/* ============ EL SET: negro puro + la pluma de luz ============ */}
      <div aria-hidden className="fixed inset-0 z-0 overflow-hidden">
        {/* resplandor que respira detrás de la pluma */}
        <div
          ref={glow}
          className="absolute right-[2%] top-[6%] h-[70vh] w-[46vw]"
          style={{ background: "radial-gradient(50% 45% at 55% 40%, rgba(0,200,5,0.13), transparent 70%)", filter: "blur(10px)" }}
        />
        <div ref={feather} className="absolute right-[4%] top-[-4%] w-[min(38vw,520px)] will-change-transform">
          {/* máscara radial: el borde de la foto se funde — solo queda la pluma de luz */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/legend/feather.jpg"
            alt=""
            className="block w-full"
            style={{
              mixBlendMode: "screen",
              filter: "brightness(1.02) contrast(1.1)",
              maskImage: "radial-gradient(58% 58% at 50% 50%, black 52%, transparent 76%)",
              WebkitMaskImage: "radial-gradient(58% 58% at 50% 50%, black 52%, transparent 76%)",
            }}
            draggable={false}
          />
        </div>
        {/* viñeta fintech */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 58%, rgba(0,0,0,0.5))" }}
        />
      </div>

      {/* nav */}
      <nav
        className="fixed inset-x-0 top-0 z-20 transition-transform duration-300"
        style={{
          background: "linear-gradient(to bottom, rgba(4,7,10,0.96) 0%, rgba(4,7,10,0.75) 55%, transparent)",
          transform: navHidden ? "translateY(-100%)" : "none",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Feather />
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em" }} className="text-xs uppercase">
              Fledge
            </span>
          </div>
          <Link
            href="/create"
            className="rounded-full px-4 py-1.5 text-sm font-bold"
            style={{ background: GREEN, color: "#03140a" }}
          >
            Launch a coin
          </Link>
        </div>
      </nav>

      <div className="relative z-10">
        {/* hero — overview del mercado */}
        <section className="relative min-h-[160vh]">
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 pt-20">
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-[110vh] w-full"
              style={{ background: "radial-gradient(85% 60% at 32% 46%, rgba(4,7,10,0.68), transparent 74%)" }}
            />
            <div className="relative max-w-3xl">
              <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: GREEN }} className="text-xs uppercase">
                Social fee escrow · Robinhood Chain
              </div>
              <h1
                style={{ fontFamily: "var(--f-display)", lineHeight: 0.98 }}
                className="mt-6 text-[clamp(2.6rem,6.6vw,5.6rem)] uppercase tracking-tight"
              >
                <span style={{ WebkitTextStroke: `2px ${WHITE}`, color: "transparent" }}>Route the fees</span>
                <br />
                <span style={{ color: GREEN }}>to the builder.</span>
              </h1>
              <p className="mt-7 max-w-md text-lg" style={{ color: "rgba(244,246,245,0.72)" }}>
                Launch a coin for someone who ships. A slice of every trade escrows on-chain to
                their GitHub, X, or wallet — claimable by them alone.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Magnetic>
                  <Link
                    href="/create"
                    className="inline-block rounded-full px-6 py-3 text-base font-bold"
                    style={{ background: GREEN, color: "#03140a" }}
                  >
                    Launch a coin
                  </Link>
                </Magnetic>
                <a
                  href="#ledger"
                  className="text-base font-medium underline decoration-1 underline-offset-4"
                  style={{ color: WHITE }}
                >
                  I was funded →
                </a>
              </div>
              {/* fila de datos mono — registro fintech */}
              <div
                className="mt-14 flex flex-wrap gap-x-10 gap-y-3 text-xs"
                style={{ fontFamily: "var(--f-mono)", color: "rgba(244,246,245,0.5)" }}
              >
                <span>CHAIN 4663</span>
                <span>BLOCKS 100MS</span>
                <span>CUSTODY NONE</span>
                <span>CLAIM = PROOF OF IDENTITY</span>
              </div>
            </div>
            <div
              className="pointer-events-none absolute bottom-4 right-6 flex flex-col items-center gap-2"
              style={{ fontFamily: "var(--f-mono)", color: "rgba(244,246,245,0.4)" }}
            >
              <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
              <span aria-hidden className="block h-9 w-px" style={{ background: hairline(0.35) }} />
            </div>
          </div>
        </section>

        {/* la cinta — teletipo bursátil */}
        <div
          className="relative border-y py-3"
          style={{ borderColor: HAIR, background: "rgba(0,200,5,0.05)" }}
        >
          <Marquee duration={26}>
            <span
              style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.14em", color: "rgba(244,246,245,0.6)" }}
              className="text-xs uppercase"
            >
              Fledge on Robinhood Chain <span style={{ color: GREEN }}>▲</span> every trade pays the
              builder <span style={{ color: GREEN }}>▲</span> escrow sworn to one name{" "}
              <span style={{ color: GREEN }}>▲</span> claim = proof of identity{" "}
              <span style={{ color: GREEN }}>▲</span>&nbsp;
            </span>
          </Marquee>
        </div>

        {/* mecanismo */}
        <section className="relative min-h-[120vh]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-full"
              style={{ background: "radial-gradient(75% 55% at 50% 45%, rgba(4,7,10,0.7), transparent 80%)" }}
            />
            <div className="relative">
              <Reveal>
                <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: "rgba(244,246,245,0.45)" }} className="text-xs uppercase">
                  How it works
                </div>
                <h2
                  style={{ fontFamily: "var(--f-display)", lineHeight: 1 }}
                  className="mt-4 max-w-3xl text-[clamp(1.9rem,4.4vw,3.2rem)] uppercase"
                >
                  Every trade <span style={{ color: GREEN }}>pays the person</span> who earned it.
                </h2>
              </Reveal>
              <div className="mt-14 grid gap-px overflow-hidden rounded-2xl sm:grid-cols-3" style={{ background: HAIR }}>
                {[
                  { n: "01", t: "Name them", d: "Pick a builder by GitHub, X, or wallet. Their coin lists on Flap in seconds." },
                  { n: "02", t: "Fees accrue", d: "A slice of the trading tax streams into an on-chain vault held in their name." },
                  { n: "03", t: "They claim", d: "They prove the identity — signature, OAuth, or the X oracle — and sweep the ETH." },
                ].map((s, i) => (
                  <Reveal key={s.n} delay={i * 100}>
                    <div className="h-full p-7" style={{ background: "rgba(6,10,14,0.85)" }}>
                      <div style={{ fontFamily: "var(--f-mono)", color: GREEN }} className="text-sm">
                        {s.n}
                      </div>
                      <h3 style={{ fontFamily: "var(--f-display)" }} className="mt-3 text-xl uppercase">
                        {s.t}
                      </h3>
                      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "rgba(244,246,245,0.66)" }}>
                        {s.d}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* hechos, en cifra gorda */}
              <div className="mt-16 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4">
                <Stat value={100} suffix="ms" label="Block time" accent={WHITE} dim="rgba(244,246,245,0.45)" />
                <Stat value={0} label="Admin keys" accent={GREEN} dim="rgba(244,246,245,0.45)" />
                <Stat value={3} label="Proof paths" accent={WHITE} dim="rgba(244,246,245,0.45)" />
                <Stat value={51} label="Tests green" accent={GREEN} dim="rgba(244,246,245,0.45)" />
              </div>
            </div>
          </div>
        </section>

        {/* LA CINTA EN VIVO — terminal */}
        <section className="relative">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(75% 65% at 50% 50%, rgba(4,7,10,0.75), transparent 84%)" }}
            />
            <div className="relative">
              <Reveal>
                <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: "rgba(244,246,245,0.45)" }} className="text-xs uppercase">
                  The tape
                </div>
                <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="mt-4 text-[clamp(1.9rem,4.4vw,3.2rem)] uppercase">
                  Fees streaming, <span style={{ color: GREEN }}>block by block.</span>
                </h2>
              </Reveal>
              <Reveal delay={120}>
                <div className="mt-8 overflow-hidden rounded-xl border" style={{ borderColor: HAIR, background: "rgba(2,5,8,0.9)" }}>
                  <div
                    className="flex items-center gap-2 border-b px-4 py-2.5"
                    style={{ borderColor: HAIR }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(244,246,245,0.25)" }} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(244,246,245,0.25)" }} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: GREEN }} />
                    <span className="ml-2 text-[11px]" style={{ fontFamily: "var(--f-mono)", color: "rgba(244,246,245,0.5)" }}>
                      fledge://tape — live preview
                    </span>
                  </div>
                  <div className="px-5 py-2">
                    <LiveVaultFeed
                      accent={GREEN}
                      gold="#9ff0b5"
                      dim="rgba(244,246,245,0.5)"
                      hair="rgba(244,246,245,0.07)"
                      verb="fill"
                    />
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* identidad */}
        <section className="relative min-h-[120vh]">
          <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6">
            <div className="relative max-w-xl">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-16 -inset-y-16"
                style={{ background: "radial-gradient(80% 70% at 40% 50%, rgba(4,7,10,0.66), transparent 78%)" }}
              />
              <div className="relative">
                <Reveal>
                  <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: "rgba(244,246,245,0.45)" }} className="text-xs uppercase">
                    Custody
                  </div>
                  <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="mt-4 text-[clamp(2rem,4.8vw,3.4rem)] uppercase">
                    One vault. <span style={{ color: GREEN }}>One identity.</span> Zero keys held.
                  </h2>
                </Reveal>
                <Reveal delay={140}>
                  <p className="mt-7 max-w-md text-lg leading-relaxed" style={{ color: "rgba(244,246,245,0.7)" }}>
                    The escrow is immutable and sworn to a single identity at launch. No admin, no
                    upgrade path, no freeze switch. Funds move once: to the wallet that proves the name.
                  </p>
                </Reveal>
                <Reveal delay={260}>
                  <div className="mt-8 flex flex-wrap gap-3" style={{ fontFamily: "var(--f-mono)" }}>
                    {["wallet signature", "github oauth", "x oracle proof"].map((m) => (
                      <span
                        key={m}
                        className="rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.14em]"
                        style={{ borderColor: HAIR, color: "rgba(244,246,245,0.7)" }}
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

        {/* ledger */}
        <section id="ledger" className="relative min-h-[125vh]">
          <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-24">
            <Reveal>
              <div
                className="relative overflow-hidden rounded-2xl p-8 sm:p-12"
                style={{ background: "rgba(3,6,9,0.82)", border: `1px solid ${HAIR}` }}
              >
                <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: hairline(0.4) }} />
                <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em", color: GREEN }} className="text-xs uppercase">
                  Balance check
                </div>
                <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="mt-4 text-[clamp(1.9rem,4.4vw,3rem)] uppercase">
                  Is a vault accruing <span style={{ color: GREEN }}>to you</span>?
                </h2>
                <p className="mt-3 max-w-md" style={{ color: "rgba(244,246,245,0.66)" }}>
                  Look up the escrows held for your GitHub, X, or wallet — and claim what is yours.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as typeof type)}
                    className="rounded-lg border bg-transparent px-4 py-3"
                    style={{ borderColor: HAIR, color: WHITE, fontFamily: "var(--f-mono)" }}
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
                    style={{ borderColor: HAIR, color: WHITE, fontFamily: "var(--f-mono)" }}
                  />
                  <button
                    onClick={lookup}
                    disabled={loading || !value}
                    className="rounded-lg px-6 py-3 font-bold disabled:opacity-40"
                    style={{ background: GREEN, color: "#03140a" }}
                  >
                    {loading ? "Checking…" : "Check balance"}
                  </button>
                </div>

                {error && <p className="mt-4 text-sm" style={{ color: "#ff8f6b" }}>{error}</p>}
                {rows && rows.length === 0 && (
                  <p className="mt-8" style={{ color: "rgba(244,246,245,0.5)" }}>
                    No vault under this identity yet.
                  </p>
                )}
                {rows && rows.length > 0 && (
                  <ul className="mt-8 flex flex-col">
                    {rows.map((r) => (
                      <li
                        key={r.vault}
                        className="flex items-center justify-between gap-4 py-4"
                        style={{ borderTop: `1px solid ${HAIR}` }}
                      >
                        <div>
                          <div className="text-xs" style={{ fontFamily: "var(--f-mono)", color: "rgba(244,246,245,0.55)" }}>
                            {r.vault}
                          </div>
                          <div
                            style={{ fontFamily: "var(--f-display)", color: GREEN, fontVariantNumeric: "tabular-nums" }}
                            className="mt-1 text-2xl"
                          >
                            {r.pendingLabel} ETH
                          </div>
                          {r.bound !== ZERO && (
                            <div className="mt-1 text-xs" style={{ color: "rgba(244,246,245,0.4)" }}>
                              bound to {r.bound}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/claim/${r.vault}`}
                          className="rounded-full px-5 py-2 font-bold"
                          style={{ background: GREEN, color: "#03140a" }}
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

        {/* CTA final + footer */}
        <section className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(75% 60% at 50% 45%, rgba(3,6,9,0.72), transparent 84%)" }}
          />
          <div className="relative mx-auto flex min-h-[90vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
            <Reveal>
              <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 0.98 }} className="text-[clamp(2.3rem,5.6vw,4.4rem)] uppercase">
                Back the one <span style={{ color: GREEN }}>who ships.</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 max-w-md text-lg" style={{ color: "rgba(244,246,245,0.7)" }}>
                Someone you follow builds every day and nobody pays them. Fix that in one transaction.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <Link
                href="/create"
                className="mt-9 inline-block rounded-full px-8 py-4 text-lg font-bold"
                style={{ background: GREEN, color: "#03140a" }}
              >
                Launch a coin for someone
              </Link>
            </Reveal>
          </div>
          <footer className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-10 pt-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-14 right-0 select-none leading-none"
              style={{
                fontFamily: "var(--f-display)",
                fontSize: "clamp(6rem, 18vw, 15rem)",
                color: "rgba(244,246,245,0.03)",
                letterSpacing: "-0.02em",
              }}
            >
              FLEDGE
            </div>
            <div className="relative">
              <div aria-hidden className="mb-10 h-px" style={{ background: hairline(0.16) }} />
              <div className="grid gap-10 pb-6 sm:grid-cols-3">
                <div>
                  <span className="flex items-center gap-2 text-xs uppercase tracking-[0.26em]" style={{ fontFamily: "var(--f-mono)" }}>
                    <Feather size={14} color="rgba(244,246,245,0.5)" /> Fledge
                  </span>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: "rgba(244,246,245,0.55)" }}>
                    Social fee escrow on Robinhood Chain. A coin&apos;s trading fees, routed to one name.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm" style={{ color: "rgba(244,246,245,0.65)" }}>
                  <Link href="/create" className="underline decoration-1 underline-offset-4 hover:opacity-80">
                    Launch a coin →
                  </Link>
                  <a href="#ledger" className="underline decoration-1 underline-offset-4 hover:opacity-80">
                    Check a balance →
                  </a>
                </div>
                <p className="text-xs leading-relaxed" style={{ fontFamily: "var(--f-mono)", color: "rgba(244,246,245,0.4)" }}>
                  Permissionless and non-custodial. Funds release only to the wallet that proves the
                  recipient identity. Not affiliated with Robinhood or Flap.
                </p>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
