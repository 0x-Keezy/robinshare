/// La pluma, dibujada en vez de renderizada.
///
/// POR QUÉ NO ES UNA IMAGEN. La versión anterior era un PNG con glow verde neón y specks de humo,
/// y el propio código lo admitía: se le había puesto una máscara radial porque *"sin máscara leía a
/// render de IA"*. Enmascarar un tell no lo quita — sólo le recorta los bordes.
///
/// Y cambia de significado con la marca nueva: ya no es el sombrero de Robin Hood, es **el
/// instrumento con que se firma** el apartado.
///
/// SEGUNDA PASADA. La primera versión leía como **nervadura de hoja o malla técnica**, no como
/// pluma: 54 barbas idénticas, perfectamente espaciadas, saliendo simétricas de un eje recto. Una
/// pluma real no es simétrica ni regular — tiene dos vanos de ancho distinto, un hueco visible
/// contra el raquis, barbas que se separan hacia la punta, y algunas sueltas. Tres cambios:
///
///  1. **Vanos asimétricos**: el lado interno es más angosto que el externo (0,72 vs 1,0), que es
///     lo que hace que una pluma se lea como pluma y no como hoja.
///  2. **Hueco contra el raquis**: las barbas arrancan separadas del eje, no pegadas — sin ese
///     hueco el dibujo lee como espina de pescado.
///  3. **Irregularidad determinista**: largo y ángulo modulados por una función sembrada, y las
///     últimas barbas de la punta se abren sueltas. Determinista a propósito: la captura del gate
///     y la página tienen que ser la misma imagen.
export function QuillMark({
  className,
  stroke = "currentColor",
  opacity = 1,
}: {
  className?: string;
  stroke?: string;
  opacity?: number;
}) {
  const W = 200;
  const H = 440;
  const tipY = 30;
  const capY = 352;

  /// Ruido determinista: sin `Math.random`, que rompería la reproducibilidad del screenshot.
  const jitter = (i: number, k: number) => {
    const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x); // 0..1
  };

  const raquis = (t: number) => {
    const y = tipY + (capY - tipY) * t;
    const x = W / 2 + Math.sin(t * Math.PI * 0.8) * 13 - t * 4;
    return [x, y] as const;
  };

  type Barba = { d: string; w: number };
  const barbas: Barba[] = [];
  const N = 46;
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const [x, y] = raquis(t);

    // Perfil del vano: crece rápido tras la punta y se apaga hacia el cálamo.
    const perfil = Math.sin(Math.pow(t, 0.6) * Math.PI);
    if (perfil < 0.04) continue;

    for (const lado of [-1, 1] as const) {
      // Asimetría: un vano más angosto que el otro.
      const anchoBase = perfil * (lado < 0 ? 46 : 64);
      const ancho = anchoBase * (0.86 + jitter(i, lado) * 0.28);
      if (ancho < 3) continue;

      // Hueco contra el raquis: la barba no nace pegada al eje.
      const hueco = 2.5 + perfil * 2;
      const x0 = x + lado * hueco;

      // Inclinación hacia la punta; las de la punta se abren más.
      const caida = 9 + t * 22 + jitter(i, lado + 7) * 5;
      const x2 = x0 + lado * ancho;
      const y2 = y - caida;
      const cx = x0 + lado * ancho * 0.45;
      const cy = y - caida * 0.28;

      barbas.push({
        d: `M${x0.toFixed(1)},${y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
        // Las barbas del centro pesan un poco más que las de los extremos.
        w: 0.5 + perfil * 0.5,
      });
    }
  }

  const [rx1, ry1] = raquis(1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      fill="none"
      aria-hidden
      style={{ opacity }}
      preserveAspectRatio="xMidYMin meet"
    >
      <g stroke={stroke} strokeLinecap="round">
        {barbas.map((b, i) => (
          <path key={i} d={b.d} strokeWidth={b.w} opacity={0.42 + (i % 5) * 0.055} />
        ))}
        {/* el raquis: se afina hacia la punta, como el de verdad */}
        <path
          d={`M${raquis(0)[0]},${raquis(0)[1]} Q${W / 2 + 15},${(tipY + capY) / 2} ${rx1},${ry1}`}
          strokeWidth="1.35"
          opacity="0.85"
        />
        {/* el cálamo: tubo hueco, abierto, cortado en bisel para escribir */}
        <path d={`M${rx1 - 2.6},${ry1} L${rx1 - 3.4},${H - 30}`} strokeWidth="1.1" opacity="0.8" />
        <path d={`M${rx1 + 2.6},${ry1} L${rx1 + 2.2},${H - 44}`} strokeWidth="1.1" opacity="0.8" />
        <path
          d={`M${rx1 - 3.4},${H - 30} Q${rx1 - 1},${H - 16} ${rx1 + 2.2},${H - 44}`}
          strokeWidth="1.1"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}
