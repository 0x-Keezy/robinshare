"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

// Lee el tema real recién en el efecto — el valor inicial "dark" coincide con
// el default de primera visita, así que no hay mismatch de hidratación. El
// script anti-flash de layout.tsx ya pintó el color correcto por CSS antes de
// este punto; este hook solo existe para dibujar el ícono correcto del toggle.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-robinshare-theme");
    if (attr === "light" || attr === "dark") setTheme(attr);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-robinshare-theme", next);
      try {
        localStorage.setItem("robinshare-theme", next);
      } catch {
        // localStorage puede fallar en modo privado — el toggle sigue
        // funcionando para esta sesión, solo no persiste.
      }
      return next;
    });
  };

  return { theme, toggle };
}
