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
/// EL BUG QUE ESTO DESTAPÓ, y que hay que no repetir: las dos capas estaban en **z-index
/// NEGATIVO** dentro de un `<main>` que pinta un fondo **opaco**. Un hijo con z negativo se pinta
/// ANTES que el fondo en flujo de su ancestro, así que quedaban tapadas: el campo de luz —la capa
/// de material que un juez visual había pedido como defecto #1— **nunca se vio en producción**.
/// Probado sin ambigüedad: pintando la capa de rojo sólido en `-z-20` el píxel de la esquina no
/// cambiaba ni un dígito (17.7,22.4,18.6), y la misma capa a `z-index: 0` daba (84.6,17.4,14.6).
/// Lo que yo venía midiendo como "el fondo se aclaró" era el grano global, que vive en `z-60`.
/// Van a `z-0`, que las deja sobre el fondo de `main` y bajo el contenido, que ya es `relative z-10`.
///
/// TÉCNICA. Escribe custom properties (`--rs-fx/fy/gx/gy`) sobre su propio elemento, y `--rs-field`
/// las consume. La sustitución de custom properties es **perezosa** —se resuelve en el elemento que
/// usa la variable, no donde se declara— así que mover cuatro números acá mueve el degradado sin
/// tocar el token ni re-renderizar React. Todo por rAF y sin estado: un `setState` a 60fps por un
/// fondo sería absurdo.
/// SEGUNDA CAPA: LA PLANCHA GRABADA.
///
/// La luz sola no alcanzaba. Movida, medía: los centros cambian de verdad (probado leyendo las
/// custom properties computadas). Pero el degradado es enorme y vive al 5,5% de opacidad, así que
/// un desplazamiento del centro produce un cambio **real y casi imperceptible** — y si la queja es
/// "se ve estático", algo que sólo se nota amplificando el contraste 9× no la responde.
///
/// Lo que falta no es más luz, es **material que se vea moverse**. Y el material ya existía en el
/// repo sin usarse a fondo: `plate.webp`, un guilloché — la roseta grabada del papel de seguridad de
/// un billete o un certificado. Es exactamente el sustrato de un acta, así que no es textura
/// decorativa: es el papel sobre el que está escrito todo lo demás.
///
/// Gira, y gira porque es una ROSETA: un patrón radial girando lentísimo se lee como un mecanismo
/// de relojería, no como una animación. Más un parallax vertical contra el scroll, que es lo que
/// hace que se perciba como una capa detrás y no como parte de la página.
///
/// POR QUÉ SE SACÓ LA COPIA LOCAL. La plancha ya vivía enmascarada detrás del mecanismo. Dos copias
/// del MISMO patrón radial fino, a escalas y rotaciones distintas, hacen **moiré** — y un moiré
/// sobre un guilloché no se lee como profundidad, se lee como un bug de render. Queda una sola,
/// global.
export function LivingField() {
  const ref = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);

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

      // LA PLANCHA. Parallax vertical contra el scroll (se mueve MENOS que la pagina, que es lo
      // que la delata como capa de atras) mas un giro continuo lentisimo. 0,55 grados por segundo
      // = una vuelta cada ~11 minutos: si te quedas mirando lo notas, si estas leyendo no te
      // molesta. El scroll suma otros 16 grados a lo largo de toda la pagina.
      if (plate.current) {
        const deg = t * 0.55 + cur.sc * 16;
        const shift = cur.sc * -90; // px; negativo = sube mientras la pagina baja
        plate.current.style.transform =
          `translate3d(${(cur.mx * 10).toFixed(1)}px, ${shift.toFixed(1)}px, 0) rotate(${deg.toFixed(2)}deg) scale(1.7)`;
      }
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
    <>
      {/* LA PLANCHA, detras de todo. `scale(1.7)` para que al girar los cantos del cuadrado nunca
          entren al viewport, y la mascara elipsoide la apaga en el centro —justo donde vive el
          texto— y la deja respirar en los bordes: asi hay material visible sin pelearle a la
          lectura. `will-change` porque es la unica capa que transforma en cada frame. */}
      <div
        ref={plate}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[url('/legend/plate.webp')] bg-cover bg-center"
        style={{
          opacity: "var(--rs-plate-bg)",
          mixBlendMode: "var(--rs-plate-blend)" as React.CSSProperties["mixBlendMode"],
          filter: "var(--rs-plate-filter)",
          maskImage: "radial-gradient(52% 46% at 50% 42%, transparent 22%, black 88%)",
          WebkitMaskImage: "radial-gradient(52% 46% at 50% 42%, transparent 22%, black 88%)",
          willChange: "transform",
        }}
      />
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "var(--rs-field)" }}
      />
    </>
  );
}
