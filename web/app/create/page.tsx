"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEther, type Address, type Hex } from "viem";
import { useAccount, useConnect, useSwitchChain, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { publicClient, factoryAddress, robinhoodChain } from "@/lib/chain";
import { escrowAbi, factoryAbi } from "@/lib/abis";
import {
  PONS_LAUNCH_FACTORY,
  PONS_LAUNCH_CONFIG_ID,
  PONS_NATIVE_PAIR,
  EXPECTED_LAUNCH_FEE,
  MAX_CREATOR_TAX_BPS,
  ponsAbi,
  identityTypeId,
  buildTokenParams,
  randomSalt,
  vaultFromReceiptLogs,
  launchFromReceiptLogs,
  ponsRevertHint,
  type IdentityType,
  type LaunchIdentity,
} from "@/lib/pons";
import { AUDIT_LINE, connectErrorHint } from "@/lib/claims";
import { RSShell, RS } from "@/components/RSShell";

const inputCls = "w-full border-0 border-b-2 bg-transparent py-2 placeholder:opacity-35 focus:outline-none";
const inputStyle = { borderColor: RS.INK, color: RS.INK, fontFamily: "var(--f-mono)" } as const;
const labelStyle = { fontFamily: "var(--f-mono)", color: RS.FAINT, letterSpacing: "0.16em" } as const;

/// Progreso del launch. Se guarda en estado a proposito: el flujo son TRES transacciones y si
/// una falla no hay que rehacer las anteriores. Un vault sin token es inofensivo (nunca recibe
/// fees), pero volver a crearlo seria tirar gas y dejar un vault huerfano de mas.
type Progress = {
  vault?: Address;
  token?: Address;
  curve?: Address;
  attached?: boolean;
  /// A QUE IDENTIDAD pertenece el vault guardado. Sin esto, retomar un launch a medias con otro
  /// handle en el formulario lanzaba la moneda nueva apuntando al vault de la identidad ANTERIOR
  /// — o sea, las fees de la moneda de Alice cobrables por Bob, de forma irreversible.
  identityKey?: string;
};

/// Clave estable de una identidad, para comparar el formulario contra lo que quedo guardado.
function identityKeyOf(type: IdentityType, handle: string, wallet: string): string {
  return type === "wallet" ? `wallet:${wallet.toLowerCase()}` : `${type}:${handle.trim().toLowerCase()}`;
}

/// El progreso se guarda TAMBIEN en localStorage, no solo en estado de React.
///
/// El flujo son tres transacciones. Con estado en memoria alcanzaba para reintentar una que
/// fallo, pero un F5 entre la segunda y la tercera perdia la direccion del token — y sin ella
/// nadie puede atar el vault a su curva, asi que las fees se acumulan sin ruta de salida hasta
/// que alguien la desentierre del historial del explorer.
const PROGRESS_KEY = "robinshare:launch-progress:v1";

function loadProgress(owner?: Address): Progress {
  if (typeof window === "undefined" || !owner) return {};
  try {
    const raw = window.localStorage.getItem(`${PROGRESS_KEY}:${owner.toLowerCase()}`);
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

function saveProgress(owner: Address | undefined, p: Progress) {
  if (typeof window === "undefined" || !owner) return;
  try {
    const k = `${PROGRESS_KEY}:${owner.toLowerCase()}`;
    if (p.attached || (!p.vault && !p.token)) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, JSON.stringify(p));
  } catch {
    // modo incognito / storage bloqueado: se sigue sin persistencia, no es fatal
  }
}

export default function CreatePage() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [type, setType] = useState<IdentityType>("github");
  const [handle, setHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const [recoveryDays, setRecoveryDays] = useState("0");
  // % de cada trade que va al vault, sobre el fee base de pons. Tope leido EN VIVO de
  // `maxCreatorTaxBps()` (hoy 1000 bps = 10%); pons revierte CreatorTaxTooHigh por encima.
  // Default CERO, y no es desidia: con 0 el token muestra el mismo 1% que cualquier otro de pons,
  // y el builder IGUAL cobra 0,70% del volumen (el 70% del fee base que pons reparte al creador).
  // El default anterior era 3, que hace que la pagina de pons muestre 4% — y el token de prueba,
  // lanzado con 10, mostro "11% / 11%" contra el 1% de un token normal. Un tax alto espanta al
  // que compra, y sin volumen el builder no cobra nada de todos modos.
  const [taxPct, setTaxPct] = useState(0);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [launchFee, setLaunchFee] = useState<bigint | null>(null);
  const [maxTaxBps, setMaxTaxBps] = useState<number>(MAX_CREATOR_TAX_BPS);
  const [launchOpen, setLaunchOpen] = useState<boolean | null>(null);

  const factory = factoryAddress();
  const wrongChain = isConnected && walletChainId !== robinhoodChain.id;

  // recuperar un launch a medias tras un reload
  useEffect(() => {
    if (!address) return;
    const saved = loadProgress(address);
    if (saved.vault || saved.token) setProgress(saved);
  }, [address]);

  useEffect(() => {
    saveProgress(address, progress);
  }, [address, progress]);

  /// Se lee la config VIVA de pons, no la constante: `launchFee` y `maxCreatorTaxBps` son estado
  /// mutable de un Safe 2-de-3. Hardcodearlas haria que el dia que las muevan todo launch
  /// revierta `LaunchFeeNotPaid` sin explicacion.
  const loadPonsConfig = useCallback(async () => {
    try {
      const [fee, maxTax, open] = await Promise.all([
        publicClient.readContract({ address: PONS_LAUNCH_FACTORY, abi: ponsAbi, functionName: "launchFee" }),
        publicClient.readContract({ address: PONS_LAUNCH_FACTORY, abi: ponsAbi, functionName: "maxCreatorTaxBps" }),
        publicClient.readContract({ address: PONS_LAUNCH_FACTORY, abi: ponsAbi, functionName: "launchEnabled" }),
      ]);
      setLaunchFee(fee as bigint);
      setMaxTaxBps(Number(maxTax as bigint));
      setLaunchOpen(open as boolean);
    } catch {
      // sin RPC la pagina sigue usable; el launch fallara con un error claro de la cadena
    }
  }, []);

  useEffect(() => {
    loadPonsConfig();
  }, [loadPonsConfig]);

  async function create() {
    setMsg(null);
    if (!factory) return setMsg("NEXT_PUBLIC_FACTORY_ADDRESS is not configured.");
    if (!isConnected || !address) return setMsg("Connect your wallet first.");

    // GUARD DE CADENA. wagmi no lo hace solo: `writeContract` sin `chainId` resuelve la cadena
    // del conector y desactiva su propia asercion, asi que una wallet parada en Ethereum manda
    // la transaccion IGUAL — a una direccion que ahi no tiene codigo, o sea que no revierte, se
    // come el gas, y despues esta pagina espera un receipt en 4663 que no va a existir nunca.
    // Robinhood Chain no viene cargada en ninguna wallet por default: estar en la cadena
    // equivocada es el estado NORMAL de alguien que entra por primera vez.
    if (walletChainId !== robinhoodChain.id) {
      try {
        setBusy("Switching to Robinhood Chain…");
        await switchChainAsync({ chainId: robinhoodChain.id });
      } catch {
        setBusy(null);
        return setMsg(
          `Your wallet is on the wrong network. Switch it to Robinhood Chain (chain ${robinhoodChain.id}) and try again.`,
        );
      } finally {
        setBusy(null);
      }
    }

    const recipientWallet = (type === "wallet" ? wallet || address : address) as Address;
    if (type === "wallet" && !/^0x[0-9a-fA-F]{40}$/.test(recipientWallet)) {
      return setMsg("That recipient wallet is not a valid address.");
    }
    if (type !== "wallet" && !handle.trim()) {
      return setMsg("Enter the GitHub handle.");
    }
    const days = Number(recoveryDays);
    if (!Number.isInteger(days) || days < 0 || (days !== 0 && days < 30) || days > 3650) {
      return setMsg("Recovery must be 0 (never) or between 30 and 3650 days.");
    }

    // Con recovery habilitado, un handle que NADIE puede reclamar convierte el clawback
    // opcional del launcher en uno garantizado — el ataque que el producto existe para impedir.
    // El contrato valida el charset pero no puede saber si la cuenta existe. Sólo se bloquea con
    // un "no existe" DEFINITIVO: si GitHub no contesta, se deja pasar (bloquear por un GitHub
    // caído sería peor que el riesgo). Con `recoveryDays = 0`, que es el default, ni se consulta.
    if (days > 0 && type === "github") {
      setBusy("Checking the handle exists…");
      try {
        const r = await fetch(`/api/github-handle?login=${encodeURIComponent(handle.trim())}`);
        const j = await r.json();
        if (j.exists === false) {
          setBusy(null);
          return setMsg(
            `github.com/${handle.trim()} does not exist. With a recovery window set, a coin launched for a name nobody can claim becomes a guaranteed clawback for you — which is exactly what this product exists to prevent. Fix the handle, or set recovery to 0.`,
          );
        }
      } catch {
        // no se pudo averiguar: se sigue
      }
      setBusy(null);
    }

    // El tope se valida contra el valor VIVO, no contra la constante: si pons lo baja, los
    // botones de preset se esconden pero el estado por default seguiria mandando 300 bps y la
    // transaccion revertiria CreatorTaxTooHigh DESPUES de que `createVault` ya gasto gas.
    if (Math.round(taxPct * 100) > maxTaxBps) {
      return setMsg(
        `pons currently caps the creator tax at ${maxTaxBps / 100}%. Pick a lower one.`,
      );
    }

    const identity: LaunchIdentity =
      type === "wallet"
        ? { type: "wallet", wallet: recipientWallet }
        : { type, handle: handle.trim() };

    let step: Progress = { ...progress };
    try {
      // ── Tx 1 · el VAULT va primero ───────────────────────────────────────────────
      // La creation code de la curva de pons incluye el `creatorFeeRecipient`, asi que la
      // direccion del token depende de la del vault: no se puede predecir al reves. Por eso el
      // orden es fijo y no hay un orquestador de una sola transaccion.
      const currentKey = identityKeyOf(type, handle, recipientWallet);
      if (step.vault && step.identityKey && step.identityKey !== currentKey) {
        // El vault guardado es de OTRA identidad. Seguir lanzaria la moneda nueva apuntandole
        // las fees a esa otra persona, y `attachToken` es de una sola vez: irreversible.
        return setMsg(
          `You have an unfinished launch for "${step.identityKey}", but the form now says "${currentKey}". Finish the old one with its original details, or discard it below — otherwise the new coin would pay the previous identity.`,
        );
      }

      if (!step.vault) {
        setBusy("1/3 · Creating the vault…");
        const vaultTx = await writeContractAsync({
          address: factory,
          abi: factoryAbi,
          chainId: robinhoodChain.id,
          functionName: "createVault",
          args: [identityTypeId(type), type === "wallet" ? "" : handle.trim(), type === "wallet" ? recipientWallet : ("0x0000000000000000000000000000000000000000" as Address), BigInt(days)],
        } as never);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: vaultTx });
        const vault = vaultFromReceiptLogs(receipt.logs, factory);
        if (!vault) throw new Error("The vault transaction confirmed but emitted no VaultCreated event.");
        step = { ...step, vault, identityKey: currentKey };
        setProgress(step);
      }

      // ── Tx 2 · el LAUNCH en pons ────────────────────────────────────────────────
      if (!step.token) {
        setBusy("2/3 · Launching the coin on pons…");
        // El fee se relee justo antes de mandar: `launchToken` exige `msg.value == launchFee`
        // EXACTO, y el owner de pons lo puede mover.
        const fee = (await publicClient.readContract({
          address: PONS_LAUNCH_FACTORY,
          abi: ponsAbi,
          functionName: "launchFee",
        })) as bigint;
        setLaunchFee(fee);
        // Pin de la economia cotizada. Sin esto, un re-peg del owner de pons puede aterrizar
        // debajo de un launch en vuelo y cambiar los terminos del token que se acaba de firmar.
        const economics = (await publicClient.readContract({
          address: PONS_LAUNCH_FACTORY,
          abi: ponsAbi,
          functionName: "previewLaunchEconomics",
          args: [PONS_LAUNCH_CONFIG_ID, PONS_NATIVE_PAIR],
        })) as Hex;

        const params = buildTokenParams({
          name,
          symbol,
          description,
          logoUrl,
          vault: step.vault!,
          creatorTaxBps: Math.round(taxPct * 100),
          identity,
          salt: randomSalt(),
          expectedEconomics: economics,
        });

        const launchTx = await writeContractAsync({
          address: PONS_LAUNCH_FACTORY,
          abi: ponsAbi,
          chainId: robinhoodChain.id,
          functionName: "launchToken",
          args: [params, PONS_LAUNCH_CONFIG_ID, PONS_NATIVE_PAIR],
          value: fee,
        } as never);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: launchTx });
        const launched = launchFromReceiptLogs(receipt.logs);
        if (!launched) throw new Error("The launch confirmed but emitted no TokenLaunched event.");
        step = { ...step, token: launched.token, curve: launched.curve };
        setProgress(step);
      }

      // ── Tx 3 · atar vault ↔ token ───────────────────────────────────────────────
      // Permissionless y auto-verificable: el vault solo acepta si el factory de pons dice que
      // ES el `creatorFeeRecipient` de ese launch. Nadie tiene que confiar en quien llama.
      if (!step.attached) {
        setBusy("3/3 · Linking the vault to the coin…");
        const attachTx = await writeContractAsync({
          address: step.vault!,
          abi: escrowAbi,
          chainId: robinhoodChain.id,
          functionName: "attachToken",
          args: [step.token!],
        } as never);
        await publicClient.waitForTransactionReceipt({ hash: attachTx });
        step = { ...step, attached: true };
        setProgress(step);
      }

      setBusy(null);
      setMsg(null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setBusy(null);
      setMsg(ponsRevertHint(raw) ?? raw);
    }
  }

  const done = progress.attached && progress.token && progress.vault;
  const feeLabel = launchFee !== null ? `${formatEther(launchFee)} ETH` : `${formatEther(EXPECTED_LAUNCH_FEE)} ETH`;
  const maxPct = maxTaxBps / 100;

  return (
    <RSShell>
      <main className="mx-auto w-full max-w-2xl px-6 py-14">
        <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: RS.GREEN_TEXT }} className="text-xs font-medium uppercase">
          Launch · Robinhood Chain
        </div>
        <h1
          style={{ fontFamily: "var(--f-display)", lineHeight: 1 }}
          className="mt-3 text-[clamp(1.9rem,7vw,3rem)] uppercase tracking-tight"
        >
          Launch a coin for a builder.
        </h1>
        <p className="mt-3 max-w-md" style={{ color: RS.DIM }}>
          Name a builder. Their coin goes live on pons, and a cut of every trade — you pick, up to{" "}
          {maxPct}% — lands in a vault only they can claim. The launch costs {feeLabel} plus gas.
        </p>

        {done ? (
          <div className="mt-10 rounded-2xl border p-6" style={{ borderColor: RS.HAIR }}>
            <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: RS.GREEN_TEXT }} className="text-xs font-medium uppercase">
              Live
            </div>
            <div className="mt-3 break-all text-sm" style={{ fontFamily: "var(--f-mono)", color: RS.INK }}>
              {progress.token}
            </div>
            <div className="mt-4 flex flex-col gap-1.5 text-sm font-medium" style={{ color: RS.INK }}>
              <a
                className="underline decoration-1 underline-offset-4 hover:opacity-70"
                href={`https://robinhoodchain.blockscout.com/address/${progress.token}`}
                target="_blank"
                rel="noreferrer"
              >
                Token on Blockscout →
              </a>
              <Link className="underline decoration-1 underline-offset-4 hover:opacity-70" href={`/claim/${progress.vault}`}>
                The builder&apos;s claim page →
              </Link>
            </div>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: RS.DIM }}>
              Fees now accrue to the {type === "twitter" ? "X" : type === "github" ? "GitHub" : "wallet"} identity.
              Send them the claim page. They didn&apos;t need a wallet for you to launch this, and
              <strong> you can never redirect the fees away from them</strong>. To collect, they
              connect a wallet and pay the gas for one transaction. (Two powers are not ours to
              disclaim — pons, and on GitHub vaults our attester key. The footer spells both out.)
            </p>
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-8">
            {launchOpen === false && (
              <p className="rounded-xl border p-4 text-sm" style={{ borderColor: RS.HAIR, color: "#c0392b" }}>
                pons has its public launch gate closed right now — only whitelisted addresses can
                launch, so the launch step would revert. Launching is disabled until it reopens.
              </p>
            )}
            {wrongChain && (
              <p className="rounded-xl border p-4 text-sm" style={{ borderColor: RS.HAIR, color: "#c0392b" }}>
                Your wallet is on the wrong network. RobinShare lives on Robinhood Chain (chain{" "}
                {robinhoodChain.id}) — we&apos;ll ask you to switch before the first signature.
              </p>
            )}

            <div className="flex gap-6">
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-[10px] uppercase" style={labelStyle}>
                  Token name
                </span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aveline Coin" className={inputCls} style={inputStyle} />
              </label>
              <label className="flex w-32 flex-col gap-2">
                <span className="text-[10px] uppercase" style={labelStyle}>
                  Ticker
                </span>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AVE"
                  className={inputCls}
                  style={inputStyle}
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase" style={labelStyle}>
                Description <span className="normal-case">(optional)</span>
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this coin for?"
                className={inputCls}
                style={inputStyle}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase" style={labelStyle}>
                Logo URL <span className="normal-case">(optional)</span>
              </span>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className={inputCls}
                style={inputStyle}
              />
              {type === "github" && !logoUrl && (
                <span className="text-xs" style={{ color: RS.FAINT }}>
                  Leave it blank and we use {handle.trim() ? `@${handle.trim()}` : "the builder"}&apos;s GitHub avatar.
                </span>
              )}
            </label>

            <div className="rounded-2xl border p-6" style={{ borderColor: RS.HAIR }}>
              <div className="text-[10px] uppercase" style={labelStyle}>
                Who gets the fees?
              </div>
              <div className="mt-4 flex gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                {/* Sin "twitter": el lanzamiento va SIN la ruta de X (PENDIENTES §4). No es sólo
                    cosmético — la factory se deploya con `xVerifier = 0`, así que `createVault`
                    con identityType=2 revierte en cadena. Ofrecerlo acá sería ofrecer un botón
                    que falla. */}
                {(["github", "wallet"] as IdentityType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className="rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors"
                    style={
                      type === t
                        ? { background: RS.GREEN_CTA, borderColor: RS.GREEN_CTA, color: RS.GREEN_CTA_TEXT }
                        : { background: "transparent", borderColor: RS.HAIR, color: RS.DIM }
                    }
                  >
                    {t === "twitter" ? "X" : t === "github" ? "GitHub" : "Wallet"}
                  </button>
                ))}
              </div>
              <div className="mt-5">
                {type === "wallet" ? (
                  <input
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder={address ? `${address} (you, default)` : "0x recipient wallet"}
                    className={`${inputCls} text-sm`}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder={type === "github" ? "github username" : "x handle"}
                    className={inputCls}
                    style={inputStyle}
                  />
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: RS.FAINT }}>
                {type === "wallet"
                  ? "Fees are bound to this wallet from launch. It just withdraws them."
                  : type === "github"
                    ? "They claim by proving the handle is theirs, through GitHub. You can never redirect it — though a GitHub claim is only as good as our attester key, which is why the footer says so."
                    : "They claim by posting from the handle. You can never redirect it, and the proof comes from an on-chain oracle, not from us."}
              </p>

              <div className="mt-6 border-t pt-5" style={{ borderColor: RS.HAIR }}>
                <div className="text-[10px] uppercase" style={labelStyle}>
                  Creator tax → vault
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                  {[0, 1, 2, 3, 5, 10].filter((pct) => pct <= maxPct).map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setTaxPct(pct)}
                      className="rounded-full border px-4 py-1.5 text-xs tracking-[0.12em] transition-colors"
                      style={
                        taxPct === pct
                          ? { background: RS.GREEN_CTA, borderColor: RS.GREEN_CTA, color: RS.GREEN_CTA_TEXT }
                          : { background: "transparent", borderColor: RS.HAIR, color: RS.DIM }
                      }
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: RS.INK }}>
                  Traders will see <strong>{1 + taxPct}% tax</strong> on the coin&apos;s pons page,
                  and the builder receives <strong>{(0.7 + taxPct).toFixed(2)}% of every trade</strong>.
                </p>
                {/* El numero que nadie mostraba: al elegir "3%" la pagina de pons dice 4%, y con
                    0% el builder igual cobra 0,70%. Sin esto, quien lanza elige a ciegas algo que
                    se congela para siempre. */}
                <p className="mt-2 text-xs leading-relaxed" style={{ color: RS.FAINT }}>
                  pons always charges 1% and passes 70% of it to the builder — that is the 0.70%
                  you get even at zero. Anything you add here is charged on top, on every buy and
                  sell, and paid in full to the vault. Fixed at launch; nobody can change it
                  afterwards, not even us.
                </p>
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase" style={labelStyle}>
                Recovery days (0 = never, the default)
              </span>
              <input value={recoveryDays} onChange={(e) => setRecoveryDays(e.target.value)} className={inputCls} style={inputStyle} />
              <span className="text-xs leading-relaxed" style={{ color: RS.FAINT }}>
                {Number(recoveryDays) === 0
                  ? "Irrevocable: the fees wait for the builder forever. You can never take them back."
                  : `You could reclaim the unclaimed balance — repeatedly, as more fees arrive — any time after ${recoveryDays} days, for as long as nobody has proved the identity. Minimum 30 days. Double-check the handle actually exists: a coin launched for a name nobody can claim turns this into a guaranteed clawback, which is exactly what the product exists to prevent.`}
              </span>
            </label>

            {(progress.vault || progress.token) && !done && (
              <div className="rounded-xl border p-4 text-xs leading-relaxed" style={{ borderColor: RS.HAIR, fontFamily: "var(--f-mono)", color: RS.DIM }}>
                <div>Unfinished launch — press launch again to resume, nothing is lost:</div>
                {progress.identityKey && (
                  <div className="mt-1.5" style={{ color: RS.INK }}>for · {progress.identityKey}</div>
                )}
                {progress.vault && <div className="mt-1 break-all">vault · {progress.vault}</div>}
                {progress.token && <div className="mt-1 break-all">token · {progress.token}</div>}
                <button
                  onClick={() => {
                    setProgress({});
                    setMsg(null);
                  }}
                  className="mt-3 rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.12em]"
                  style={{ borderColor: RS.HAIR, color: RS.DIM }}
                >
                  Discard it
                </button>
              </div>
            )}

            {!isConnected ? (
              <>
              <button
                onClick={() => connect({ connector: injected() })}
                className="rounded-full border-2 px-7 py-3 font-bold transition-colors"
                style={{ background: "transparent", borderColor: RS.INK, color: RS.INK }}
              >
                Connect wallet
              </button>
                {connectError && (
                  <p className="mt-3 text-xs leading-relaxed" style={{ fontFamily: "var(--f-mono)", color: "#c0392b" }}>
                    {connectErrorHint(connectError.message)}
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={create}
                disabled={!!busy || launchOpen === false}
                className="rounded-full px-7 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: RS.GREEN_CTA, color: RS.GREEN_CTA_TEXT }}
              >
                {busy ?? `Launch ${symbol || "the coin"}`}
              </button>
            )}

            {msg && (
              <p className="text-sm" style={{ color: "#c0392b" }}>
                {msg}
              </p>
            )}
            <p className="text-xs leading-relaxed" style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }}>
              Three signatures: create the vault, launch the coin, link the two. The coin is always
              paired against native ETH — RobinShare can only collect from ETH-paired launches.
            </p>
            {/* El footer del shell ya lleva la declaración (va compuesta dentro de CUSTODY_LINE),
                pero acá se repite a la vista: éste es el punto donde alguien firma y compromete
                plata, y una declaración que hay que ir a buscar al pie no es una declaración. */}
            <p
              className="rounded-xl border px-4 py-3 text-xs leading-relaxed"
              style={{ fontFamily: "var(--f-mono)", borderColor: RS.HAIR, color: RS.DIM }}
            >
              {AUDIT_LINE.trim()} It has been reviewed and tested, but no external auditor has
              looked at it. You are the first line of defence for whatever you launch here.
            </p>
          </div>
        )}
      </main>
    </RSShell>
  );
}
