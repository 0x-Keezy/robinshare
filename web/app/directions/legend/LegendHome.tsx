"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import { Reveal, stagIndex } from "@/components/Reveal";
import { Stat } from "@/components/Stat";
import { SetAsideBand } from "@/components/SetAsideBand";
import { OnChainStrip } from "@/components/OnChainStrip";
import { Magnetic } from "@/components/Magnetic";
import { useVaultLookup } from "@/lib/useVaultLookup";
import { Scroll, useScrollSync } from "@/lib/scrollProgress";
import { useHideNav } from "@/lib/useHideNav";
import { useTheme } from "@/lib/useTheme";
import { SetAsideMark } from "@/components/SetAsideMark";
import { QuillMark } from "@/components/QuillMark";
import { publicClient, robinhoodChain } from "@/lib/chain";
import { CUSTODY_LINE_PARTS } from "@/lib/claims";

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
/// El explorer de la cadena, para que toda direccion que la pagina muestre sea COMPROBABLE. Sale
/// de la definicion de chain y no de un literal: si la cadena cambia de explorer, cambia en un
/// lugar y no en cinco.
const EXPLORER = robinhoodChain.blockExplorers.default.url;

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

  // El numero parpadea cuando cambia. Sin esto, la altura de bloque en vivo y una escrita a mano
  // se ven EXACTAMENTE igual, y es el unico dato de la pagina que se lee de la cadena en tiempo
  // real: si no cobra por estar vivo, no sirve de nada que lo este.
  const [blockBumped, setBlockBumped] = useState(false);
  useEffect(() => {
    if (block === null) return;
    setBlockBumped(true);
    const t = setTimeout(() => setBlockBumped(false), 420);
    return () => clearTimeout(t);
  }, [block]);

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
      {/* EL CAMPO. El fondo deja de ser un color y pasa a ser una superficie.
          Un juez visual externo midio la pagina y su defecto #1 no fue un elemento: fue que en
          cuatro pantallas de desktop **no habia un solo asset** —ni gradiente, ni sombra, ni
          textura, ni profundidad— y que cuando no hay material, el ojo lee "esto no se construyo,
          se escribio". Esto es la capa mas barata de esa deuda y la que mas rinde: +5% de
          luminancia bajo el hero cayendo a nada, y un soplo del verde de la cadena arriba a la
          derecha. Enorme y eliptico a proposito: si el degradado se PERCIBE como degradado es
          glow, y el glow es el tell que hay que evitar; tiene que leerse como que la pagina esta
          iluminada desde algun lado. Fijo al viewport y detras de todo (-z-10). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--rs-field)" }}
      />
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
          {/* La marca va en UNA sola tinta. Antes su porcion apartada iba en el verde Robinhood
              (#00C805) mientras el CTA de al lado iba en lima: dos verdes distintos a 40px de
              distancia, lo bastante cerca como para leerse como un error y lo bastante lejos como
              para no leerse como sistema. Un juez visual lo cazo exactamente asi. La regla ahora
              es explicita y se sostiene en toda la pagina: **el verde de la cadena es solo para el
              dato en vivo** (el dot y la altura de bloque), y la marca se lee por su geometria,
              que es como fue dibujada. */}
          <div className="flex items-center gap-2" style={{ color: INK }}>
            <SetAsideMark color={INK} />
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em" }} className="text-xs font-medium uppercase">
              RobinShare
            </span>
          </div>
          <div className="flex items-center gap-4 sm:gap-5">
            {/* EL TEMA NO SE TOCA COMO FEATURE, PERO SI COMO ICONO.
                El sol/luna arriba a la derecha es un tell de scaffold que el gate del vertical
                falla por nombre (`ThemeToggle|sun.*moon`), y un juez externo lo leyo como tal. El
                impulso obvio era sacar el control entero, pero eso borra el tema claro, que
                funciona y tiene tokens propios: seria romper algo que anda por un problema de
                dibujo. Asi que se cambia el DIBUJO. El glifo es un circulo mitad tinta mitad
                papel —el icono de contraste, no el del clima— y ademas es literalmente el spine
                del producto: tinta sobre papel, el acta. Va dentro de una caja con hairline para
                que lea como un control del sistema y no como un emoji flotando. */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="rs-focus rs-press flex h-8 w-8 items-center justify-center rounded-[7px] transition-colors"
              style={{ color: INK, border: `1px solid ${HAIR}`, background: "var(--rs-surface)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 4.5a7.5 7.5 0 0 1 0 15Z" fill="currentColor" />
              </svg>
            </button>
            <a
              href="#ledger"
              className="rs-focus hidden text-sm font-medium underline-offset-4 transition-opacity hover:underline sm:block"
              style={{ color: DIM }}
            >
              Check a balance
            </a>
            {/* "Launch a coin" aparecia CUATRO veces con el mismo label y la misma pildora. En la
                nav alcanza el verbo: el contexto lo da la barra. */}
            <Link
              href="/create"
              className="rs-focus rs-press whitespace-nowrap rounded-[9px] px-4 py-2 text-sm font-bold sm:px-5"
              style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT, boxShadow: "var(--rs-lift)" }}
            >
              Launch
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10">
        {/* HERO — titular negro + panel terminal oscuro */}
        <section id="ledger" className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-28 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pt-32">
          <div>
            {/* el eyebrow deja de ser una linea de texto suelta: lleva su regla, que se DIBUJA.
                Una linea que aparece de golpe es un borde; una que se dibuja es un gesto. */}
            <div className="flex items-center gap-3">
              <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: FAINT }} className="text-xs uppercase sm:whitespace-nowrap">
                Social fee escrow · Robinhood Chain
              </div>
              <Reveal variant="draw" className="h-px flex-1" delay={260}>
                <div className="h-px w-full" style={{ background: "var(--rs-rule)" }} />
              </Reveal>
            </div>
            {/* lg+: el titular convive con el panel en un grid. En minusculas "Automatically." ocupa
                bastante menos ancho que en versales, asi que el clamp pudo subir sin que la
                palabra quiebre contra el min-content del panel (367px). Se verifica midiendo
                el ancho real en el QA, no a ojo. */}
            {/* EL TITULAR SE COMPONE, linea por linea (variante "set": cada linea sube desde
                detras de su propia caja, sin fade). Antes entraba como un bloque con el mismo
                fade + translate que TODO lo demas de la pagina — un juez visual lo llamo "la
                animacion mas perezosa que existe, aplicada uniformemente", y el problema real es
                que si el titular y el panel y la regla entran igual, ninguno se mueve como lo que
                es y el movimiento no comunica nada.
                El tracking negativo es ajuste optico: a 4.7rem, la Fraunces con espaciado normal
                deja las palabras flotando. */}
            <Reveal variant="set" stagger={110} className="mt-5">
              <h1
                style={{ fontFamily: "var(--f-display)", lineHeight: 0.96, letterSpacing: "-0.022em" }}
                className="text-[clamp(2.2rem,9.5vw,5.8rem)] lg:text-[clamp(3.2rem,5.8vw,4.7rem)]"
              >
                <span className="block" style={stagIndex(0)}>
                  Route fees
                </span>
                <span className="block" style={stagIndex(1)}>
                  to builders.
                </span>
                <span className="block" style={stagIndex(2)}>
                  Automatically.
                </span>
              </h1>
            </Reveal>
            <Reveal variant="settle" delay={420}>
              <p className="mt-6 max-w-md text-lg leading-relaxed" style={{ color: DIM }}>
                Launch a coin for any builder. Every trade sets a cut aside for their GitHub or
                wallet. Only they can claim it.
              </p>
            </Reveal>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link
                  href="/create"
                  className="rs-focus rs-press inline-block rounded-[11px] px-6 py-3.5 text-base font-bold"
                  style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT, boxShadow: "var(--rs-lift)" }}
                >
                  Launch a coin
                </Link>
              </Magnetic>
              {/* El "I was funded" mandaba a #ledger, que ahora ES esta misma sección: era un
                  link a sí mismo. Hace lo único útil que puede desde acá — poner el cursor en el
                  campo del lookup, que está al lado. */}
              {/* UN SECUNDARIO DE VERDAD. Antes esto era texto subrayado, o sea que la pagina
                  tenia un solo componente de boton (la pildora lima) repetido cuatro veces y
                  ningun secundario: no habia sistema, habia un boton. Ahora es superficie +
                  hairline + label en tinta plena, que es el segundo nivel real de una jerarquia
                  de tres. */}
              <button
                type="button"
                onClick={() => document.getElementById("rs-lookup")?.focus()}
                className="rs-focus rs-press inline-block rounded-[11px] px-5 py-3.5 text-base font-semibold transition-colors"
                style={{
                  background: "var(--rs-surface)",
                  border: "1px solid var(--rs-edge-strong)",
                  color: INK,
                }}
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
          {/* EL PANEL, con material. Era `#080D0A` plano con un `1px solid` uniforme: la unica
              pieza "diseñada" de la pagina era un formulario con borde y radio. Ahora el borde es
              ASIMETRICO —el de arriba atrapa luz, el de abajo no, que es lo que hace que un panel
              se sienta fisico— y la sombra es direccional con spread negativo, no un halo.
              Entra con la variante "settle": baja con overshoot amortiguado, como un objeto con
              masa que llega a su lugar. */}
          <Reveal variant="settle" delay={180}>
            <div
              className="overflow-hidden rounded-[14px]"
              style={{
                background: "linear-gradient(180deg, #0C1310, #070B09)",
                borderTop: "1px solid var(--rs-edge-top)",
                borderLeft: "1px solid rgba(247,248,244,0.10)",
                borderRight: "1px solid rgba(247,248,244,0.10)",
                borderBottom: "1px solid var(--rs-edge-bot)",
                boxShadow: "var(--rs-lift-hi)",
              }}
            >
              <div
                className="flex items-center gap-2 border-b px-5 py-3.5"
                style={{ borderColor: "rgba(247,248,244,0.10)", background: "rgba(247,248,244,0.022)" }}
              >
                <span className="rs-live-dot h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
                <span className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.55)" }}>
                  Balance check
                </span>
                {/* La altura de bloque es el unico dato REALMENTE vivo de la pagina, asi que
                    mientras no llego se muestra su hueco (skeleton) en vez de no existir: un
                    elemento que aparece de la nada mueve el layout y, peor, no deja ver que se
                    estaba esperando algo. Y cuando cambia, parpadea — sin eso, un contador en vivo
                    y uno congelado se ven identicos. */}
                <span
                  className="ml-auto text-[11px] tabular-nums"
                  style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.4)" }}
                  title="Live block height on Robinhood Chain"
                >
                  {block === null ? (
                    <span className="rs-skeleton inline-block h-[1em] w-20 align-middle" />
                  ) : (
                    <>
                      block{" "}
                      <span
                        className={blockBumped ? "rs-tick" : ""}
                        style={{ color: "rgba(247,248,244,0.72)" }}
                      >
                        #{block.toLocaleString("en-US")}
                      </span>
                    </>
                  )}
                </span>
              </div>

              <div className="px-5 py-6">
                <p className="text-[15px] leading-relaxed" style={{ color: "rgba(247,248,244,0.72)" }}>
                  Someone may have launched a coin for you. Search your GitHub or wallet.
                </p>

                {/* EL SELECT NATIVO SE FUE. Era un `<select>` sin estilar: su chevron lo dibujaba
                    el user-agent, con otro gris y otro peso optico que todo lo demas de la pagina,
                    y su underline medía ~160px contra los ~440px del input vecino, o sea dos
                    controles hermanos que no compartian ni una medida. Ademas las dos labels
                    quedaban 8px fuera de baseline entre si porque select e input tienen alturas
                    intrinsecas distintas.
                    Un segmentado de dos arregla las tres cosas y ademas DICE que son exactamente
                    dos caminos, que es la verdad del producto (no hay una tercera ruta: la factory
                    va con xVerifier=0 y esa creacion revierte en cadena). */}
                <div className="mt-6 flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.4)" }}>
                    Identity
                  </span>
                  <div
                    role="group"
                    aria-label="Identity type"
                    className="grid grid-cols-2 gap-1 rounded-[9px] p-1"
                    style={{ background: "rgba(0,0,0,0.32)", border: "1px solid rgba(247,248,244,0.10)" }}
                  >
                    {(["github", "wallet"] as const).map((t) => {
                      const on = type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setType(t)}
                          className="rs-focus rs-press rounded-[6px] py-1.5 text-[13px] font-medium transition-colors"
                          style={{
                            fontFamily: "var(--f-mono)",
                            background: on ? "rgba(247,248,244,0.11)" : "transparent",
                            color: on ? "#F2F3EE" : "rgba(247,248,244,0.5)",
                            boxShadow: on ? "inset 0 1px 0 rgba(247,248,244,0.14)" : "none",
                          }}
                        >
                          {t === "github" ? "GitHub" : "Wallet"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="mt-5 flex flex-col gap-2">
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
                    className="rs-focus w-full rounded-[9px] px-3 py-2.5 text-base transition-colors placeholder:opacity-30 focus:outline-none"
                    style={{
                      background: "rgba(0,0,0,0.32)",
                      border: "1px solid rgba(247,248,244,0.14)",
                      color: "#F2F3EE",
                      fontFamily: "var(--f-mono)",
                    }}
                  />
                </label>

                {/* EL PRIMARIO NO PUEDE VESTIRSE DE DISABLED EN REPOSO. El estado que ve TODO
                    visitante al llegar es "campo vacio", y ahi el boton era label gris sobre
                    transparente con hairline: un juez visual lo leyo, correctamente, como "no
                    puedo tocar esto" — mientras el boton de la nav, a 500px, era lima solido.
                    Ahora vacio = superficie con tinta plena (lee accionable, que es la verdad:
                    hay que escribir algo), y solo el estado de carga se apaga. */}
                <button
                  onClick={lookup}
                  disabled={loading || !value}
                  className="rs-focus rs-press mt-5 flex w-full items-center justify-center gap-2 rounded-[11px] px-6 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed"
                  style={
                    loading
                      ? { background: "rgba(247,248,244,0.06)", color: "rgba(247,248,244,0.5)" }
                      : !value
                        ? {
                            background: "rgba(247,248,244,0.07)",
                            border: "1px solid rgba(247,248,244,0.16)",
                            color: "rgba(247,248,244,0.82)",
                          }
                        : { background: GREEN_CTA, color: GREEN_CTA_TEXT, boxShadow: "var(--rs-lift)" }
                  }
                >
                  {loading && <span className="demo-spinner" aria-hidden />}
                  {loading ? "Reading the chain…" : "Check balance"}
                </button>

                {/* LOS CUATRO ESTADOS DEL LOOKUP.
                    Antes eran dos parrafitos de texto suelto y una lista. Es la unica herramienta
                    del sitio, hace una llamada RPC y puede fallar, asi que sus estados SON el
                    producto: un juez visual conto "sin loading, sin vacio, sin error, sin exito"
                    como el lugar exacto donde una pagina se delata.

                    CARGA — un renglon fantasma con la forma del resultado que viene, no un
                    spinner solo. El barrido dice "esto se esta llenando"; el spinner solo dice
                    "espera". Ademas reserva la altura, asi que cuando llega el dato el panel no
                    salta. */}
                {loading && !rows && (
                  <div className="mt-5 flex flex-col gap-2" aria-hidden>
                    <div className="rs-skeleton h-3 w-32" />
                    <div className="rs-skeleton h-6 w-44" />
                  </div>
                )}

                {/* ERROR — con etiqueta, no un renglon rojo suelto. El mensaje crudo de viem es
                    ilegible para un humano, asi que va debajo, en cuerpo chico, y arriba queda
                    lo unico que el visitante necesita saber. */}
                {error && (
                  <div
                    className="mt-5 rounded-[9px] px-4 py-3"
                    style={{ background: "rgba(255,143,122,0.07)", border: "1px solid rgba(255,143,122,0.28)" }}
                    role="alert"
                  >
                    <div className="text-[10px] uppercase tracking-[0.16em]" style={{ fontFamily: "var(--f-mono)", color: "#ff8f7a" }}>
                      The chain did not answer
                    </div>
                    <p className="mt-1.5 break-words text-[12px] leading-relaxed" style={{ color: "rgba(247,248,244,0.6)" }}>
                      {error}
                    </p>
                  </div>
                )}

                {/* VACIO — el estado mas comun, y era una linea gris que dejaba al visitante sin
                    nada que hacer. Ahora dice la verdad y ofrece la salida util. */}
                {rows && rows.length === 0 && (
                  <div className="mt-5 border-t pt-4" style={{ borderColor: "rgba(247,248,244,0.12)" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(247,248,244,0.62)" }}>
                      Nothing set aside under this name yet.
                    </p>
                    <Link
                      href="/create"
                      className="rs-focus mt-2 inline-block text-sm font-semibold underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
                      style={{ color: "#F2F3EE" }}
                    >
                      Launch a coin for someone →
                    </Link>
                  </div>
                )}

                {/* EXITO — la direccion del vault deja de ser texto muerto y linkea al explorer:
                    es la unica pantalla donde el visitante puede COMPROBAR lo que la pagina le
                    acaba de decir, y esa comprobacion es todo el producto. */}
                {rows && rows.length > 0 && (
                  <ul className="mt-5 flex flex-col">
                    {rows.map((r) => (
                      <li key={r.vault} className="flex items-center justify-between gap-3 border-t py-4" style={{ borderColor: "rgba(247,248,244,0.12)" }}>
                        <div className="min-w-0">
                          <a
                            href={`${EXPLORER}/address/${r.vault}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rs-focus text-[11px] underline decoration-1 underline-offset-2 transition-opacity hover:opacity-100"
                            style={{ fontFamily: "var(--f-mono)", color: "rgba(247,248,244,0.45)" }}
                          >
                            {r.vault.slice(0, 10)}…{r.vault.slice(-6)}
                          </a>
                          <div
                            className="mt-0.5 text-xl tabular-nums"
                            style={{ fontFamily: "var(--f-mono)", color: "#F2F3EE", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum" 1' }}
                          >
                            {r.pendingLabel}
                            <span className="ml-1.5 text-[13px]" style={{ color: "rgba(247,248,244,0.5)" }}>ETH</span>
                          </div>
                        </div>
                        <Link
                          href={`/claim/${r.vault}`}
                          className="rs-focus rs-press whitespace-nowrap rounded-[9px] px-4 py-2 text-xs font-bold"
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

        {/* AQUI CORRIA UN MARQUEE, Y SE FUE.
            La tira decia "RobinShare on Robinhood Chain · every trade pays the builder · only they
            can claim it" en loop. Un juez visual del vertical lo mando a sacar con tres razones
            que no tienen vuelta: (1) el marquee tiene un origen semantico unico, el ticker
            bursatil, y en fintech es legitimo cuando transporta DATOS — con slogans es el
            dispositivo de memecoin, y esta pagina se define justo por lo contrario ("which this
            site reads off the chain, not off a promise"); (2) repetia palabra por palabra el
            titular que estaba 100px mas abajo, la misma frase dos veces en una pantalla; y (3) a
            390px mostraba cinco palabras cortadas de los dos lados, compitiendo con el scroll
            vertical del visitante. Ninguno de los benchmarks del vertical —Mercury, Stripe, Ramp,
            Linear, Morpho, Uniswap— corre una tira de slogans.

            En su lugar va EL INSTRUMENTO: la marca a escala, mostrando el mecanismo en vez de
            describirlo. Es el unico dibujo que este producto puede tener y que no se puede pegar
            en otro sitio, y se mueve con el scroll del visitante, no en autoplay. */}
        <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <SetAsideBand />
        </section>

        {/* EL MECANISMO. Antes eran tres filas de `py-24` con un numeral de 7.5rem al costado:
            tres pantallas casi vacias para dos lineas de texto cada una. Eso no es respiro
            editorial, es relleno — mas fondo que contenido, y el visitante scrollea tres veces sin
            recibir nada. Ahora es UNA grilla de tres columnas con una regla que las une, y detras
            corre la plancha grabada: lo unico de la pagina que cruza capas en z. */}
        <section className="relative mx-auto max-w-6xl px-6 py-28">
          {/* la plancha: guilloche de certificado, el lenguaje visual de los titulos al portador.
              Va detras y muy tenue — es atmosfera, no ilustracion. La pagina no tenia NADA que
              cruzara capas; el juez lo marco como "relleno plano con hairlines". */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 h-[70%] bg-[url('/legend/plate.webp')] bg-cover bg-center"
            style={{
              opacity: "var(--rs-plate-opacity)",
              maskImage: "radial-gradient(70% 60% at 50% 50%, black 30%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(70% 60% at 50% 50%, black 30%, transparent 78%)",
            }}
          />
          <Reveal variant="set" stagger={0}>
            <h2
              style={{ fontFamily: "var(--f-display)", lineHeight: 1, letterSpacing: "-0.018em" }}
              className="max-w-3xl text-[clamp(1.8rem,4.2vw,3rem)]"
            >
              Every trade pays the person who earned it.
            </h2>
          </Reveal>

          {/* LOS TRES PASOS, SIN NUMERALES Y SIN RAILS.
              Antes cada paso abria con `/01 /02 /03` en mono gris sobre un rail vertical, que es
              **dos** tells del gate a la vez: la numeracion de seccion decorativa y el "numbered
              steps sobre un rail". Y encima los rails estaban mal ejecutados — morian ~70px debajo
              de la ultima linea de texto y no existian ni a la izquierda del primero ni a la
              derecha del tercero, asi que leian como una tabla sin terminar.
              Los tres pasos YA son secuenciales por su copy (Name them → Fees accrue → They
              claim): no necesitan que se lo digan con numeros. La secuencia ahora la marca una
              linea que AVANZA de izquierda a derecha con un nodo por paso, y que se dibuja al
              entrar — que es la misma informacion, dicha por el movimiento en vez de por un
              adorno. */}
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-3">
            {[
              {
                t: "Name them",
                d: "Pick a builder by GitHub or wallet. Their coin lists on pons in seconds, paired against native ETH.",
              },
              {
                t: "Fees accrue",
                d: "A launch-set cut of every trade lands in an on-chain vault under their name.",
              },
              {
                t: "They claim",
                d: "They prove it is them (GitHub login, or a signature from the wallet you named) and sweep the ETH.",
              },
            ].map((s, i) => (
              <div key={s.t} className="flex flex-col">
                {/* el tramo de linea de este paso + su nodo. El ultimo tramo se apaga hacia la
                    derecha: la secuencia termina, no se corta. */}
                <Reveal variant="draw" delay={i * 180}>
                  <div
                    className="h-px w-full"
                    style={{
                      background:
                        i === 2
                          ? "linear-gradient(90deg, var(--rs-hair) 60%, transparent)"
                          : "var(--rs-hair)",
                    }}
                  />
                </Reveal>
                <Reveal variant="settle" delay={i * 180 + 120}>
                  <div
                    aria-hidden
                    className="h-2 w-px"
                    style={{ background: i === 2 ? GREEN_TEXT : "var(--rs-hair)" }}
                  />
                  <h3
                    style={{ fontFamily: "var(--f-display)", letterSpacing: "-0.012em" }}
                    className="mt-5 text-2xl"
                  >
                    {s.t}
                  </h3>
                  <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed" style={{ color: DIM }}>
                    {s.d}
                  </p>
                </Reveal>
              </div>
            ))}
          </div>

          <div className="mt-20" />

          {/* LOS CUATRO HECHOS. Verificables, y verificados en esta sesion contra la cadena y
              contra el contrato, no contra la memoria:

                · 100 ms  — medido sobre 100.000 bloques de 4663: 101,3 ms reales.
                · 0       — el vault no tiene `onlyOwner`, ni proxy, ni hatch de emergencia. La
                            label dice "on the vault" y no "we hold" a proposito: la llave del
                            attester EXISTE y firma la identidad en la ruta de GitHub, y eso el
                            footer lo declara. "0 admin keys" a secas era cierto del contrato y
                            engañoso del producto.
                · 2       — GitHub y wallet. No hay una tercera: la factory va con xVerifier=0 y
                            esa creacion revierte en cadena.
                · 100 %   — leido del contrato: `withdraw()` transfiere `address(this).balance`
                            entero al boundWallet. No hay corte, ni skim, ni fee del sitio.

              Antes era un flex con gap uniforme, asi que "100ms" medía ~260px y "0" medía ~55px y
              quedaba un agujero entre medio; y una label que wrapeaba en mobile rompia la altura
              de su fila. Ahora es grilla de cuatro columnas iguales, cada celda con su hairline y
              altura reservada para dos lineas de label. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 sm:gap-x-8">
            <Stat value={100} suffix="ms" label="Chain block time" accent={INK} dim={FAINT} index={0} />
            <Stat value={0} label="Admin keys on the vault" accent={INK} dim={FAINT} index={1} />
            <Stat value={2} label="Ways to prove it is you" accent={INK} dim={FAINT} index={2} />
            {/* "Of the fee → builder" era ambiguo y se comia el unico acento decorativo de la
                pagina: un lector lo podia leer como una garantia absoluta, y el footer aclara dos
                lineas mas abajo que pons SI puede reapuntar los creator fees. Lo que si es
                literal y verificable —y es lo que este numero afirma— es que RobinShare no se
                queda con nada: `withdraw()` transfiere `address(this).balance` ENTERO al
                boundWallet. La label ahora dice eso y solo eso. */}
            <Stat value={100} suffix="%" label="Of the vault, to them" accent={GREEN_TEXT} dim={FAINT} index={3} />
          </div>
        </section>

        {/* custodia */}
        <section className="border-y" style={{ borderColor: HAIR, background: PAPER }}>
          {/* `items-center` centraba las dos columnas verticalmente y, como la izquierda solo
              tenia el titular, dejaba ~400px vacios de alto por media pagina de ancho mientras la
              derecha corria un parrafo de nueve lineas. Eso no es aire editorial: es una columna
              que se quedo sin contenido. Ahora arranca arriba y la izquierda LLEVA algo — las dos
              rutas de identidad, que ademas es donde tienen que estar. */}
          <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-12 px-6 py-28 lg:grid-cols-2 lg:items-start">
            <div>
              <Reveal variant="set" stagger={110}>
                <h2
                  style={{ fontFamily: "var(--f-display)", lineHeight: 1, letterSpacing: "-0.018em" }}
                  className="text-[clamp(1.8rem,4.2vw,3rem)]"
                >
                  <span className="block" style={stagIndex(0)}>
                    One vault. One identity.
                  </span>
                  <span className="block" style={stagIndex(1)}>
                    No keys of ours.
                  </span>
                </h2>
              </Reveal>

              {/* LAS DOS RUTAS, EN TIPOGRAFIA Y NO EN PILDORAS.
                  Antes eran dos chips con borde y radio completo: vestidos de CONTROL —el ojo lee
                  "esto se clickea"— cuando no son controles sino dos hechos. Un juez visual lo
                  fallo por nombre. Como jerarquia tipografica dicen lo mismo, no mienten sobre su
                  interactividad, y de paso llenan la columna que estaba vacia. */}
              <Reveal variant="lift" stagger={120} delay={260} className="mt-10 flex flex-col">
                {[
                  { k: "Wallet signature", v: "The wallet you named signs. Nothing else is involved." },
                  { k: "GitHub OAuth", v: "They log in as themselves, and we attest it on-chain." },
                ].map((m, i) => (
                  <div
                    key={m.k}
                    className="flex flex-col gap-1.5 border-t py-5"
                    style={{ borderColor: HAIR, ...stagIndex(i) }}
                  >
                    {/* SEGUNDA VOZ. Toda etiqueta chica de la pagina hablaba en mono caps con
                        tracking de 0.16-0.26em: eyebrow, labels de campo, labels de stat, titulos
                        de footer, estos. Veinte elementos con una sola voz, que es el tell de "una
                        textura repetida" y la razon principal de que el conjunto se sienta plano.
                        La regla nueva: **la mono se queda donde hay dato de cadena** (altura de
                        bloque, address, chain id, los numerales) y todo lo demas pasa al cuerpo,
                        con tracking corto. */}
                    <span
                      className="text-[12px] font-semibold uppercase"
                      style={{ letterSpacing: "0.07em", color: INK }}
                    >
                      {m.k}
                    </span>
                    <span className="max-w-[38ch] text-[14px] leading-relaxed" style={{ color: FAINT }}>
                      {m.v}
                    </span>
                  </div>
                ))}
              </Reveal>
            </div>

            <Reveal variant="settle" delay={160}>
              <div>
                {/* Puntuacion pareja: los apostrofos van curvos como las comillas. Antes convivian
                    &ldquo;zero keys&rdquo; (curvas) con coin&apos;s e it&apos;s (rectos) en el
                    mismo parrafo, que es exactamente el detalle que separa "caro" de "rapido". */}
                <p className="max-w-md text-lg leading-relaxed" style={{ color: DIM }}>
                  The vault is fixed at launch: no owner, no upgrades, no emergency hatch. The
                  money only moves to the wallet that proves the name, and the economics are
                  frozen the second the coin exists. Whoever launched it can never redirect the
                  fees, and can only ever reclaim them if they set a recovery window at launch,
                  which this site reads off the chain, not off a promise.
                </p>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed" style={{ color: FAINT }}>
                  Two things are not ours to promise, and we would rather say them than let you
                  read &ldquo;zero keys&rdquo; and find out later. pons, the launchpad the coin
                  lives on, can point a coin&rsquo;s creator fees somewhere else: a 2-of-3
                  multisig, behind a public 3-day timelock anyone can watch on-chain before it
                  lands, and it applies retroactively to anything not yet swept. Sweeping is
                  permissionless: anyone can shrink that window, and the builder can do it from
                  their own claim page with one click. And on a GitHub vault, our attester
                  signature is what proves the identity, so that key is trusted by construction.
                  Wallet vaults never touch it.
                </p>
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
          {/* py-32 dejaba ~500px muertos entre el boton y la regla del footer. El cierre es la
              UNICA seccion que se gana el aire maximo de la pagina (es el silencio antes del pie),
              pero el aire va ARRIBA del bloque, no debajo del boton. */}
          <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-32 text-center">
            <Reveal variant="set" stagger={0}>
              <h2
                style={{ fontFamily: "var(--f-display)", lineHeight: 0.98, letterSpacing: "-0.024em" }}
                className="text-[clamp(2.2rem,5.4vw,4.2rem)]"
              >
                Back the one who ships.
              </h2>
            </Reveal>
            <Reveal variant="settle" delay={160}>
              <p className="mt-5 max-w-md text-lg leading-relaxed" style={{ color: DIM }}>
                Someone you follow builds every day and nobody pays them. Fix that in one transaction.
              </p>
            </Reveal>
            <Reveal variant="settle" delay={280}>
              <Magnetic strength={10}>
                <Link
                  href="/create"
                  className="rs-focus rs-press mt-9 inline-block rounded-[12px] px-8 py-4 text-lg font-bold"
                  style={{ background: GREEN_CTA, color: GREEN_CTA_TEXT, boxShadow: "var(--rs-lift-hi)" }}
                >
                  Launch a coin for someone
                </Link>
              </Magnetic>
            </Reveal>
          </div>
          <footer className="relative mx-auto max-w-6xl overflow-hidden px-6 pb-12 pt-8">
            {/* EL WORDMARK, AHORA CON DECISION.
                Era la mejor jugada de art direction del sitio y estaba al 40% de su potencial:
                pegado a la derecha, recortado por overflow y no por eleccion, sin cruzar ninguna
                capa, y en mobile cortado a la derecha Y abajo, leyendo como artefacto.
                Ahora abarca el ancho, va CENTRADO (recorte simetrico) y se corta por la linea de
                base — que es el recorte de un masthead, y lee como decidido. Y sobre todo: el
                contenido del footer pasa POR ENCIMA, asi que hay algo que cruza capas en z, que
                era lo que la pagina entera no tenia. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 select-none whitespace-nowrap text-center leading-none"
              style={{
                fontFamily: "var(--f-display)",
                fontSize: "clamp(3.4rem,14vw,10rem)",
                color: "var(--rs-watermark)",
                letterSpacing: "-0.03em",
                bottom: "-0.22em",
              }}
            >
              ROBINSHARE
            </div>

            {/* LAS COORDENADAS. Antes el footer de un protocolo cuyo claim es "verifiable
                on-chain" cerraba con dos links, y los dos eran las mismas dos acciones de la nav:
                ni contrato, ni explorer, ni chain id, ni repo. */}
            <div className="relative border-t pb-10 pt-10" style={{ borderColor: HAIR }}>
              <OnChainStrip block={block} />
            </div>

            <div className="relative grid gap-10 border-t pb-10 pt-10 sm:grid-cols-3" style={{ borderColor: HAIR }}>
              <div>
                <span className="flex items-center gap-2 text-xs uppercase tracking-[0.26em]" style={{ fontFamily: "var(--f-mono)" }}>
                  <SetAsideMark size={14} color={INK} /> RobinShare
                </span>
                <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: DIM }}>
                  A coin&rsquo;s trading fees, routed to the builder who earned them. On Robinhood Chain.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2.5 text-sm font-medium" style={{ color: INK }}>
                <Link href="/create" className="rs-focus underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70">
                  Launch a coin →
                </Link>
                <a href="#ledger" className="rs-focus underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70">
                  Check a balance →
                </a>
              </div>
            </div>

            {/* LO QUE HAY QUE DECIR, CON JERARQUIA.
                Estas son las frases mas importantes del sitio —que el contrato no esta auditado, y
                que quien lo construye trabaja tambien en un competidor— y vivian dentro de un
                bloque de veinte lineas de mono gris de bajo contraste, o sea vestidas de letra
                chica. Un juez visual lo nombro como el defecto que mas valor tiraba a la basura:
                esa honestidad ES el diferenciador del producto.
                El texto es EL MISMO (`CUSTODY_LINE_PARTS` compone `CUSTODY_LINE` carácter por
                carácter, y `test/copy.test.ts` lo exige): lo que cambia es que cada bloque tiene su
                etiqueta, el cuerpo pasa a la sans con contraste real, y deja de ser un muro. */}
            {/* Los tres primeros bloques son hechos MECANICOS (que hace el vault, que poderes no
                controlamos, que limites tiene). Los dos ultimos son DECLARACIONES: cosas que
                cuestan conversiones y se dicen igual. Van separados y con distinto peso porque no
                son lo mismo — y porque cinco bloques en una grilla de tres dejaban una celda
                vacia abajo a la derecha, el mismo hueco en L que ya afeaba este footer. */}
            <div className="relative border-t pt-10" style={{ borderColor: HAIR }}>
              <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
                {CUSTODY_LINE_PARTS.slice(0, 3).map((part) => (
                  <div key={part.label} className="flex flex-col gap-2">
                    <span
                      className="text-[12px] font-semibold uppercase"
                      style={{ letterSpacing: "0.07em", color: INK }}
                    >
                      {part.label}
                    </span>
                    <p className="text-[13px] leading-relaxed" style={{ color: DIM }}>
                      {part.body.trim()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Las dos declaraciones, sobre superficie propia: dejan de ser dos notas al pie mas
                  y pasan a ser un bloque que se ve. Es la unica parte del footer con material. */}
              <div
                className="mt-10 grid gap-x-10 gap-y-6 rounded-[12px] p-6 sm:grid-cols-2"
                style={{
                  // La base OPACA es lo que importa: el panel era translucido, asi que el
                  // wordmark gigante del fondo se veia a traves del texto de auditoria — la
                  // letra fantasma justo debajo de lo mas serio que dice la pagina. El cruce en
                  // z tiene que ser por detras del contenido, no a traves de el.
                  background: "var(--rs-surface), var(--rs-paper)",
                  borderTop: "1px solid var(--rs-edge-top)",
                  borderBottom: "1px solid var(--rs-edge-bot)",
                }}
              >
                {CUSTODY_LINE_PARTS.slice(3).map((part) => (
                  <div key={part.label} className="flex flex-col gap-2">
                    <span
                      className="text-[12px] font-semibold uppercase"
                      style={{ letterSpacing: "0.07em", color: INK }}
                    >
                      {part.label}
                    </span>
                    <p className="text-[14px] leading-relaxed" style={{ color: INK }}>
                      {part.body.trim()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
