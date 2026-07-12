"use client";

import type { ReactNode } from "react";

/// Banda marquee infinita (CSS puro, contenido duplicado). Respeta reduced-motion.
export function Marquee({
  children,
  duration = 28,
  className = "",
}: {
  children: ReactNode;
  duration?: number;
  className?: string;
}) {
  return (
    <div className={`mq-wrap pointer-events-none overflow-hidden whitespace-nowrap ${className}`} aria-hidden>
      <div className="mq-track inline-block" style={{ animationDuration: `${duration}s` }}>
        <span className="inline-block">{children}</span>
        <span className="inline-block">{children}</span>
      </div>
      <style>{`
        .mq-track { animation-name: mqslide; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform; }
        @keyframes mqslide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .mq-track { animation: none; } }
      `}</style>
    </div>
  );
}
