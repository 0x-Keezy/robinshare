"use client";

import Link from "next/link";
import { Archivo_Black, Archivo, IBM_Plex_Mono } from "next/font/google";
import { BowMark } from "@/components/BowMark";
import { useTheme } from "@/lib/useTheme";

/*
 * Shell de RobinShare para las páginas de utilidad (/create, /claim):
 * mismo sistema visual que la home (tokens var(--rs-*), Archivo Black +
 * IBM Plex Mono, arco como marca, toggle de tema) sin el peso del hero.
 */

const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--f-display" });
const body = Archivo({ subsets: ["latin"], variable: "--f-body" });
const mono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--f-mono" });

export const RS = {
  PAPER: "var(--rs-paper)",
  INK: "var(--rs-ink)",
  GREEN: "#00C805", // dato en vivo, no varía por tema
  GREEN_TEXT: "var(--rs-green-text)",
  GREEN_CTA: "var(--rs-green-cta)",
  GREEN_CTA_TEXT: "var(--rs-green-cta-text)",
  DIM: "var(--rs-dim)",
  FAINT: "var(--rs-faint)",
  HAIR: "var(--rs-hair)",
};

export function RSShell({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();

  return (
    <div
      className={`${display.variable} ${body.variable} ${mono.variable} flex min-h-screen flex-col`}
      style={{ background: RS.PAPER, color: RS.INK, fontFamily: "var(--f-body)" }}
    >
      <nav className="border-b" style={{ borderColor: RS.HAIR }}>
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80" style={{ color: RS.INK }}>
            <BowMark color={RS.GREEN} />
            <span style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.26em" }} className="text-xs font-medium uppercase">
              RobinShare
            </span>
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: RS.INK }}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <div className="flex-1">{children}</div>

      <footer className="border-t" style={{ borderColor: RS.HAIR }}>
        <p
          className="mx-auto w-full max-w-2xl px-6 py-6 text-xs leading-relaxed"
          style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }}
        >
          Permissionless and non-custodial. Funds release only to the wallet that proves the
          recipient identity. Not affiliated with Robinhood or Flap.
        </p>
      </footer>
    </div>
  );
}
