/// La marca de RobinShare: **el apartado**.
///
/// Una barra —el trade— con una porción cortada y **desplazada fuera del eje**: lo que se guarda a
/// nombre del builder. Dibuja lo que el producto hace, sin metáfora prestada.
///
/// POR QUÉ NO ES EL ARCO. `BowMark` era un arco tensado, el guiño a Robin Hood. El chiste del
/// nombre no dice nada de lo que el producto HACE, y sobre todo **convergía con Recurve** — el otro
/// launchpad de Jose, en la MISMA cadena y el mismo vertical, que ya usa un mark de arco bespoke y
/// se llama, literalmente, por un arco recurvo. Dos marcas hermanas con el mismo símbolo no son una
/// familia: son una confusión.
///
/// SEGUNDA PASADA. La primera versión leía como **ícono de batería con poca carga**, y el juez
/// visual dio las dos causas exactas:
///
///  1. **Dos tratamientos distintos** (una pieza rellena, la otra en contorno). El ojo veía dos
///     objetos de naturaleza distinta, no un objeto cortado. Ahora las dos van rellenas: es una
///     barra partida, no una caja con algo adentro.
///  2. **El hueco solo codifica "dos cosas", no "algo apartado".** Para leer *apartado* hace falta
///     evidencia de remoción Y desplazamiento: la porción tiene que estar visiblemente **fuera de
///     la línea de la que salió**. Por eso ahora baja media altura y se sostiene sola.
///
/// Y había una inversión semántica que contaba la historia al revés: la pieza chica rellena y el
/// resto como contorno vacío leía "la plata SALIÓ del vault" — lo contrario de lo que vende el
/// producto.
///
/// Verificada a 16 px antes que a 20: si a 16 no lee, no es una marca.
export function SetAsideMark({
  size = 20,
  color = "currentColor",
  accent,
}: {
  size?: number;
  color?: string;
  /// La porción apartada, cuando el contexto permite dos tintas. Sin esto la marca es de una sola
  /// tinta y funciona igual: la lectura la da la geometría, no el color.
  accent?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* el resto del trade, en su eje */}
      <rect x="9.5" y="8" width="12" height="5.5" rx="1.2" fill={color} />
      {/* la porción apartada: mismo tratamiento, mismo alto, DESPLAZADA hacia abajo y separada.
          El desplazamiento es lo que codifica "se apartó"; el hueco solo, no. */}
      <rect x="2.5" y="12.5" width="5" height="5.5" rx="1.2" fill={accent ?? color} />
    </svg>
  );
}
