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
 * como un clon suyo. Se toma su REGISTRO (campo de color plano, display gorda, mayusculas,
 * contundencia) y se separa en los seis ejes que dan identidad; el cuadro esta en el brief.
 *
 * LA DIFERENCIA QUE MAS IMPORTA es el artefacto: donde STAQ pone stickers 3D claymorficos (billetes,
 * cohete, moneda) va EL RECIBO — un ticket impreso, dentado, en mono, con la identidad que escribiste
 * y la altura de bloque real. Es 100% DOM+CSS, es lo que el producto hace, y no se puede pegar en
 * otro sitio. Cero imagenes en toda la pagina.
 *
 * `legend` sigue siendo la direccion de produccion. Esta vive en /v/tape hasta que se juzgue.
 */

// Gabarito 900: gorda y geometrica, con autoridad. BAN explicito de Bagel Fat One (la display de
// STAQ, de registro burbuja) y de Bricolage Grotesque (su cuerpo). Archivo e IBM Plex Mono ya
// estaban en el proyecto: de tres caras se reusan dos y cambia la que da la personalidad.
const display = Gabarito({ subsets: ["latin"], weight: ["800", "900"], variable: "--t-display" });
const body = Archivo({ subsets: ["latin"], variable: "--t-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--t-mono" });

