"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DIRECTIONS } from "@/lib/directions";

/*
 * COMPARAR — el A/B del bake-off.
 *
 * POR QUE EXISTE. El switcher flotante ya dejaba saltar de una direccion a otra, pero para JUZGAR
 * dos versiones saltar no alcanza: se pierde el punto de comparacion en el salto y hay que
 * acordarse de lo que se vio hace tres segundos. Aca las dos corren al mismo tiempo, en la misma
 * pantalla y en el mismo punto del scroll.
 *
 * EL SCROLL SE SINCRONIZA POR FRACCION, no por pixeles: dos direcciones distintas tienen alturas
 * distintas (la misma pagina puede medir 3.900px en una y 5.900px en otra), asi que igualar
 * `scrollTop` compara secciones que no se corresponden. Por fraccion, el 40% de una queda al lado
 * del 40% de la otra, que es lo que uno quiere mirar.
 *
 * Los iframes van con `?embed=1` para que la direccion adentro no dibuje SU switcher flotante —
 * si no, la vista tendria tres pastillas encimadas.
 */

/// Las tres tintas de `tape` no son direcciones distintas (es el mismo componente con otro bloque
/// de variables), asi que entran al selector como opciones propias con su query.
const OPCIONES = [
  ...DIRECTIONS.map((d) => ({ v: d.code, nombre: d.name, tag: d.tag, url: `/v/${d.code}` })),
  { v: "tape:rojo", nombre: "Tape · tinta roja", tag: "afiche · negro y rojo", url: "/v/tape?tinta=rojo" },
  { v: "tape:papel", nombre: "Tape · impresa", tag: "afiche · papel", url: "/v/tape?tinta=papel" },
];

const ANCHOS = [
  { k: "desktop", label: "Escritorio", w: 1440 },
  { k: "tablet", label: "Tablet", w: 834 },
  { k: "mobile", label: "Teléfono", w: 390 },
] as const;

