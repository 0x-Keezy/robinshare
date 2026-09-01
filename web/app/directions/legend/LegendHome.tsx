"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import { Reveal } from "@/components/Reveal";
import { LiveVaultFeed } from "@/components/LiveVaultFeed";
import { Marquee } from "@/components/Marquee";
import { Stat } from "@/components/Stat";
import { Magnetic } from "@/components/Magnetic";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { Scroll, useScrollSync } from "@/lib/scrollProgress";
import { useHideNav } from "@/lib/useHideNav";
import { useTheme } from "@/lib/useTheme";
import { SetAsideMark } from "@/components/SetAsideMark";
import { QuillMark } from "@/components/QuillMark";
import { publicClient } from "@/lib/chain";
import { CUSTODY_LINE } from "@/lib/claims";

/*
 * ROBINSHARE (ex-Legend, ganadora del bake-off) — el BROKERAGE.
 * Registro suizo-snappy: tipografía negra gigante, grid denso, hairlines.
 * Oscuro por defecto (tokens var(--rs-*), toggle a claro en el nav). El lima
 * es el acento de marca; el verde Robinhood puro queda SOLO en el tape en
 * vivo. La marca es el APARTADO (SetAsideMark): una barra con una porcion
 * separada y sostenida aparte — lo que el producto hace, sin metafora
 * prestada. El arco se fue: convergia con Recurve, el otro launchpad de
 * Jose en esta misma cadena, que se llama literalmente por un arco.
 */

