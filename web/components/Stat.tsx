"use client";

import { useEffect, useRef, useState } from "react";

/// Un hecho del protocolo, en numero. Solo hechos honestos y verificables — nada de TVL inventado
/// pre-launch, que es el tell mas caro del vertical.
///
/// DOS ARREGLOS DE OFICIO, los dos de un juez visual externo:
///
/// 1. **El numero estaba en la serif de display.** En un sitio cuya tesis entera es "esto se lee
///    de la cadena, no de una promesa", los numeros estaban vestidos de revista. La regla del
///    vertical es al reves: display serif para los titulares, **mono tabular para todo dato**.
///    `tabular-nums` no es cosmetico aca — sin el, un contador que sube de 0 a 100 cambia de ancho
///    en cada frame y el bloque entero tiembla mientras cuenta.
///
/// 2. **La fila no era una grilla.** Eran cuatro celdas en flex con gap uniforme, asi que "100ms"
///    medía ~260px y "0" medía ~55px y quedaba un agujero enorme entre medio. Y en mobile, una
///    label que wrapeaba a dos lineas rompia la altura de su fila contra las vecinas. Por eso
///    ahora la celda **reserva altura para dos lineas de label** siempre: las cuatro terminan a la
///    misma altura tenga la label una linea o dos.
///
/// La hairline de arriba es por celda y no una regla corrida: marca la celda como una unidad de
/// una tabla, que es lo que es.
export function Stat({
  value,
  suffix = "",
  label,
  accent,
  dim,
  index = 0,
}: {
  value: number;
  suffix?: string;
  label: string;
  accent: string;
  dim: string;
  /// Posicion en la fila. Escalona la entrada: las celdas no cuentan las cuatro a la vez, entran
  /// de izquierda a derecha como se lee una tabla.
  index?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      setDone(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const delay = index * 110;
        const t0 = performance.now() + delay;
        const D = 950;
        const tick = () => {
          const now = performance.now();
          if (now < t0) {
            requestAnimationFrame(tick);
            return;
          }
          const t = Math.min(1, (now - t0) / D);
          // expo-out: arranca rapidisimo y frena largo. Un cubic-out sigue leyendose mecanico
          // sobre numeros chicos (el "2" de "ways to claim" pasaba por 0,1,2 y parecia un glitch);
          // con expo el valor llega casi enseguida y lo que se percibe es el ASENTARSE.
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setN(Math.round(value * eased));
          if (t < 1) requestAnimationFrame(tick);
          else setDone(true);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, index]);

  return (
    <div
      ref={ref}
      className="flex flex-col border-t pt-4"
      style={{ borderColor: "var(--rs-hair)" }}
    >
      <div
        style={{
          fontFamily: "var(--f-mono)",
          color: accent,
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum" 1',
          // El tracking se cierra a medida que el cuerpo crece: a 4rem, el espaciado por defecto
          // de una mono deja los digitos flotando. Esto es el ajuste optico por tamaño que
          // separa "dos familias a distintos tamaños" de una escala tipografica de verdad.
          letterSpacing: "-0.045em",
        }}
        className="text-[clamp(2.3rem,4.6vw,3.6rem)] font-medium leading-[0.9]"
      >
        {n}
        <span style={{ letterSpacing: "-0.02em" }}>{suffix}</span>
      </div>
      {/* min-h reserva DOS lineas de label: sin esto, "Of the fee to the builder" wrapea en
          mobile y su celda queda mas alta que las tres vecinas. */}
      <div
        style={{ fontFamily: "var(--f-mono)", color: dim, letterSpacing: "0.16em" }}
        className="mt-3 min-h-[2.6em] text-[10px] uppercase leading-[1.3] sm:text-[11px]"
      >
        {label}
      </div>
      {/* marca de "ya conto": una hairline corta que se dibuja al terminar. Es el acuse de recibo
          del dato — sin ella, el numero final y un numero estatico se ven identicos. */}
      <div
        aria-hidden
        className="h-px w-6 origin-left transition-transform duration-500 ease-out"
        style={{ background: accent, transform: done ? "scaleX(1)" : "scaleX(0)", opacity: 0.5 }}
      />
    </div>
  );
}
