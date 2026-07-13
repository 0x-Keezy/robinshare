"use client";

import { useState } from "react";
import Link from "next/link";
import { DIRECTIONS } from "@/lib/directions";

/*
 * Switcher flotante del bake-off: salta entre versiones con un click desde
 * cualquier /v/<dir>. Neutro a propósito (pill oscuro glass) para convivir con
 * los 9 mundos sin disfrazarse de ninguno.
 */
export function VersionSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const cur = DIRECTIONS.find((d) => d.code === current);
  const v2 = DIRECTIONS.filter((d) => d.gen === 2);
  const v1 = DIRECTIONS.filter((d) => d.gen === 1);

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2" style={{ fontFamily: "ui-monospace, monospace" }}>
      {open && (
        <div
          className="mb-2 w-72 overflow-hidden rounded-xl border shadow-2xl"
          style={{ background: "rgba(10,12,10,0.96)", borderColor: "rgba(255,255,255,0.16)", backdropFilter: "blur(8px)" }}
        >
          <div className="px-4 pb-1 pt-3 text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Bake-off v2
          </div>
          {v2.map((d) => (
            <Link
              key={d.code}
              href={`/v/${d.code}`}
              className="flex items-baseline justify-between px-4 py-2 text-sm hover:bg-[rgba(255,255,255,0.08)]"
              style={{ color: d.code === current ? "#00C805" : "rgba(255,255,255,0.9)" }}
              onClick={() => setOpen(false)}
            >
              <span>{d.code === current ? "▸ " : ""}{d.name}</span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{d.tag}</span>
            </Link>
          ))}
          <div className="px-4 pb-1 pt-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Archivo v1
          </div>
          {v1.map((d) => (
            <Link
              key={d.code}
              href={`/v/${d.code}`}
              className="flex items-baseline justify-between px-4 py-1.5 text-xs hover:bg-[rgba(255,255,255,0.08)]"
              style={{ color: d.code === current ? "#00C805" : "rgba(255,255,255,0.6)" }}
              onClick={() => setOpen(false)}
            >
              <span>{d.code === current ? "▸ " : ""}{d.name}</span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{d.tag}</span>
            </Link>
          ))}
          <Link
            href="/v"
            className="block border-t px-4 py-2.5 text-xs uppercase tracking-[0.18em] hover:bg-[rgba(255,255,255,0.08)]"
            style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
            onClick={() => setOpen(false)}
          >
            ⌂ Ver todas
          </Link>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-xl"
        style={{
          background: "rgba(10,12,10,0.94)",
          borderColor: "rgba(255,255,255,0.18)",
          color: "#fff",
          backdropFilter: "blur(8px)",
        }}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: "#00C805" }} />
        {cur ? cur.name : "Versiones"}
        <span style={{ color: "rgba(255,255,255,0.5)" }}>{open ? "▾" : "▴"}</span>
      </button>
    </div>
  );
}
