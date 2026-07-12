"use client";

import { useEffect } from "react";

/// Módulo de scroll compartido (patrón Cyera/Aegis del vault): un listener passive
/// rAF-throttled escribe el progreso 0→1 acá; el 3D lo LEE dentro de useFrame sin
/// provocar re-renders de React. El DOM scrollea nativo; el canvas es capa.
export const Scroll = { progress: 0 };

export function useScrollSync() {
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      Scroll.progress = Math.min(1, Math.max(0, window.scrollY / max));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    read();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
}
