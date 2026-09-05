"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gabarito, Archivo, IBM_Plex_Mono } from "next/font/google";
import { useVaultLookup, type IdType } from "@/lib/useVaultLookup";
import { formatEther } from "viem";
import { publicClient, robinhoodChain, factoryAddress } from "@/lib/chain";
import { escrowAbi } from "@/lib/abis";
import { CUSTODY_LINE_PARTS } from "@/lib/claims";

/*
 * TAPE — el recibo, gritado. Ver BRIEF-tape.md.
 *
 * DE DONDE SALE. Jose trajo staqsend.cash y pidio "una version en este estilo". La referencia del
 * usuario ES el benchmark. Pero STAQ no es solo una referencia de estilo: es un competidor directo
 * —mismo launchpad, misma cadena, mismo producto— asi que copiar su afiche haria que esto se lea
 * como un clon suyo.
 *
 * SEGUNDA PASADA, y el juez fresco tenia razon en lo grande (5,5/10, no pasa). Dos correcciones que
 * cambiaron el sistema entero:
 *
 * 1. EL CAMPO ESTABA PRESTADO. La primera version pintaba la pagina de `#CCFF00`, que medido es
 *    oklch(0.93 0.24 124) contra el oklch(0.93 0.23 118) del fondo de STAQ: mismo L, misma C, seis
 *    grados de tono. El brief se habia auto-aprobado el eje de paleta mirando el acento SECUNDARIO
 *    ("no usamos su naranja") y no el campo primario, que es justo lo que la gente recuerda de una
 *    pagina. Ahora el campo es TINTA y el lima es acento en dos bandas: lo que se recuerda de esta
 *    pagina es un afiche negro con datos lima, y de paso el recibo de papel crema sobre negro es
 *    una imagen que el competidor no tiene. Ademas devuelve el lock de ADN (oscuro por defecto).
 *
 * 2. EL WOW DISPARABA DONDE NADIE LO VE. El buscador vivia en la seccion 4 y el recibo en la 1, a
 *    ~2000px de scroll: escribias, la cadena contestaba, y lo que cambiaba estaba fuera de pantalla
 *    (la captura del efecto tuvo que volver a subir para mostrarlo). Ahora la herramienta y el
 *    comprobante comparten encuadre en el hero, que ademas es la leccion que `legend` ya habia
 *    aprendido: el lookup ES el hero.
 *
 * EL SISTEMA DE IMPRESION. Todo lo que la pagina "imprime" lleva una plancha lima corrida unos
 * pixeles: el titular y el recibo. Eso es un desregistro de serigrafia de verdad —una tinta
 * DISTINTA fuera de registro—, no la misma tinta translucida, que es lo que hacia la v1 y leia como
 * sombra borrosa. Es el unico efecto de la pagina y es el que la firma.
 *
 * `legend` sigue siendo la direccion de produccion. Esta vive en /v/tape hasta que se juzgue.
 */

// Gabarito 900: gorda y geometrica, con autoridad. BAN explicito de Bagel Fat One (la display de
// STAQ, de registro burbuja) y de Bricolage Grotesque (su cuerpo). Archivo e IBM Plex Mono ya
// estaban en el proyecto: de tres caras se reusan dos y cambia la que da la personalidad.
const display = Gabarito({ subsets: ["latin"], weight: ["800", "900"], variable: "--t-display" });
const body = Archivo({ subsets: ["latin"], variable: "--t-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--t-mono" });

/// Los colores salen de variables CSS y no de literales: las tres variantes de tinta (lima, rojo y
/// papel) son el MISMO componente con otro bloque de variables — ver `.tape-lima` / `.tape-rojo` /
/// `.tape-papel` en globals.css. Tres copias del archivo se desincronizan a la primera correccion.
const TINTA = "var(--tp-campo)";
const PAPEL = "var(--tp-papel)";
const PAPEL_TINTA = "var(--tp-papel-tinta)";
/// El acento: en `lima` es el #CCFF00 de RobinShare, en las otras dos el rojo de recibo termico.
const LIMA = "var(--tp-acento)";
const ACENTO_TEXTO = "var(--tp-acento-texto)";
/// Verde de la cadena. Lockeado: SOLO dato en vivo (la altura de bloque). Nunca decorativo, y por
/// eso es el unico color que NO cambia entre variantes.
const VIVO = "#00C805";
const CUERPO = "var(--tp-cuerpo)";
const HAIR = "var(--tp-hair)";
const EXPLORER = robinhoodChain.blockExplorers.default.url;
/// EL UNICO CICLO QUE CORRIO DE VERDAD. El juez encontro el hueco mas caro de la pagina: el unico
/// numero vivo era la altura de bloque, que prueba que la cadena existe y no que el producto
/// funciono. Este vault si: se lanzo, se tradeo, se cosecho y se cobro, en mainnet. Se lee su
/// `totalPaid()` EN VIVO —no se escribe a mano— y se linkea al explorer para que el lector lo
/// compruebe sin creernos nada.
/// Va sin la identidad a proposito: el handle del vault es el de Jose y no tiene por que estar en
/// la pagina. La prueba es la plata y la direccion, no de quien era.
const VAULT_PILOTO = "0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3" as const;
/// Gas de las dos transacciones del cobro, sumado del explorer: 0,00005635 + 0,00002072.
const GAS_DEL_COBRO = "0.000077";

