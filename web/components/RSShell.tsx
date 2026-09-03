"use client";

import { Fraunces, Archivo, IBM_Plex_Mono } from "next/font/google";
import { Wordmark } from "@/components/Wordmark";
import { useTheme } from "@/lib/useTheme";
import { CUSTODY_LINE_PARTS } from "@/lib/claims";

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
      {/* LA MARCA NO PUEDE SALTAR EN EL CAMINO DE CONVERSION. La nav de la home usa el contenedor
          ancho y esta usaba `max-w-2xl`, asi que el wordmark se corria 176-240px de lado al pasar
          de / a /create — en escritorio quedaba varado a un tercio de la pantalla mientras la
          regla del nav cruzaba entera. El chrome comparte contenedor con la home (`rs-shell`); lo
          que sigue angosto es el CONTENIDO, que es lo que se lee. */}
      <nav className="border-b" style={{ borderColor: RS.HAIR }}>
        <div className="rs-shell flex items-center justify-between py-4">
          <Wordmark size={20} />
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="rs-focus rs-press rs-tap flex h-8 w-8 items-center justify-center rounded-[7px]"
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

      {/* LA LETRA CHICA, ETIQUETADA — igual que en la home, y por la misma razon.
          Aca seguia siendo lo que un juez visual ya habia mandado a arreglar en la home: un muro
          de veinte lineas de mono a 12px al 50% de opacidad. Y estaba justo en las DOS paginas
          donde el visitante compromete plata o prueba su identidad, que es donde mas importa que
          se lea. El texto es identico —salen del mismo `CUSTODY_LINE_PARTS`, y `test/copy.test.ts`
          exige que su concatenacion sea la constante entera—; lo que cambia es que cada clausula
          lleva su etiqueta y sale del mono. En telefono va en una columna, de 640 en dos. */}
      <footer className="border-t" style={{ borderColor: RS.HAIR }}>
        <div className="rs-shell grid gap-x-10 gap-y-5 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {CUSTODY_LINE_PARTS.map((part) => (
            <div key={part.label} className="flex flex-col gap-1.5">
              <span
                className="text-[11px] font-semibold uppercase"
                style={{ letterSpacing: "0.07em", color: RS.INK }}
              >
                {part.label}
              </span>
              <p className="text-[13px] leading-relaxed" style={{ color: RS.DIM }}>
                {part.body.trim()}
              </p>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
