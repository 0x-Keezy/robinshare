"use client";

import { useState } from "react";
import Link from "next/link";
import { parseEther, type Address, type Hex } from "viem";
import { useAccount, useConnect, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { publicClient, factoryAddress } from "@/lib/chain";
import { vaultPortalAbi } from "@/lib/portalAbi";
import {
  VAULT_PORTAL,
  mineSalt,
  encodeVaultData,
  buildLaunchParams,
  type IdentityType,
} from "@/lib/fledge";
import { RSShell, RS } from "@/components/RSShell";

const inputCls = "w-full border-0 border-b-2 bg-transparent py-2 placeholder:opacity-35 focus:outline-none";
const inputStyle = { borderColor: RS.INK, color: RS.INK, fontFamily: "var(--f-mono)" } as const;
const labelStyle = { fontFamily: "var(--f-mono)", color: RS.FAINT, letterSpacing: "0.16em" } as const;

export default function CreatePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { writeContractAsync } = useWriteContract();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IdentityType>("github");
  const [handle, setHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const [recoveryDays, setRecoveryDays] = useState("0");
  const [devBuy, setDevBuy] = useState("0.01");
  // % del trade que va al vault. Límites sondeados contra el portal REAL en
  // Robinhood Chain (eth_call, scripts/_taxprobe.mjs): mínimo 0.01%, máximo
  // 10.00% — fuera de eso el portal revierte con el custom error 0xcfdd26ea.
  const [taxPct, setTaxPct] = useState(3);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ token: Address; tx: Hex } | null>(null);

  const factory = factoryAddress();

  async function create() {
    setMsg(null);
    setResult(null);
    if (!factory) return setMsg("NEXT_PUBLIC_FACTORY_ADDRESS is not configured.");
    if (!isConnected || !address) return setMsg("Connect your wallet first.");
    if (!name || !symbol) return setMsg("Name and ticker are required.");

    const recipientWallet = (type === "wallet" ? wallet || address : address) as Address;
    if (type === "wallet" && !/^0x[0-9a-fA-F]{40}$/.test(recipientWallet)) {
      return setMsg("That recipient wallet is not a valid address.");
    }
    if (type !== "wallet" && !handle.trim()) {
      return setMsg("Enter the GitHub / X handle.");
    }

    try {
      setBusy("Mining salt (vanity 7777)…");
      const { salt, token } = await mineSalt((t) => setBusy(`Mining salt… (${t} attempts)`));

      const vaultData = encodeVaultData(type, handle.trim(), recipientWallet, Number(recoveryDays) || 0);

      // Arte + metadata del token: subir a Flap (/api/upload via nuestro proxy) -> CID on-chain.
      // Sin imagen propia y con identidad github: usamos el avatar del dev por defecto.
      let meta = "{}";
      const ghAvatar = type === "github" && handle.trim() ? `https://github.com/${handle.trim()}.png` : null;
      if (imageFile || ghAvatar) {
        setBusy("Uploading token art to Flap…");
        const fd = new FormData();
        fd.append("name", name);
        fd.append("symbol", symbol);
        fd.append("description", description || `${name} — fees on RobinShare`);
        if (type === "twitter") fd.append("twitter", handle.trim());
        if (type === "github") fd.append("website", `https://github.com/${handle.trim()}`);
        if (imageFile) fd.append("image", imageFile);
        else if (ghAvatar) fd.append("sourceUrl", ghAvatar);
        try {
          const r = await fetch("/api/token-image", { method: "POST", body: fd });
          const j = await r.json();
          if (j.cid) meta = j.cid;
          else setMsg(`Token art skipped (${j.error}). Launching without image.`);
        } catch {
          setMsg("Token art upload failed. Launching without image.");
        }
      }

      const devBuyWei = parseEther(devBuy || "0");
      const params = buildLaunchParams({
        name,
        symbol,
        meta,
        salt,
        factory,
        vaultData,
        taxBps: Math.round(taxPct * 100),
        devBuyWei,
      });

      setBusy(`Launching ${symbol} (token ${token.slice(0, 6)}…7777)…`);
      const tx = await writeContractAsync({
        address: VAULT_PORTAL,
        abi: vaultPortalAbi,
        functionName: "newTokenV6WithVault",
        args: [params],
        value: devBuyWei,
      } as never);

      setBusy("Waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setResult({ token, tx });
      setBusy(null);
      setMsg(null);
    } catch (e) {
      setBusy(null);
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

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
          Name a builder. Their coin goes live on Flap, and a cut of every trade — you pick 1 to
          10% — lands in a vault only they can claim.
        </p>

        {result ? (
          <div className="mt-10 rounded-2xl border p-6" style={{ borderColor: RS.HAIR }}>
            <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: RS.GREEN_TEXT }} className="text-xs font-medium uppercase">
              Live
            </div>
            <div className="mt-3 break-all text-sm" style={{ fontFamily: "var(--f-mono)", color: RS.INK }}>
              {result.token}
            </div>
            <div className="mt-4 flex flex-col gap-1.5 text-sm font-medium" style={{ color: RS.INK }}>
              <a
                className="underline decoration-1 underline-offset-4 hover:opacity-70"
                href={`https://robinhoodchain.blockscout.com/address/${result.token}`}
                target="_blank"
                rel="noreferrer"
              >
                Token on Blockscout →
              </a>
              <a
                className="underline decoration-1 underline-offset-4 hover:opacity-70"
                href={`https://robinhoodchain.blockscout.com/tx/${result.tx}`}
                target="_blank"
                rel="noreferrer"
              >
                Launch transaction →
              </a>
            </div>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: RS.DIM }}>
              Fees now accrue to the {type === "twitter" ? "X" : type === "github" ? "GitHub" : "wallet"} identity.
              Share the{" "}
              <Link className="underline decoration-1 underline-offset-4" href="/" style={{ color: RS.INK }}>
                claim page
              </Link>{" "}
              with the recipient.
            </p>
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-8">
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
                Token image {imageFile ? `· ${imageFile.name}` : <span className="normal-case">(optional)</span>}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-full file:border file:bg-transparent file:px-4 file:py-1.5 file:text-xs file:uppercase file:tracking-[0.12em]"
                style={{ color: RS.DIM, fontFamily: "var(--f-mono)" }}
              />
              {type === "github" && !imageFile && (
                <span className="text-xs" style={{ color: RS.FAINT }}>
                  No image? We use {handle.trim() ? `@${handle.trim()}` : "the builder"}&apos;s GitHub avatar.
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
                  ? "Fees are bound to this wallet from launch. It just sweeps them."
                  : "They claim by proving the handle is theirs. You can't redirect it — neither can we."}
              </p>

              <div className="mt-6 border-t pt-5" style={{ borderColor: RS.HAIR }}>
                <div className="text-[10px] uppercase" style={labelStyle}>
                  Trade fee → vault
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                  {[1, 2, 3, 5, 10].map((pct) => (
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
                  Set at launch, between 1 and 10%. All of it goes to the builder&apos;s vault.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-[10px] uppercase" style={labelStyle}>
                  Dev-buy (ETH)
                </span>
                <input value={devBuy} onChange={(e) => setDevBuy(e.target.value)} className={inputCls} style={inputStyle} />
              </label>
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-[10px] uppercase" style={labelStyle}>
                  Recovery days (0 = never)
                </span>
                <input value={recoveryDays} onChange={(e) => setRecoveryDays(e.target.value)} className={inputCls} style={inputStyle} />
              </label>
            </div>

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
              The fee applies per side (buy and sell) and all of it goes to the vault. Token
              addresses are mined locally to end in 7777.
            </p>
          </div>
        )}
      </main>
    </RSShell>
  );
}
