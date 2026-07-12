"use client";

import { useEffect, useState } from "react";

/// Nav que se esconde al scrollear hacia abajo y reaparece al subir (o cerca del top).
/// Mata la colisión texto-sobre-texto de un nav fijo con contenido que pasa por debajo.
export function useHideNav(threshold = 120) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        if (y < threshold) setHidden(false);
        else if (y > lastY + 6) setHidden(true);
        else if (y < lastY - 6) setHidden(false);
        lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);
  return hidden;
}
