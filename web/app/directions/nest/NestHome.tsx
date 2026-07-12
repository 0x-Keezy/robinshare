"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { useVaultLookup } from "@/lib/useVaultLookup";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--f-display", axes: ["SOFT", "WONK", "opsz"] });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--f-body" });
const plex = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

const PINE = "#060a08";
const CREAM = "#f5f1e8";
const AMBER = "#ffae45";
const ZERO = "0x0000000000000000000000000000000000000000";

// brasas/motas ámbar que suben lento — vida ambiental barata (solo transform/opacity).
// Posiciones DETERMINISTAS (evita mismatch de hidratación en SSR).
const EMBERS = [
  { l: 12, s: 2.5, dur: 15, delay: 0, drift: 14 },
  { l: 22, s: 1.5, dur: 19, delay: 4, drift: -10 },
  { l: 34, s: 2, dur: 13, delay: 8, drift: 8 },
  { l: 44, s: 1, dur: 22, delay: 2, drift: -16 },
  { l: 58, s: 3, dur: 17, delay: 6, drift: 12 },
  { l: 67, s: 1.5, dur: 14, delay: 10, drift: -8 },
  { l: 76, s: 2, dur: 20, delay: 1, drift: 18 },
  { l: 85, s: 1, dur: 16, delay: 7, drift: -12 },
  { l: 92, s: 2.5, dur: 12, delay: 11, drift: 10 },
];