// Fraunces variable, no Archivo Black. Ver BRIEF-facelift.md: el display anterior era el del molde
// suizo-snappy por defecto y no decia nada del producto. La serif de autoridad es el registro del
// acta — que es lo que este producto es: una parte apartada a nombre de alguien.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--f-display",
  axes: ["SOFT", "WONK", "opsz"],
});
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

  // demo interactivo del tape (producto-como-héroe, lección Arcus): el visitante
  // tipea un handle y ve SU vault llenarse — el feed enfoca ese nombre y el
  // total acumula fill a fill. Ilustrativo, como todo el tape.

  // block number REAL de Robinhood Chain en el header del tape — el único dato
  // del panel que no es ilustrativo: se lee del RPC en vivo (~100ms/block, el
  // salto entre polls se ve subir). Si el RPC no responde, no se muestra.
  const [block, setBlock] = useState<bigint | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () => {
      publicClient
        .getBlockNumber()
        .then((b) => {
          if (alive) setBlock(b);
        })
        .catch(() => {});
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

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
      {/* LA PLUMA: SACADA DE ESTE BUILD, a proposito.
          El concept spine (el acta) es bueno y la pluma es la metafora correcta, pero una pluma a
          medias es PEOR que ninguna. El juez visual la leyo como "helecho / fronda de palmera" y
          diagnostico por que, con precision: no tiene MASA (92 trazos abiertos sin contorno que los
          ate leen como peine, no como vano), la asimetria 1:1.39 es opticamente simetria, y el
          perfil sin(t^0.6·π) dibuja una LENTE — ancha al medio y apagada en los dos extremos —
          cuando una pluma es ancha abajo y termina en punta arriba.
          Y peor que el dibujo: estaba `fixed` en el gutter, o sea una calcomania pegada al viewport
          que aparecia recortada por algo distinto en cada seccion, y en mobile se cruzaba con el
          cuerpo de texto.
          Vuelve cuando este dibujada con silueta cerrada y COMPUESTA en una seccion —el lugar
          natural es echada bajo "One vault. One identity. No keys of ours.", como la pluma apoyada
          sobre un acta ya firmada—, no flotando de wallpaper. QuillMark.tsx queda en el repo con el
          diagnostico escrito. */}

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
            <SetAsideMark color={INK} accent={GREEN} />
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em" }} className="text-xs font-medium uppercase">
              RobinShare
            </span>
          </div>
          <div className="flex items-center gap-4 sm:gap-5">
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
            <Link href="/create" className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold sm:px-4" style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT }}>
              Launch a coin
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10">
        {/* HERO — titular negro + panel terminal oscuro */}
        <section id="ledger" className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-28 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-32">
          <div>
            <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: FAINT }} className="text-xs uppercase">
              Social fee escrow · Robinhood Chain
            </div>
            {/* lg+: el titular convive con el panel en un grid. En minusculas "Automatically." ocupa
                bastante menos ancho que en versales, asi que el clamp pudo subir sin que la
                palabra quiebre contra el min-content del panel (367px). Se verifica midiendo
                el ancho real en el QA, no a ojo. */}
            <h1
              style={{ fontFamily: "var(--f-display)", lineHeight: 0.96 }}
              className="mt-5 text-[clamp(2.2rem,9.5vw,5.8rem)] lg:text-[clamp(3.2rem,5.8vw,4.7rem)]"
            >
              Route fees
              <br />
              to builders.
              <br />
              Automatically.
            </h1>
            <p className="mt-6 max-w-md text-lg" style={{ color: DIM }}>
              Launch a coin for any builder. Every trade sets a cut aside for their GitHub or
              wallet. Only they can claim it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Magnetic>
                <Link href="/create" className="inline-block rounded-full px-6 py-3 text-base font-bold" style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT }}>
                  Launch a coin
                </Link>
              </Magnetic>
              {/* El "I was funded" mandaba a #ledger, que ahora ES esta misma sección: era un
                  link a sí mismo. Hace lo único útil que puede desde acá — poner el cursor en el
                  campo del lookup, que está al lado. */}
              <button
                type="button"
                onClick={() => document.getElementById("rs-lookup")?.focus()}
                className="text-base font-semibold underline decoration-2 underline-offset-4"
                style={{ color: INK }}
              >
                I was funded →
              </button>
            </div>
          </div>

          {/* EL LOOKUP ES EL HERO. Antes acá había un panel-terminal con handles inventados
              (@peblo, @aveline, @nkoto) y montos falso-precisos (+0.0143 ETH), o sea una UI de
              mentira como elemento de prueba principal — en el vertical cuyo gate dice "dato real
              o placeholder honesto". El disclaimer existía, pero en 11px al 50% de opacidad: MENOS
              contraste que los datos que desmentía. Y encima estaba mezclado con un input real en
              el mismo panel, así que el visitante no podía saber qué parte del producto existe.

              Ahora ese lugar lo ocupa el lookup DE VERDAD: escribís tu handle y la cadena
              contesta. Es el producto, era el wow declarado en el brief, y estaba enterrado al 85%
              del scroll como un formulario. El único dato del panel sigue siendo real —el block
              number del RPC— y ahora es lo que ancla el "esto está vivo" en vez de una maqueta. */}
          <Reveal>
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: "#080D0A", border: "1px solid rgba(247,248,244,0.12)" }}
            >
              <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(247,248,244,0.12)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
                <span className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.55)" }}>
                  Balance check
                </span>
                {block !== null && (
                  <span
                    className="ml-auto text-[11px] tabular-nums"
                    style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.4)" }}
                    title="Live block height — Robinhood Chain"
                  >
                    block <span style={{ color: GREEN }}>#{block.toLocaleString("en-US")}</span>
                  </span>
                )}
              </div>

              <div className="px-5 py-6">
                <p className="text-[15px] leading-relaxed" style={{ color: "rgba(247,248,244,0.72)" }}>
                  Someone may have launched a coin for you. Search your GitHub or wallet.
                </p>

                <div className="mt-5 flex items-end gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.4)" }}>
                      Identity
                    </span>
                    <select
                      suppressHydrationWarning
                      value={type}
                      onChange={(e) => setType(e.target.value as typeof type)}
                      className="border-0 border-b bg-transparent py-1.5 pr-5 text-sm focus:outline-none"
                      style={{ borderColor: "rgba(247,248,244,0.3)", color: "#F2F3EE", fontFamily: "var(--f-mono)" }}
                    >
                      <option value="github" style={{ color: "#000" }}>GitHub</option>
                      <option value="wallet" style={{ color: "#000" }}>Wallet</option>
                    </select>
                  </label>
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.4)" }}>
                      Name on the vault
                    </span>
                    <input
                      id="rs-lookup"
                      suppressHydrationWarning
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && lookup()}
                      placeholder={type === "wallet" ? "0x…" : "your-handle"}
                      spellCheck={false}
                      className="w-full border-0 border-b bg-transparent py-1.5 text-base placeholder:opacity-30 focus:outline-none"
                      style={{ borderColor: "rgba(247,248,244,0.3)", color: "#F2F3EE", fontFamily: "var(--f-mono)" }}
                    />
                  </label>
                </div>

                <button
                  onClick={lookup}
                  disabled={loading || !value}
                  className="mt-5 w-full rounded-full border-2 px-6 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed"
                  style={
                    loading || !value
                      ? { background: "transparent", borderColor: "rgba(247,248,244,0.3)", color: "rgba(247,248,244,0.45)" }
                      : { background: GREEN_CTA, borderColor: GREEN_CTA, color: GREEN_CTA_TEXT }
                  }
                >
                  {loading ? "Checking…" : "Check balance"}
                </button>

                {error && <p className="mt-4 text-sm" style={{ color: "#ff8f7a" }}>{error}</p>}
                {rows && rows.length === 0 && (
                  <p className="mt-5 text-sm" style={{ color: "rgba(247,248,244,0.55)" }}>
                    No vault under this identity yet.
                  </p>
                )}
                {rows && rows.length > 0 && (
                  <ul className="mt-5 flex flex-col">
                    {rows.map((r) => (
                      <li key={r.vault} className="flex items-center justify-between gap-3 border-t py-3" style={{ borderColor: "rgba(247,248,244,0.12)" }}>
                        <div className="min-w-0">
                          <div className="text-[11px]" style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.4)" }}>
                            {r.vault.slice(0, 10)}…{r.vault.slice(-6)}
                          </div>
                          <div className="text-lg tabular-nums" style={{ fontFamily: "var(--f-mono)", color: "#F2F3EE" }}>
                            {r.pendingLabel} ETH
                          </div>
                        </div>
                        <Link
                          href={`/claim/${r.vault}`}
                          className="whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold"
                          style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT }}
                        >
                          {r.bound === ZERO ? "Claim it" : "Open"}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Reveal>
        </section>

        {/* LA TIRA. El separador era un triangulo verde repetido — el tell exacto que un lector
            externo fotografio como "AI slop": el adorno de relleno que aparece en cualquier landing
            generada. Ahora separa LA MARCA (el apartado), que es el unico simbolo que este producto
            puede usar sin pedirselo prestado a nadie. Y el texto deja de gritar en versales: la
            serif del sistema pide caja mixta. */}
        <div className="border-y py-2.5" style={{ borderColor: HAIR }}>
          <Marquee duration={34}>
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.1em", color: DIM }} className="inline-flex items-center gap-3 text-xs">
              <span>RobinShare on Robinhood Chain</span>
              <SetAsideMark size={13} color={DIM} accent={GREEN} />
              <span>every trade pays the builder</span>
              <SetAsideMark size={13} color={DIM} accent={GREEN} />
              <span>only they can claim it</span>
              <SetAsideMark size={13} color={DIM} accent={GREEN} />
              <span className="pr-3" />
            </span>
          </Marquee>
        </div>

        {/* mecanismo — filas editoriales con numerales gigantes (aire tipo Arcus:
            un concepto por pantalla, el blanco es el lujo) */}
        <section className="mx-auto max-w-6xl px-6 py-28">
          <Reveal>
            <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="max-w-3xl text-[clamp(1.8rem,4.2vw,3rem)]">
              Every trade pays the person who earned it.
            </h2>
          </Reveal>
          <div className="mt-10 flex flex-col">
            {[
              { n: "01", t: "Name them", d: "Pick a builder by GitHub or wallet. Their coin lists on pons in seconds, paired against native ETH." },
              { n: "02", t: "Fees accrue", d: "A launch-set cut of every trade (1–10%) lands in an on-chain vault under their name." },
              { n: "03", t: "They claim", d: "They prove it's them (GitHub login, or a signature from the wallet you named) and sweep the ETH." },
            ].map((s) => (
              <Reveal key={s.n}>
                <div
                  className="grid items-center gap-6 border-t py-16 sm:grid-cols-[220px_1fr] sm:gap-12 sm:py-24"
                  style={{ borderColor: HAIR }}
                >
                  <div
                    aria-hidden
                    style={{ fontFamily: "var(--f-display)", color: FAINT, lineHeight: 0.9 }}
                    className="text-[clamp(4rem,9vw,7.5rem)] tracking-tight"
                  >
                    /{s.n}
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "var(--f-display)" }} className="text-2xl sm:text-3xl">
                      {s.t}
                    </h3>
                    <p className="mt-4 max-w-lg text-lg leading-relaxed" style={{ color: DIM }}>
                      {s.d}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* hechos en negro gigante — user-meaningful, verificables */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 border-t pt-14 sm:grid-cols-4" style={{ borderColor: HAIR }}>
            <Stat value={100} suffix="ms" label="Block time" accent={INK} dim={FAINT} />
            <Stat value={0} label="Admin keys we hold" accent={INK} dim={FAINT} />
            <Stat value={3} label="Ways to claim" accent={INK} dim={FAINT} />
            <Stat value={100} suffix="%" label="Of the fee → builder" accent={GREEN_TEXT} dim={FAINT} />
          </div>
          <p className="mt-6 text-[11px]" style={{ fontFamily: "var(--f-mono)", color: FAINT }}>
            Verifiable on-chain · Robinhood Chain (4663) ·{" "}
            <a
              href="https://github.com/0x-Keezy/robinshare"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-70"
            >
              open source
            </a>
          </p>
        </section>

        {/* custodia */}
        <section className="border-y" style={{ borderColor: HAIR, background: PAPER }}>
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-28 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 1 }} className="text-[clamp(1.8rem,4.2vw,3rem)]">
                One vault. One identity.
                <br />
                No keys of ours.
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <div>
                <p className="max-w-md text-lg leading-relaxed" style={{ color: DIM }}>
                  The vault is fixed at launch: no owner, no upgrades, no emergency hatch. The
                  money only moves to the wallet that proves the name, and the economics are
                  frozen the second the coin exists. Whoever launched it can never redirect the
                  fees, and can only ever reclaim them if they set a recovery window at launch —
                  which this site reads off the chain, not off a promise.
                </p>
                <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: FAINT }}>
                  Two things are not ours to promise, and we would rather say them than let you
                  read &ldquo;zero keys&rdquo; and find out later. pons, the launchpad the coin
                  lives on — can point a coin&apos;s creator fees somewhere else: a 2-of-3
                  multisig, behind a public 3-day timelock anyone can watch on-chain before it
                  lands, and it applies retroactively to anything not yet swept. Sweeping is permissionless: anyone can shrink that
                  window, and the builder can do it from their own claim page with one click.
                  And on a GitHub vault, our attester signature is what
                  proves the identity — so that key is trusted, by construction. Wallet
                  vaults never touch it.
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                  {["wallet signature", "github oauth"].map((m) => (
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

        {/* La sección "Balance check" que vivía acá se MUDÓ AL HERO. Era el producto y el wow
            declarado del brief, y estaba al 85% del scroll como un formulario: el visitante tenía
            que atravesar toda la página de venta para llegar a la única acción que le sirve a ÉL.
            El ancla #ledger apunta ahora al hero, así que los links de la nav siguen andando. */}

        {/* CTA final + footer claro */}
        <section className="border-t" style={{ borderColor: HAIR, background: PAPER }}>
          <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-32 text-center">
            <Reveal>
              <h2 style={{ fontFamily: "var(--f-display)", lineHeight: 0.98 }} className="text-[clamp(2.2rem,5.4vw,4.2rem)]">
                Back the one who ships.
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
                  <SetAsideMark size={14} color={INK} accent={GREEN} /> RobinShare
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
                {CUSTODY_LINE}
              </p>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
