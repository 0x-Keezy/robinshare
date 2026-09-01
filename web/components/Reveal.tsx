"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/// Scroll reveal compartido. Respeta prefers-reduced-motion (via CSS). Sin dependencias pesadas.
///
/// LAS VARIANTES. Al principio esto tenia un solo modo —fade + rise + un-blur— y se usaba para
/// TODO: titulares, paneles, reglas, numeros. Un juez visual externo lo llamo "la animacion mas
/// perezosa que existe, aplicada uniformemente", y tenia razon por una razon concreta: si el
/// titular y el panel y la regla entran igual, ninguno de los tres se mueve como lo que ES, asi
/// que el movimiento no comunica nada — solo tapa el hecho de que la seccion aparecio.
///
/// Ahora la variante la elige quien lo usa, y cada una tiene su semantica (las curvas y el detalle
/// de por que, en globals.css):
///
///   "fade"   — el default historico. Queda para contenido generico.
///   "set"    — titulares: cada linea se COMPONE subiendo desde su propia caja.
///   "settle" — paneles: se asientan con overshoot amortiguado, como un objeto con masa.
///   "draw"   — reglas y lineas: se dibujan de izquierda a derecha.
///   "lift"   — datos y numeros: entran EN FOCO (blur → nitido).
///
/// `stagger` solo aplica a "set" y "lift", que son las que escalonan hijos via --i.
export type RevealVariant = "fade" | "set" | "settle" | "draw" | "lift";

const VARIANT_CLASS: Record<RevealVariant, string> = {
  fade: "reveal",
  set: "rs-set",
  settle: "rs-settle",
  draw: "rs-draw",
  lift: "rs-lift-in",
};

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  variant = "fade",
  stagger,
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "li" | "span" | "p" | "h1" | "h2";
  className?: string;
  variant?: RevealVariant;
  /// ms entre hijos consecutivos (variantes "set" y "lift"). El escalonado es lo que separa
  /// "un bloque aparecio" de "esto se esta componiendo delante tuyo".
  stagger?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Gotcha (vault): en pestaña OCULTA Chrome congela las transiciones CSS a mitad
    // de vuelo → la sección queda fantasma (opacity/blur intermedios). Si el tab está
    // hidden, saltamos directo al estado final; y al volver a visible, cualquier
    // reveal ya disparado se asienta al instante.
    const settle = () => el.classList.add("no-anim");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (document.hidden) settle();
            else setTimeout(settle, 900); // pasada la ventana de transición, fijar
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    const onVis = () => {
      if (!document.hidden && el.classList.contains("is-in")) settle();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref as never}
      className={`${VARIANT_CLASS[variant]} ${className}`}
      style={{
        ["--reveal-delay" as string]: `${delay}ms`,
        ...(stagger !== undefined ? { ["--rs-stagger" as string]: `${stagger}ms` } : {}),
      }}
    >
      {children}
    </Comp>
  );
}

/// Marca el indice de escalonado de un hijo dentro de un Reveal "set"/"lift". Se escribe como
/// prop de estilo y no como delay calculado en JS para que el escalonado siga siendo CSS puro
/// (una sola transicion por elemento, sin timers que se desincronicen con el scroll).
export const stagIndex = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;