function Embers() {
  return (
    <div aria-hidden className="ember-field pointer-events-none absolute inset-0 overflow-hidden">
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="ember absolute bottom-[-8%] rounded-full"
          style={{
            left: `${e.l}%`,
            width: e.s,
            height: e.s,
            background: AMBER,
            boxShadow: `0 0 ${e.s * 3}px ${e.s}px rgba(255,174,69,0.5)`,
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
            ["--drift" as string]: `${e.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

// gota de fee que cae al nido cada ~7s — el mecanismo hecho visible
function Drip() {
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 block h-full w-px">
      <span
        className="drip absolute left-0 top-0 block h-2 w-2 -translate-x-1/2 rounded-full"
        style={{ background: AMBER, boxShadow: `0 0 12px 2px ${AMBER}` }}
      />
    </span>
  );
}

export function NestHome() {
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);

  // parallax sutil del petirrojo con el scroll
  useEffect(() => {
    const onScroll = () => setShift(Math.min(60, window.scrollY * 0.06));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main
      className={`${fraunces.variable} ${instrument.variable} ${plex.variable} min-h-screen`}
      style={{ background: PINE, color: CREAM, fontFamily: "var(--f-body)" }}
    >
      <style>{`
        @keyframes dripfall { 0%{transform:translate(-50%,-10%);opacity:0} 8%{opacity:1} 60%{opacity:1} 78%{transform:translate(-50%,760%);opacity:0} 100%{opacity:0} }
        .drip{ animation: dripfall 7s cubic-bezier(.5,0,.9,1) infinite }
        @keyframes emberrise { 0%{transform:translate(0,0);opacity:0} 12%{opacity:.9} 88%{opacity:.7} 100%{transform:translate(var(--drift),-108vh);opacity:0} }
        .ember{ animation-name: emberrise; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform, opacity }
        @media (prefers-reduced-motion: reduce){ .drip{ animation:none; opacity:0 } .ember-field{ display:none } }
      `}</style>

      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em" }} className="text-xs uppercase">
          Fledge
        </span>
        <Link
          href="/create"
          className="rounded-full px-4 py-1.5 text-sm font-medium"
          style={{ background: AMBER, color: PINE }}
        >
          Launch a coin
        </Link>
      </nav>

      {/* hero */}
      <header ref={heroRef} className="relative overflow-hidden">
        {/* resplandor ámbar detrás del pecho del petirrojo — el ave "emite" luz */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-[18%] top-[38%] h-[46vh] w-[46vh] -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,174,69,0.18), transparent 66%)", filter: "blur(8px)" }}
        />
        {/* petirrojo */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-[70%] sm:w-[58%]"
          style={{ transform: `translateY(${shift}px)` }}
        >
          <div
            className="h-full w-full"
            style={{
              backgroundImage: "url(/nest/robin.png)",
              backgroundSize: "cover",
              backgroundPosition: "center right",
              maskImage: `linear-gradient(90deg, transparent, #000 34%, #000 100%)`,
              WebkitMaskImage: `linear-gradient(90deg, transparent, #000 34%, #000 100%)`,
            }}
          />
          {/* fade inferior hacia la seccion siguiente */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
            style={{ background: `linear-gradient(to bottom, transparent, ${PINE})` }}
          />
        </div>

        {/* brasas ambientales */}
        <Embers />

        {/* viñeta cinematográfica */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 80% at 50% 40%, transparent 55%, rgba(0,0,0,0.55))" }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-10 pb-28 sm:pt-16 sm:pb-40">
          <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: AMBER }} className="text-xs uppercase">
            Social fee escrow · Robinhood Chain
          </div>
          <h1
            style={{ fontFamily: "var(--f-display)", lineHeight: 1.02, fontWeight: 400 }}
            className="mt-6 max-w-2xl text-[clamp(2.9rem,7vw,5.6rem)]"
          >
            A coin that{" "}
            <span style={{ fontStyle: "italic", color: AMBER }}>feeds</span> the maker you admire.
          </h1>
          <p className="mt-7 max-w-md text-lg" style={{ color: "rgba(245,241,232,0.72)" }}>
            Launch a coin for a builder, an open source dev, anyone. Every trade drips into a nest held for their GitHub,
            their X, or a wallet. Only they can ever lift it out.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/create"
              className="rounded-full px-6 py-3 text-base font-semibold"
              style={{ background: AMBER, color: PINE }}
            >
              Launch a coin
            </Link>
            <a href="#claim" className="text-base font-medium underline decoration-1 underline-offset-4" style={{ color: CREAM }}>
              I was funded
            </a>
          </div>
        </div>
      </header>

      {/* how it works — egg / feed / fledge */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div
          style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: "rgba(245,241,232,0.4)", borderColor: "rgba(245,241,232,0.12)" }}
          className="mb-12 border-t pt-6 text-xs uppercase"
        >
          How it works
        </div>
        <div className="grid gap-12 sm:grid-cols-3">
          {[
            { n: "Egg", d: "Pick someone by their GitHub, X, or wallet. Their coin hatches on Flap in seconds." },
            { n: "Feed", d: "Every buy and sell drips a slice of the trading tax into an on-chain nest held for that identity." },
            { n: "Fledge", d: "They prove who they are and the nest opens, sweeping the ETH to any wallet they choose." },
          ].map((s, i) => (
            <Reveal as="div" delay={i * 100} key={s.n}>
              <div className="flex items-baseline gap-3">
                <span style={{ fontFamily: "var(--f-mono)", color: AMBER }} className="text-sm">
                  0{i + 1}
                </span>
                <h3 style={{ fontFamily: "var(--f-display)", fontStyle: "italic" }} className="text-3xl">
                  {s.n}
                </h3>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "rgba(245,241,232,0.66)" }}>
                {s.d}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* lookup — el nido */}
      <section id="claim" className="mx-auto max-w-6xl px-6 py-16">
        <div
          className="relative overflow-hidden rounded-3xl border p-8 sm:p-12"
          style={{ borderColor: "rgba(255,174,69,0.22)", background: "linear-gradient(180deg, rgba(255,174,69,0.05), rgba(255,174,69,0.01))" }}
        >
          <div className="relative">
            <Drip />
          </div>
          <h2 style={{ fontFamily: "var(--f-display)" }} className="text-[clamp(2rem,5vw,3.4rem)]">
            Is a nest filling up for <span style={{ fontStyle: "italic", color: AMBER }}>you</span>?
          </h2>
          <p className="mt-3 max-w-md text-base" style={{ color: "rgba(245,241,232,0.66)" }}>
            Look up the escrows held for your GitHub, X, or wallet, and lift out what is yours.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-xl border bg-transparent px-4 py-3"
              style={{ borderColor: "rgba(245,241,232,0.2)", color: CREAM, fontFamily: "var(--f-mono)" }}
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
              style={{ borderColor: "rgba(245,241,232,0.2)", color: CREAM, fontFamily: "var(--f-mono)" }}
            />
            <button
              onClick={lookup}
              disabled={loading || !value}
              className="rounded-xl px-6 py-3 font-semibold disabled:opacity-40"
              style={{ background: AMBER, color: PINE }}
            >
              {loading ? "Looking…" : "Find the nest"}
            </button>
          </div>

          {error && <p className="mt-4 text-sm" style={{ color: "#ff8f6b" }}>{error}</p>}
          {rows && rows.length === 0 && (
            <p className="mt-8" style={{ color: "rgba(245,241,232,0.5)" }}>No nest yet for this identity.</p>
          )}
          {rows && rows.length > 0 && (
            <ul className="mt-8 flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.vault} className="rounded-2xl border p-4" style={{ borderColor: "rgba(245,241,232,0.12)" }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm" style={{ fontFamily: "var(--f-mono)", color: "rgba(245,241,232,0.6)" }}>{r.vault}</div>
                      <div style={{ fontFamily: "var(--f-display)", color: AMBER }} className="mt-1 text-3xl tabular-nums">
                        {r.pendingLabel} ETH
                      </div>
                      {r.bound !== ZERO && <div className="mt-1 text-xs" style={{ color: "rgba(245,241,232,0.45)" }}>bound to {r.bound}</div>}
                    </div>
                    <Link href={`/claim/${r.vault}`} className="rounded-full px-5 py-2 font-semibold" style={{ background: AMBER, color: PINE }}>
                      Claim
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-14 text-xs" style={{ color: "rgba(245,241,232,0.4)", fontFamily: "var(--f-mono)" }}>
        <span style={{ letterSpacing: "0.24em" }} className="uppercase">Fledge</span>
        <p className="mt-3 max-w-2xl leading-relaxed">
          Permissionless and non-custodial. Funds can only ever be released to the wallet that proves the recipient
          identity. Not affiliated with Robinhood or Flap.
        </p>
      </footer>
    </main>
  );
}
