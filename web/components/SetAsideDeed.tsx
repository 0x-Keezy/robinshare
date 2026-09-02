"use client";

import Link from "next/link";
import { robinhoodChain } from "@/lib/chain";
import { DeedSeal } from "@/components/DeedSeal";
import type { IdType, VaultRow } from "@/lib/useVaultLookup";

/// EL ACTA — el mecanismo dicho en una oración que se completa.
///
/// POR QUÉ ESTO Y NO UN DIAGRAMA. Acá vivía `SetAsideBand`: la marca (una barra con una porción
/// cortada y sostenida fuera del eje) dibujada a 900px como diagrama del mecanismo. Jose la miró y
/// dijo, textual: **"No entiendo esta parte que quisiste mostrar."** Si el dueño del producto no la
/// lee, no funciona, y no hay nada que discutir.
///
/// La autopsia de un juez externo, que es la parte que vale para el próximo build:
///
///  1. **La imagen no tenía verbo.** El mecanismo es una TRANSFORMACIÓN (algo entero del que se
///     aparta un pedazo que queda a nombre de alguien) y yo dibujé el ESTADO FINAL de una
///     naturaleza muerta. El espectador nunca vio el entero, así que el hueco no podía leerse como
///     "acá se sacó algo": se leía como dos barras, o como un bug de render. Una geometría estática
///     puede mostrar una proporción; no puede mostrar procedencia ni titularidad.
///  2. **Se rompía la conservación de la materia.** La porción era blanca y la barra grafito:
///     materiales distintos leen como sustancias distintas, o sea dos objetos, no "lo mismo
///     movido".
///  3. **No había persona**, y el diferenciador del producto no es "se reparte un fee" (eso es
///     Splits, Drips, cualquier referral) sino que **el destinatario es un humano nombrado que no
///     lo pidió y puede probarlo**. Un rectángulo no puede ser una persona.
///  4. La regla de ticks de arriba era una **promesa de unidad** sin números, origen ni fin:
///     decoración disfrazada de medición, que en un vertical de confianza es peor que nada.
///
/// Y el board de referencia lo confirmó antes de escribir una línea: **nadie de la categoría dibuja
/// un diagrama abstracto del mecanismo.** Splits y Superfluid no lo dibujan (tipografía + nombres
/// reales); Drips —el prior art más cercano— dibuja **los destinatarios**, no el flujo; y el único
/// que dibuja props 3D (Sablier) es el que menos credibilidad transmite de los cuatro.
///
/// LO QUE HACE ESTA VERSIÓN. Deja de dibujar y empieza a escribir. No son etiquetas colgando de un
/// dibujo que tiene que cargar el sentido: es una **oración**, que carga el sentido ella misma, con
/// el layout dándole autoridad de documento. Y el único campo pesado es **la persona**, porque la
/// persona es el producto.
///
/// El campo se llena con lo que el visitante busca arriba: su propio input completa un instrumento
/// con aspecto legal, usando datos reales de la cadena. Ese wow no se puede trasplantar a ninguna
/// otra página, que es el test anti-molde.
///
/// HONESTIDAD. Sin dato inventado y sin disclaimer: en reposo los campos están **en blanco**, que
/// es autoevidentemente un blanco. No hay número de bloque decorativo con puntito verde (sería una
/// afirmación de liveness que no dice nada del mecanismo), y la única dirección que aparece es la
/// del vault REAL que devolvió la cadena, linkeada al explorer — o no aparece.
const EXPLORER = robinhoodChain.blockExplorers.default.url;

/// GitHub permite 39 caracteres y una address son 42: a cuerpo de titular, cualquiera de los dos
/// desborda un viewport de 390px. El campo baja un escalón de tamaño cuando se pone largo y se
/// trunca por el MEDIO cuando ya no hay escalón que alcance (nunca por el final: el final de una
/// address es lo que la gente compara).
function fieldText(raw: string): { shown: string; full: string; step: 0 | 1 | 2 } {
  const full = raw;
  if (raw.length <= 14) return { shown: raw, full, step: 0 };
  if (raw.length <= 22) return { shown: raw, full, step: 1 };
  return { shown: `${raw.slice(0, 10)}…${raw.slice(-6)}`, full, step: 2 };
}

