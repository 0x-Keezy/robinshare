"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gabarito, Archivo, IBM_Plex_Mono } from "next/font/google";
import { useVaultLookup, type IdType } from "@/lib/useVaultLookup";
import { publicClient, robinhoodChain, factoryAddress } from "@/lib/chain";
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

const TINTA = "#0D120E";
const PAPEL = "#F7F8F4";
const LIMA = "#CCFF00";
/// Verde de la cadena. Lockeado: SOLO dato en vivo (la altura de bloque). Nunca decorativo.
const VIVO = "#00C805";
/// Cuerpo sobre tinta. Token propio y no un gris por defecto: un juez marco que la superficie mas
/// grande de la pagina era la menos decidida.
const CUERPO = "rgba(247,248,244,0.74)";
const HAIR = "rgba(247,248,244,0.18)";
const EXPLORER = robinhoodChain.blockExplorers.default.url;

export function TapeHome() {
  const { type, setType, value, setValue, rows, error, loading, lookup } = useVaultLookup();

  /// Lo que se busco DE VERDAD, que no es `value` (eso cambia con cada tecla). El recibo se imprime
  /// con esto: si se imprimiera con `value`, el ticket se escribiria solo letra por letra mientras
  /// alguien tipea, que es lo contrario de un comprobante.
  const [named, setNamed] = useState<{ value: string; type: IdType } | null>(null);
  /// La altura a la que se leyo la cadena, CONGELADA al disparar. Un recibo con un numero que sigue
  /// corriendo no atestigua nada.
  const [sealedAt, setSealedAt] = useState<bigint | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);

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
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      style={{ background: TINTA, color: PAPEL, fontFamily: "var(--t-body)" }}
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
              style={{ background: LIMA, color: TINTA }}
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
      <section className="rs-shell grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.02fr_minmax(330px,0.98fr)] lg:items-start lg:gap-16">
        <div>
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

          {/* LA HERRAMIENTA, EN EL FOLD. */}
          <div className="mt-8">
            <div id="lookup" role="group" aria-label="Identity type" className="flex scroll-mt-6 gap-2">
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
                        ? { background: PAPEL, color: TINTA, borderColor: PAPEL }
                        : { background: "transparent", color: CUERPO, borderColor: "rgba(247,248,244,0.3)" }
                    }
                  >
                    {t === "github" ? "GitHub" : "Wallet"}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
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
                className="rs-focus w-full rounded-xl border px-5 py-4 text-base font-medium placeholder:opacity-45 focus:outline-none"
                style={{ borderColor: "rgba(247,248,244,0.3)", background: "rgba(247,248,244,0.05)", color: PAPEL, fontFamily: "var(--t-mono)" }}
              />
              {/* EL PRIMARIO NO PUEDE VESTIRSE DE ROTO EN REPOSO. El estado que ve TODO visitante al
                  llegar es "campo vacio": ahi va tinta plena sobre el borde de papel (lee
                  accionable, que es la verdad: hay que escribir algo) y solo la carga se apaga. */}
              <button
                onClick={run}
                disabled={loading || !value}
                className="rs-focus rs-press shrink-0 rounded-xl border px-8 py-4 text-base font-bold uppercase tracking-[0.04em]"
                style={
                  loading
                    ? { background: "transparent", borderColor: "rgba(247,248,244,0.3)", color: CUERPO }
                    : !value
                      ? { background: "transparent", borderColor: PAPEL, color: PAPEL }
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
                    style={{ borderColor: "rgba(247,248,244,0.3)" }}
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
                      style={{ background: LIMA, color: TINTA }}
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href="/create"
              className="rs-focus rs-tap mt-5 inline-block text-[13px] font-bold uppercase tracking-[0.08em] underline decoration-2 underline-offset-[6px]"
              style={{ color: CUERPO }}
            >
              Or launch one for someone →
            </Link>
          </div>
        </div>

        <Recibo named={named} rows={rows} loading={loading} sealedAt={sealedAt} block={block} />
      </section>

      {/* ── 2 · LOS CUATRO HECHOS (banda lima) ──────────────────────────────────────────────
          Datos, no eslóganes, y es una de las DOS bandas lima de toda la pagina: el acento pega
          porque es escaso. Cada celda lleva su regla arriba, si no las cifras cortas ("2", "0")
          nadan en su columna mientras "0.70%" la llena. */}
      <section style={{ background: LIMA, color: TINTA }}>
        <div className="rs-shell grid grid-cols-2 gap-x-8 gap-y-9 py-12 sm:py-14 lg:grid-cols-4">
          <Hecho v="0.70%" k="Of every trade, to them" />
          <Hecho v="100%" k="Of the vault pays out" />
          <Hecho v="2" k="Ways to prove it is you" />
          <Hecho v="0" k="Of it passes through us" />
        </div>
      </section>

      {/* ── 3 · COMO FUNCIONA (tinta) ───────────────────────────────────────────────────────
          El titular de la v1 abria con "THREE MOVES", que son literalmente las dos primeras
          palabras del titular de la misma seccion en STAQ. Un juez fresco lo cazo y tenia razon:
          en una pagina que se defiende de parecerse a un competidor, arrancar con su frase cierra
          el juicio solo. */}
      <section>
        <div className="rs-shell py-16 sm:py-24">
          <h2 className="tape-h2 max-w-4xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            YOU DO ONE STEP. THE CHAIN DOES THE OTHER TWO.
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              ["01", "Name them", "A GitHub handle or a wallet address. Nothing else, and nothing from them."],
              ["02", "Fees accrue", "Every trade on their coin sets a cut aside, in a contract with their name written into it."],
              ["03", "They claim", "Whenever. They log in with GitHub, or sign from the wallet, and take the whole balance."],
            ].map(([n, t, d]) => (
              <li key={n} className="border-t-2 pt-5" style={{ borderColor: LIMA }}>
                <div
                  className="text-[clamp(3rem,7vw,4.4rem)] leading-[0.8]"
                  style={{ fontFamily: "var(--t-display)", fontWeight: 900, color: LIMA }}
                >
                  {n}
                </div>
                <h3 className="mt-4 text-xl font-bold uppercase tracking-[-0.01em]" style={{ fontFamily: "var(--t-display)" }}>
                  {t}
                </h3>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed" style={{ color: CUERPO }}>
                  {d}
                </p>
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
      <section className="border-t" style={{ borderColor: HAIR }}>
        <div className="rs-shell py-16 sm:py-24">
          <h2 className="tape-h2 max-w-4xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900, color: LIMA }}>
            WHAT WE CAN&rsquo;T PROMISE.
          </h2>
          {/* Cinco bloques en dos columnas dejaban un hueco en L abajo a la derecha: el mismo
              defecto de grilla que ya habiamos arreglado en el pie de `legend` (seis datos en
              cuatro columnas). El ultimo ocupa las dos y la grilla cierra. */}
          <div className="mt-10 grid gap-x-14 gap-y-9 sm:grid-cols-2">
            {CUSTODY_LINE_PARTS.map((part, i) => (
              <div key={part.label} className={i === CUSTODY_LINE_PARTS.length - 1 ? "sm:col-span-2" : undefined}>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--t-mono)", color: LIMA }}>
                  {part.label}
                </div>
                <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed" style={{ color: CUERPO }}>
                  {part.body.trim()}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/docs"
            className="rs-focus rs-tap mt-10 inline-block text-base font-bold uppercase tracking-[0.06em] underline decoration-2 underline-offset-8"
            style={{ color: LIMA }}
          >
            Read the whole thing →
          </Link>
        </div>
      </section>

      {/* ── 5 · CIERRE (banda lima) ─────────────────────────────────────────────────────────
          La segunda y ultima banda lima. Alineada a la izquierda como todo el resto: en la v1 era
          la unica composicion centrada de la pagina y sin motivo, que es el cierre universal de
          SaaS. */}
      <section style={{ background: LIMA, color: TINTA }}>
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
              <a
                href={`${EXPLORER}/address/${factoryAddress()}`}
                target="_blank"
                rel="noreferrer"
                className="rs-focus rs-tap mt-2 block break-all underline decoration-1 underline-offset-4"
              >
                {factoryAddress()}
              </a>
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

function Hecho({ v, k }: { v: string; k: string }) {
  return (
    <div className="border-t-2 pt-4" style={{ borderColor: TINTA }}>
      <div
        className="text-[clamp(2.6rem,7vw,4rem)] leading-[0.85] tracking-[-0.035em]"
        style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}
      >
        {v}
      </div>
      <div className="mt-3 max-w-[18ch] text-[11px] font-semibold uppercase leading-[1.35] tracking-[0.12em]" style={{ fontFamily: "var(--t-mono)" }}>
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
  const impreso = named !== null;

  return (
    <div className="tape-recibo mx-auto w-full max-w-[380px] lg:mx-0 lg:mt-10" style={{ fontFamily: "var(--t-mono)" }}>
      <div className="tape-paper px-6 py-7" style={{ background: PAPEL, color: TINTA }}>
        <div className="text-center">
          <div className="text-[15px] font-bold uppercase tracking-[0.2em]">RobinShare</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] opacity-60">Set-aside receipt</div>
        </div>

        <div className="my-5 border-t border-dashed" style={{ borderColor: "rgba(13,18,14,0.4)" }} />

        <Linea k="Identity" v={idLabel} pendiente="write a handle" imprimiendo={loading} orden={0} />
        <Linea k="Rate" v={impreso ? "0.70% of every trade" : null} pendiente="—" imprimiendo={loading} orden={1} />
        <Linea
          k="Vault"
          v={vault ? `${vault.vault.slice(0, 8)}…${vault.vault.slice(-4)}` : impreso && !loading ? "none yet" : null}
          pendiente="—"
          imprimiendo={loading}
          orden={2}
        />
        <Linea k="Balance" v={vault ? `${vault.pendingLabel} ETH` : impreso && !loading ? "0 ETH" : null} pendiente="—" imprimiendo={loading} orden={3} />

        <div className="my-5 border-t border-dashed" style={{ borderColor: "rgba(13,18,14,0.4)" }} />

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

        <div className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#a3311f" }}>
          This contract has not been audited
        </div>
      </div>
    </div>
  );
}

function Linea({
  k,
  v,
  pendiente,
  imprimiendo,
  orden,
}: {
  k: string;
  v: string | null;
  pendiente: string;
  imprimiendo: boolean;
  orden: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[12px]">
      <span className="shrink-0 uppercase tracking-[0.16em] opacity-60">{k}</span>
      <span
        className={`min-w-0 break-all text-right font-semibold ${v ? "tape-print" : ""}`}
        style={v ? { animationDelay: `${orden * 90}ms` } : { opacity: 0.3 }}
      >
        {v ?? (imprimiendo ? "…" : pendiente)}
      </span>
    </div>
  );
}
