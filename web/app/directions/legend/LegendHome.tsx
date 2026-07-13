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
import { useTheme } from "@/lib/useTheme";
import { BowMark } from "@/components/BowMark";

/*
 * ROBINSHARE (ex-Legend, ganadora del bake-off) — el BROKERAGE.
 * Registro suizo-snappy: tipografía negra gigante, grid denso, hairlines.
 * Oscuro por defecto (tokens var(--rs-*), toggle a claro en el nav). El lima
 * es el acento de marca; el verde Robinhood puro queda SOLO en el tape en
 * vivo. La marca es el arco (BowMark) — el guiño a Robin Hood: compartir
 * con los que lo merecen. Cero dolly — motion snappy.
 */

const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--f-display" });
const body = Archivo({ subsets: ["latin"], variable: "--f-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

// Los 7 tokens de color ahora son referencias a variables CSS (ver
// web/app/globals.css) en vez de literales — el navegador resuelve el valor
// correcto por la cascada CSS según el atributo data-robinshare-theme del
// <html>, que un script bloqueante en layout.tsx fija ANTES de que React
// hidrate. Ningún otro sitio de uso de estas constantes cambia.
const PAPER = "var(--rs-paper)";
const INK = "var(--rs-ink)";
const GREEN = "#00C805"; // sin variar por tema: color de "dato en vivo" (dot + feed)
const GREEN_TEXT = "var(--rs-green-text)";
const GREEN_CTA = "var(--rs-green-cta)";
const GREEN_CTA_TEXT = "var(--rs-green-cta-text)";
const DIM = "var(--rs-dim)";
const FAINT = "var(--rs-faint)";
const HAIR = "var(--rs-hair)";
const ZERO = "0x0000000000000000000000000000000000000000";

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

export function LegendHome() {
  useScrollSync();
  const navHidden = useHideNav();
  const reduce = useReducedMotion();
  const { theme, toggle: toggleTheme } = useTheme();
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();
  const inkFeather = useRef<HTMLDivElement>(null);

  // La pluma de TINTA cae por el papel con el scroll, rotando, como pluma de
  // verdad. (Su gemela de luz vivía dentro del terminal — Jose la sacó del
  // todo por pedirlo incómoda; el motivo de marca queda solo en esta.)
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let cur = 0;
    const mouse = { x: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = performance.now() / 1000;
      cur += (Scroll.progress - cur) * 0.08;
      const p = cur;
      if (inkFeather.current) {
        // sway oscila (no acumula) — el drift direccional (p*-7vw) SÍ acumulaba y
        // terminaba metiendo la pluma en la columna de contenido (tapaba el stat
        // "51 · TESTS GREEN"). Confinada al gutter derecho: solo cae y oscila.
        const sway = Math.sin(t * 0.5) * 2 + Math.sin(p * Math.PI * 2.4) * 8;
        const fall = p * 78; // vh que cae a lo largo de la página
        inkFeather.current.style.transform =
          `translate3d(${mouse.x * 12}px, ${fall}vh, 0) rotate(${-10 + sway}deg)`;
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
      style={{ background: PAPER, color: INK, fontFamily: "var(--f-body)" }}
    >
      {/* la pluma de TINTA: cae por el papel con el scroll (detrás del contenido).
          Sin máscara leía a render de IA (glow neón + specks de humo sin recortar
          en el borde, "chevrons" sueltos) — misma máscara radial de la pluma de
          luz + filtro que la hunde hacia tinta oscura en vez de fósforo brillante. */}
      <div aria-hidden className="pointer-events-none fixed right-[5%] top-[-8%] z-0 w-[min(24vw,340px)]">
        <div ref={inkFeather} className="will-change-transform">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/legend/feather-ink.png"
            alt=""
            className="w-full opacity-80"
            style={{
              filter: "var(--rs-feather-ink-filter)",
              maskImage: "radial-gradient(64% 70% at 54% 48%, black 50%, transparent 85%)",
              WebkitMaskImage: "radial-gradient(64% 70% at 54% 48%, black 50%, transparent 85%)",
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* nav claro */}
      <nav
        className="fixed inset-x-0 top-0 z-40 transition-transform duration-300"
        style={{
          background: "var(--rs-nav-gradient)",
          transform: navHidden ? "translateY(-100%)" : "none",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2" style={{ color: INK }}>
            <BowMark color={GREEN} />
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em" }} className="text-xs font-medium uppercase">
              RobinShare
            </span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              style={{ color: INK }}
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <a href="#ledger" className="hidden text-sm font-medium underline-offset-4 hover:underline sm:block" style={{ color: DIM }}>
              Check a balance
            </a>
            <Link href="/create" className="rounded-full px-4 py-1.5 text-sm font-bold" style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT }}>
              Launch a coin
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10">
        {/* HERO — titular negro + panel terminal oscuro */}
        <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-28 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-32">
          <div>
            <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: FAINT }} className="text-xs uppercase">
              Social fee escrow · Robinhood Chain
            </div>
            <h1
              style={{ fontFamily: "var(--f-display)", lineHeight: 0.96 }}
              className="mt-5 text-[clamp(2rem,9vw,5.4rem)] uppercase tracking-tight"
            >
              Route fees
              <br />
              to builders.
              <br />
              <span style={{ color: GREEN_TEXT }}>Automatically.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg" style={{ color: DIM }}>
              Launch a coin for any builder. Every trade sets 3% aside for their GitHub, X, or
              wallet. Only they can claim it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link href="/create" className="inline-block rounded-full px-6 py-3 text-base font-bold" style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT }}>
                  Launch a coin
                </Link>
              </Magnetic>
              <a href="#ledger" className="text-base font-semibold underline decoration-2 underline-offset-4" style={{ color: INK }}>
                I was funded →
              </a>
            </div>
            <div
              className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-[11px] uppercase tracking-[0.18em]"
              style={{ fontFamily: "var(--f-mono)", color: FAINT }}
            >
              <span>Chain 4663</span>
              <span>Blocks 100ms</span>
              <span>Custody none</span>
              <span>Fee 3% → vault</span>
            </div>
          </div>

          {/* la única zona oscura: el terminal con la pluma + el feed */}
          <Reveal>
            <div className="overflow-hidden rounded-2xl shadow-2xl" style={{ background: "#080D0A", border: "1px solid rgba(13,18,14,0.2)" }}>
              <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "rgba(247,248,244,0.12)" }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(247,248,244,0.25)" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgba(247,248,244,0.25)" }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: GREEN }} />
                <span className="ml-2 text-[11px]" style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.55)" }}>
                  robinshare://tape — live preview
                </span>
              </div>
              {/* Jose: la pluma de luz sobre el tape quedaba incómoda pese a los
                  ajustes (mascara/tamaño/brillo) — la sacamos del todo, el terrario
                  queda solo para el feed. La pluma de tinta del hero es la que se
                  queda como motivo de marca. */}
              <div className="px-5 py-3">
                <LiveVaultFeed
                  accent={GREEN}
                  gold="#9ff0b5"
                  dim="rgba(247,248,244,0.55)"
                  hair="rgba(247,248,244,0.08)"
                  verb="fill"
                />
              </div>
            </div>
            <p className="mt-2 text-right text-[11px]" style={{ fontFamily: "var(--f-mono)", color: FAINT }}>
              Illustrative — live with the first launch
            </p>
          </Reveal>
        </section>

        {/* tape ticker claro */}
        <div className="border-y py-2.5" style={{ borderColor: HAIR }}>
          <Marquee duration={26}>
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.14em", color: DIM }} className="text-xs uppercase">
              RobinShare on Robinhood Chain <span style={{ color: GREEN_TEXT }}>▲</span> every trade
              pays the builder <span style={{ color: GREEN_TEXT }}>▲</span> only they can claim it{" "}
              <span style={{ color: GREEN_TEXT }}>▲</span>&nbsp;
            </span>
          </Marquee>
        </div>

        {/* mecanismo — cards suizas */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="max-w-3xl text-[clamp(1.8rem,4.2vw,3rem)] uppercase">
              Every trade pays the <span style={{ color: GREEN_TEXT }}>person</span> who earned it.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-3" style={{ borderColor: HAIR, background: HAIR }}>
            {[
              { n: "01", t: "Name them", d: "Pick a builder by GitHub, X, or wallet. Their coin lists on Flap in seconds." },
              { n: "02", t: "Fees accrue", d: "3% of every trade lands in an on-chain vault under their name." },
              { n: "03", t: "They claim", d: "They prove it's them (GitHub login, a tweet, or a signature) and sweep the ETH." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="h-full p-7" style={{ background: PAPER }}>
                  <div style={{ fontFamily: "var(--f-mono)", color: GREEN_TEXT }} className="text-sm font-medium">
                    {s.n}
                  </div>
                  <h3 style={{ fontFamily: "var(--f-display)" }} className="mt-3 text-xl uppercase">
                    {s.t}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed" style={{ color: DIM }}>
                    {s.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* hechos en negro gigante */}
          <div className="mt-16 grid grid-cols-2 gap-x-8 gap-y-10 border-t pt-12 sm:grid-cols-4" style={{ borderColor: HAIR }}>
            <Stat value={100} suffix="ms" label="Block time" accent={INK} dim={FAINT} />
            <Stat value={0} label="Admin keys" accent={INK} dim={FAINT} />
            <Stat value={3} label="Proof paths" accent={INK} dim={FAINT} />
            <Stat value={51} label="Tests green" accent={GREEN_TEXT} dim={FAINT} />
          </div>
        </section>

        {/* custodia */}
        <section className="border-y" style={{ borderColor: HAIR, background: PAPER }}>
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="text-[clamp(1.8rem,4.2vw,3rem)] uppercase">
                One vault. One identity.
                <br />
                <span style={{ color: GREEN_TEXT }}>Zero keys held.</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <div>
                <p className="max-w-md text-lg leading-relaxed" style={{ color: DIM }}>
                  The vault is fixed at launch. There are no admin keys and no way to redirect
                  it, not even for us. The money only moves to the wallet that proves the name.
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                  {["wallet signature", "github oauth", "x oracle proof"].map((m) => (
                    <span
                      key={m}
                      className="rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em]"
                      style={{ borderColor: HAIR, color: DIM }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ledger — formulario de brokerage */}
        <section id="ledger" className="mx-auto max-w-3xl px-6 py-24">
          <Reveal>
            <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: GREEN_TEXT }} className="text-xs font-medium uppercase">
              Balance check
            </div>
            <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="mt-3 text-[clamp(1.9rem,4.4vw,3rem)] uppercase">
              Someone may have launched you a coin.
            </h2>
            <p className="mt-3 max-w-md" style={{ color: DIM }}>
              Search your GitHub, X, or wallet. If there&apos;s a vault, it&apos;s yours to claim.
            </p>

            <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-2">
                <span style={{ fontFamily: "var(--f-mono)", color: FAINT, letterSpacing: "0.16em" }} className="text-[10px] uppercase">
                  Identity
                </span>
                <select
                  suppressHydrationWarning
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="border-0 border-b-2 bg-transparent py-2 pr-6 focus:outline-none"
                  style={{ borderColor: INK, color: INK, fontFamily: "var(--f-mono)" }}
                >
                  <option value="github">GitHub</option>
                  <option value="twitter">X (Twitter)</option>
                  <option value="wallet">Wallet</option>
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-2">
                <span style={{ fontFamily: "var(--f-mono)", color: FAINT, letterSpacing: "0.16em" }} className="text-[10px] uppercase">
                  Name on the vault
                </span>
                <input
                  suppressHydrationWarning
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookup()}
                  placeholder={type === "wallet" ? "0x…" : "handle"}
                  className="border-0 border-b-2 bg-transparent py-2 text-lg placeholder:opacity-35 focus:outline-none"
                  style={{ borderColor: INK, color: INK, fontFamily: "var(--f-mono)" }}
                />
              </label>
              <Magnetic>
                <button
                  onClick={lookup}
                  disabled={loading || !value}
                  className="rounded-full border-2 px-7 py-3 font-bold transition-colors disabled:cursor-not-allowed"
                  // estado disabled ya NO es un opacity-40 del fill verde (leia a boton
                  // roto) — es un outline explicito que comunica "todavia no accionable".
                  // Borde subido de HAIR(0.14) a 0.3 tras el audit: al filo de HAIR el
                  // ghost quedaba tan tenue que la accion principal leia a fantasma.
                  style={
                    loading || !value
                      ? { background: "transparent", borderColor: FAINT, color: FAINT }
                      : { background: GREEN_CTA, borderColor: GREEN_CTA, color: "#fff" }
                  }
                >
                  {loading ? "Checking…" : "Check balance"}
                </button>
              </Magnetic>
            </div>

            {error && <p className="mt-4 text-sm" style={{ color: "#c0392b" }}>{error}</p>}
            {rows && rows.length === 0 && (
              <p className="mt-8" style={{ color: DIM }}>
                No vault under this identity yet.
              </p>
            )}
            {rows && rows.length > 0 && (
              <ul className="mt-8 flex flex-col">
                {rows.map((r) => (
                  <li key={r.vault} className="flex items-center justify-between gap-4 border-t py-4" style={{ borderColor: HAIR }}>
                    <div>
                      <div className="text-xs" style={{ fontFamily: "var(--f-mono)", color: FAINT }}>
                        {r.vault}
                      </div>
                      <div style={{ fontFamily: "var(--f-display)", color: INK, fontVariantNumeric: "tabular-nums" }} className="mt-1 text-2xl">
                        {r.pendingLabel} ETH
                      </div>
                      {r.bound !== ZERO && (
                        <div className="mt-1 text-xs" style={{ color: FAINT }}>
                          bound to {r.bound}
                        </div>
                      )}
                    </div>
                    <Link href={`/claim/${r.vault}`} className="rounded-full px-5 py-2 font-bold" style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT }}>
                      Claim
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </section>

        {/* CTA final + footer claro */}
        <section className="border-t" style={{ borderColor: HAIR, background: PAPER }}>
          <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center">
            <Reveal>
              <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 0.98 }} className="text-[clamp(2.2rem,5.4vw,4.2rem)] uppercase">
                Back the one <span style={{ color: GREEN_TEXT }}>who ships.</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-5 max-w-md text-lg" style={{ color: DIM }}>
                Someone you follow builds every day and nobody pays them. Fix that in one transaction.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <Magnetic strength={10}>
                <Link href="/create" className="mt-8 inline-block rounded-full px-8 py-4 text-lg font-bold" style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT }}>
                  Launch a coin for someone
                </Link>
              </Magnetic>
            </Reveal>
          </div>
          <footer className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-10 pt-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-10 right-0 select-none leading-none"
              style={{ fontFamily: "var(--f-display)", fontSize: "clamp(4rem,11vw,9.5rem)", color: "var(--rs-watermark)", letterSpacing: "-0.02em" }}
            >
              ROBINSHARE
            </div>
            <div className="relative grid gap-10 border-t pb-6 pt-10 sm:grid-cols-3" style={{ borderColor: HAIR }}>
              <div>
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.26em]" style={{ fontFamily: "var(--f-mono)" }}>
                  <BowMark size={14} color={GREEN} /> RobinShare
                </span>
                <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: DIM }}>
                  A coin&apos;s trading fees, routed to the builder who earned them. On Robinhood Chain.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-sm font-medium" style={{ color: INK }}>
                <Link href="/create" className="underline decoration-1 underline-offset-4 hover:opacity-70">
                  Launch a coin →
                </Link>
                <a href="#ledger" className="underline decoration-1 underline-offset-4 hover:opacity-70">
                  Check a balance →
                </a>
              </div>
              <p className="text-xs leading-relaxed" style={{ fontFamily: "var(--f-mono)", color: FAINT }}>
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
