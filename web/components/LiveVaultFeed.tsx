"use client";

import { useEffect, useRef, useState } from "react";

/*
 * El PRODUCTO hecho vida: un feed de trades alimentando vaults, fila por fila.
 * Ilustrativo (etiquetado "preview") — pero convierte el pitch abstracto en algo
 * que se VE pasar. Cada dirección lo skinnea por props.
 */

type Row = { id: number; t: string; amt: string; handle: string; drip: string };

// Ficticios a propósito — nombres reales con montos ETH inventados rozaba
// la suplantación (hallazgo del audit ciego). Mismo registro "builder que
// shippea", cero identidades reales.
const HANDLES = [
  "@shipsdaily", "@night-builder", "@0xmerge", "@the-committer",
  "@indiehacker", "@basecamp-dev", "@anon-shipper", "@core-dev", "@the-forker",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function LiveVaultFeed({
  accent,
  gold,
  dim,
  hair,
  verb = "swap",
  max = 6,
  className = "",
}: {
  accent: string;
  gold: string;
  dim: string;
  hair: string;
  verb?: string;
  max?: number;
  className?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const seq = useRef(0);
  const rand = useRef(mulberry32(4663));
  const lastHandle = useRef<string | null>(null);

  useEffect(() => {
    const make = (): Row => {
      const r = rand.current;
      const amt = (0.05 + r() * 2.4).toFixed(2);
      const drip = ((parseFloat(amt) * (0.008 + r() * 0.004))).toFixed(4);
      const now = new Date();
      const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      // nunca repetir el handle anterior en la ventana visible — evita que el
      // mismo nombre "domine" el feed y se sienta a fixture, no a producto real
      let handle = HANDLES[Math.floor(r() * HANDLES.length)];
      if (handle === lastHandle.current) {
        handle = HANDLES[(HANDLES.indexOf(handle) + 1) % HANDLES.length];
      }
      lastHandle.current = handle;
      return { id: seq.current++, t, amt, handle, drip };
    };
    setRows(Array.from({ length: 3 }, make));
    const iv = setInterval(() => {
      setRows((prev) => [make(), ...prev].slice(0, max));
    }, 2200);
    return () => clearInterval(iv);
  }, [max]);

  return (
    <div className={className} style={{ fontFamily: "var(--f-mono)" }}>
      <ul className="flex flex-col">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className="feed-row flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
            style={{
              borderTop: i === 0 ? "none" : `1px solid ${hair}`,
              opacity: 1 - i * 0.13,
              // halo oscuro: el feed vive sobre fondos ocupados (plumas, humo, plates) —
              // sin esto el texto se lava contra cualquier cosa brillante detrás
              textShadow: "0 0 6px rgba(3,6,4,0.92), 0 1px 4px rgba(3,6,4,0.95)",
            }}
          >
            <span className="whitespace-nowrap" style={{ color: dim }}>{r.t}</span>
            <span className="flex-1 whitespace-nowrap" style={{ color: dim }}>
              {verb} <span style={{ color: "inherit" }}>{r.amt}</span>
            </span>
            <span className="whitespace-nowrap" style={{ color: accent }}>{r.handle}</span>
            {/* "ETH" explícito, no el glifo Ξ — a 13px monoespaciado se confundía con ≡ */}
            <span className="whitespace-nowrap" style={{ color: gold, fontVariantNumeric: "tabular-nums" }}>
              +{r.drip} ETH
            </span>
          </li>
        ))}
      </ul>
      <style>{`
        .feed-row { animation: feedin 0.5s cubic-bezier(0.16,1,0.3,1); }
        @keyframes feedin { from { opacity: 0; transform: translateY(-8px); } }
        @media (prefers-reduced-motion: reduce) { .feed-row { animation: none; } }
      `}</style>
    </div>
  );
}
