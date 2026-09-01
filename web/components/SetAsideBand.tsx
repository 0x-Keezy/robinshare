"use client";

import { useEffect, useRef, useState } from "react";

/// EL INSTRUMENTO: la marca a escala arquitectonica.
///
/// Por que existe. Un juez visual externo midio la pagina y el numero que dolio no fue el
/// puntaje: fue que **1 de 6 ejes** era propio. Tipografia prestada, paleta prestada, estructura
/// de hero prestada, assets inexistentes, wow ausente. Lo unico propio era el copy. Su diagnostico
/// literal: *"no es el molde generico, es el molde correcto sin construir"*. Y el fix que nombro
/// es el que esta abajo: **la unica imagen que este producto puede tener y que nadie puede pegar
/// en otro sitio es la ruta fee → persona.**
///
/// Asi que esto no es una ilustracion decorativa: es `SetAsideMark` —la marca, una barra con una
/// porcion cortada y sostenida fuera del eje— dibujada a 900px de ancho en vez de a 20. La marca
/// ya contaba el mecanismo; lo que faltaba era darle el tamaño de un artefacto en vez del de un
/// favicon. Por eso la geometria es IDENTICA a la del mark (misma proporcion de corte, mismo
/// desplazamiento hacia abajo y a la izquierda): si fueran dos dibujos distintos, serian dos
/// simbolos compitiendo, que es exactamente el error que ya se cometio con el arco.
///
/// POR QUE NO LLEVA EL LIMA. Es el elemento mas importante de la pagina y da la tentacion de
/// gastarle el acento encima. No: el presupuesto de lima es de UN uso decorativo y ya esta puesto
/// en el `100%` del stat, que es la misma idea dicha en numero. Aca el climax lo da el CONTRASTE
/// —la porcion apartada es lo mas brillante del bloque, la barra vive al 30%— que es como lo
/// resuelven Mercury/Linear/Ramp: casi monocromo, un solo acento en toda la pagina.
///
/// POR QUE NO ES AUTOPLAY. El playbook del vertical es explicito: el wow Tier-1 responde al INPUT
/// del usuario. El corte se separa **con el scroll**, no en un loop. Si el visitante no scrollea,
/// no pasa nada; si scrollea despacio, ve la porcion salir despacio. El movimiento es la lectura,
/// no un adorno que corre al lado.
///
/// HTML/CSS y no SVG a proposito: en SVG con viewBox las etiquetas escalan con el dibujo, asi que
/// la misma tipografia terminaria a un cuerpo distinto en cada breakpoint. Aca la geometria escala
/// y el texto no, que es lo que hace un instrumento de verdad.

/// Donde arranca y termina el corte, en % del ancho de la barra. No es 50%: un corte al medio lee
/// como "partido en dos", no como "se aparto una parte".
///
/// El ancho es un compromiso deliberado entre dos verdades. En el mark, la porcion es enorme
/// respecto del resto (5 contra 12) porque a 20px tiene que LEERSE; a 900px, esa misma proporcion
/// afirmaria que el corte es un tercio del trade, que es falso. Y al reves, un corte del 2% real
/// seria invisible. 12% es el punto donde el gesto se lee sin mentir sobre la economia — y ademas
/// el numero real lo fija cada quien al lanzar, asi que el dibujo no puede clavar uno.
const CUT_START = 70;
const CUT_WIDTH = 12;

