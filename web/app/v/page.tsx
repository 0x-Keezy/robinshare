import Link from "next/link";
import Image from "next/image";
import { DIRECTIONS } from "@/lib/directions";

export const metadata = { title: "FLEDGE — bake-off: elegí el mundo" };

/*
 * HUB del bake-off: todas las versiones, un click. Neutro (no compite con los mundos).
 */
export default function VersionsHub() {
  const v2 = DIRECTIONS.filter((d) => d.gen === 2);
  const v1 = DIRECTIONS.filter((d) => d.gen === 1);

  return (
    <main className="min-h-screen" style={{ background: "#0a0d0a", color: "#edf1ea" }}>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-14">
        <div style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.26em", color: "#00C805" }} className="text-xs uppercase">
          FLEDGE · Robin Hood bake-off
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Elegí el mundo<span style={{ color: "#00C805" }}>.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px]" style={{ color: "rgba(237,241,234,0.65)" }}>
          Seis registros del mismo producto — el movimiento es la mitad de la historia: entrá,
          scrolleá, y saltá entre versiones con el switcher flotante de abajo.
        </p>

        <h2 style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.22em", color: "rgba(237,241,234,0.5)" }} className="mt-12 text-[11px] uppercase">
          Bake-off v2 — los seis
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {v2.map((d) => (
            <Link
              key={d.code}
              href={`/v/${d.code}`}
              className="group overflow-hidden rounded-2xl border transition-transform hover:-translate-y-1"
              style={{ borderColor: "rgba(237,241,234,0.14)", background: "#11150f" }}
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={`/versions/${d.code}.jpg`}
                  alt={d.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <div className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-xl font-bold">{d.name}</h3>
                  <span style={{ fontFamily: "ui-monospace, monospace", color: "#00C805" }} className="text-[11px] uppercase tracking-[0.08em]">
                    {d.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(237,241,234,0.6)" }}>
                  {d.d}
                </p>
                <div className="mt-3 text-sm font-semibold" style={{ color: "#00C805" }}>
                  Entrar →
                </div>
              </div>
            </Link>
          ))}
        </div>

        <h2 style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.22em", color: "rgba(237,241,234,0.4)" }} className="mt-14 text-[11px] uppercase">
          Archivo v1
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {v1.map((d) => (
            <Link
              key={d.code}
              href={`/v/${d.code}`}
              className="group flex items-center gap-4 rounded-xl border p-3 transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              style={{ borderColor: "rgba(237,241,234,0.1)" }}
            >
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg">
                <Image src={`/versions/${d.code}.jpg`} alt={d.name} fill sizes="96px" className="object-cover" />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "rgba(237,241,234,0.85)" }}>
                  {d.name}
                </div>
                <div style={{ fontFamily: "ui-monospace, monospace", color: "rgba(237,241,234,0.45)" }} className="text-[10px] uppercase">
                  {d.tag}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-14 text-xs leading-6" style={{ fontFamily: "ui-monospace, monospace", color: "rgba(237,241,234,0.4)" }}>
          Producción: cada versión sale a su subdominio con NEXT_PUBLIC_DIRECTION
          (scripts/deploy-bakeoff.sh). Este hub y el switcher viven solo en /v.
        </p>
      </div>
    </main>
  );
}
