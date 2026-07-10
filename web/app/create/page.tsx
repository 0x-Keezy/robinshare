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
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ token: Address; tx: Hex } | null>(null);

  const factory = factoryAddress();

  async function create() {
    setMsg(null);
    setResult(null);
    if (!factory) return setMsg("NEXT_PUBLIC_FACTORY_ADDRESS no configurada.");
    if (!isConnected || !address) return setMsg("Conectá tu wallet primero.");
    if (!name || !symbol) return setMsg("Nombre y símbolo son obligatorios.");

    const recipientWallet = (type === "wallet" ? wallet || address : address) as Address;
    if (type === "wallet" && !/^0x[0-9a-fA-F]{40}$/.test(recipientWallet)) {
      return setMsg("Wallet receptora inválida.");
    }
    if (type !== "wallet" && !handle.trim()) {
      return setMsg("Escribí el handle de GitHub / X.");
    }

    try {
      setBusy("Minando salt (vanity 7777)…");
      const { salt, token } = await mineSalt((t) => setBusy(`Minando salt… (${t} intentos)`));

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
        fd.append("description", description || `${name} — fees on FLEDGE`);
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
        taxBps: 300,
        devBuyWei,
      });

      setBusy(`Lanzando ${symbol} (token ${token.slice(0, 6)}…7777)…`);
      const tx = await writeContractAsync({
        address: VAULT_PORTAL,
        abi: vaultPortalAbi,
        functionName: "newTokenV6WithVault",
        args: [params],
        value: devBuyWei,
      } as never);

      setBusy("Esperando confirmación…");
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
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← vaults
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Create a coin</h1>
      <p className="mt-2 text-neutral-400">
        Launch a token on Flap (Robinhood Chain) whose trading fees are escrowed to a person — by their GitHub, X or
        wallet. They claim by proving that identity.
      </p>

      {result ? (
        <div className="mt-8 rounded-lg border border-emerald-800 bg-emerald-950/40 p-5">
          <div className="text-lg font-semibold text-emerald-300">Live 🎉</div>
          <div className="mt-2 font-mono text-sm text-neutral-300">{result.token}</div>
          <div className="mt-3 flex flex-col gap-1 text-sm">
            <a
              className="text-emerald-400 underline"
              href={`https://robinhoodchain.blockscout.com/address/${result.token}`}
              target="_blank"
              rel="noreferrer"
            >
              view token on Blockscout
            </a>
            <a
              className="text-emerald-400 underline"
              href={`https://robinhoodchain.blockscout.com/tx/${result.tx}`}
              target="_blank"
              rel="noreferrer"
            >
              view launch transaction
            </a>
          </div>
          <p className="mt-3 text-sm text-neutral-400">
            Fees now accrue to the {type} identity. Share the{" "}
            <Link className="underline" href="/">
              claim page
            </Link>{" "}
            with the recipient.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Token name"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="TICKER"
              className="w-32 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
          />

          <label className="flex flex-col gap-1 text-sm text-neutral-400">
            Token image {imageFile ? `· ${imageFile.name}` : "(optional)"}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-300 file:mr-3 file:rounded file:border-0 file:bg-neutral-800 file:px-3 file:py-1 file:text-neutral-200"
            />
            {type === "github" && !imageFile && (
              <span className="text-xs text-neutral-500">
                No image? We&apos;ll use{" "}
                <span className="text-neutral-300">{handle.trim() ? `@${handle.trim()}` : "the dev"}</span>&apos;s
                GitHub avatar as the coin art.
              </span>
            )}
          </label>

          <div className="rounded-lg border border-neutral-800 p-4">
            <div className="text-sm font-medium text-neutral-300">Who gets the fees?</div>
            <div className="mt-3 flex gap-2">
              {(["github", "twitter", "wallet"] as IdentityType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    type === t ? "bg-white text-black" : "border border-neutral-700 text-neutral-300"
                  }`}
                >
                  {t === "twitter" ? "X" : t === "github" ? "GitHub" : "Wallet"}
                </button>
              ))}
            </div>
            <div className="mt-3">
              {type === "wallet" ? (
                <input
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder={address ? `${address} (you, default)` : "0x recipient wallet"}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm"
                />
              ) : (
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder={type === "github" ? "github username" : "x handle"}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
                />
              )}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {type === "wallet"
                ? "Fees are bound to this wallet immediately — it just sweeps them."
                : "The FLEDGE oracle verifies ownership when they claim. You cannot redirect it."}
            </p>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-sm text-neutral-400">
              Dev-buy (ETH)
              <input
                value={devBuy}
                onChange={(e) => setDevBuy(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </label>
            <label className="flex-1 text-sm text-neutral-400">
              Recovery days (0 = never)
              <input
                value={recoveryDays}
                onChange={(e) => setRecoveryDays(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
              />
            </label>
          </div>

          {!isConnected ? (
            <button
              onClick={() => connect({ connector: injected() })}
              className="rounded-md bg-white px-4 py-2 font-medium text-black"
            >
              Connect wallet
            </button>
          ) : (
            <button
              onClick={create}
              disabled={!!busy}
              className="rounded-md bg-emerald-500 px-4 py-3 font-semibold text-black disabled:opacity-40"
            >
              {busy ?? `Launch ${symbol || "token"} (3% tax → recipient)`}
            </button>
          )}

          {msg && <p className="text-sm text-red-400">{msg}</p>}
          <p className="text-xs text-neutral-600">
            100% of the trading tax goes to the escrow. Tax 3%/3%, ~100y duration. The token address is mined locally to
            end in 7777 (Flap vanity).
          </p>
        </div>
      )}
    </main>
  );
}
