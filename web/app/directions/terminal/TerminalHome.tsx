"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { VT323, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { LiveVaultFeed } from "@/components/LiveVaultFeed";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { useScrollSync } from "@/lib/scrollProgress";

/*
 * TERMINAL — la Bloomberg de Sherwood (registro CRT-fósforo del bake-off).
 * CERO fotografías, a propósito: todo el mundo es texto, scanlines y glow de fósforo
 * P1. Boot sequence honesto, headlines que se TIPEAN al entrar al viewport, secciones
 * como salidas de comandos. La página ES una terminal conectada a la chain.
 */

const vt = VT323({ weight: "400", subsets: ["latin"], variable: "--f-display" });
const plex = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

const CRT = "#020503";
const PHOS = "#33FF66"; // fósforo P1 (distinto del #00C805 de las otras)
const PHOS_DIM = "rgba(51,255,102,0.55)";
const PHOS_FAINT = "rgba(51,255,102,0.28)";
const AMBER = "#FFB000"; // ámbar de terminal para warnings/payoffs
const ZERO = "0x0000000000000000000000000000000000000000";

/* headline que se tipea al entrar al viewport (una vez) */
function Typed({ text, className = "", style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          setStarted(true);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [text]);
  useEffect(() => {
    if (!started) return;
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 28);
    return () => clearTimeout(t);
  }, [started, n, text.length]);
  return (
    <span ref={ref} className={className} style={style}>
      {text.slice(0, n)}
      <span className="cursor-blink">▮</span>
    </span>
  );
}

/* boot sequence: líneas reales de carga (gate honesto: fuentes listas) */
function Boot({ onDone }: { onDone: () => void }) {
  const LINES = [
    "FLEDGE BIOS v4.66.3 — Robinhood Chain 4663",
    "mem check ............ OK",
    "loading vault registry ............ OK",
    "attester: canonical ............ OK",
    "oracle: x-verifier ............ STANDBY",
    "custody ............ NONE (by design)",
    "mounting /sherwood ............ OK",
    "",
    "> READY. scroll to continue_",
  ];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let disposed = false;
    document.fonts.ready.then(() => {
      if (disposed) return;
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setShown(i);
        if (i >= LINES.length) {
          clearInterval(iv);
          setTimeout(() => !disposed && onDone(), 700);
        }
      }, 160);
    });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-center px-8 sm:px-20"
      style={{ background: CRT, fontFamily: "var(--f-mono)" }}
    >
      {LINES.slice(0, shown).map((l, i) => (
        <div key={i} className="text-sm leading-7" style={{ color: i === LINES.length - 1 ? PHOS : PHOS_DIM }}>
          {l || " "}
        </div>
      ))}
    </div>
  );
}

