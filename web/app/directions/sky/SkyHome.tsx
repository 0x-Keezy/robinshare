"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Anton, Archivo, JetBrains_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { useVaultLookup } from "@/lib/useVaultLookup";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--f-display" });
const archivo = Archivo({ subsets: ["latin"], variable: "--f-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-mono" });

const INK = "#060907";
const PAPER = "#f4f7f2";
const SIGNAL = "#00ff85";
const ZERO = "0x0000000000000000000000000000000000000000";

function SkyBird({ size = 22, color = SIGNAL }: { size?: number; color?: string }) {
  // pájaro origami de 2 trazos
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 15 L12 7 L22 15" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11 L12 16 L17 11" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Typewriter({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState("");
  const [del, setDel] = useState(false);

  useEffect(() => {
    const full = words[i % words.length];
    if (!del && txt === full) {
      const t = setTimeout(() => setDel(true), 1300);
      return () => clearTimeout(t);
    }
    if (del && txt === "") {
      setDel(false);
      setI((v) => v + 1);
      return;
    }
    const t = setTimeout(
      () => setTxt(del ? full.slice(0, txt.length - 1) : full.slice(0, txt.length + 1)),
      del ? 40 : 75,
    );
    return () => clearTimeout(t);
  }, [txt, del, i, words]);

  return (
    <span style={{ color: SIGNAL }}>
      {txt}
      <span className="animate-pulse">|</span>
    </span>
  );
}

export function SkyHome() {
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();

  return (
    <main
      className={`${anton.variable} ${archivo.variable} ${mono.variable} min-h-screen`}
      style={{ background: INK, color: PAPER, fontFamily: "var(--f-body)" }}
    >
      {/* nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <SkyBird />
          <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em" }} className="text-xs uppercase">
            Fledge
          </span>
        </div>
        <Link
          href="/create"
          className="rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ background: SIGNAL, color: INK }}
        >
          Launch a coin
        </Link>
      </nav>

      {/* hero */}
      <header className="relative mx-auto max-w-5xl overflow-hidden px-6 pt-16 pb-10 sm:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2 select-none"
          style={{
            fontFamily: "var(--f-display)",
            fontSize: "clamp(8rem, 22vw, 18rem)",
            color: "rgba(244,247,242,0.03)",
            lineHeight: 0.8,
          }}
        >
          FLEDGE
        </div>

        <div
          style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: SIGNAL }}
          className="text-xs uppercase"
        >
          Social fee escrow · Robinhood Chain
        </div>

        <h1
          style={{ fontFamily: "var(--f-display)", lineHeight: 0.92 }}
          className="mt-5 text-[clamp(3.2rem,12vw,10rem)] uppercase tracking-tight"
        >
          <span className="block">Launch a coin</span>
          <span className="block">
            <span
              style={{
                WebkitTextStroke: `2px ${SIGNAL}`,
                color: "transparent",
              }}
            >
              for
            </span>{" "}
            someone
          </span>
          <span className="block">who ships.</span>
        </h1>

        <div className="mt-6 text-2xl sm:text-3xl" style={{ fontFamily: "var(--f-display)" }}>
          <Typewriter words={["for @torvalds", "for @that-designer", "for @the-maintainer", "for @your-favorite-dev"]} />
        </div>

        <p className="mt-8 max-w-xl text-lg" style={{ color: "rgba(244,247,242,0.72)" }}>
          Someone you follow ships every day and nobody pays them. Launch their coin on Flap. Every trade feeds them, by
          their GitHub, their X, or a wallet. Only they can ever claim it. That is the whole point.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="rounded-full px-6 py-3 text-base font-bold"
            style={{ background: SIGNAL, color: INK }}
          >
            Launch a coin →
          </Link>
          <a
            href="#claim"
            className="rounded-full border px-6 py-3 text-base font-semibold"
            style={{ borderColor: "rgba(244,247,242,0.25)", color: PAPER }}
          >
            I was funded
          </a>
        </div>
      </header>

      {/* how it works */}
      <section className="mx-auto max-w-5xl px-6 pt-6 pb-20">
        <div
          style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: "rgba(244,247,242,0.4)", borderColor: "rgba(244,247,242,0.12)" }}
          className="mb-10 border-t pt-6 text-xs uppercase"
        >
          How it works
        </div>
        <div className="grid gap-10 sm:grid-cols-3">
          {[
            { n: "01", t: "Launch", d: "Pick someone by their GitHub, X, or wallet. Their coin goes live on Flap in seconds." },
            { n: "02", t: "Every trade feeds them", d: "A slice of the trading tax drips into an on-chain escrow held for that identity. Automatic." },
            { n: "03", t: "Only they claim", d: "They prove it is them and sweep the ETH to any wallet. No one else can touch it." },
          ].map((s, idx) => (
            <Reveal as="div" delay={idx * 90} key={s.n}>
              <div style={{ fontFamily: "var(--f-mono)", color: SIGNAL }} className="text-sm">
                {s.n}
              </div>
              <h3 style={{ fontFamily: "var(--f-display)" }} className="mt-2 text-2xl uppercase">
                {s.t}
              </h3>
              <p className="mt-2 text-sm" style={{ color: "rgba(244,247,242,0.65)" }}>
                {s.d}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* banda invertida: lookup */}
      <section id="claim" style={{ background: SIGNAL, color: INK }} className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 style={{ fontFamily: "var(--f-display)" }} className="text-[clamp(2.4rem,7vw,5rem)] uppercase leading-none">
            Were you funded?
          </h2>
          <p className="mt-3 max-w-lg text-base font-medium" style={{ color: "rgba(6,9,7,0.75)" }}>
            Look up the escrows filling up for your GitHub, X, or wallet, and claim them.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-full border-2 bg-transparent px-4 py-3 font-semibold"
              style={{ borderColor: INK, color: INK, fontFamily: "var(--f-mono)" }}
            >
              <option value="github">GitHub</option>
              <option value="twitter">X (Twitter)</option>
              <option value="wallet">Wallet</option>
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder={type === "wallet" ? "0x wallet address" : "handle"}
              className="flex-1 rounded-full border-2 bg-transparent px-5 py-3 font-medium placeholder:opacity-50"
              style={{ borderColor: INK, color: INK, fontFamily: "var(--f-mono)" }}
            />
            <button
              onClick={lookup}
              disabled={loading || !value}
              className="rounded-full px-6 py-3 font-bold disabled:opacity-40"
              style={{ background: INK, color: SIGNAL, fontFamily: "var(--f-display)", letterSpacing: "0.05em" }}
            >
              {loading ? "LOOKING…" : "FIND VAULTS"}
            </button>
          </div>

          {error && <p className="mt-4 text-sm font-semibold">{error}</p>}
          {rows && rows.length === 0 && <p className="mt-8 font-medium" style={{ color: "rgba(6,9,7,0.6)" }}>No vaults yet for this identity.</p>}
          {rows && rows.length > 0 && (
            <ul className="mt-8 flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.vault} className="rounded-2xl border-2 p-4" style={{ borderColor: INK }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm" style={{ fontFamily: "var(--f-mono)" }}>{r.vault}</div>
                      <div style={{ fontFamily: "var(--f-display)" }} className="mt-1 text-2xl">
                        {r.pendingLabel} ETH
                      </div>
                      {r.bound !== ZERO && <div className="mt-1 text-xs opacity-70">bound to {r.bound}</div>}
                    </div>
                    <Link
                      href={`/claim/${r.vault}`}
                      className="rounded-full px-5 py-2 font-bold"
                      style={{ background: INK, color: SIGNAL, fontFamily: "var(--f-display)" }}
                    >
                      CLAIM
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-12 text-xs" style={{ color: "rgba(244,247,242,0.4)", fontFamily: "var(--f-mono)" }}>
        <div className="flex items-center gap-2">
          <SkyBird size={16} color="rgba(244,247,242,0.5)" />
          <span>FLEDGE</span>
        </div>
        <p className="mt-3 max-w-2xl">
          Permissionless and non-custodial. Funds can only ever be released to the wallet that proves the recipient
          identity. Not affiliated with Robinhood or Flap.
        </p>
      </footer>
    </main>
  );
}
