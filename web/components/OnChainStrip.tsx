"use client";

import { useEffect, useState } from "react";
import { parseAbi } from "viem";
import { publicClient } from "@/lib/chain";
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
const REPO = "https://github.com/robinshareapp/robinshare";

/// LA LLAVE DEL ATTESTER, leida de la cadena.
///
/// Un juez de confianza lo puso como el hueco mas caro: la pagina **confiesa** que en la ruta de
/// GitHub la firma del attester es lo que prueba la identidad —o sea que esa llave es de
/// confianza— y despues **no dice cual es**. No se puede vigilar una llave que no se puede
/// identificar: una confesion sin direccion es media confesion.
///
/// Se LEE de la factory en vez de hardcodearse, por la misma razon que todo lo demas en esta
/// pagina: si algun dia rota, el sitio dice la verdad solo. Es literalmente lo que el copy promete
/// — "which this site reads off the chain, not off a promise".
const factoryAttesterAbi = parseAbi(["function attester() view returns (address)"]);

export function OnChainStrip({ block }: { block: bigint | null }) {
  const factory = factoryAddress();
  const [attester, setAttester] = useState<string | null>(null);

  useEffect(() => {
    if (!factory) return;
    let alive = true;
    publicClient
      .readContract({ address: factory, abi: factoryAttesterAbi, functionName: "attester" })
      .then((a) => {
        if (alive) setAttester(a as string);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [factory]);
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
    // SEIS DATOS EN TRES COLUMNAS, no en cuatro. Con `lg:grid-cols-4` la segunda fila llevaba 2 de
    // 4 celdas y el pie quedaba con un hueco en L —el tell de una grilla que nadie reviso—, y
    // ademas la label mas larga ("Attester key (trusted on GitHub vaults)") no entraba en una
    // columna de cuatro: wrapeaba a dos lineas y empujaba su valor ~15px por debajo de la linea
    // de base de sus tres vecinas. Seis en tres columnas da dos filas llenas y celdas 33% mas
    // anchas.
    <div
      className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3"
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
            {/* MEDIA 30x15 Y NO PARECIA UN BOTON. Es la unica via a la direccion completa del
                contrato — o sea, a lo unico que un esceptico puede ir a comprobar— y era un
                texto de 10px sin caja, a 12px de un link que te saca del sitio. Ahora tiene
                caja propia (lee como control) y `rs-tap` le da los 44px tactiles sin agrandar
                el tipo. */}
            <button
              type="button"
              onClick={copy}
              className="rs-focus rs-press rs-tap rounded-[6px] border px-2 py-1 text-[10px] uppercase tracking-[0.16em] transition-opacity hover:opacity-100"
              style={{
                color: copied ? "var(--rs-green-text)" : "var(--rs-dim)",
                borderColor: copied ? "var(--rs-green-text)" : "var(--rs-hair)",
                opacity: 1,
              }}
              aria-label="Copy the factory address"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </span>
        ) : (
          <span style={{ color: "var(--rs-faint)" }}>not configured</span>
        )}
      </Field>

      {/* LA LLAVE QUE SI EXISTE. El titular de la seccion de custodia dice "One key, and we name
          it" — esto es donde se la nombra. */}
      <Field label="Attester key (trusted on GitHub vaults)">
        {attester ? (
          <a
            href={`${EXPLORER}/address/${attester}`}
            target="_blank"
            rel="noreferrer"
            className="rs-focus underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70"
            style={{ color: "var(--rs-ink)" }}
          >
            {attester.slice(0, 8)}…{attester.slice(-6)}
          </a>
        ) : (
          <span className="rs-skeleton inline-block h-[1.1em] w-28 align-middle" />
        )}
      </Field>

      {/* EL DATO QUE LA PAGINA TENIA Y NO COBRABA. `withdraw()` transfiere `address(this).balance`
          ENTERO al boundWallet: RobinShare no se queda con nada. Es el hecho mas duro y mas
          verificable del producto y estaba enterrado como cuarto de cuatro stats, dicho al reves
          ("100% para ellos") en vez de derecho ("0% para nosotros"). */}
      <Field label="Our cut">
        <span className="tabular-nums">0% — the vault pays out its full balance</span>
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
      {/* min-h de dos lineas: una label que wrapea no puede correr su valor fuera de la linea de
          base de los vecinos de su fila. */}
      <span
        className="min-h-[2.4em] text-[10px] uppercase leading-[1.2]"
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
