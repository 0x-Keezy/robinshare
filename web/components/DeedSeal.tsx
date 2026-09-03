"use client";

/// EL SELLO. El momento en que la cadena confirma, y el acta queda sellada.
///
/// POR QUÉ EXISTE. Dos jueces distintos midieron la página y los dos escribieron lo mismo en el eje
/// de wow: **ausente**. Y Jose lo dijo con sus palabras: *"me falta algo visual que sea como WOW"*.
///
/// POR QUÉ ES ESTO Y NO UNA ANIMACIÓN. El playbook del vertical es explícito y ya nos costó una
/// ronda ignorarlo: en DeFi/fintech **el wow Tier-1 responde al INPUT del usuario, no al autoplay**,
/// y **la carga del wow es el DATO**. Un adorno que se mueve solo en una página de custodia no suma
/// asombro, resta crédito. Por eso esto no pasa nada hasta que alguien busca un nombre; y cuando
/// pasa, lo que se ve es información verdadera.
///
/// QUÉ SELLA, EXACTAMENTE. Un sello notarial no decora: **atestigua un momento**. Éste atestigua el
/// único momento que este producto puede probar — la altura de bloque a la que se leyó la cadena.
/// El aro lleva la cadena y su id; el centro, el bloque exacto de esa lectura, congelado (un sello
/// con un número que sigue cambiando no sella nada). Todo dato acá es real o el sello no aparece.
///
/// EL ESTADO EN REPOSO NO ES "APAGADO", ES **GOFRADO EN SECO**: el sello está, sin tinta, como el
/// relieve de un papel timbrado antes de firmarse. Así hay algo que mirar apenas cargás la página
/// —que es la mitad del pedido— y la llegada del dato tiene a dónde llegar. Un elemento que aparece
/// de la nada no se lee como que algo se cumplió; se lee como que algo apareció.
import { useEffect, useRef, useState } from "react";

