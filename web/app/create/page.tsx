"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEther, type Address, type Hex } from "viem";
import { useAccount, useConnect, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { publicClient, factoryAddress } from "@/lib/chain";
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
import { RSShell, RS } from "@/components/RSShell";

const inputCls = "w-full border-0 border-b-2 bg-transparent py-2 placeholder:opacity-35 focus:outline-none";
const inputStyle = { borderColor: RS.INK, color: RS.INK, fontFamily: "var(--f-mono)" } as const;
const labelStyle = { fontFamily: "var(--f-mono)", color: RS.FAINT, letterSpacing: "0.16em" } as const;

/// Progreso del launch. Se guarda en estado a proposito: el flujo son TRES transacciones y si
/// una falla no hay que rehacer las anteriores. Un vault sin token es inofensivo (nunca recibe
/// fees), pero volver a crearlo seria tirar gas y dejar un vault huerfano de mas.
type Progress = { vault?: Address; token?: Address; curve?: Address; attached?: boolean };

export default function CreatePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
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
  const [taxPct, setTaxPct] = useState(3);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const [launchFee, setLaunchFee] = useState<bigint | null>(null);
  const [maxTaxBps, setMaxTaxBps] = useState<number>(MAX_CREATOR_TAX_BPS);
  const [launchOpen, setLaunchOpen] = useState<boolean | null>(null);

  const factory = factoryAddress();

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

    const recipientWallet = (type === "wallet" ? wallet || address : address) as Address;
    if (type === "wallet" && !/^0x[0-9a-fA-F]{40}$/.test(recipientWallet)) {
      return setMsg("That recipient wallet is not a valid address.");
    }
    if (type !== "wallet" && !handle.trim()) {
      return setMsg("Enter the GitHub / X handle.");
    }
    const days = Number(recoveryDays);
    if (!Number.isInteger(days) || days < 0 || (days !== 0 && days < 30) || days > 3650) {
      return setMsg("Recovery must be 0 (never) or between 30 and 3650 days.");
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
      if (!step.vault) {
        setBusy("1/3 · Creating the vault…");
        const vaultTx = await writeContractAsync({
          address: factory,
          abi: factoryAbi,
          functionName: "createVault",
          args: [identityTypeId(type), type === "wallet" ? "" : handle.trim(), type === "wallet" ? recipientWallet : ("0x0000000000000000000000000000000000000000" as Address), BigInt(days)],
        } as never);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: vaultTx });
        const vault = vaultFromReceiptLogs(receipt.logs, factory);
        if (!vault) throw new Error("The vault transaction confirmed but emitted no VaultCreated event.");
        step = { ...step, vault };
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
              Send them the claim page — they don&apos;t need a wallet or any ETH to collect.
            </p>
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-8">
            {launchOpen === false && (
              <p className="rounded-xl border p-4 text-sm" style={{ borderColor: RS.HAIR, color: "#c0392b" }}>
                pons has its public launch gate closed right now — only whitelisted addresses can
                launch. Nothing you do here will spend anything until that reopens.
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
                {(["github", "twitter", "wallet"] as IdentityType[]).map((t) => (
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
                  : "They claim by proving the handle is theirs. You can't redirect it — neither can we."}
              </p>

              <div className="mt-6 border-t pt-5" style={{ borderColor: RS.HAIR }}>
                <div className="text-[10px] uppercase" style={labelStyle}>
                  Creator tax → vault
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                  {[1, 2, 3, 5, 10].filter((pct) => pct <= maxPct).map((pct) => (
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
                <p className="mt-3 text-xs leading-relaxed" style={{ color: RS.FAINT }}>
                  Charged on top of pons&apos; own trade fee, on every buy and sell, and paid in full
                  to the builder&apos;s vault — pons never splits it. Fixed at launch; nobody can
                  change it afterwards, not even us.
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
                  : `You could reclaim the unclaimed balance after ${recoveryDays} days — but only if nobody has proved the identity by then. Minimum 30 days.`}
              </span>
            </label>

            {(progress.vault || progress.token) && !done && (
              <div className="rounded-xl border p-4 text-xs leading-relaxed" style={{ borderColor: RS.HAIR, fontFamily: "var(--f-mono)", color: RS.DIM }}>
                <div>Partial progress — press launch again to resume, nothing is lost:</div>
                {progress.vault && <div className="mt-1.5 break-all">vault · {progress.vault}</div>}
                {progress.token && <div className="mt-1 break-all">token · {progress.token}</div>}
              </div>
            )}

            {!isConnected ? (
              <button
                onClick={() => connect({ connector: injected() })}
                className="rounded-full border-2 px-7 py-3 font-bold transition-colors"
                style={{ background: "transparent", borderColor: RS.INK, color: RS.INK }}
              >
                Connect wallet
              </button>
            ) : (
              <button
                onClick={create}
                disabled={!!busy}
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
          </div>
        )}
      </main>
    </RSShell>
  );
}