export function TerminalHome() {
  useScrollSync();
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();
  const [booted, setBooted] = useState(false);

  return (
    <main
      className={`${vt.variable} ${plex.variable} relative`}
      style={{ background: CRT, color: PHOS, fontFamily: "var(--f-mono)" }}
    >
      <style>{`
        .cursor-blink { animation: blink 1.1s steps(1) infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .crt-flicker { animation: flick 7s infinite; }
        @keyframes flick { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.86} 94%{opacity:1} 97%{opacity:0.93} 98%{opacity:1} }
        @media (prefers-reduced-motion: reduce) { .cursor-blink, .crt-flicker { animation: none; } }
      `}</style>

      {!booted && <Boot onDone={() => setBooted(true)} />}

      {/* scanlines + curvatura CRT sobre TODO */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60]"
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[61]"
        style={{ background: "radial-gradient(115% 95% at 50% 50%, transparent 60%, rgba(0,0,0,0.55))" }}
      />

      {/* barra de título de la terminal */}
      <nav className="fixed inset-x-0 top-0 z-20 border-b" style={{ borderColor: PHOS_FAINT, background: "rgba(2,5,3,0.94)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-xs" style={{ color: PHOS_DIM }}>
            fledge@robinhood:4663 ~ social-fee-escrow
          </span>
          <Link href="/create" className="border px-3 py-1 text-xs uppercase hover:bg-[rgba(51,255,102,0.12)]" style={{ borderColor: PHOS, color: PHOS }}>
            [ execute launch ]
          </Link>
        </div>
      </nav>

      <div className="crt-flicker relative z-10 mx-auto max-w-5xl px-6">
        {/* PROMPT — hero */}
        <section className="flex min-h-screen flex-col justify-center pt-16">
          <div className="text-sm" style={{ color: PHOS_FAINT }}>
            $ fledge --purpose
          </div>
          <h1
            style={{ fontFamily: "var(--f-display)", lineHeight: 0.95, textShadow: `0 0 18px rgba(51,255,102,0.45)` }}
            className="mt-4 text-[clamp(3rem,9vw,7.5rem)] uppercase"
          >
            <Typed text="ROUTE FEES TO BUILDERS." />
          </h1>
          <div className="mt-6 max-w-xl text-[15px] leading-7" style={{ color: PHOS_DIM }}>
            <span style={{ color: PHOS_FAINT }}>stdout:</span> launch a coin for someone who ships.
            a slice of every trade escrows on-chain to their github, x, or wallet. claimable by
            them alone. no owner keys. no custody. immutable code — the only privileged role is
            flap&apos;s official guardian, never ours.
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/create"
              className="border-2 px-6 py-2.5 text-sm font-medium uppercase tracking-wide hover:bg-[rgba(51,255,102,0.14)]"
              style={{ borderColor: PHOS, color: PHOS, textShadow: "0 0 10px rgba(51,255,102,0.5)" }}
            >
              [ launch a coin ]
            </Link>
            <a
              href="#query"
              className="border px-6 py-2.5 text-sm uppercase tracking-wide hover:bg-[rgba(51,255,102,0.08)]"
              style={{ borderColor: PHOS_FAINT, color: PHOS_DIM }}
            >
              [ i was funded ]
            </a>
          </div>
          <div className="mt-14 grid max-w-xl grid-cols-2 gap-y-1 text-xs sm:grid-cols-4" style={{ color: PHOS_FAINT }}>
            <span>CHAIN=4663</span>
            <span>BLOCK=100ms</span>
            <span>ADMIN_KEYS=0</span>
            <span>TESTS=51 ✓</span>
          </div>
        </section>

        {/* MAN PAGE — cómo funciona */}
        <section className="border-t py-20" style={{ borderColor: PHOS_FAINT }}>
          <div className="text-sm" style={{ color: PHOS_FAINT }}>
            $ man fledge
          </div>
          <h2 style={{ fontFamily: "var(--f-display)" }} className="mt-3 text-4xl uppercase sm:text-5xl">
            <Typed text="HOW IT WORKS(1)" />
          </h2>
          <div className="mt-10 flex flex-col gap-8">
            {[
              { cmd: "fledge mark <builder>", d: "name the builder — github, x handle, or wallet. their coin lists on flap in seconds." },
              { cmd: "fledge tax --auto", d: "a slice of every trade streams into an on-chain vault held in their name. permissionless." },
              { cmd: "fledge claim --prove", d: "they prove the identity (signature | oauth | x-oracle) and sweep the eth. nobody else can." },
            ].map((r, i) => (
              <Reveal key={r.cmd} delay={i * 80}>
                <div className="grid gap-2 sm:grid-cols-[320px_1fr] sm:gap-8">
                  <code className="text-sm" style={{ color: AMBER }}>
                    {r.cmd}
                  </code>
                  <p className="text-[15px] leading-7" style={{ color: PHOS_DIM }}>
                    {r.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* TAIL — el feed */}
        <section className="border-t py-20" style={{ borderColor: PHOS_FAINT }}>
          <div className="text-sm" style={{ color: PHOS_FAINT }}>
            $ tail -f /var/log/fledge/vaults.log{"  "}
            <span className="border px-2 py-0.5 text-[10px] uppercase" style={{ borderColor: PHOS_FAINT }}>
              preview
            </span>
          </div>
          <div className="mt-6 border p-5" style={{ borderColor: PHOS_FAINT, background: "rgba(51,255,102,0.03)" }}>
            <LiveVaultFeed accent={PHOS} gold={AMBER} dim={PHOS_FAINT} hair="rgba(51,255,102,0.1)" verb="swap" />
          </div>
        </section>

        {/* QUERY — el lookup */}
        <section id="query" className="border-t py-20" style={{ borderColor: PHOS_FAINT }}>
          <div className="text-sm" style={{ color: PHOS_FAINT }}>
            $ fledge query --balance
          </div>
          <h2 style={{ fontFamily: "var(--f-display)" }} className="mt-3 text-4xl uppercase sm:text-5xl">
            <Typed text="GOLD UNDER YOUR NAME?" />
          </h2>
          <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3">
              <span className="text-xs uppercase" style={{ color: PHOS_FAINT }}>
                --type
              </span>
              <select
                suppressHydrationWarning
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="border bg-transparent px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: PHOS_FAINT, color: PHOS }}
              >
                <option style={{ color: "#000" }} value="github">github</option>
                <option style={{ color: "#000" }} value="twitter">x</option>
                <option style={{ color: "#000" }} value="wallet">wallet</option>
              </select>
            </label>
            <label className="flex flex-1 items-center gap-3">
              <span className="text-lg" style={{ color: PHOS }}>
                &gt;
              </span>
              <input
                suppressHydrationWarning
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                placeholder={type === "wallet" ? "0x…" : "handle_"}
                className="w-full border-0 border-b bg-transparent py-2 text-lg placeholder:opacity-40 focus:outline-none"
                style={{ borderColor: PHOS_DIM, color: PHOS, caretColor: PHOS }}
              />
            </label>
            <button
              onClick={lookup}
              disabled={loading || !value}
              className="border-2 px-6 py-2.5 text-sm font-medium uppercase hover:bg-[rgba(51,255,102,0.14)] disabled:opacity-40"
              style={{ borderColor: PHOS, color: PHOS }}
            >
              {loading ? "[ querying… ]" : "[ run query ]"}
            </button>
          </div>

          {error && (
            <p className="mt-5 text-sm" style={{ color: "#FF5555" }}>
              ERR: {error}
            </p>
          )}
          {rows && rows.length === 0 && (
            <p className="mt-8 text-sm" style={{ color: PHOS_DIM }}>
              0 rows. no vault under this identity yet — be the one who launches it.
            </p>
          )}
          {rows && rows.length > 0 && (
            <div className="mt-8 border" style={{ borderColor: PHOS_FAINT }}>
              {rows.map((r) => (
                <div
                  key={r.vault}
                  className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
                  style={{ borderColor: PHOS_FAINT }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs" style={{ color: PHOS_FAINT }}>
                      {r.vault}
                    </div>
                    <div style={{ fontFamily: "var(--f-display)", color: AMBER }} className="text-2xl">
                      {r.pendingLabel} ETH
                    </div>
                    {r.bound !== ZERO && (
                      <div className="text-xs" style={{ color: PHOS_FAINT }}>
                        bound={r.bound}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/claim/${r.vault}`}
                    className="border px-4 py-1.5 text-sm uppercase hover:bg-[rgba(51,255,102,0.14)]"
                    style={{ borderColor: PHOS, color: PHOS }}
                  >
                    [ claim ]
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* EXECUTE — cierre */}
        <section className="border-t py-24 text-center" style={{ borderColor: PHOS_FAINT }}>
          <div className="text-sm" style={{ color: PHOS_FAINT }}>
            $ fledge launch --for &lt;someone-who-ships&gt;
          </div>
          <h2
            style={{ fontFamily: "var(--f-display)", textShadow: "0 0 22px rgba(51,255,102,0.4)" }}
            className="mt-4 text-5xl uppercase sm:text-6xl"
          >
            <Typed text="EXECUTE." />
          </h2>
          <Link
            href="/create"
            className="mt-8 inline-block border-2 px-8 py-3 text-base font-medium uppercase tracking-wide hover:bg-[rgba(51,255,102,0.14)]"
            style={{ borderColor: PHOS, color: PHOS, textShadow: "0 0 10px rgba(51,255,102,0.5)" }}
          >
            [ launch a coin for someone ]
          </Link>
          <footer className="mt-20 border-t pt-6 text-left text-xs leading-6" style={{ borderColor: PHOS_FAINT, color: PHOS_FAINT }}>
            <div>fledge — permissionless, non-custodial. funds release only to the wallet that proves the recipient identity.</div>
            <div>not affiliated with robinhood or flap. exit code 0.</div>
          </footer>
        </section>
      </div>
    </main>
  );
}