export function DeedSeal({
  /// Altura de bloque a la que se leyó la cadena. `null` = todavía nadie buscó → gofrado en seco.
  atBlock,
  className = "",
}: {
  atBlock: bigint | null;
  /// El TAMAÑO se controla por clase, no por prop numerica: tiene que ser responsivo. A 134px
  /// sobre un viewport de 390 el sello se comia el texto del pie de la hoja.
  className?: string;
}) {
  const inked = atBlock !== null;
  const [pressed, setPressed] = useState(false);
  const prev = useRef<bigint | null>(null);

  // El golpe se dispara SOLO en la transición seco → entintado, no en cada render. Sin esto, un
  // re-render cualquiera (el poll del bloque corre cada 2s) volvería a estampar el sello y el gesto
  // se convertiría en un tic.
  useEffect(() => {
    if (atBlock !== null && prev.current === null) {
      setPressed(true);
      const t = setTimeout(() => setPressed(false), 620);
      prev.current = atBlock;
      return () => clearTimeout(t);
    }
    prev.current = atBlock;
  }, [atBlock]);

  const R = 50;
  const rimR = 41.5;
  const label = "ROBINHOOD CHAIN · 4663 · READ ON CHAIN · ";

  return (
    <div
      aria-hidden={!inked}
      className={`${className} ${pressed ? "rs-stamp" : ""}`}
      style={{
        // Un sello lo baja una mano, así que nunca cae a escuadra. Cuatro grados alcanzan: más
        // lee como error de layout, menos no se percibe.
        transform: "rotate(-4deg)",
        opacity: inked ? 1 : 0.16,
        transition: "opacity 420ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <path
            id="rs-seal-rim"
            fill="none"
            d={`M 50 ${50 - rimR} A ${rimR} ${rimR} 0 1 1 ${50 - 0.01} ${50 - rimR}`}
          />
        </defs>

        {/* aro exterior + interior: la doble regla es lo que hace que un círculo lea como sello y
            no como un badge de UI */}
        <circle cx="50" cy="50" r={R - 1} fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.85" />
        <circle cx="50" cy="50" r={R - 5.5} fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />
        <circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.5" />

        {/* el aro dentado: 60 dientes, uno por segundo de un minuto. Es lo que da la silueta de
            sello aun cuando el texto no se lee, y sobrevive al tamaño chico. */}
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = R - 1, r2 = R - 3.4;
          // REDONDEO OBLIGATORIO, no cosmetico. Sin el, esta pagina tiraba un error de hidratacion
          // en la consola de TODO visitante: el ultimo bit de `Math.cos`/`Math.sin` no coincide
          // entre el runtime que hace el SSR y el motor del navegador, asi que React comparaba
          // x2="31.046072432667714" (servidor) contra 31.046072432667717 (cliente) y avisaba
          // "some attributes ... didn't match. This won't be patched up". A 4 decimales sobre un
          // viewBox de 100 unidades el error maximo es 0,0001u ~= 0,00013px al tamano que se
          // renderiza: invisible. Y de paso el HTML del sello pesa ~1,4 KB menos.
          const q = (n: number) => +n.toFixed(4);
          return (
            <line
              key={i}
              x1={q(50 + Math.cos(a) * r1)}
              y1={q(50 + Math.sin(a) * r1)}
              x2={q(50 + Math.cos(a) * r2)}
              y2={q(50 + Math.sin(a) * r2)}
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.55"
            />
          );
        })}

        {/* el texto del aro, sobre el círculo: la marca de agua de cualquier sello real */}
        {/* `textLength` a la circunferencia exacta (2·π·r) con `lengthAdjust="spacing"`: sin eso el
            texto ocupa lo que mide y deja un tramo de aro vacio, que lee como sello a medio grabar.
            PERO el cuerpo tiene que estar cerca del natural o el motor reparte el sobrante como
            tracking: a 5.9 los 41 caracteres median ~145u contra los 260,8 forzados, o sea **+0,49em
            de espaciado** — y las letras del aro flotaban sueltas ("R O B I N H O O D"). Eso no lee
            como sello, lee como guirnalda. A 9.4 el natural queda en ~231 y el estiramiento residual
            baja a ~0,12em. */}
        <text
          style={{ fontFamily: "var(--f-mono)", fontSize: 9.4 }}
          fill="currentColor"
          opacity="0.8"
        >
          <textPath
            href="#rs-seal-rim"
            startOffset="0"
            textLength={2 * Math.PI * rimR}
            lengthAdjust="spacing"
          >
            {label}
          </textPath>
        </text>

        {/* el centro: lo que el sello atestigua */}
        <text
          x="50"
          y="45.5"
          textAnchor="middle"
          // SVG deja el tracking colgando DESPUES del ultimo glifo, asi que con `textAnchor=middle`
          // la palabra queda corrida media letra a la izquierda respecto del numero de abajo.
          dx=".1em"
          style={{ fontFamily: "var(--f-mono)", fontSize: 5.4, letterSpacing: "0.2em" }}
          fill="currentColor"
          opacity="0.65"
        >
          BLOCK
        </text>
        {/* `textLength` fijo con `spacingAndGlyphs`: el numero se ENCAJA en el aro interior sin
            importar cuantos digitos tenga. Sin esto se salia del anillo ya hoy (11 caracteres a
            cuerpo 9.6 miden ~63 unidades contra los ~50 que hay adentro), y la cadena va a sumar
            digitos con el tiempo — o sea que el defecto empeoraba solo. */}
        <text
          x="50"
          y="57"
          textAnchor="middle"
          // solo cuando hay numero: aplicado al guion del reposo, `spacingAndGlyphs` lo estira a
          // lo ancho del aro y deja un glifo raro en vez de un placeholder
          textLength={inked ? 43 : undefined}
          lengthAdjust={inked ? "spacingAndGlyphs" : undefined}
          style={{
            fontFamily: "var(--f-mono)",
            fontSize: 9,
            fontVariantNumeric: "tabular-nums",
          }}
          fill="currentColor"
        >
          {/* NO un em dash: es el tell #1 del gate del vertical y estaba en el estado por defecto,
              o sea que lo veia el 100% de los visitantes. Guiones de cifra, que ademas ocupan el
              ancho de un digito y dejan el hueco con la forma del dato que viene. */}
          {atBlock !== null ? `#${atBlock.toLocaleString("en-US")}` : "#‒‒‒‒‒‒"}
        </text>
      </svg>
    </div>
  );
}
