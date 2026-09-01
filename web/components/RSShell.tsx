"use client";

import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import { Wordmark } from "@/components/Wordmark";
import { useTheme } from "@/lib/useTheme";
import { CUSTODY_LINE } from "@/lib/claims";

/*
 * Shell de RobinShare para las páginas de utilidad (/create, /claim):
 * mismo sistema visual que la home (tokens var(--rs-*), Fraunces + Archivo +
 * IBM Plex Mono, wordmark serif como marca, toggle de tema) sin el peso del hero.
 */

// Fraunces, no Archivo Black. La serif de autoridad es el registro que el vertical DeFi permite y
// que ningun hermano del cluster usa; Archivo Black era el display por defecto del molde
// suizo-snappy que hace que la pagina se lea como generada. Ver BRIEF-facelift.md.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--f-display",
  axes: ["SOFT", "WONK", "opsz"],
});
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
          <Wordmark size={20} />
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rs-focus rs-press flex h-8 w-8 items-center justify-center rounded-[7px]"
            style={{ color: RS.INK, border: `1px solid ${RS.HAIR}`, background: "var(--rs-surface)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 4.5a7.5 7.5 0 0 1 0 15Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </nav>

      <div className="flex-1">{children}</div>

      <footer className="border-t" style={{ borderColor: RS.HAIR }}>
        <p
          className="mx-auto w-full max-w-2xl px-6 py-6 text-xs leading-relaxed"
          style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }}
        >
          {CUSTODY_LINE}
        </p>
      </footer>
    </div>
  );
}