const LIMA = "#CCFF00";
const TINTA = "#0D120E";
const PAPEL = "#F7F8F4";
/// Verde de la cadena. Lockeado: SOLO dato en vivo (la altura de bloque). Nunca decorativo.
const VIVO = "#00C805";
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
      style={{ background: LIMA, color: TINTA, fontFamily: "var(--t-body)" }}
    >
      {/* ── NAV ─────────────────────────────────────────────────────────────────────────────
          Barra tratada, no una fila default: regla de tinta abajo y el CTA como pastilla negra.
          No es `fixed` a proposito — en un afiche la barra es parte de la hoja, no una capa que
          flota encima, y ademas evita de raiz el defecto que ya cazamos en `legend` (un scrim que
          se desvanece adentro del nav deja el contenido leyendose a traves). */}
      <nav className="border-b-2" style={{ borderColor: TINTA }}>
        <div className="rs-shell flex items-center justify-between py-3.5">
          <Link href="/" className="rs-focus rs-tap text-2xl leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            ROBINSHARE
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/docs" className="rs-focus rs-tap hidden text-sm font-semibold uppercase tracking-[0.06em] sm:block">
              Docs
            </Link>
            <a href="#lookup" className="rs-focus rs-tap hidden text-sm font-semibold uppercase tracking-[0.06em] md:block">
              Check a balance
            </a>
            <Link
              href="/create"
              className="rs-focus rs-press rounded-full px-5 py-3 text-sm font-bold uppercase tracking-[0.06em] sm:py-2.5"
              style={{ background: TINTA, color: LIMA }}
            >
              Launch
            </Link>
          </div>
        </div>
      </nav>

      {/* ── 1 · HERO (campo lima) ───────────────────────────────────────────────────────────── */}
      <section className="rs-shell grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_minmax(320px,0.95fr)] lg:items-center">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] sm:text-xs" style={{ fontFamily: "var(--t-mono)" }}>
            Social fee escrow · Robinhood Chain
          </div>

          {/* EL TITULAR, CON DESREGISTRO DE IMPRENTA. La segunda copia va 3px corrida y translucida:
              es el error de registro de una serigrafia, o sea el unico "efecto" de la pagina, y es
              del registro afiche — no un glow. `aria-hidden` para que no se lea dos veces. */}
          <h1 className="tape-h1 relative mt-5" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            <span aria-hidden className="tape-ghost absolute inset-0 select-none">
              LAUNCH A COIN IN SOMEONE ELSE&rsquo;S NAME
            </span>
            <span className="relative">LAUNCH A COIN IN SOMEONE ELSE&rsquo;S NAME</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg font-medium leading-snug sm:text-xl">
            Name a builder by their GitHub handle or a wallet. Their coin goes live on pons, paired
            against native ETH, and 0.70% of every trade piles up in a vault only they can open. They
            need no wallet, and no idea it happened.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="rs-focus rs-press rounded-full px-7 py-4 text-base font-bold uppercase tracking-[0.04em]"
              style={{ background: TINTA, color: LIMA }}
            >
              Launch a coin →
            </Link>
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="rs-focus rs-press rounded-full border-2 px-7 py-4 text-base font-bold uppercase tracking-[0.04em]"
              style={{ borderColor: TINTA, background: PAPEL, color: TINTA }}
            >
              I was funded
            </button>
          </div>
        </div>

        <Recibo named={named} rows={rows} loading={loading} sealedAt={sealedAt} block={block} />
      </section>

      {/* ── 2 · LOS CUATRO HECHOS (tinta) ───────────────────────────────────────────────────
          Datos, no eslóganes. En `legend` esto era una fila de stats; acá las cifras son del tamaño
          del titular porque en un afiche el numero ES la imagen. */}
      <section style={{ background: TINTA, color: PAPEL }}>
        <div className="rs-shell grid grid-cols-2 gap-x-8 gap-y-10 py-14 sm:py-18 lg:grid-cols-4">
          <Hecho v="0.70%" k="Of every trade, to them" />
          <Hecho v="100%" k="Of the vault pays out" />
          <Hecho v="2" k="Ways to prove it is you" />
          <Hecho v="0" k="Of it passes through us" />
        </div>
      </section>

      {/* ── 3 · TRES MOVIMIENTOS (tinta) ────────────────────────────────────────────────────── */}
      <section style={{ background: TINTA, color: PAPEL }} className="border-t-2" >
        <div className="rs-shell py-16 sm:py-24">
          <h2 className="tape-h2 max-w-3xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            THREE MOVES. ONLY THE FIRST ONE IS YOURS.
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              ["01", "Name them", "A GitHub handle or a wallet address. Nothing else, and nothing from them."],
              ["02", "Fees accrue", "Every trade on their coin sets a cut aside, in a contract with their name written into it."],
              ["03", "They claim", "Whenever. They log in with GitHub, or sign from the wallet, and take the whole balance."],
            ].map(([n, t, d]) => (
              <li key={n}>
                <div
                  className="text-[clamp(3.4rem,9vw,5.5rem)] leading-[0.8]"
                  style={{ fontFamily: "var(--t-display)", fontWeight: 900, color: LIMA }}
                >
                  {n}
                </div>
                <h3 className="mt-4 text-2xl font-bold" style={{ fontFamily: "var(--t-display)" }}>
                  {t}
                </h3>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed" style={{ color: "rgba(247,248,244,0.72)" }}>
                  {d}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 4 · EL BUSCADOR (lima) ──────────────────────────────────────────────────────────
          La herramienta real, y el wow: responde al INPUT del usuario, no a un autoplay. Escribis un
          handle, la cadena contesta y el recibo de arriba se imprime. */}
      <section id="lookup" className="scroll-mt-6 border-t-2" style={{ borderColor: TINTA }}>
        <div className="rs-shell py-16 sm:py-24">
          <h2 className="tape-h2 max-w-3xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            SOMEONE MAY HAVE LAUNCHED ONE FOR YOU.
          </h2>
          <p className="mt-4 max-w-lg text-lg font-medium">
            Type a handle and the chain answers. Nothing here is a mock-up — the block number is read
            live, and the vault is read from the contract.
          </p>

          <div className="mt-8 max-w-xl">
            <div role="group" aria-label="Identity type" className="flex gap-2">
              {(["github", "wallet"] as const).map((t) => {
                const on = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setType(t)}
                    className="rs-focus rs-press rs-tap rounded-full border-2 px-5 py-2.5 text-sm font-bold uppercase tracking-[0.06em]"
                    style={on ? { background: TINTA, color: LIMA, borderColor: TINTA } : { background: "transparent", color: TINTA, borderColor: TINTA }}
                  >
                    {t === "github" ? "GitHub" : "Wallet"}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
                className="rs-focus w-full rounded-2xl border-2 px-5 py-4 text-base font-medium placeholder:opacity-40 focus:outline-none"
                style={{ borderColor: TINTA, background: PAPEL, color: TINTA, fontFamily: "var(--t-mono)" }}
              />
              <button
                onClick={run}
                disabled={loading || !value}
                className="rs-focus rs-press shrink-0 rounded-2xl px-7 py-4 text-base font-bold uppercase tracking-[0.04em] disabled:opacity-45"
                style={{ background: TINTA, color: LIMA }}
              >
                {loading ? "Reading…" : "Check"}
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border-2 px-4 py-3 text-sm font-semibold" style={{ borderColor: "#c0392b", color: "#8c2a1f", background: PAPEL }} role="alert">
                The chain did not answer. {error}
              </p>
            )}

            {rows && rows.length === 0 && (
              <p className="mt-4 text-base font-semibold">
                Nothing set aside under that name yet.{" "}
                <Link href="/create" className="rs-focus underline decoration-2 underline-offset-4">
                  Launch one for them →
                </Link>
              </p>
            )}

            {rows && rows.length > 0 && (
              <ul className="mt-5 flex flex-col gap-3">
                {rows.map((r) => (
                  <li
                    key={r.vault}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4"
                    style={{ borderColor: TINTA, background: PAPEL }}
                  >
                    <div className="min-w-0">
                      <a
                        href={`${EXPLORER}/address/${r.vault}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rs-focus text-xs underline decoration-1 underline-offset-2"
                        style={{ fontFamily: "var(--t-mono)" }}
                      >
                        {r.vault.slice(0, 10)}…{r.vault.slice(-6)}
                      </a>
                      <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: "var(--t-mono)" }}>
                        {r.pendingLabel} <span className="text-sm font-medium opacity-60">ETH</span>
                      </div>
                    </div>
                    <Link
                      href={`/claim/${r.vault}`}
                      className="rs-focus rs-press rounded-full px-5 py-2.5 text-sm font-bold uppercase"
                      style={{ background: TINTA, color: LIMA }}
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ── 5 · LO QUE NO PODEMOS PROMETER (tinta) ──────────────────────────────────────────
          La letra chica, en cuerpo grande. En este producto la honestidad incomoda ES el
          diferenciador, no un disclaimer al pie — y el texto sale de `CUSTODY_LINE_PARTS`, la misma
          constante que el resto del sitio, asi que no puede desincronizarse. */}
      <section style={{ background: TINTA, color: PAPEL }}>
        <div className="rs-shell py-16 sm:py-24">
          <h2 className="tape-h2 max-w-4xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900, color: LIMA }}>
            WHAT WE CAN&rsquo;T PROMISE.
          </h2>
          <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {CUSTODY_LINE_PARTS.map((part) => (
              <div key={part.label}>
                <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ fontFamily: "var(--t-mono)", color: LIMA }}>
                  {part.label}
                </div>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "rgba(247,248,244,0.78)" }}>
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

      {/* ── 6 · CIERRE + PIE (lima) ─────────────────────────────────────────────────────────── */}
      <section className="border-t-2" style={{ borderColor: TINTA }}>
        <div className="rs-shell py-16 text-center sm:py-24">
          <h2 className="tape-h1 mx-auto max-w-4xl" style={{ fontFamily: "var(--t-display)", fontWeight: 900 }}>
            BACK THE ONE WHO SHIPS.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg font-medium">
            Someone you follow builds every day and nobody pays them. Fix that in one transaction.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/create"
              className="rs-focus rs-press rounded-full px-7 py-4 text-base font-bold uppercase tracking-[0.04em]"
              style={{ background: TINTA, color: LIMA }}
            >
              Launch a coin →
            </Link>
            <Link
              href="/docs"
              className="rs-focus rs-press rounded-full border-2 px-7 py-4 text-base font-bold uppercase tracking-[0.04em]"
              style={{ borderColor: TINTA, background: PAPEL, color: TINTA }}
            >
              Docs
            </Link>
          </div>

          <div className="mt-16 flex flex-col items-center gap-2 border-t-2 pt-8 text-xs" style={{ borderColor: TINTA, fontFamily: "var(--t-mono)" }}>
            <div className="font-semibold uppercase tracking-[0.16em]">
              {robinhoodChain.name} · {robinhoodChain.id}
            </div>
            {factoryAddress() && (
              <a
                href={`${EXPLORER}/address/${factoryAddress()}`}
                target="_blank"
                rel="noreferrer"
                className="rs-focus rs-tap break-all underline decoration-1 underline-offset-4"
              >
                {factoryAddress()}
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Hecho({ v, k }: { v: string; k: string }) {
  return (
    <div>
      <div
        className="text-[clamp(2.8rem,8vw,4.5rem)] leading-[0.85] tracking-[-0.03em]"
        style={{ fontFamily: "var(--t-display)", fontWeight: 900, color: LIMA }}
      >
        {v}
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ fontFamily: "var(--t-mono)", color: "rgba(247,248,244,0.65)" }}>
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
 * En reposo imprime el encabezado y deja los campos en blanco, con la forma del dato que viene —
 * asi hay algo que mirar apenas carga la pagina y cuando llega el dato tiene a donde llegar, en vez
 * de aparecer de la nada y mover el layout.
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
    <div className="tape-recibo mx-auto w-full max-w-[380px] lg:mx-0" style={{ fontFamily: "var(--t-mono)" }}>
      <div className="tape-paper px-6 py-7" style={{ background: PAPEL, color: TINTA }}>
        <div className="text-center">
          <div className="text-[15px] font-bold uppercase tracking-[0.2em]">RobinShare</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] opacity-60">Set-aside receipt</div>
        </div>

        <div className="my-5 border-t-2 border-dashed" style={{ borderColor: "rgba(13,18,14,0.35)" }} />

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

        <div className="my-5 border-t-2 border-dashed" style={{ borderColor: "rgba(13,18,14,0.35)" }} />

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

        <div className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8c2a1f" }}>
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
        style={v ? { animationDelay: `${orden * 90}ms` } : { opacity: 0.28 }}
      >
        {v ?? (imprimiendo ? "…" : pendiente)}
      </span>
    </div>
  );
}