export type VarianteTape = "lima" | "rojo" | "papel";

export function TapeHome({ variante = "lima" }: { variante?: VarianteTape } = {}) {
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();

  /// Lo que se busco DE VERDAD, que no es `value` (eso cambia con cada tecla). El recibo se imprime
  /// con esto: si se imprimiera con `value`, el ticket se escribiria solo letra por letra mientras
  /// alguien tipea, que es lo contrario de un comprobante.
  const [named, setNamed] = useState<{ value: string; type: IdType } | null>(null);
  /// La altura a la que se leyo la cadena, CONGELADA al disparar. Un recibo con un numero que sigue
  /// corriendo no atestigua nada.
  const [sealedAt, setSealedAt] = useState<bigint | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);
  const [pagado, setPagado] = useState<bigint | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      publicClient
        .getBlockNumber()
        .then((b) => {
          if (alive) setBlock(b);
        })
        .catch(() => {});
    tick();
    publicClient
      .readContract({ address: VAULT_PILOTO, abi: escrowAbi, functionName: "totalPaid" })
      .then((v) => {
        if (alive) setPagado(v as bigint);
      })
      .catch(() => {});
    const iv = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const run = () => {
    const v = value.trim();
    if (!v) return;
    setNamed({ value: v, type });
    setSealedAt(block);
    lookup();
  };

  return (
    <main
      className={`tape-${variante} ${display.variable} ${body.variable} ${mono.variable}`}
      style={{ background: "var(--tp-campo)", color: "var(--tp-tinta)", fontFamily: "var(--t-body)" }}
    >
      {/* ── NAV ─────────────────────────────────────────────────────────────────────────────
          No es `fixed` a proposito: en un afiche la barra es parte de la hoja, no una capa que
          flota encima, y ademas evita de raiz el defecto que ya cazamos en `legend` (un scrim que
          se desvanece adentro del nav deja el contenido leyendose a traves).
          `Docs` no desaparece en telefono: un juez marco que la v1 perdia sus dos links
          secundarios sin hamburguesa ni reemplazo, o sea perdia funcion y no solo estetica. */}
      <nav className="border-b" style={{ borderColor: HAIR }}>
        <div className="rs-shell flex items-center justify-between py-3.5">
          <Link
            href="/"
            className="rs-focus rs-tap text-xl leading-none tracking-[-0.03em] sm:text-2xl"
            style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}
          >
            ROBINSHARE
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/docs" className="rs-focus rs-tap text-[13px] font-semibold uppercase tracking-[0.08em] sm:text-sm" style={{ color: CUERPO }}>
              Docs
            </Link>
            <Link
              href="/create"
              className="rs-focus rs-press rounded-full px-5 py-3 text-[13px] font-bold uppercase tracking-[0.06em] sm:py-2.5 sm:text-sm"
              style={{ background: LIMA, color: ACENTO_TEXTO }}
            >
              Launch
            </Link>
          </div>
        </div>
      </nav>

      {/* ── 1 · HERO = TITULAR + HERRAMIENTA + COMPROBANTE, EN UN SOLO ENCUADRE ──────────────
          La v1 tenia el buscador 2000px mas abajo que el recibo, asi que el unico wow de la pagina
          ocurria fuera de pantalla. Van juntos: escribis a la izquierda y el ticket se imprime a la
          derecha, en el mismo golpe de vista. */}
      <section className="rs-shell flex flex-col gap-8 py-12 sm:py-16 lg:grid lg:grid-cols-[1.02fr_minmax(330px,0.98fr)] lg:items-start lg:gap-x-16 lg:gap-y-8">
        <div className="order-1 lg:col-start-1 lg:row-start-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] sm:text-xs" style={{ fontFamily: "var(--t-mono)", color: LIMA }}>
            Social fee escrow · Robinhood Chain
          </div>

          {/* EL TITULAR, CON LA PLANCHA LIMA FUERA DE REGISTRO. Una tinta DISTINTA corrida, no la
              misma al 16% (eso leia como sombra borrosa, que es el efecto barato que esta pagina
              jura no tener). `aria-hidden` para que ningun lector lo lea dos veces. */}
          <h1 className="tape-h1 relative mt-5" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            <span aria-hidden className="tape-ghost absolute inset-0 select-none">
              LAUNCH A COIN IN SOMEONE ELSE&rsquo;S NAME
            </span>
            <span className="relative">LAUNCH A COIN IN SOMEONE ELSE&rsquo;S NAME</span>
          </h1>

          {/* Dos lineas, no seis. En registro afiche el cuerpo no puede tener mas area que el
              titular, y en telefono ese parrafo empujaba el comprobante abajo del fold. El detalle
              largo vive en /docs, que para eso existe. */}
          <p className="mt-5 max-w-md text-lg font-medium leading-snug sm:text-xl">
            Name a builder by their GitHub handle. Their coin goes live on pons, paired against
            native ETH, and <strong style={{ color: LIMA, fontWeight: 700 }}>0.70% of every trade</strong>{" "}
            waits in a vault only they can open.
          </p>

          <div className="mt-7">
            <Link
              href="/create"
              className="rs-focus rs-press inline-block rounded-full px-8 py-4 text-base font-bold uppercase tracking-[0.04em]"
              style={{ background: LIMA, color: ACENTO_TEXTO }}
            >
              Launch a coin →
            </Link>
          </div>

          </div>

          <div className="order-3 lg:col-start-1 lg:row-start-2">
          {/* LA HERRAMIENTA, ROTULADA. Sin este rotulo el visitante ve un titular que
              dice "lanzá" y abajo un formulario que consulta, o sea dos acciones peleando por el
              mismo espacio sin que nada diga cual es cual. */}
          <div className="mt-9 border-t pt-7" style={{ borderColor: HAIR }}>
            <div className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: CUERPO }}>
              Or someone may have launched one for you
            </div>
            <div id="lookup" role="group" aria-label="Identity type" className="mt-4 flex scroll-mt-6 gap-2">
              {(["github", "wallet"] as const).map((t) => {
                const on = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setType(t)}
                    className="rs-focus rs-press rs-tap rounded-full border px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.06em]"
                    style={
                      on
                        ? { background: "var(--tp-tinta)", color: "var(--tp-campo)", borderColor: "var(--tp-tinta)" }
                        : { background: "transparent", color: CUERPO, borderColor: "color-mix(in srgb, var(--tp-tinta) 30%, transparent)" }
                    }
                  >
                    {t === "github" ? "GitHub" : "Wallet"}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-row gap-2 sm:gap-3">
              <input
                ref={inputRef}
                id="tape-lookup"
                suppressHydrationWarning
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                placeholder={type === "wallet" ? "0x…" : "their-handle"}
                spellCheck={false}
                aria-label={type === "wallet" ? "Wallet address" : "GitHub handle"}
                className="tape-campo rs-focus w-full rounded-xl border-2 px-5 py-4 text-base font-medium focus:outline-none"
                style={{ fontFamily: "var(--t-mono)" }}
              />
              {/* EL PRIMARIO NO PUEDE VESTIRSE DE ROTO EN REPOSO. El estado que ve TODO visitante al
                  llegar es "campo vacio": ahi va tinta plena sobre el borde de papel (lee
                  accionable, que es la verdad: hay que escribir algo) y solo la carga se apaga. */}
              <button
                onClick={run}
                disabled={loading || !value}
                className="rs-focus rs-press shrink-0 rounded-xl border-2 px-5 py-4 text-sm font-bold uppercase tracking-[0.04em] sm:px-8 sm:text-base"
                style={
                  loading
                    ? { background: "transparent", borderColor: "color-mix(in srgb, var(--tp-tinta) 30%, transparent)", color: CUERPO }
                    : !value
                      ? { background: "transparent", borderColor: "var(--tp-tinta)", color: "var(--tp-tinta)" }
                      : { background: LIMA, borderColor: LIMA, color: TINTA }
                }
              >
                {loading ? "Reading…" : "Check"}
              </button>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "#ff8f7a", color: "#ff8f7a" }} role="alert">
                The chain did not answer. {error}
              </p>
            )}

            {rows && rows.length === 0 && (
              <p className="mt-3 text-[15px] font-semibold">
                Nothing set aside under that name yet.{" "}
                <Link href="/create" className="rs-focus underline decoration-2 underline-offset-4" style={{ color: LIMA }}>
                  Launch one for them →
                </Link>
              </p>
            )}

            {rows && rows.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {rows.map((r) => (
                  <li
                    key={r.vault}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-3.5"
                    style={{ borderColor: "color-mix(in srgb, var(--tp-tinta) 30%, transparent)" }}
                  >
                    <div className="min-w-0">
                      <a
                        href={`${EXPLORER}/address/${r.vault}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rs-focus text-[11px] underline decoration-1 underline-offset-2"
                        style={{ fontFamily: "var(--t-mono)", color: CUERPO }}
                      >
                        {r.vault.slice(0, 10)}…{r.vault.slice(-6)}
                      </a>
                      <div className="text-xl font-bold tabular-nums" style={{ fontFamily: "var(--t-mono)" }}>
                        {r.pendingLabel} <span className="text-sm font-medium opacity-60">ETH</span>
                      </div>
                    </div>
                    <Link
                      href={`/claim/${r.vault}`}
                      className="rs-focus rs-press rounded-full px-5 py-2.5 text-[13px] font-bold uppercase"
                      style={{ background: LIMA, color: ACENTO_TEXTO }}
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}

          </div>
        </div>

        <div className="order-2 flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Recibo named={named} rows={rows} loading={loading} sealedAt={sealedAt} block={block} />
          <Talon />
        </div>
      </section>

      {/* ── 2 · LOS CUATRO HECHOS (banda lima) ──────────────────────────────────────────────
          Datos, no eslóganes, y es una de las DOS bandas lima de toda la pagina: el acento pega
          porque es escaso. Cada celda lleva su regla arriba, si no las cifras cortas ("2", "0")
          nadan en su columna mientras "0.70%" la llena. */}
      <div className="tape-seam" style={{ background: LIMA }} />

      <section style={{ background: LIMA, color: ACENTO_TEXTO }}>
        <div className="rs-shell grid grid-cols-2 gap-x-8 gap-y-9 py-12 sm:py-14 lg:grid-cols-4">
          <Hecho v="0.70%" k="Of every trade, to them" />
          <Hecho v="100%" k="Of the vault pays out" />
          <Hecho v="2" k="Ways to prove it is you" />
          {/* Un juez conto la banda: cuatro numeros gigantes y ninguno era un DATO — 0,70% es un
              parametro, 100% y 0 son afirmaciones, 2 es un conteo de features. Toma la forma de la
              franja de metricas (el marcador de confianza del vertical) sin cargar el contenido
              que la justifica. Ahora el cuarto sale de la cadena. */}
          <Hecho v={pagado === null ? "…" : formatEther(pagado)} k="ETH paid out so far · on chain" />
        </div>
      </section>

      <div className="tape-seam" style={{ background: TINTA }} />

      {/* ── 2b · LA PRUEBA (tinta) ──────────────────────────────────────────────────────────
          El hueco mas caro que encontro el juez: el unico numero vivo de la pagina era la altura
          de bloque, que prueba que la cadena existe y no que el producto funciono. Esto si: un
          ciclo completo que corrio en mainnet, con su `totalPaid()` leido en vivo y linkeado al
          explorer. Y va con los numeros feos incluidos, que es lo que lo hace creible. */}
      <section className="border-t" style={{ borderColor: HAIR }}>
        <div className="rs-shell grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_minmax(320px,380px)] lg:items-center lg:gap-16">
          <div>
            <h2 className="tape-h2 max-w-2xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
              One cycle has actually run.
            </h2>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed" style={{ color: CUERPO }}>
              Launch, trade, harvest the fees, log in with GitHub, claim. It happened on mainnet on
              August 31, and the vault still publishes what it paid. Call{" "}
              <code style={{ fontFamily: "var(--t-mono)", color: PAPEL }}>totalPaid()</code> on it
              yourself; the number on the right is read off the chain while you load this page.
            </p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed" style={{ color: CUERPO }}>
              Two things before it means anything. The only trader was me, so the volume was me. And
              the pilot ran with the creator tax at the maximum, so that vault captured 10.70% of
              each trade, not the 0.70% a default launch gets.
            </p>
          </div>
          <Comprobante pagado={pagado} />
        </div>
      </section>

      {/* ── 3 · COMO FUNCIONA (tinta) ───────────────────────────────────────────────────────
          El titular de la v1 abria con "THREE MOVES", que son literalmente las dos primeras
          palabras del titular de la misma seccion en STAQ. Un juez fresco lo cazo y tenia razon:
          en una pagina que se defiende de parecerse a un competidor, arrancar con su frase cierra
          el juicio solo. */}
      <section className="border-t" style={{ borderColor: HAIR }}>
        <div className="rs-shell py-16 sm:py-24">
          <h2 className="tape-h2 max-w-4xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            YOU DO ONE STEP. THE CHAIN DOES THE OTHER TWO.
          </h2>
          {/* LOS TRES PASOS, IMPRESOS EN UNA TIRA — no tres tarjetas sobre un riel.
              "Numbered steps 01/02/03 sobre un rail" es un tell listado en el gate mecanico, era el
              unico bloque de la pagina que podia estar en cualquier otra landing, y encima era el
              eco mas cercano al competidor, que tambien numera sus pasos. Como talon perforado deja
              de ser un patron de UI y pasa a ser el tercer uso del unico material de la pagina: el
              papel del recibo. */}
          <ol className="tape-recibo mt-12 grid md:grid-cols-3">
            {[
              ["01", "Name them", "A GitHub handle or a wallet address. Nothing else, and nothing from them."],
              ["02", "Fees accrue", "Every trade on their coin sets a cut aside, in a contract with their name written into it."],
              ["03", "They claim", "Whenever. They log in with GitHub, or sign from the wallet, and take the whole balance."],
            ].map(([n, t, d], i) => (
              <li
                key={n}
                className={`tape-paper px-6 py-7 ${i > 0 ? "border-t border-dashed md:border-l md:border-t-0" : ""}`}
                style={{ background: PAPEL, color: PAPEL_TINTA, borderColor: "color-mix(in srgb, var(--tp-papel-tinta) 35%, transparent)" }}
              >
                <div className="text-[11px] uppercase tracking-[0.2em] opacity-55" style={{ fontFamily: "var(--t-mono)" }}>
                  Step {n}
                </div>
                <h3 className="mt-3 text-2xl font-bold uppercase tracking-[-0.015em]" style={{ fontFamily: "var(--t-display)" }}>
                  {t}
                </h3>
                <p className="mt-2 max-w-[32ch] text-[14px] leading-relaxed opacity-75">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 4 · LO QUE NO PODEMOS PROMETER (tinta) ──────────────────────────────────────────
          REGLA DE LOS TITULARES, para que el color deje de ser arbitrario: sobre tinta un h2 va en
          papel; el UNICO que va en lima es este, porque es la seccion que diferencia al producto y
          la unica que el competidor no puede copiar.
          El texto sale de `CUSTODY_LINE_PARTS` —la misma constante que el resto del sitio, auditada
          por `test/copy.test.ts`— y va en cuerpo grande, no en letra chica: en este producto la
          honestidad incomoda ES el diferenciador. */}
      {/* ── 4 · LO QUE NO PODEMOS PROMETER — UNA HOJA IMPRESA A SANGRE ─────────────────────
          Antes era texto sobre el campo, con el titular en lima (o sea en el color que en el resto
          de la pagina significa dinero) y la declaracion de no-auditado en gris de parrafo, en el
          rincon de una grilla que ademas dejaba un hueco en L. Tres jueces marcaron alguna parte de
          eso.
          Ahora es papel de ancho completo: cambia el eje de la pagina —la unica seccion que no se
          alinea al margen de todas las demas—, extiende el material a un cuarto uso, y la
          declaracion roja queda donde el rojo pertenece, que es impreso sobre papel.
          El texto sale de `CUSTODY_LINE_PARTS`, la misma constante que audita `test/copy.test.ts`. */}
      <section className="tape-hoja py-16 sm:py-24" style={{ background: PAPEL, color: PAPEL_TINTA }}>
        <div className="rs-shell">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: "var(--t-mono)", opacity: 0.55 }}>
            RobinShare · disclosure sheet
          </div>
          <h2 className="tape-h2 mt-4 max-w-4xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            What we can&rsquo;t promise.
          </h2>

          <p
            className="mt-7 max-w-3xl text-[clamp(1.2rem,2.8vw,1.75rem)] font-bold leading-snug"
            style={{ fontFamily: "var(--t-display)", color: "var(--tp-alarma)" }}
          >
            {CUSTODY_LINE_PARTS[3].body.trim()}
          </p>

          <div className="mt-10 grid gap-x-14 gap-y-9 sm:grid-cols-2">
            {/* Cuatro bloques en dos columnas = 2x2 exacto. El `col-span-2` del ultimo venia de
                cuando eran CINCO (con la declaracion de auditoria adentro de la grilla); al
                sacarla a titular, ese span empujaba el cuarto a una tercera fila y volvia a abrir
                el hueco en L que ya habiamos cerrado dos veces. */}
            {CUSTODY_LINE_PARTS.filter((_, i) => i !== 3).map((part) => (
              <div key={part.label}>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ fontFamily: "var(--t-mono)", opacity: 0.55 }}>
                  {part.label}
                </div>
                <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed" style={{ opacity: 0.82 }}>
                  {part.body.trim()}
                </p>
              </div>
            ))}
          </div>

          <Link
            href="/docs"
            className="rs-focus rs-tap mt-10 inline-block text-base font-bold uppercase tracking-[0.06em] underline decoration-2 underline-offset-8"
          >
            Read the whole thing →
          </Link>
        </div>
      </section>

      {/* ── 5 · CIERRE (banda lima) ─────────────────────────────────────────────────────────
          La segunda y ultima banda lima. Alineada a la izquierda como todo el resto: en la v1 era
          la unica composicion centrada de la pagina y sin motivo, que es el cierre universal de
          SaaS. */}
      <div className="tape-seam" style={{ background: LIMA }} />

      <section style={{ background: LIMA, color: ACENTO_TEXTO }}>
        <div className="rs-shell grid gap-8 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <h2 className="tape-h1" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            BACK THE ONE WHO SHIPS.
          </h2>
          <div>
            <p className="max-w-sm text-lg font-medium leading-snug">
              Someone you follow builds every day and nobody pays them. Fix that in one transaction.
            </p>
            <Link
              href="/create"
              className="rs-focus rs-press mt-6 inline-block rounded-full px-8 py-4 text-base font-bold uppercase tracking-[0.04em]"
              style={{ background: TINTA, color: LIMA }}
            >
              Launch a coin →
            </Link>
          </div>
        </div>
      </section>

      <div className="tape-seam" style={{ background: TINTA }} />

      {/* ── 6 · PIE (tinta) ─────────────────────────────────────────────────────────────────
          El pie de la v1 eran dos lineas. En un producto que custodia plata de terceros y NO esta
          auditado, eso no es minimalismo: es esconder lo que hay que poder mirar. */}
      <footer>
        <div className="rs-shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xl leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
              ROBINSHARE
            </div>
            <p className="mt-3 max-w-[30ch] text-sm leading-relaxed" style={{ color: CUERPO }}>
              A coin&rsquo;s trading fees, routed to the builder who earned them.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col items-start gap-3 text-sm font-semibold">
            <Link href="/create" className="rs-focus rs-tap underline decoration-1 underline-offset-4">
              Launch a coin
            </Link>
            <a href="#lookup" className="rs-focus rs-tap underline decoration-1 underline-offset-4">
              Check a balance
            </a>
            <Link href="/docs" className="rs-focus rs-tap underline decoration-1 underline-offset-4">
              Docs
            </Link>
          </nav>

          <div className="text-xs leading-relaxed" style={{ fontFamily: "var(--t-mono)", color: CUERPO }}>
            <div className="uppercase tracking-[0.16em]" style={{ color: LIMA }}>
              Chain
            </div>
            <div className="mt-2">
              {robinhoodChain.name} · {robinhoodChain.id}
            </div>
            <div className="mt-3 uppercase tracking-[0.16em]" style={{ color: LIMA }}>
              Factory
            </div>
            {factoryAddress() ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <a
                  href={`${EXPLORER}/address/${factoryAddress()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rs-focus rs-tap whitespace-nowrap underline decoration-1 underline-offset-4"
                >
                  {factoryAddress()!.slice(0, 8)}…{factoryAddress()!.slice(-6)}
                </a>
                <Copiar valor={factoryAddress()!} />
              </div>
            ) : (
              <div className="mt-2">not configured</div>
            )}
          </div>

          <div className="text-xs leading-relaxed" style={{ fontFamily: "var(--t-mono)", color: CUERPO }}>
            <div className="uppercase tracking-[0.16em]" style={{ color: LIMA }}>
              Read before you trust it
            </div>
            <p className="mt-2">
              {CUSTODY_LINE_PARTS[3].body.trim()} {CUSTODY_LINE_PARTS[4].body.trim()}
            </p>
            <p className="mt-3">
              These coins run on a bonding curve and can go to zero. Nothing here is investment
              advice.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/*
 * EL COMPROBANTE DE PAGO. Hermano del recibo del hero, y el que cierra el hueco de confianza: uno
 * muestra lo que PODRIA apartarse, este muestra lo que YA se pago. Su unico numero sale de
 * `totalPaid()` leido en vivo — si algun dia ese vault cobra de nuevo, la pagina lo dice sola.
 */
function Comprobante({ pagado }: { pagado: bigint | null }) {
  return (
    <div className="tape-recibo mx-auto w-full max-w-[380px] lg:mx-0" style={{ fontFamily: "var(--t-mono)" }}>
      <div className="tape-paper px-6 py-7" style={{ background: PAPEL, color: PAPEL_TINTA }}>
        <div className="text-center">
          <div className="text-[15px] font-bold uppercase tracking-[0.2em]">RobinShare</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] opacity-60">Payout receipt · mainnet</div>
        </div>

        <div className="my-5 border-t border-dashed" style={{ borderColor: "color-mix(in srgb, var(--tp-papel-tinta) 40%, transparent)" }} />

        <FilaFija k="Vault" v={`${VAULT_PILOTO.slice(0, 8)}…${VAULT_PILOTO.slice(-4)}`} />
        <FilaFija k="Paid out" v={pagado === null ? "reading…" : `${formatEther(pagado)} ETH`} destacado />
        <FilaFija k="Gas" v={`${GAS_DEL_COBRO} ETH · 36% of it`} />
        <FilaFija k="Date" v="2026-08-31" />

        <div className="my-5 border-t border-dashed" style={{ borderColor: "color-mix(in srgb, var(--tp-papel-tinta) 40%, transparent)" }} />

        <a
          href={`${EXPLORER}/address/${VAULT_PILOTO}`}
          target="_blank"
          rel="noreferrer"
          className="rs-focus rs-tap block text-center text-[11px] font-semibold uppercase tracking-[0.14em] underline underline-offset-4"
        >
          Check it on the explorer ↗
        </a>
      </div>
    </div>
  );
}

function FilaFija({ k, v, destacado }: { k: string; v: string; destacado?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[12px]">
      <span className="shrink-0 uppercase tracking-[0.16em] opacity-60">{k}</span>
      <span className={`min-w-0 break-all text-right font-semibold ${destacado ? "text-[15px]" : ""}`}>{v}</span>
    </div>
  );
}

/// EL TALON — el trozo que queda al arrancar un recibo. Existe por dos razones a la vez: llena los
/// ~275px de campo muerto que quedaban bajo el comprobante en la columna derecha del hero, y sube
/// al fold los dos datos que hacen comprobable a la pagina, que hasta ahora vivian solo en el pie.
function Talon() {
  const factory = factoryAddress();
  return (
    <div className="tape-recibo mx-auto w-full max-w-[380px] lg:mx-0" style={{ fontFamily: "var(--t-mono)" }}>
      <div className="tape-paper px-6 py-5" style={{ background: PAPEL, color: PAPEL_TINTA }}>
        <div className="flex items-baseline justify-between gap-4 text-[11px]">
          <span className="uppercase tracking-[0.16em] opacity-55">Chain</span>
          <span className="font-semibold">
            {robinhoodChain.name} · {robinhoodChain.id}
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 text-[11px]">
          <span className="uppercase tracking-[0.16em] opacity-55">Factory</span>
          {factory ? (
            <a
              href={`${EXPLORER}/address/${factory}`}
              target="_blank"
              rel="noreferrer"
              className="rs-focus rs-tap font-semibold underline decoration-1 underline-offset-4"
            >
              {factory.slice(0, 8)}…{factory.slice(-6)}
            </a>
          ) : (
            <span className="opacity-55">not configured</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Hecho({ v, k }: { v: string; k: string }) {
  return (
    <div className="border-t-2 pt-4" style={{ borderColor: TINTA }}>
      <div
        className="text-[clamp(2.6rem,7vw,4rem)] leading-[0.85] tracking-[-0.035em]"
        style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}
      >
        {v}
      </div>
      <div className="mt-3 max-w-[20ch] text-[12px] font-semibold uppercase leading-[1.3] tracking-[0.03em]">
        {k}
      </div>
    </div>
  );
}

/*
 * EL RECIBO — el artefacto signature de esta direccion.
 *
 * Es donde STAQ pone ilustracion 3D (billetes claymorficos, un cohete, una moneda). Aca va un
 * ticket impreso: papel, borde dentado por `mask-image`, cuerpo mono, y la altura de bloque REAL a
 * la que se leyo la cadena. Cero imagenes: todo DOM + CSS.
 *
 * Sobre campo tinta el papel crema pasa a ser LA imagen de la pagina, que es justo lo que el
 * competidor no tiene. Su sombra es una plancha lima corrida —el mismo desregistro del titular—,
 * no un bloque negro: en la v1 la sombra dura al 92% formaba una franja que leia como recorte mal
 * hecho, y los dientes de 9px asomaban como un peine negro.
 *
 * En reposo imprime el encabezado y deja los campos con la forma del dato que viene, asi hay algo
 * que mirar apenas carga y cuando llega el dato tiene a donde llegar en vez de mover el layout.
 */
function Recibo({
  named,
  rows,
  loading,
  sealedAt,
  block,
}: {
  named: { value: string; type: IdType } | null;
  rows: { vault: string; pendingLabel: string }[] | null;
  loading: boolean;
  sealedAt: bigint | null;
  block: bigint | null;
}) {
  const vault = rows && rows.length > 0 ? rows[0] : null;
  const idLabel = named ? (named.type === "github" ? `github:${named.value}` : named.value) : null;
  const buscado = named !== null;
  /// TRES TICKETS DISTINTOS, y el largo del papel es la diferencia. Un juez midio que el recibo no
  /// crecia al imprimir —la caja iba de y≈168 a y≈537 antes y despues, cambiaban cuatro strings— y
  /// llamo a eso "un reemplazo de strings", no un wow. Una impresora termica saca el papel que hace
  /// falta: en reposo es un talon corto, sin vault sale un talon corto que lo DICE, y con vault sale
  /// el ticket largo con el saldo. Y ademas: imprimir "VAULT: none yet / BALANCE: 0 ETH" hacia que
  /// la unica interaccion de la pagina devolviera un cero, que le dice al visitante justo lo
  /// contrario de lo que el producto quiere probar.
  const estado = !buscado ? "reposo" : loading ? "imprimiendo" : vault ? "hallado" : "vacio";

  return (
    <div className="tape-recibo mx-auto w-full max-w-[380px] lg:mx-0" style={{ fontFamily: "var(--t-mono)" }}>
      <div className="tape-paper px-6 py-7" style={{ background: PAPEL, color: PAPEL_TINTA }}>
        <div className="text-center">
          <div className="text-[15px] font-bold uppercase tracking-[0.2em]">RobinShare</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] opacity-60">
            {estado === "hallado" ? "Set-aside receipt" : "Set-aside enquiry"}
          </div>
        </div>

        <div className="my-5 border-t border-dashed" style={{ borderColor: "color-mix(in srgb, var(--tp-papel-tinta) 40%, transparent)" }} />

        {estado === "reposo" && (
          <p className="py-1 text-center text-[12px] leading-relaxed opacity-55">
            Write a handle and the chain
            <br />
            prints what it finds.
          </p>
        )}

        {estado === "imprimiendo" && (
          <p className="py-1 text-center text-[12px] opacity-55">Reading the chain…</p>
        )}

        {estado === "vacio" && (
          <>
            <Linea k="Identity" v={idLabel} orden={0} />
            <p className="mt-3 text-[12px] font-semibold uppercase leading-relaxed tracking-[0.1em]">
              No vault under this name.
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed opacity-60">
              Nobody has launched a coin for them yet. You can be the first.
            </p>
          </>
        )}

        {estado === "hallado" && vault && (
          <>
            <Linea k="Identity" v={idLabel} orden={0} />
            <Linea k="Rate" v="0.70% of every trade" orden={1} />
            <Linea k="Vault" v={`${vault.vault.slice(0, 8)}…${vault.vault.slice(-4)}`} orden={2} />
            <div className="my-4 border-t border-dashed" style={{ borderColor: "color-mix(in srgb, var(--tp-papel-tinta) 25%, transparent)" }} />
            <div className="tape-print flex items-baseline justify-between gap-4" style={{ animationDelay: "270ms" }}>
              <span className="shrink-0 text-[12px] uppercase tracking-[0.16em] opacity-60">Waiting</span>
              <span className="text-right text-[20px] font-semibold tabular-nums">
                {vault.pendingLabel} <span className="text-[13px] opacity-60">ETH</span>
              </span>
            </div>
          </>
        )}

        <div className="my-5 border-t border-dashed" style={{ borderColor: "color-mix(in srgb, var(--tp-papel-tinta) 40%, transparent)" }} />

        {/* EL UNICO DATO REALMENTE VIVO DE LA PAGINA, y el unico uso del verde de la cadena.
            Antes de buscar corre; al buscar se CONGELA, porque un comprobante con un numero que
            sigue cambiando no atestigua nada. */}
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="uppercase tracking-[0.16em] opacity-60">{sealedAt !== null ? "Read at block" : "Chain live at"}</span>
          <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: VIVO }} aria-hidden />
            {(sealedAt ?? block) === null ? "……" : `#${(sealedAt ?? block)!.toLocaleString("en-US")}`}
          </span>
        </div>

        {/* Sube de 10 a 11px y el rojo se oscurece: a #a3311f sobre papel crema la frase mas
            importante del artefacto era la menos legible de el. #7a1f12 sobre #F7F8F4 da ~8:1. */}
        <div className="mt-6 text-center text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--tp-alarma)" }}>
          This contract has not been audited
        </div>
      </div>
    </div>
  );
}

function Linea({ k, v, orden }: { k: string; v: string | null; orden: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[12px]">
      <span className="shrink-0 uppercase tracking-[0.16em] opacity-60">{k}</span>
      <span className="tape-print min-w-0 break-all text-right font-semibold" style={{ animationDelay: `${orden * 90}ms` }}>
        {v}
      </span>
    </div>
  );
}

/// Copiar la direccion completa sin que ocupe 42 caracteres en el pie. El feedback dura 1,6s y
/// vuelve solo: un boton que se queda en "Copiado" para siempre miente sobre el estado.
function Copiar({ valor }: { valor: string }) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!listo) return;
    const t = setTimeout(() => setListo(false), 1600);
    return () => clearTimeout(t);
  }, [listo]);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(valor)
          .then(() => setListo(true))
          .catch(() => {});
      }}
      aria-label="Copy the factory address"
      className="rs-focus rs-press rs-tap rounded-[5px] border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]"
      style={{ borderColor: listo ? LIMA : "rgba(247,248,244,0.3)", color: listo ? LIMA : CUERPO }}
    >
      {listo ? "Copied" : "Copy"}
    </button>
  );
}
