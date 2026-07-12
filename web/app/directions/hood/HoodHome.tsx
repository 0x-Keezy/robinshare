"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cinzel, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { Marquee } from "@/components/Marquee";
import { Magnetic } from "@/components/Magnetic";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { Scroll, useScrollSync } from "@/lib/scrollProgress";
import { useHideNav } from "@/lib/useHideNav";

/*
 * HOOD — la leyenda contada en FOTOGRAFÍAS (dirección 2.5D, lección viktoroddy/Aegis:
 * asset generado + parallax por capas + textura óptica > 3D a mano). Toda la página es
 * UN dolly-in cinematográfico hacia el beam del bosque (transform scrubbed por scroll
 * sobre una foto fija), con el arquero de Gemini como capa de primer plano que dispara
 * su flecha cuando scrolleás. Sin WebGL: puro transform/opacity a 60fps.
 */

const cinzel = Cinzel({ weight: ["400", "700"], subsets: ["latin"], variable: "--f-display" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--f-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

const INK = "#03070a";
const CREAM = "#efeee6";
const GREEN = "#00C805";
const GOLD = "#d9a441";
const ZERO = "0x0000000000000000000000000000000000000000";
const HAIR = "rgba(239,238,230,0.15)";

const hairline = (o = 0.22) =>
  `linear-gradient(to right, transparent, rgba(239,238,230,${o}) 28%, rgba(239,238,230,${o}) 72%, transparent)`;

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

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = (t: number) => t * t * (3 - 2 * t);

/* La cámara: un solo rAF que scrubbea TODAS las capas leyendo Scroll.progress
   (patrón del módulo compartido — cero re-renders de React). */
function useCinema(reduce: boolean) {
  const bg = useRef<HTMLDivElement>(null);
  const bg2 = useRef<HTMLDivElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const archer = useRef<HTMLDivElement>(null);
  const streak = useRef<HTMLDivElement>(null);
  const fogA = useRef<HTMLDivElement>(null);
  const fogB = useRef<HTMLDivElement>(null);
  const barT = useRef<HTMLDivElement>(null);
  const barB = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    let raf = 0;
    let cur = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const target = reduce ? 0.06 : Scroll.progress;
      cur += (target - cur) * 0.09; // damping (lección lerp del vault)
      const p = cur;
      const mx = reduce ? 0 : mouse.current.x;
      const my = reduce ? 0 : mouse.current.y;

      // EL DOLLY: la foto escala hacia el beam durante toda la página
      if (bg.current) {
        const s = 1.06 + ease(p) * 0.5;
        bg.current.style.transform =
          `translate3d(${mx * -10}px, ${my * -6 + p * -40}px, 0) scale(${s})`;
      }
      // CORTE 2: el claro del cofre entra en fundido para el ledger (two-shot film)
      if (bg2.current) {
        const x = ease(clamp01((p - 0.5) / 0.14));
        bg2.current.style.opacity = String(x);
        const s2 = 1.14 + ease(clamp01((p - 0.5) / 0.5)) * 0.22;
        bg2.current.style.transform = `translate3d(${mx * -8}px, ${my * -5 + (p - 0.5) * -22}px, 0) scale(${s2})`;
      }
      // la noche se cierra alrededor del texto a medida que entrás
      if (dark.current) {
        const lift = ease(clamp01((p - 0.5) / 0.14)) * 0.22; // el cofre respira más claro
        dark.current.style.opacity = String(Math.max(0.12, 0.18 + ease(clamp01((p - 0.1) / 0.5)) * 0.5 - lift));
      }
      // el arquero: para (0→6%), dispara (6→16%) y sale del cuadro (16→30%)
      if (archer.current) {
        const shot = clamp01((p - 0.06) / 0.1);
        const exit = clamp01((p - 0.16) / 0.14);
        const recoil = Math.sin(shot * Math.PI) * -14; // retroceso al soltar
        archer.current.style.transform =
          `translate3d(calc(${mx * 14 + recoil}px - ${ease(exit) * 55}vw), ${my * 8}px, 0)`;
        archer.current.style.opacity = String(1 - ease(exit));
      }
      // la flecha: una estela verde que cruza del arco al beam, scrubbed
      if (streak.current) {
        const t = clamp01((p - 0.07) / 0.09);
        const on = t > 0.001 && t < 0.999 && !reduce;
        streak.current.style.opacity = on ? String(Math.sin(t * Math.PI)) : "0";
        // vuela desde el arco y MUERE en el beam (centro del cuadro)
        streak.current.style.transform =
          `translate3d(${-36 + ease(t) * 36}vw, ${9 - ease(t) * 17}vh, 0) rotate(-7deg)`;
      }
      // niebla multiplano: dos capas a distinta velocidad = profundidad real del dolly
      if (fogA.current) {
        fogA.current.style.transform = `translate3d(${mx * -18}px, ${p * 14}vh, 0)`;
      }
      if (fogB.current) {
        fogB.current.style.transform = `translate3d(${mx * -30}px, ${p * -22}vh, 0) scale(${1 + p * 0.2})`;
      }
      // letterbox: la película abre — las barras se retraen al entrar al bosque
      const lb = (1 - clamp01(p / 0.16)) * 5.5;
      if (barT.current) barT.current.style.height = `${lb}vh`;
      if (barB.current) barB.current.style.height = `${lb}vh`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, [reduce]);

  return { bg, bg2, dark, archer, streak, fogA, fogB, barT, barB };
}

/* Title card de apertura: FLEDGE presenta… (gate honesto: fuentes + plate decodificado) */
function TitleCard({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let disposed = false;
    const img = new Image();
    img.src = "/hood/forest.jpg";
    const decode = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    const floor = new Promise((r) => setTimeout(r, 1200));
    Promise.all([document.fonts.ready, decode, floor]).then(() => {
      if (disposed) return;
      setLeaving(true);
      setTimeout(() => !disposed && onDone(), 750);
    });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-700"
      style={{ background: "#000", opacity: leaving ? 0 : 1 }}
    >
      <div
        style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.34em", color: "rgba(239,238,230,0.5)" }}
        className="text-[11px] uppercase"
      >
        Robinhood Chain presents
      </div>
      <div
        style={{ fontFamily: "var(--f-display)", fontWeight: 700, letterSpacing: "0.18em", color: CREAM }}
        className="mt-4 text-5xl uppercase sm:text-6xl"
      >
        Fledge
      </div>
      <div aria-hidden className="mt-6 h-px w-24" style={{ background: "rgba(217,164,65,0.6)" }} />
    </div>
  );
}

export function HoodHome() {
  useScrollSync();
  const navHidden = useHideNav();
  const reduce = useReducedMotion();
  const [titleGone, setTitleGone] = useState(false);
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();
  const { bg, bg2, dark, archer, streak, fogA, fogB, barT, barB } = useCinema(reduce);

  return (
    <main
      className={`${cinzel.variable} ${sans.variable} ${mono.variable} relative`}
      style={{ background: INK, color: CREAM, fontFamily: "var(--f-body)" }}
    >
      {!titleGone && <TitleCard onDone={() => setTitleGone(true)} />}
      {/* letterbox — la película abre con el scroll */}
      <div ref={barT} aria-hidden className="fixed inset-x-0 top-0 z-[30] bg-black" style={{ height: "5.5vh" }} />
      <div ref={barB} aria-hidden className="fixed inset-x-0 bottom-0 z-[30] bg-black" style={{ height: "5.5vh" }} />
      {/* ============ EL SET: foto fija que la "cámara" recorre ============ */}
      <div aria-hidden className="fixed inset-0 z-0 overflow-hidden">
        <div
          ref={bg}
          className="absolute inset-0 will-change-transform"
          style={{
            backgroundImage: "url(/hood/forest.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "50% 42%", // origen del dolly = el beam
            transformOrigin: "50% 42%",
          }}
        />
        {/* CORTE 2: el claro del cofre (funde en el ledger) */}
        <div
          ref={bg2}
          className="absolute inset-0 opacity-0 will-change-transform"
          style={{
            backgroundImage: "url(/hood/chest.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "50% 55%",
            transformOrigin: "50% 55%",
          }}
        />
        {/* niebla multiplano — profundidad real dentro del dolly */}
        <div
          ref={fogA}
          className="absolute inset-x-[-10%] top-[30%] h-[55%] will-change-transform"
          style={{
            background: "radial-gradient(60% 55% at 50% 55%, rgba(120,220,160,0.10), transparent 70%)",
            filter: "blur(6px)",
          }}
        />
        <div
          ref={fogB}
          className="absolute inset-x-[-14%] top-[48%] h-[60%] will-change-transform"
          style={{
            background: "radial-gradient(55% 50% at 50% 50%, rgba(200,240,215,0.07), transparent 72%)",
            filter: "blur(10px)",
          }}
        />
        {/* la noche que se cierra (contraste para el texto profundo) */}
        <div ref={dark} className="absolute inset-0" style={{ background: INK, opacity: 0.18 }} />
        {/* viñeta cine */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(115% 85% at 50% 42%, transparent 52%, rgba(0,0,0,0.62))" }}
        />
        {/* la flecha (estela) que cruza al disparar */}
        <div
          ref={streak}
          className="absolute left-1/2 top-1/2 h-[2px] w-[26vw] opacity-0 will-change-transform"
          style={{
            background: `linear-gradient(to right, transparent, ${GREEN}, #eafff0)`,
            boxShadow: `0 0 18px 3px rgba(0,200,5,0.65)`,
          }}
        />
        {/* el arquero: capa 2.5D FIJA — la cámara pasa junto a él; dispara y sale */}
        <div
          ref={archer}
          className="absolute bottom-0 left-[-4%] w-[46vh] max-w-[68vw] will-change-transform sm:left-[2%]"
          style={{ filter: "drop-shadow(24px 8px 42px rgba(0,0,0,0.75)) drop-shadow(-6px -4px 30px rgba(0,200,5,0.18))" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hood/archer.png" alt="" className="block w-full" draggable={false} />
          <div
            className="absolute -bottom-3 left-1/4 h-8 w-2/3 rounded-full"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.7), transparent 70%)", filter: "blur(6px)" }}
          />
        </div>
      </div>

      {/* nav */}
      <nav
        className="fixed inset-x-0 top-0 z-40 transition-transform duration-300"
        style={{
          background: "linear-gradient(to bottom, rgba(3,7,10,0.95) 0%, rgba(3,7,10,0.7) 55%, transparent)",
          transform: navHidden ? "translateY(-100%)" : "none",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span style={{ fontFamily: "var(--f-display)", letterSpacing: "0.3em", fontWeight: 700 }} className="text-sm">
            FLEDGE
          </span>
          <Link
            href="/create"
            className="rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ background: GREEN, color: "#03140a" }}
          >
            Launch a coin
          </Link>
        </div>
      </nav>

      <div className="relative z-10">
        {/* ACTO 0 — el cartel */}
        <section className="relative min-h-[170vh]">
          <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 pt-20">
            <div className="relative ml-auto w-full max-w-2xl text-right">
              <div
                style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.28em", color: GREEN }}
                className="text-xs uppercase"
              >
                A Robinhood Chain legend
              </div>
              <h1
                style={{ fontFamily: "var(--f-display)", fontWeight: 700, lineHeight: 1.04 }}
                className="mt-6 text-[clamp(2.7rem,6.8vw,5.8rem)] uppercase"
              >
                The fees find
                <br />
                <span style={{ color: GREEN }}>their mark.</span>
              </h1>
              <p className="ml-auto mt-7 max-w-md text-lg" style={{ color: "rgba(239,238,230,0.78)" }}>
                Launch a coin for someone who ships. Every trade sends a slice into escrow, sworn
                to their GitHub, X, or wallet. Only they can ever claim it.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-end gap-4">
                <a
                  href="#ledger"
                  className="text-base font-medium underline decoration-1 underline-offset-4"
                  style={{ color: CREAM }}
                >
                  I was funded →
                </a>
                <Link
                  href="/create"
                  className="rounded-full px-6 py-3 text-base font-semibold"
                  style={{ background: GREEN, color: "#03140a" }}
                >
                  Launch a coin
                </Link>
              </div>
            </div>

            <div
              className="pointer-events-none absolute bottom-[7.5vh] left-1/2 hidden [@media(min-height:760px)]:flex -translate-x-1/2 flex-col items-center gap-2"
              style={{ fontFamily: "var(--f-mono)", color: "rgba(239,238,230,0.45)" }}
            >
              <span className="text-[10px] uppercase tracking-[0.3em]">Scroll to loose the arrow</span>
              <span aria-hidden className="block h-9 w-px" style={{ background: hairline(0.35) }} />
            </div>
          </div>
        </section>

        {/* ACTOS I–III — créditos de la leyenda */}
        <section className="relative min-h-[150vh]">
          <div className="mx-auto max-w-4xl px-6 py-24">
            {[
              { act: "Act I", num: "I", t: "Mark", d: "Name the builder — by their GitHub, their X, or a wallet. Their coin goes live on Flap in seconds. They don't even need to know yet." },
              { act: "Act II", num: "II", t: "Tribute", d: "Every buy and sell pays tribute: a slice of the trading tax rides into an on-chain vault sworn to that name. Automatic. Non-custodial. No hands touch it." },
              { act: "Act III", num: "III", t: "Claim", d: "The builder proves the name is theirs — a signature, a login, the X oracle — and sweeps the gold to any wallet. No one else. Not us. Not the launcher." },
            ].map((s, i) => (
              <Reveal key={s.act} delay={i * 90}>
                <div className="relative py-16 text-center">
                  {/* numeral romano fantasma detrás del acto */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex select-none items-center justify-center leading-none"
                    style={{
                      fontFamily: "var(--f-display)",
                      fontWeight: 700,
                      fontSize: "clamp(11rem, 30vw, 22rem)",
                      color: "rgba(239,238,230,0.045)",
                    }}
                  >
                    {s.num}
                  </div>
                  <div className="relative">
                    <div
                      style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.3em", color: GOLD }}
                      className="text-xs uppercase"
                    >
                      {s.act}
                    </div>
                    <h2
                      style={{ fontFamily: "var(--f-display)", fontWeight: 700 }}
                      className="mt-3 text-[clamp(2.2rem,5.4vw,3.8rem)] uppercase tracking-wide"
                    >
                      {s.t}
                    </h2>
                    <p className="mx-auto mt-4 max-w-lg text-[17px] leading-relaxed" style={{ color: "rgba(239,238,230,0.75)" }}>
                      {s.d}
                    </p>
                  </div>
                  {i < 2 && <div aria-hidden className="mx-auto mt-14 h-px w-2/3" style={{ background: hairline(0.2) }} />}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* los créditos — starring the builders */}
        <div className="relative select-none border-y py-5" style={{ borderColor: HAIR }}>
          <Marquee duration={30}>
            <span
              style={{ fontFamily: "var(--f-display)", letterSpacing: "0.22em", color: "rgba(217,164,65,0.55)" }}
              className="text-sm uppercase"
            >
              Starring the builders&nbsp;—&nbsp;@torvalds&nbsp;·&nbsp;@gakonst&nbsp;·&nbsp;@shadcn&nbsp;·&nbsp;@dabit3&nbsp;·&nbsp;@rauchg&nbsp;·&nbsp;@the-maintainer&nbsp;·&nbsp;@your-favorite-dev&nbsp;·&nbsp;
            </span>
          </Marquee>
        </div>

        {/* EL LEDGER — ya estás dentro de la luz */}
        <section id="ledger" className="relative min-h-[120vh]">
          <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
            <Reveal>
              <div
                className="relative overflow-hidden rounded-2xl p-8 sm:p-12"
                style={{ background: "rgba(2,5,7,0.82)", border: `1px solid ${HAIR}` }}
              >
                <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: hairline(0.4) }} />
                <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.28em", color: GREEN }} className="text-xs uppercase">
                  The reckoning
                </div>
                <h2 style={{ fontFamily: "var(--f-display)", fontWeight: 700 }} className="mt-4 text-[clamp(1.9rem,4.6vw,3rem)] uppercase">
                  Gold under <span style={{ color: GOLD }}>your name</span>?
                </h2>
                <p className="mt-3 max-w-md" style={{ color: "rgba(239,238,230,0.68)" }}>
                  Check the vaults sworn to your GitHub, X, or wallet — and claim what is yours.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <select
                    suppressHydrationWarning
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
                    suppressHydrationWarning
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
                    style={{ background: GREEN, color: "#03140a" }}
                  >
                    {loading ? "Checking…" : "Check the vaults"}
                  </button>
                </div>

                {error && <p className="mt-4 text-sm" style={{ color: "#ff8f6b" }}>{error}</p>}
                {rows && rows.length === 0 && (
                  <p className="mt-8" style={{ color: "rgba(239,238,230,0.5)" }}>
                    No vault under this name yet. Be the one who launches it.
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
                          <div className="text-xs" style={{ fontFamily: "var(--f-mono)", color: "rgba(239,238,230,0.55)" }}>
                            {r.vault}
                          </div>
                          <div
                            style={{ fontFamily: "var(--f-display)", fontWeight: 700, color: GOLD, fontVariantNumeric: "tabular-nums" }}
                            className="mt-1 text-2xl"
                          >
                            {r.pendingLabel} ETH
                          </div>
                          {r.bound !== ZERO && (
                            <div className="mt-1 text-xs" style={{ color: "rgba(239,238,230,0.4)" }}>
                              bound to {r.bound}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/claim/${r.vault}`}
                          className="rounded-full px-5 py-2 font-semibold"
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

        {/* CIERRE — créditos */}
        <section className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(75% 60% at 50% 45%, rgba(2,5,7,0.7), transparent 84%)" }}
          />
          <div className="relative mx-auto flex min-h-[85vh] max-w-6xl flex-col items-center justify-center px-6 text-center">
            <Reveal>
              <h2
                style={{ fontFamily: "var(--f-display)", fontWeight: 700, lineHeight: 1.04 }}
                className="text-[clamp(2.4rem,6vw,4.8rem)] uppercase"
              >
                Every legend starts
                <br />
                with <span style={{ color: GREEN }}>one shot.</span>
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <Magnetic strength={10}>
                <Link
                  href="/create"
                  className="mt-10 inline-block rounded-full px-8 py-4 text-lg font-semibold"
                  style={{ background: GREEN, color: "#03140a" }}
                >
                  Launch a coin for someone
                </Link>
              </Magnetic>
            </Reveal>
          </div>
          <footer className="relative mx-auto max-w-6xl px-6 pb-12 pt-8">
            <div aria-hidden className="mb-6 h-px" style={{ background: hairline(0.16) }} />
            <div
              className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              style={{ color: "rgba(239,238,230,0.45)", fontFamily: "var(--f-mono)" }}
            >
              <span className="uppercase tracking-[0.28em]">Fledge</span>
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
