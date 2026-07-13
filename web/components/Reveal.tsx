"use client";

import { useEffect, useRef, type ReactNode } from "react";

/// Scroll reveal compartido: fade + rise + un-blur al entrar al viewport, una sola vez.
/// Respeta prefers-reduced-motion (via CSS). Sin dependencias pesadas.
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "li" | "span" | "p" | "h1" | "h2";
  className?: string;
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
      className={`reveal ${className}`}
      style={{ ["--reveal-delay" as string]: `${delay}ms` }}
    >
      {children}
    </Comp>
  );
}
