"use client";

import { useEffect, useRef, useState } from "react";

/// LA FIRMA — la pluma vuelve, y esta vez firma.
///
/// POR QUÉ VUELVE. La pluma existió y se sacó, y al sacarla quedó escrita la condición de regreso:
/// *"vuelve cuando esté dibujada con silueta cerrada y COMPUESTA en una sección —el lugar natural es
/// echada bajo 'One vault. One identity. No keys of ours.', como la pluma apoyada sobre un acta ya
/// firmada—, no flotando de wallpaper."* Esto es exactamente eso, y por eso vive acá y no en un
/// gutter.
///
/// QUÉ ESTABA MAL EN LA ANTERIOR (diagnóstico de un juez visual, que es lo que hay que no repetir):
///
///  1. **No tenía MASA.** Eran 92 trazos abiertos —46 barbas por lado— sin ningún contorno que los
///     atara. Un vano de pluma es una superficie continua; 92 líneas sueltas leen como **peine**.
///     Por eso acá el vano es **un path cerrado y relleno**, y las separaciones entre barbas se
///     CORTAN adentro de esa masa en vez de dibujarse una por una.
///  2. **El perfil dibujaba una LENTE**: `sin(t^0.6·π)` es ancho al medio y se apaga en los dos
///     extremos. Una pluma es puntiaguda arriba, ancha abajo del medio, y después se queda sin
///     barbas y sigue como cañón desnudo hasta el pico. El perfil de acá tiene ese quiebre.
///  3. **La asimetría 1:1.39 es ópticamente simetría.** Acá los dos vanos difieren lo suficiente
///     como para leerse (0,58 contra 1,0).
///  4. Y lo peor no era el dibujo: estaba `fixed` al viewport, o sea una calcomanía que aparecía
///     recortada distinto en cada sección y en mobile se cruzaba con el cuerpo de texto.
///
/// POR QUÉ ANIMA, SI EL PLAYBOOK DESCONFÍA DEL MOVIMIENTO DECORATIVO. Porque no es un loop: **se
/// dispara con el scroll del visitante** (una sola vez, al entrar la sección) y lo que dibuja es el
/// gesto que le da sentido a todo el bloque — el acta que se firma. La pluma no flota: **recorre la
/// firma mientras la firma se escribe**, montada sobre el mismo path con `offset-path`, así que el
/// pico está siempre exactamente donde nace la tinta. Si se movieran por separado, se notaría.
///
/// Con `prefers-reduced-motion` la firma aparece ya escrita y la pluma en su lugar de reposo: el
/// gesto es contenido, no adorno, así que quien pide menos movimiento igual tiene que verlo.

/// El trazo de la firma. Un garabato, no letras: un nombre concreto sería el de alguien, y acá el
/// acta se firma sola. `pathLength="100"` normaliza el largo para que el dibujado sea un porcentaje
/// y no dependa de medir el path en runtime.
const SIG =
  "M6,62 C26,22 50,12 61,32 C70,49 55,73 45,61 C36,50 58,25 90,29 C119,33 117,64 105,67 " +
  "C95,69 95,51 115,43 C139,33 167,51 185,57 C205,63 223,43 235,29 C247,15 267,17 275,35 " +
  "C281,49 267,63 257,57 C249,52 257,37 283,37 C314,37 337,51 398,24";

export function Signature({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setOn(true);
          io.disconnect();
        }
      },
      // 0.55 y no 0: la firma tiene que arrancar cuando el bloque ya se está leyendo, no cuando
      // asoma un pixel por abajo — si no, el visitante llega tarde y ve el final.
      { threshold: 0.55 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`rs-sig ${on ? "is-on" : ""} ${className}`} aria-hidden>
      <svg viewBox="0 0 410 90" className="w-full overflow-visible">
        {/* la línea del renglón, que se dibuja primero: el papel pautado antes de la firma */}
        <line
          className="rs-sig-rule"
          x1="0"
          y1="82"
          x2="410"
          y2="82"
          stroke="var(--rs-hair)"
          strokeWidth="1"
        />
        {/* LA FIRMA. Sin `fill` — un path abierto con fill pinta el area encerrada por sus curvas
            y el garabato queda relleno de manchones. */}
        <path
          className="rs-sig-ink"
          d={SIG}
          pathLength={100}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* LA PLUMA, montada sobre el MISMO path. El pico queda donde nace la tinta porque los dos
          recorren la misma curva; animados por separado se despegarían y se notaria enseguida. */}
      <div className="rs-sig-quill">
        <Quill />
      </div>
    </div>
  );
}

/// La pluma con SILUETA CERRADA. El vano es una superficie rellena y las barbas son cortes
/// negativos adentro de esa masa — al revés de la versión anterior, que dibujaba cada barba como un
/// trazo suelto y por eso leía como peine.
function Quill() {
  return (
    <svg viewBox="0 0 64 190" width="100%" height="100%" fill="none">
      {/* el vano: punta arriba, ancho abajo del medio, y despues se corta — la pluma se queda sin
          barbas y sigue como cañon desnudo. Los dos lados difieren de verdad (el interno mucho mas
          angosto), que es lo que separa una pluma de una hoja. */}
      <path
        d="M33 4
           C 30 34, 24 58, 17 82
           C 11 103, 8 118, 12 130
           C 17 142, 26 146, 32 143
           C 38 140, 43 130, 45 116
           C 48 92, 44 52, 33 4 Z"
        fill="currentColor"
        opacity="0.92"
      />
      {/* los cortes entre barbas: negativos sobre la masa, no trazos sueltos. Pocos y desiguales —
          una pluma real no tiene 46 barbas idénticas perfectamente espaciadas. */}
      <g stroke="var(--rs-paper)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
        <path d="M30 26 L 24 44" />
        <path d="M28 40 L 19 62" />
        <path d="M25 56 L 15 80" />
        <path d="M22 74 L 13 99" />
        <path d="M34 30 L 40 52" />
        <path d="M34 50 L 43 76" />
        <path d="M33 72 L 44 98" />
        <path d="M31 96 L 42 118" />
      </g>
      {/* el raquis: el eje que sostiene el vano, apenas visible */}
      <path d="M33 6 C 31 46, 28 96, 30 140" stroke="var(--rs-paper)" strokeWidth="1.5" opacity="0.5" />
      {/* el cañón desnudo y el pico, que es donde toca el papel */}
      <path
        d="M30 141 C 33 152, 35 163, 34.5 176 L 32.5 188 L 30.5 176 C 29 163, 27 152, 27 142 Z"
        fill="currentColor"
      />
    </svg>
  );
}