export default function CompararPage() {
  const [izq, setIzq] = useState("tape");
  const [der, setDer] = useState("tape:rojo");
  const [ancho, setAncho] = useState<(typeof ANCHOS)[number]["k"]>("desktop");
  const [sync, setSync] = useState(true);
  /// La escala se MIDE, no se hardcodea: con un factor fijo el iframe queda flotando en el medio
  /// de su columna con aire muerto a los costados, que es justo lo contrario de lo que sirve para
  /// comparar (ver grande). Se recalcula con el ancho real de la columna.
  const [escala, setEscala] = useState(1);
  const cajaRef = useRef<HTMLDivElement>(null);

  const refIzq = useRef<HTMLIFrameElement>(null);
  const refDer = useRef<HTMLIFrameElement>(null);
  /// Sin esta bandera los dos iframes se empujan entre si: A mueve a B, el scroll de B dispara su
  /// propio handler y vuelve a mover a A. Se marca quien manda y se ignora el eco.
  const mandando = useRef<"izq" | "der" | null>(null);

  useEffect(() => {
    if (!sync) return;
    const pares = [
      ["izq", refIzq, refDer],
      ["der", refDer, refIzq],
    ] as const;
    const limpiezas: (() => void)[] = [];

    for (const [nombre, origen, destino] of pares) {
      const w = origen.current?.contentWindow;
      if (!w) continue;
      const onScroll = () => {
        if (mandando.current && mandando.current !== nombre) return;
        mandando.current = nombre;
        const od = w.document.documentElement;
        const dw = destino.current?.contentWindow;
        if (dw) {
          const dd = dw.document.documentElement;
          const recorrible = od.scrollHeight - od.clientHeight;
          const f = recorrible > 0 ? w.scrollY / recorrible : 0;
          dw.scrollTo(0, f * (dd.scrollHeight - dd.clientHeight));
        }
        window.setTimeout(() => (mandando.current = null), 60);
      };
      w.addEventListener("scroll", onScroll, { passive: true });
      limpiezas.push(() => w.removeEventListener("scroll", onScroll));
    }
    return () => limpiezas.forEach((f) => f());
  }, [sync, izq, der, ancho]);

  const w = ANCHOS.find((a) => a.k === ancho)!.w;

  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    const medir = () => setEscala(Math.min(1, caja.clientWidth / w));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja);
    return () => ro.disconnect();
  }, [w]);

  return (
    <main className="min-h-screen" style={{ background: "#0a0d0a", color: "#edf1ea", fontFamily: "ui-monospace, monospace" }}>
      <header className="sticky top-0 z-20 border-b" style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(10,13,10,0.94)", backdropFilter: "blur(8px)" }}>
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <Link href="/v" className="rs-focus text-xs uppercase tracking-[0.2em]" style={{ color: "#00C805" }}>
            ⌂ Bake-off
          </Link>

          <Selector label="Izquierda" value={izq} onChange={setIzq} />
          <Selector label="Derecha" value={der} onChange={setDer} />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>
              Ancho
            </span>
            {ANCHOS.map((a) => (
              <button
                key={a.k}
                onClick={() => setAncho(a.k)}
                className="rs-focus rounded-full border px-3 py-1 text-[11px]"
                style={
                  ancho === a.k
                    ? { background: "#edf1ea", color: "#0a0d0a", borderColor: "#edf1ea" }
                    : { background: "transparent", color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.22)" }
                }
              >
                {a.label}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
            <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} className="rs-focus" />
            Scroll sincronizado
          </label>

          <button
            onClick={() => {
              setIzq(der);
              setDer(izq);
            }}
            className="rs-focus ml-auto rounded-full border px-3 py-1 text-[11px]"
            style={{ borderColor: "rgba(255,255,255,0.22)", color: "rgba(255,255,255,0.7)" }}
          >
            ⇄ Dar vuelta
          </button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        {([
          ["izq", izq, refIzq],
          ["der", der, refDer],
        ] as const).map(([lado, code, ref]) => {
          const d = OPCIONES.find((x) => x.v === code);
          return (
            <section key={lado} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <div className="text-sm font-semibold">{d?.nombre ?? code}</div>
                <div className="truncate text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {d?.tag}
                </div>
              </div>
              {/* El iframe se dibuja al ancho REAL del dispositivo y despues se escala: asi la
                  direccion adentro cree que esta en un telefono de 390px y dispara sus breakpoints
                  de verdad, en vez de renderizar el layout de escritorio achicado. */}
              <div
                ref={lado === "izq" ? cajaRef : undefined}
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: "rgba(255,255,255,0.16)", height: "78vh" }}
              >
                <div className="h-full w-full overflow-hidden" style={{ display: "flex", justifyContent: "center" }}>
                  <iframe
                    ref={ref}
                    key={`${code}-${ancho}`}
                    src={`${d?.url ?? `/v/${code}`}${(d?.url ?? "").includes("?") ? "&" : "?"}embed=1`}
                    title={d?.nombre ?? code}
                    style={{
                      width: w,
                      // `flexShrink: 0` no es cosmetico: como item de un flex, el iframe se
                      // encogia de sus 1440px de layout a 416 y despues el `scale` lo achicaba
                      // OTRA vez, asi que la pagina quedaba flotando chiquita en el medio de su
                      // columna. El ancho de layout tiene que ser el del dispositivo; el que
                      // ajusta al contenedor es el transform.
                      flexShrink: 0,
                      height: `calc(78vh / ${escala})`,
                      border: "0",
                      transform: `scale(${escala})`,
                      transformOrigin: "top center",
                    }}
                  />
                </div>
              </div>
              <a
                href={d?.url ?? `/v/${code}`}
                target="_blank"
                rel="noreferrer"
                className="rs-focus mt-2 inline-block text-[11px] underline underline-offset-4"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Abrir sola ↗
              </a>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Selector({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rs-focus rounded-md border px-2 py-1 text-[12px]"
        style={{ background: "#12160f", color: "#edf1ea", borderColor: "rgba(255,255,255,0.22)" }}
      >
        {OPCIONES.map((o) => (
          <option key={o.v} value={o.v}>
            {o.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
