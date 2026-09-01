/// La marca de RobinShare: **el apartado**.
///
/// Una barra larga —el trade— con una porción separada y sostenida aparte: lo que se guarda a
/// nombre del builder. Dibuja lo que el producto hace, en dos formas y sin metáfora prestada.
///
/// POR QUÉ REEMPLAZA AL ARCO. `BowMark` era un arco tensado, el guiño a Robin Hood. Dos problemas:
/// el chiste del nombre no dice nada sobre lo que el producto HACE, y sobre todo **converge con
/// Recurve** — el otro launchpad de Jose, en la MISMA cadena y el mismo vertical, que ya usa un
/// mark de arco bespoke y que se llama, literalmente, por un arco recurvo. Dos marcas hermanas con
/// el mismo símbolo no son una familia: son una confusión.
///
/// El corte queda a la izquierda a propósito: se aparta ANTES, no con lo que sobra al final.
export function SetAsideMark({
  size = 20,
  color = "currentColor",
  accent,
}: {
  size?: number;
  color?: string;
  /// La porción apartada, cuando el contexto permite dos tintas. Sin esto, la marca es de un solo
  /// trazo y funciona igual en un favicon de 16 px.
  accent?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* la porción apartada: separada del cuerpo por el hueco, no por un borde */}
      <rect x="2.5" y="8.5" width="4.5" height="7" rx="1" fill={accent ?? color} />
      {/* el resto del trade, que sigue de largo */}
      <rect x="10" y="8.5" width="11.5" height="7" rx="1" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
