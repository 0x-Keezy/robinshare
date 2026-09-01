"use client";

import { useEffect, useRef } from "react";

/// EL CAMPO VIVO — la luz de fondo deja de estar clavada.
///
/// POR QUÉ. Jose: *"creo que el background es muy estático"*, y tenía razón de forma literal: el
/// fondo era **un degradado fijo** más un grano que tampoco se mueve. Nada en toda la página cambia
/// si el visitante se queda quieto, y como la luz venía siempre del mismo punto, el ojo la deja de
/// registrar a los dos segundos y vuelve a leer "fondo plano".
///
/// LAS TRES FUENTES DE MOVIMIENTO, en orden de importancia:
///
///  1. **El SCROLL** — la principal, y la única que existe en mobile. La luz **desciende** a medida
///     que se baja: arriba entra desde arriba del hero, y hacia el footer ya alumbra desde el
///     costado. Es la fuente honesta: el visitante mueve la página y la página responde.
///  2. **El PUNTERO** — sólo donde hay uno. Corre el foco unos pocos por ciento hacia el cursor,
///     con muchísima inercia. No es un spotlight que persigue al mouse (ese efecto es de portfolio
///     de 2021 y grita "demo"): es una lámpara pesada que tarda en girar.
///  3. **UNA RESPIRACIÓN LENTA** — un seno de ~34 segundos, de ±2%. Es lo único autónomo, y existe
///     por una razón concreta: sin ella, un visitante que se queda leyendo sin mover nada vuelve a
///     ver una imagen congelada, que es exactamente la queja. A esa amplitud y ese período **no se
///     percibe como animación**; se percibe como que la página está encendida.
///
/// LO QUE NO HACE, A PROPÓSITO. No pulsa, no cambia de color, no tiene blobs que floten. El
/// playbook del vertical es explícito: en DeFi/fintech el movimiento decorativo **resta crédito**, y
/// un degradado que se PERCIBE moviéndose es glow. La prueba de que está bien calibrado es que si
/// mirás fijo no ves nada moverse, pero si comparás dos capturas separadas por unos segundos, los
/// centros cambiaron.
///
/// TÉCNICA. Escribe custom properties (`--rs-fx/fy/gx/gy`) sobre su propio elemento, y `--rs-field`
/// las consume. La sustitución de custom properties es **perezosa** —se resuelve en el elemento que
/// usa la variable, no donde se declara— así que mover cuatro números acá mueve el degradado sin
/// tocar el token ni re-renderizar React. Todo por rAF y sin estado: un `setState` a 60fps por un
/// fondo sería absurdo.
export function LivingField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    // objetivo y valor actual, para que todo llegue con inercia y nada persiga al pixel
    const target = { mx: 0, my: 0 };
    const cur = { mx: 0, my: 0, sc: 0 };
    let running = true;

    const onMove = (e: PointerEvent) => {
      // sólo con un puntero de verdad: en táctil, `pointermove` llega durante el scroll y haría
      // saltar la luz con cada arrastre
      if (e.pointerType !== "mouse") return;
      target.mx = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      target.my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      if (!running) return;
      raf = requestAnimationFrame(tick);

      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const sc = Math.min(1, Math.max(0, window.scrollY / max));

      // inercia: 0.045 para el puntero (lámpara pesada), 0.08 para el scroll (algo más atento)
      cur.mx += (target.mx - cur.mx) * 0.045;
      cur.my += (target.my - cur.my) * 0.045;
      cur.sc += (sc - cur.sc) * 0.08;

      const t = performance.now() / 1000;
      const breath = Math.sin(t / 5.4); // ~34 s de período completo
      const breath2 = Math.cos(t / 7.1);

      // el foco principal: nace arriba del hero y BAJA con el scroll; el puntero lo corre de lado
      const fx = 50 + cur.mx * 7 + breath * 2;
      const fy = -6 + cur.sc * 46 + cur.my * 4 + breath2 * 2;
      // el soplo verde va al revés en horizontal: la contraposición es lo que da profundidad de
      // capas, y si las dos se movieran juntas se leerían como una sola imagen desplazándose
      const gx = 88 - cur.mx * 9 - breath * 3;
      const gy = 8 + cur.sc * 26 - breath2 * 2;

      el.style.setProperty("--rs-fx", `${fx.toFixed(2)}%`);
      el.style.setProperty("--rs-fy", `${fy.toFixed(2)}%`);
      el.style.setProperty("--rs-gx", `${gx.toFixed(2)}%`);
      el.style.setProperty("--rs-gy", `${gy.toFixed(2)}%`);
    };
    raf = requestAnimationFrame(tick);

    // no gastar frames con la pestaña oculta
    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: "var(--rs-field)" }}
    />
  );
}