export function SetAsideDeed({
  named,
  rows,
  loading,
  onFocusSearch,
  sealedAt,
}: {
  /// Lo que el visitante buscó de verdad (no lo que está tipeando).
  named: { value: string; type: IdType } | null;
  rows: VaultRow[] | null;
  loading: boolean;
  onFocusSearch: () => void;
  /// Altura de bloque CONGELADA en el instante en que se leyo la cadena. Congelada y no viva a
  /// proposito: un sello atestigua un momento, y un numero que sigue corriendo no atestigua nada.
  sealedAt: bigint | null;
}) {
  const label = named ? (named.type === "github" ? `@${named.value}` : named.value) : null;
  const field = label ? fieldText(label) : null;
  const vault = rows && rows.length > 0 ? rows[0] : null;
  const searchedButEmpty = named !== null && rows !== null && rows.length === 0;

  return (
    <div
      /* UNA HOJA, NO UNA CARD. La versión anterior era un rectángulo de radio 14 con un halo
         parejo alrededor — el tell que hace que un documento se lea "componente de UI". Un acta es
         una hoja: cantos casi rectos, hairline, y si levanta, sombra CORTA y con offset hacia
         abajo, teñida al sustrato. */
      className="relative rounded-[3px] px-6 py-9 sm:px-12 sm:py-12"
      style={{
        background: "var(--rs-surface)",
        borderTop: "1px solid var(--rs-edge-top)",
        borderBottom: "1px solid var(--rs-edge-bot)",
        borderLeft: "1px solid var(--rs-hair)",
        borderRight: "1px solid var(--rs-hair)",
        boxShadow: "var(--rs-sheet)",
      }}
    >
      {/* EL SELLO. Apoyado sobre el canto inferior derecho de la hoja y CRUZANDO la regla del pie,
          que es donde cae un sello de verdad: sobre el texto, no en una celda reservada al lado.
          `pointer-events-none` porque es evidencia, no un control. */}
      <div className="pointer-events-none absolute -bottom-3 right-3 sm:-bottom-5 sm:right-7" style={{ color: "var(--rs-ink)" }}>
        <DeedSeal atBlock={sealedAt} className="aspect-square w-[86px] sm:w-[134px]" />
      </div>

      {/* DOS VOCES en los smalls, no una. El título del instrumento va en la serif con versalitas
          —es el encabezado de un documento— y las condiciones en mono, que es la voz de los datos.
          Antes los cuatro smalls eran la misma mono caps tracked y el conjunto leía como textura
          repetida. */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <span
          style={{ fontFamily: "var(--f-display)", fontVariant: "small-caps", letterSpacing: "0.06em" }}
          className="text-[15px]"
        >
          Set-aside deed
        </span>
        <span
          className="text-[10px] uppercase sm:text-[11px]"
          style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.18em", color: "var(--rs-faint)" }}
        >
          Robinhood Chain · 4663
        </span>
      </div>

      {/* LA ORACIÓN. Los quiebres son manuales y caen SIEMPRE en el límite de una cláusula, nunca
          adentro del campo: partir un handle al medio, con medio subrayado en cada línea, es el
          peor fallo posible de este bloque. */}
      <p
        style={{ fontFamily: "var(--f-display)", lineHeight: 1.34, letterSpacing: "-0.014em" }}
        className="relative z-10 mt-8 text-[clamp(1.6rem,4.6vw,2.9rem)]"
      >
        <span className="block">A cut of every trade on their coin</span>
        <span className="block">
          is set aside for{" "}
          {field ? (
            <Field text={field} step={field.step} />
          ) : (
            <Blank onClick={onFocusSearch} loading={loading} />
          )}
          {/* la coma vive AFUERA del campo: adentro, el padding del subrayado la empujaba y dejaba
              un hueco visible entre el nombre y su coma. */}
          ,
        </span>
        <span className="block">and only they can claim it.</span>
      </p>

      <div
        className="mt-9 flex flex-col gap-2 border-t pt-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 pr-[96px] sm:pr-40"
        style={{ borderColor: "var(--rs-hair)" }}
      >
        <span
          className="text-[10px] uppercase sm:text-[11px]"
          style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.18em", color: "var(--rs-faint)" }}
        >
          {/* Antes decia "cannot be redirected", a secas y en versales, y el footer de la propia
              pagina admite dos excepciones (la ventana de recovery del lanzador y el multisig de
              pons). El claim mas ruidoso del sitio era el que su letra chica desmentia. Esto SI es
              cierto sin asterisco: RobinShare no puede reapuntarlo. */}
          Fixed at launch · we cannot redirect it
        </span>

        {/* A la derecha va SÓLO lo que es verdad y comprobable. Si la cadena devolvió un vault, su
            dirección real linkeada al explorer; si buscaron y no hay, se dice; y si no buscaron
            nada, no hay nada que afirmar y el slot queda vacío. */}
        {vault ? (
          <a
            href={`${EXPLORER}/address/${vault.vault}`}
            target="_blank"
            rel="noreferrer"
            className="rs-focus text-[10px] underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70 sm:text-[11px]"
            style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.18em", color: "var(--rs-dim)" }}
          >
            {/* SIN `uppercase`: se leia `VAULT 0XCED117…B8C2F3`, con el `0x` en mayuscula y el
                mixed-case del checksum EIP-55 destruido por un `text-transform`. En un producto
                cuya tesis es "comparalo vos contra el explorer", eso no es un detalle de estilo:
                es un error de contenido que cualquier cripto-nativo caza en un segundo. */}
            <span className="uppercase tracking-[0.18em]">Vault</span>{" "}
            {vault.vault.slice(0, 6)}…{vault.vault.slice(-4)}
          </a>
        ) : searchedButEmpty ? (
          <Link
            href="/create"
            className="rs-focus text-[10px] underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70 sm:text-[11px]"
            style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.18em", color: "var(--rs-dim)" }}
          >
            No vault yet · launch one →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/// El campo lleno. Se marca por FORMA —mono, y una regla debajo— y no por color.
///
/// El boceto lo subrayaba en lima, y ahí había dos problemas de una: el presupuesto del acento ya
/// está gastado en el `100%` del stat, y sobre todo **`#CCFF00` sobre blanco da 1,1:1**, así que en
/// tema claro el subrayado no existía. Marcar el campo con la regla, además, es lo que
/// corresponde: en un formulario llenado el campo se marca con la línea, no con resaltador.
function Field({ text, step }: { text: { shown: string; full: string }; step: 0 | 1 | 2 }) {
  return (
    <span
      title={text.full}
      className="whitespace-nowrap"
      style={{
        fontFamily: "var(--f-mono)",
        // los escalones evitan que un handle de 39 caracteres reviente la medida antes de que el
        // truncado por el medio entre en juego
        fontSize: step === 0 ? "0.74em" : step === 1 ? "0.62em" : "0.66em",
        letterSpacing: "-0.01em",
        borderBottom: "2px solid var(--rs-field-rule)",
        paddingBottom: "0.05em",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {text.shown}
    </span>
  );
}

/// El campo vacío. Es un BOTÓN que lleva el foco al buscador del hero.
///
/// El boceto ponía un "Name someone to fill this in →" abajo a la derecha del panel, lejos del
/// campo al que se refería y con una flecha apuntando a nada. La señal va en el campo mismo: si el
/// blanco se puede llenar, el blanco tiene que verse tipeable y responder al click.
function Blank({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rs-focus whitespace-nowrap align-baseline transition-opacity hover:opacity-100"
      style={{
        fontFamily: "var(--f-mono)",
        fontSize: "0.7em",
        letterSpacing: "-0.01em",
        color: "var(--rs-faint)",
        borderBottom: "2px dashed var(--rs-field-rule)",
        paddingBottom: "0.05em",
        opacity: loading ? 0.5 : 0.85,
      }}
    >
      {loading ? "reading…" : "a builder"}
    </button>
  );
}
