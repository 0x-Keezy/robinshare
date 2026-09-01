import Link from "next/link";

/// EL WORDMARK. La marca de RobinShare es su NOMBRE, no un símbolo.
///
/// POR QUÉ NO HAY SÍMBOLO. Jose miró el logo y dijo "qué feo logo, por favor haz las cosas bien".
/// Un juez de marca en frío lo midió y le dio la razón con seis motivos, de los cuales tres
/// importan para no repetir el error:
///
///  1. **El mark vivía a 8 píxeles.** `SetAsideMark` tenía su tinta entre `y 8` y `y 18` de un
///     viewBox de 24, o sea 10/24 del alto. Renderizado a 20px en la nav, la marca real medía
///     **8,3px** y encima se sentaba baja. Por eso leía como un bullet suelto al lado del nombre.
///  2. **Leía como skeleton loader.** Dos barras de largos distintos, escalonadas, con `rx=1.2`
///     sobre 5,5 de alto = 22% de radio: exactamente el chip de placeholder de carga de cualquier
///     librería de UI. Una marca que dice "el contenido no cargó" es lo peor posible en un
///     producto de custodia.
///  3. **Un monograma tampoco servía**, y esto fue lo que no habíamos visto: **Recurve —el otro
///     launchpad del mismo dueño, en la MISMA cadena y el mismo vertical— también empieza con R**,
///     y a 32px en una lista de wallet lo único que sobrevive es familia cromática + inicial. Más:
///     "RobinShare" + Robinhood Chain + acento lima + una R sola lee como producto oficial de
///     Robinhood, que es un problema de posicionamiento, no de gusto.
///
/// La salida es la que corren **Stripe, Ramp y Mercury**: wordmark solo en la nav. Elimina de raíz
/// el grafismo feo al lado del nombre, y diferencia de Recurve mucho más de lo que podrían hacerlo
/// dos símbolos (marca-de-palabra contra marca-de-símbolo).
///
/// POR QUÉ ESTA TIPOGRAFÍA. La identidad ya existía y no la estábamos usando: es la voz de la
/// tarjeta del acta (`SetAsideDeed`) — serif de instrumento legal. La mono espaciada que había
/// antes dice "dev tool / terminal" y encima peleaba con esa tarjeta, o sea que el sistema tenía
/// dos voces para la misma marca.
///
/// Y va en CAJA MIXTA con letras de verdad, no en versalitas. Fraunces no tiene versalitas reales,
/// así que `font-variant: small-caps` las **sintetiza escalando mayúsculas**: a 52px se ve que el
/// asta de las chicas queda más fina que la de la R y la S. A tamaño de logo eso es un defecto de
/// dibujo, no un detalle.
///
/// El símbolo NO desaparece del todo: sobrevive donde el cuadrado es obligatorio y algo tiene que
/// ir (favicon, apple-icon), y ahí vive EL INDENT — ver `app/icon.svg`.
export function Wordmark({
  size = 21,
  color = "var(--rs-ink)",
  href = "/",
  className = "",
}: {
  size?: number;
  color?: string;
  /// `null` lo renderiza como texto plano (para el footer, donde ya hay links y un logo que
  /// linkea a la página en la que estás es ruido).
  href?: string | null;
  className?: string;
}) {
  const mark = (
    <span
      style={{
        fontFamily: "var(--f-display)",
        fontSize: size,
        fontWeight: 600,
        // `opsz` alto afila la serif (más contraste, remates más finos), que es lo que le
        // corresponde a un logo: un wordmark siempre es display, aunque se muestre chico.
        fontVariationSettings: "'SOFT' 0, 'WONK' 0, 'opsz' 96",
        letterSpacing: "0.006em",
        lineHeight: 1,
        color,
        whiteSpace: "nowrap",
      }}
    >
      RobinShare
    </span>
  );

  if (href === null) return <span className={className}>{mark}</span>;
  return (
    <Link
      href={href}
      aria-label="RobinShare, home"
      className={`rs-focus inline-flex items-center transition-opacity hover:opacity-70 ${className}`}
    >
      {mark}
    </Link>
  );
}
