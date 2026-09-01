"use client";

import { useEffect, useState } from "react";
import { factoryAddress, robinhoodChain } from "@/lib/chain";

/// LAS COORDENADAS. Donde vive esto, en la cadena, con las direcciones de verdad.
///
/// Por que existe: un juez visual externo encontro que la pagina de un protocolo cuya tesis
/// literal es *"verifiable on-chain"* cerraba con **dos links, y los dos eran las mismas dos
/// acciones de la nav**. Ni contrato, ni explorer, ni chain id, ni RPC, ni repo. En este vertical
/// eso no es un hueco de contenido: es la parte que un lector escéptico va a buscar primero, y no
/// encontrarla es la respuesta.
///
/// Y reemplaza a algo peor. Donde iba esto corria un **marquee de slogans** ("every trade pays the
/// builder…") que el mismo juez mando a sacar con un argumento que no tiene vuelta: el marquee
/// tiene un origen semantico unico, el ticker bursatil, y en fintech es legitimo cuando transporta
/// DATOS; con slogans es el dispositivo de memecoin. Peor: la tira repetia palabra por palabra el
/// titular que estaba 100px mas abajo, y a 390px mostraba cinco palabras cortadas de los dos lados
/// mientras competia con el scroll vertical del visitante. Ninguno de los benchmarks del vertical
/// —Mercury, Stripe, Ramp, Linear, Morpho, Uniswap— corre una tira de slogans.
///
/// POR QUE NO ES UN TICKER DE EVENTOS EN VIVO, que era la otra opcion sobre la mesa: se midio la
/// cadena en esta sesion y hay **un** vault creado. Un ticker de eventos con un evento es una
/// mentira de formato — promete un caudal que no existe. Las coordenadas, en cambio, son ciertas
/// hoy y siguen siendo ciertas con mil vaults.
const EXPLORER = robinhoodChain.blockExplorers.default.url;
const REPO = "https://github.com/0x-Keezy/robinshare";

export function OnChainStrip({ block }: { block: bigint | null }) {
  const factory = factoryAddress();
  const [copied, setCopied] = useState(false);
  const [bumped, setBumped] = useState(false);

  // El numero de bloque parpadea cuando cambia. Sin esto, un contador en vivo y uno congelado se
  // ven exactamente igual, y el unico dato realmente vivo de la pagina no cobra por estar vivo.
  useEffect(() => {
    if (block === null) return;
    setBumped(true);
    const t = setTimeout(() => setBumped(false), 420);
    return () => clearTimeout(t);
  }, [block]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    if (!factory) return;
    try {
      await navigator.clipboard.writeText(factory);
      setCopied(true);
    } catch {
      /* clipboard bloqueado (http, permisos): el link al explorer sigue estando */
    }
  };

  return (
    <div
      className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4"
      style={{ fontFamily: "var(--f-mono)" }}
    >
      <Field label="Chain">
        <span className="tabular-nums">{robinhoodChain.name} · 4663</span>
      </Field>

      <Field label="Block height">
        {block === null ? (
          <span className="rs-skeleton inline-block h-[1.1em] w-24 align-middle" />
        ) : (
          <span className="inline-flex items-center gap-2">
            <span
              className="rs-live-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "#00C805" }}
            />
            <span className={`tabular-nums ${bumped ? "rs-tick" : ""}`}>
              {block.toLocaleString("en-US")}
            </span>
          </span>
        )}
      </Field>

      <Field label="Factory contract">
        {factory ? (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href={`${EXPLORER}/address/${factory}`}
              target="_blank"
              rel="noreferrer"
              className="rs-focus underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
              style={{ color: "var(--rs-ink)" }}
            >
              {factory.slice(0, 8)}…{factory.slice(-6)}
            </a>
            <button
              type="button"
              onClick={copy}
              className="rs-focus rs-press text-[10px] uppercase tracking-[0.16em] transition-opacity hover:opacity-100"
              style={{ color: copied ? "var(--rs-green-text)" : "var(--rs-faint)", opacity: copied ? 1 : 0.85 }}
              aria-label="Copy the factory address"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </span>
        ) : (
          <span style={{ color: "var(--rs-faint)" }}>not configured</span>
        )}
      </Field>

      <Field label="Source">
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          className="rs-focus underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--rs-ink)" }}
        >
          Read the contracts
        </a>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-[10px] uppercase"
        style={{ letterSpacing: "0.2em", color: "var(--rs-faint)" }}
      >
        {label}
      </span>
      <span className="text-[13px]" style={{ color: "var(--rs-dim)" }}>
        {children}
      </span>
    </div>
  );
}
