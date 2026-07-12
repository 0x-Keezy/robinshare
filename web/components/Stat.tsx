"use client";

import { useEffect, useRef, useState } from "react";

/// Número que cuenta hasta su valor al entrar al viewport (una vez). Solo hechos
/// honestos del protocolo — nada de TVL inventado pre-launch.
export function Stat({
  value,
  suffix = "",
  label,
  accent,
  dim,
}: {
  value: number;
  suffix?: string;
  label: string;
  accent: string;
  dim: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const t0 = performance.now();
        const D = 1100;
        const tick = () => {
          const t = Math.min(1, (performance.now() - t0) / D);
          setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <div ref={ref}>
      <div
        style={{ fontFamily: "var(--f-display)", color: accent, fontVariantNumeric: "tabular-nums" }}
        className="text-[clamp(2.4rem,5vw,4rem)] leading-none"
      >
        {n}
        {suffix}
      </div>
      <div
        style={{ fontFamily: "var(--f-mono)", color: dim, letterSpacing: "0.18em" }}
        className="mt-2 text-[11px] uppercase"
      >
        {label}
      </div>
    </div>
  );
}