export function SetAsideBand({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    // Con reduced-motion el instrumento se muestra ARMADO (p=1), no apagado: el diagrama es
    // contenido, no decoracion, asi que quien pide menos movimiento igual tiene que poder leerlo.
    if (reduce) {
      setP(1);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let cur = 0;
    let running = false;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 cuando el bloque entra por abajo, 1 cuando su centro llega al 46% de la pantalla.
      const t = (vh * 0.9 - r.top) / (vh * 0.44);
      return Math.max(0, Math.min(1, t));
    };

    const tick = () => {
      const target = measure();
      cur += (target - cur) * 0.12; // suavizado: el corte tiene inercia, no persigue al pixel
      setP(cur);
      if (Math.abs(target - cur) > 0.0015) {
        raf = requestAnimationFrame(tick);
      } else {
        setP(target);
        running = false;
      }
    };
    const kick = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    // IntersectionObserver para no correr rAF cuando el bloque no se ve.
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) kick();
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
    };
  }, [reduce]);

  // Curva de salida: el corte sale rapido y se ASIENTA, no llega a velocidad constante.
  const e = 1 - Math.pow(1 - p, 3);

  // CUANTO BAJA LA PORCION, en multiplos de la altura de la barra.
  //
  // La primera version bajaba 52px contra una barra de 46px, o sea que al terminar quedaba **6px
  // por debajo** de la barra. Un juez visual lo midio y el diagnostico fue exacto: a esa distancia
  // no lee como "se aparto una pieza", lee como "la barra tiene un escalon" — y peor, la silueta
  // (rectangulos de radio 2 con un gap, bajo contraste) es la de un **skeleton loader**, asi que
  // el riesgo no era verse feo sino parecer que la pagina no cargo.
  //
  // 1.8x la altura de barra deja un vano de 0.8x entre las dos piezas: suficiente para que el
  // hilo de procedencia tenga recorrido visible y para que la separacion sea inequivoca.
  const DROP_FACTOR = 1.8;
  const dropPx = `calc(var(--rs-bar-h) * ${(DROP_FACTOR * e).toFixed(3)})`;
  const gapPx = `calc(var(--rs-bar-h) * ${((DROP_FACTOR - 1) * e).toFixed(3)})`;
  // % de ancho que se corre a la izquierda: EXACTAMENTE su propio ancho, de modo que el canto
  // derecho de la porcion queda justo debajo del canto izquierdo del hueco. Asi el hilo de
  // procedencia es una sola vertical limpia en vez de una L — y la L, probada, no se veia: su
  // tramo horizontal corria por debajo de la porcion, que lo tapaba entera.
  const shift = e * CUT_WIDTH;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* ── la escala: lo unico "de acta" que queda ─────────────────────────
          La primera version rayaba la barra POR DENTRO con una pauta cada 14px, buscando lenguaje
          de libro mayor. A 900px de ancho eso no leia como pauta: leia como **codigo de barras**,
          y encima era exactamente el pecado que este trabajo vino a corregir — decoracion agregada
          para tapar que no habia idea. La medicion vive ahora AFUERA y arriba, espaciada, como la
          escala de un instrumento; y la barra queda limpia, que es lo que deja que el corte se
          lea. */}
      <div className="flex items-end justify-between gap-4">
        <span
          className="text-[10px] uppercase sm:text-[11px]"
          style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.2em", color: "var(--rs-faint)" }}
        >
          Every trade on the coin
        </span>
      </div>
      <div
        aria-hidden
        className="mt-3 h-2 w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--rs-edge-top) 0 1px, transparent 1px 4.1666%)",
          maskImage: "linear-gradient(180deg, transparent, black)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, black)",
          opacity: 0.5 + e * 0.5,
        }}
      />

      {/* ── EL INSTRUMENTO ─────────────────────────────────────────────────
          La altura de la barra vive en una custom property y no en dos clases sueltas: la porcion
          y su etiqueta se posicionan CALCULANDO sobre ella, asi que si el breakpoint cambia la
          altura, las tres cosas siguen alineadas. Antes la etiqueta usaba el valor de desktop
          hardcodeado y en mobile quedaba 8px corrida. */}
      <div className="relative mt-2 h-[160px] [--rs-bar-h:38px] sm:h-[192px] sm:[--rs-bar-h:46px]">
        <div className="absolute inset-x-0 top-0 h-[var(--rs-bar-h)]">
          {/* la barra: dos piezas, con la muesca donde estaba la porcion */}
          <BarPiece left={0} width={CUT_START} />
          <BarPiece left={CUT_START + CUT_WIDTH} width={100 - CUT_START - CUT_WIDTH} />

          {/* LA MUESCA. Tiene que leerse como un hueco donde ANTES habia material, no como un
              espacio que siempre estuvo vacio. Por eso los dos cantos del corte se iluminan un
              poco (son cantos frescos) y el fondo del hueco es mas oscuro que la pagina. */}
          <div
            aria-hidden
            className="absolute inset-y-0"
            style={{
              left: `${CUT_START}%`,
              width: `${CUT_WIDTH}%`,
              opacity: e,
              background: "var(--rs-notch)",
              boxShadow: "inset 1px 0 0 var(--rs-edge-top), inset -1px 0 0 var(--rs-edge-top)",
            }}
          />

          {/* EL HILO DE PROCEDENCIA. Sin esto, la porcion de abajo es otro objeto; con esto, es la
              misma que salio de arriba. Una sola vertical que baja por el canto izquierdo del
              hueco y termina en el canto derecho de la porcion. Se apaga hacia abajo: es un
              rastro, no un cable. */}
          <div
            aria-hidden
            className="absolute w-px"
            style={{
              left: `${CUT_START}%`,
              top: "100%",
              height: gapPx,
              background: "linear-gradient(180deg, var(--rs-edge-top), transparent)",
              opacity: Math.min(1, e * 1.5),
            }}
          />
        </div>

        {/* LA PORCION APARTADA. Lo mas brillante del bloque: el ojo tiene que terminar aca.
            Sin rayado —es la pieza extraida, esta limpia— y con la misma altura y radio que la
            barra, para que se lea como un PEDAZO de ella y no como una tarjeta nueva. */}
        <div
          className="absolute top-0 h-[var(--rs-bar-h)] rounded-[2px]"
          style={{
            left: `calc(${CUT_START}% - ${shift}%)`,
            width: `${CUT_WIDTH}%`,
            transform: `translateY(${dropPx})`,
            // Mismo material que la barra, pero ENCENDIDO: el borde de arriba es el mas claro y el
            // de abajo se apaga, igual que en las piezas oscuras. Solida y plana leia como una
            // tarjeta en blanco; con la caida de luz lee como un bloque del mismo cuerpo.
            background: "var(--rs-slice)",
            boxShadow:
              e > 0.05
                ? "inset 0 -1px 0 rgba(0,0,0,0.16), 0 16px 30px -16px rgba(0,0,0,0.85)"
                : "none",
          }}
        />

        {/* Etiqueta de la porcion: aparece cuando ya se separo, no antes. Va CENTRADA bajo la
            pieza. Alineada al canto izquierdo, como estaba, se extendia hacia la derecha hasta
            quedar debajo del hueco, asi que nombraba ambiguamente a las dos cosas. */}
        <div
          className="absolute text-[10px] uppercase sm:text-[11px]"
          style={{
            fontFamily: "var(--f-mono)",
            letterSpacing: "0.18em",
            color: "var(--rs-ink)",
            left: `calc(${CUT_START - shift + CUT_WIDTH / 2}%)`,
            top: `calc(var(--rs-bar-h) * ${(1 + DROP_FACTOR * e).toFixed(3)} + 14px)`,
            opacity: Math.max(0, e * 1.8 - 0.8),
            transform: `translate(-50%, ${(1 - e) * 6}px)`,
            whiteSpace: "nowrap",
          }}
        >
          <span className="hidden sm:inline">Set aside for the builder</span>
          <span className="sm:hidden">Their vault</span>
        </div>
      </div>

      {/* ── pie: la regla base y la lectura en palabras ───────────────────── */}
      <div className="h-px w-full" style={{ background: "var(--rs-rule)" }} />
      {/* Las dos aserciones van a los extremos del ancho, no separadas por un gap. Con un
          `gap-x-8`, mismo peso y mismo color, a golpe de vista leian como UNA sola frase rota al
          medio. A extremos opuestos se leen como dos, y ademas riman con el instrumento de
          arriba, que tambien trabaja entre sus dos puntas. */}
      <div
        className="mt-3 flex flex-col gap-1 text-[10px] uppercase sm:flex-row sm:items-baseline sm:justify-between sm:text-[11px]"
        style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.2em", color: "var(--rs-faint)" }}
      >
        <span>The cut is fixed at launch</span>
        <span>Only they can claim it</span>
      </div>
    </div>
  );
}

/// Una pieza de la barra. El material sale de los tokens: borde superior que atrapa luz, borde
/// inferior que no. Un `1px solid` uniforme era justo lo que hacia leer la pagina como "plano con
/// hairlines"; el borde asimetrico es lo que hace que una superficie se sienta fisica.
function BarPiece({ left, width }: { left: number; width: number }) {
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 rounded-[2px]"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        // Token propio, no `--rs-surface-hi` reciclado. Con la superficie generica, en tema claro
        // la barra quedaba a 6% de tinta sobre papel y el HUECO a 16%: el orden de valor se
        // invertia y el vano pesaba mas que el material del que salio, o sea el dibujo al reves.
        // La regla que tiene que sobrevivir a los dos temas es: hueco = valor del papel · barra =
        // un paso desde el papel · porcion = contraste maximo.
        background: "var(--rs-bar)",
        borderTop: "1px solid var(--rs-edge-top)",
        borderBottom: "1px solid var(--rs-edge-bot)",
        boxShadow: "var(--rs-lift)",
      }}
    />
  );
}
