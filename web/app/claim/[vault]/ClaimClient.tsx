"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatEther, type Address, type Hex } from "viem";
import { useAccount, useConnect, useSwitchChain, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { publicClient, factoryAddress, robinhoodChain } from "@/lib/chain";
import { escrowAbi, factoryAbi } from "@/lib/abis";
import { recoveryBadge, ponsRevertHint } from "@/lib/pons";
import { walletErrorHint, connectErrorHint } from "@/lib/claims";
import { RSShell, RS } from "@/components/RSShell";

const ZERO = "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Demo mode (?demo=1) — illustrative claim flow for capture/promo purposes.
// The product hasn't launched yet, so there's no real vault to read on-chain;
// this seeds an illustrative state and lets the cursor drive Connect → Verify
// → Claim without touching a wallet or the chain. Prod path (no query param)
// is untouched below.
// ---------------------------------------------------------------------------
const DEMO_PAYOUT = "0x8f3ac1b0d4e29ff9a2c77b1d9e4a6f0b2c1e091b" as Address;
const DEMO_TX_HASH = "0x7c3f9a1e2d4b8f605ac9e3d71f4b8a2c5e9d0f3a6b8c1d4e7f9a0b2c3d4e5f61" as Hex;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Voucher = { signature: Hex; deadline: string; payout: Address };

type State = {
  identityType: number;
  identityValue: string;
  pending: bigint;
  bound: Address;
  totalPaid: bigint;
  /// 0 = NUNCA. Es lo que decide el badge irrevocable/revocable, leido de la cadena.
  recoveryAfter: bigint;
  /// 0x0 hasta que alguien corra `attachToken()`. Sin el, `sweepCurve()` es un no-op y las fees
  /// se quedan en la curva de pons.
  token: Address;
};

/// El vault del rail pons ya no expone `description()`: se elimino junto con `vaultUISchema()`
/// para que la auditoria fuera chica. La frase se arma aca, con lo que igual se lee de la cadena.
function describeVault(identityType: number, identityValue: string): string {
  if (identityType === 0) return "Fees are bound to one wallet from launch.";
  if (identityType === 1) return `Fees for @${identityValue} — claimable by proving the GitHub account.`;
  return `Fees for @${identityValue} — claimable by posting from the X account.`;
}

const ctaCls =
  "rounded-full px-7 py-3 font-bold transition-all duration-150 will-change-transform disabled:cursor-not-allowed disabled:opacity-60 hover:scale-105 hover:brightness-110 active:scale-95 active:brightness-95";
const ctaStyle = { background: RS.GREEN_CTA, color: RS.GREEN_CTA_TEXT } as const;
const ghostCls =
  "rounded-full border-2 px-7 py-3 font-bold transition-all duration-150 will-change-transform hover:scale-105 hover:bg-white/5 active:scale-95";
const ghostStyle = { background: "transparent", borderColor: RS.INK, color: RS.INK } as const;

// easeOutCubic — used to animate the balance drain to zero on claim (demo only)
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function ClaimClient({ vault }: { vault: Address }) {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const { connect, error: connectError } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();

  // ?demo=1 — modo ilustrativo. APAGADO EN PRODUCCION, y no es una precaucion teorica.
  //
  // Este bloque se escribio cuando el producto no estaba lanzado ("there's no real vault to read
  // on-chain"). Desde que hay vaults reales, `?demo=1` sobre la URL de un vault REAL se volvio una
  // pagina de phishing lista para usar, alojada en el dominio del propio producto: descartaba lo
  // que dice la cadena, pintaba un saldo inventado, corria Connect -> Verify -> Claim sin tocar
  // nada, y terminaba en "Claimed - fees released" con un link a una transaccion que no existe.
  //
  // El ataque completo: al builder le llega "te lanzaron una moneda, cobrala aca" + la URL de SU
  // vault con `?demo=1`. Ve un saldo, hace click, la pagina le confirma que cobro, y deja de
  // intentar el claim de verdad. Si ese vault tiene `recoveryDays > 0`, quien lo lanzo se lleva
  // todo cuando vence la ventana — que es exactamente el ataque que este producto existe para
  // impedir, y quien lo lanzo es justamente el que tiene el incentivo de mandar ese link.
  //
  // Ahora hace falta ADEMAS la env var, que no esta en produccion: en el dominio real `?demo=1`
  // es un no-op y la pagina lee la cadena. Clavado en `test/demo.test.ts`.
  const isDemo =
    process.env.NEXT_PUBLIC_ALLOW_DEMO === "1" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1";
  const [demoConnected, setDemoConnected] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  // identity-proof beat: "Verifying…" (spinner) -> "Verified ✓" (chip, brief hold) -> Claim button
  const [demoVerifying, setDemoVerifying] = useState(false);
  const [demoVerified, setDemoVerified] = useState(false);
  // payoff beat: while non-null, this ETH value overrides the displayed balance and
  // animates from the pending amount down to 0 (the "drain" — see handleClaimClick)
  const [demoDrainEth, setDemoDrainEth] = useState<number | null>(null);
  // terminal beat: once the demo claim resolves, the vault has no real on-chain
  // `bound` wallet to flip `isBound` true (this is a mock, nothing is written on
  // chain), so without this flag `pending` returning to 0n + `voucher` returning
  // to null makes the "Verify with GitHub" button's guard clause true again —
  // the UI would loop back to inviting a second verification right after a
  // successful claim. This flag is the demo-only terminal state: once true, the
  // CTA area stays retired and only the "Done." + "View transaction" already
  // rendered below the card speak for the outcome.
  const [demoClaimed, setDemoClaimed] = useState(false);

  const [s, setS] = useState<State | null>(null);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [tweetText, setTweetText] = useState<string | null>(null); // ruta X: el texto exacto a tuitear
  const [tweetUrl, setTweetUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  // Ruta de reparacion: si el launch salio pero `attachToken()` no, el vault existe y el token
  // tambien, pero la curva nunca se puede barrer. Cualquiera puede atarlos — el contrato lo
  // verifica contra el registro de pons, asi que no hay que confiar en quien lo pega aca.
  const [attachAddr, setAttachAddr] = useState("");
  /// null = todavia no se sabe; false = la direccion de la URL no es un vault nuestro.
  const [isKnownVault, setIsKnownVault] = useState<boolean | null>(null);
  /// Si el relayer esta prendido y con saldo, el dev cobra SIN pagar gas — que es la promesa
  /// central del producto. Si no, cae solo al camino de siempre (firma el su propia tx).
  const [relayerReady, setRelayerReady] = useState(false);

  const refresh = useCallback(async () => {
    const [identityType, identityValue, pending, bound, totalPaid, recoveryAfter, token] =
      await Promise.all([
        publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "identityType" }),
        publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "identityValue" }),
        publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "pendingAmount" }),
        publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "boundWallet" }),
        publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "totalPaid" }),
        publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "recoveryAfter" }),
        publicClient.readContract({ address: vault, abi: escrowAbi, functionName: "token" }),
      ]);
    setS({
      identityType: Number(identityType),
      identityValue: identityValue as string,
      pending: pending as bigint,
      bound: bound as Address,
      totalPaid: totalPaid as bigint,
      recoveryAfter: recoveryAfter as bigint,
      token: token as Address,
    });
  }, [vault]);

  // Ruta X (XGeneralVerifier de Flap): lee el texto exacto a tuitear para la wallet conectada.
  const loadTweetText = useCallback(async () => {
    if (!address) return;
    const t = await publicClient.readContract({
      address: vault,
      abi: escrowAbi,
      functionName: "expectedTweet",
      args: [address],
    });
    setTweetText(t as string);
  }, [address, vault]);

  useEffect(() => {
    if (isDemo) {
      setIsKnownVault(true);
      return; // seeded below instead of read from chain
    }
    // Procedencia ANTES de leer nada. Sin esto, una direccion cualquiera en la URL hacia que
    // las siete lecturas rechazaran a la vez y la pagina se quedaba en "Loading vault…" para
    // siempre, con un stack de viem por consola. No es un agujero de seguridad (el attester
    // valida procedencia por su cuenta antes de firmar), pero es un callejon sin salida.
    (async () => {
      const factory = factoryAddress();
      if (!factory) {
        setIsKnownVault(false);
        setMsg("NEXT_PUBLIC_FACTORY_ADDRESS is not configured, so this page cannot verify the vault.");
        return;
      }
      try {
        const known = (await publicClient.readContract({
          address: factory,
          abi: factoryAbi,
          functionName: "isVault",
          args: [vault],
        })) as boolean;
        setIsKnownVault(known);
        if (!known) return;
      } catch (e) {
        setIsKnownVault(false);
        setMsg(`Could not reach Robinhood Chain to check this address: ${String(e)}`);
        return;
      }
      refresh().catch((e) => setMsg(String(e)));
    })();
  }, [refresh, isDemo, vault]);

  // Demo seed — illustrative vault: a GitHub-identity vault with fees
  // pending, not yet bound to a payout wallet.
  useEffect(() => {
    if (!isDemo) return;
    setS({
      identityType: 1,
      identityValue: "arlo_dev",
      pending: 64900000000000000n, // 0.0649 ETH
      bound: ZERO as Address,
      totalPaid: 0n,
      recoveryAfter: 0n, // irrevocable, el default del producto
      token: "0x00000000000000000000000000000000000000dd" as Address,
    });
  }, [isDemo]);

  // ruta X: al conectar en un vault twitter, cargar el texto exacto a tuitear
  useEffect(() => {
    if (s?.identityType === 2 && isConnected) loadTweetText().catch(() => {});
  }, [s?.identityType, isConnected, loadTweetText]);

  // ¿hay relayer? Se pregunta una vez; si no lo hay, la UI no promete lo que no puede cumplir.
  useEffect(() => {
    if (isDemo) return;
    fetch("/api/relay/claim")
      .then((r) => r.json())
      .then((j) => setRelayerReady(!!j?.enabled))
      .catch(() => setRelayerReady(false));
  }, [isDemo]);

  // voucher de retorno del OAuth de GitHub (viene en el fragment #)
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const signature = p.get("signature") as Hex | null;
    const deadline = p.get("deadline");
    const payout = p.get("payout") as Address | null;
    if (signature && deadline && payout) {
      setVoucher({ signature, deadline, payout });
      history.replaceState(null, "", window.location.pathname); // limpia el fragment
    }
  }, []);

  async function sendTx(
    fn: "withdraw" | "harvest" | "claimAndBind" | "claimByProof" | "attachToken",
    args: readonly unknown[] = [],
  ) {
    setMsg(null);
    try {
      // GUARD DE CADENA — ver el comentario largo en app/create/page.tsx. Sin esto un dev con una
      // MetaMask recien instalada (que nunca oyo hablar de la cadena 4663) manda su claim a otra
      // red, a una direccion sin codigo: no revierte, se come el gas, y esta pagina espera para
      // siempre un receipt que no va a existir.
      if (walletChainId !== robinhoodChain.id) {
        setMsg("Switching your wallet to Robinhood Chain…");
        await switchChainAsync({ chainId: robinhoodChain.id });
      }
      const hash = await writeContractAsync({
        address: vault,
        abi: escrowAbi,
        chainId: robinhoodChain.id,
        functionName: fn,
        args,
      } as never);
      setTxHash(hash);
      setMsg("Sent — waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash });
      setMsg("Done.");
      setVoucher(null);
      await refresh();
    } catch (e) {
      // El error crudo se conserva DEBAJO del consejo, no se tira: cuando alguien tenga que
      // reportar el problema, el detalle tiene que seguir estando.
      const raw = e instanceof Error ? e.message : String(e);
      // Dos traductores, en orden: primero el del CONTRATO (ahora que los custom errors estan en
      // el ABI, `raw` trae el nombre del error y esta tabla puede matchear), y si no, el de la
      // WALLET. /claim usaba ninguno de los dos: mostraba `e.message` pelado.
      const hint = ponsRevertHint(raw) ?? walletErrorHint(raw);
      setMsg(hint ? `${hint}

${raw}` : raw);
    }
  }

  function verifyGithub() {
    if (!address) return;
    window.location.href = `/api/attest/github/start?vault=${vault}&payout=${address}`;
  }

  // ---- demo-mode click handlers — same UI, mocked side effects ----
  async function handleConnectClick() {
    if (isDemo) {
      setDemoConnected(true);
      return;
    }
    connect({ connector: injected() });
  }

  async function handleVerifyGithubClick() {
    if (isDemo) {
      setDemoPending(true);
      setDemoVerifying(true); // beat 1: "Verifying…" spinner on the button itself
      await sleep(1100);
      setDemoVerifying(false);
      setDemoVerified(true); // beat 2: "Verified via GitHub ✓" chip — the identity proof, made visible
      await sleep(650);
      setVoucher({ signature: DEMO_TX_HASH, deadline: "9999999999", payout: DEMO_PAYOUT });
      setDemoVerified(false);
      setDemoPending(false);
      return;
    }
    verifyGithub();
  }

  // Animates a float ETH amount from `fromEth` to 0 over `ms`, driving demoDrainEth.
  // Uses setInterval keyed off wall-clock time rather than requestAnimationFrame:
  // rAF is throttled/paused by the browser on backgrounded or non-composited tabs
  // (which the Playwright capture page can be), which would hang this promise
  // forever. setInterval keeps ticking regardless, and since each tick reads real
  // elapsed time (not "one rAF frame"), the eased curve stays correct even if
  // some ticks are dropped or delayed.
  function animateDemoDrain(fromEth: number, ms: number) {
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const id = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / ms);
        setDemoDrainEth(fromEth * (1 - easeOutCubic(t)));
        if (t >= 1) {
          clearInterval(id);
          resolve();
        }
      }, 30);
    });
  }

  async function handleClaimClick() {
    if (!voucher) return;
    if (isDemo) {
      const fromEth = s ? Number(formatEther(s.pending)) : 0;
      setDemoPending(true);
      setMsg("Sent — waiting for confirmation…");
      await sleep(500);
      await animateDemoDrain(fromEth, 900); // the payoff: balance visibly sweeps to 0
      setDemoDrainEth(null);
      setTxHash(DEMO_TX_HASH);
      setS((prev) => (prev ? { ...prev, pending: 0n, totalPaid: prev.pending } : prev));
      setMsg("Done.");
      setVoucher(null);
      setDemoPending(false);
      setDemoClaimed(true);
      return;
    }
    await sendTx("claimAndBind", [voucher.payout, BigInt(voucher.deadline), voucher.signature]);
  }

  /// Claim SIN gas: el server manda la transaccion y la paga.
  ///
  /// El contrato ya lo permitia — `claimAndBind` valida la FIRMA del attester, no `msg.sender`
  /// (probado en fork con un dev de 0 ETH). Lo que faltaba era esta ruta. Si falla por lo que
  /// sea, se cae al camino de siempre en vez de dejar al usuario sin salida.
  async function claimViaRelayer() {
    if (!voucher) return;
    setMsg("Sending your claim — we're paying the gas…");
    try {
      const res = await fetch("/api/relay/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault,
          payout: voucher.payout,
          deadline: voucher.deadline,
          signature: voucher.signature,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.relayed) {
        setMsg(
          `${j.error ?? "the relayer could not send it"} — you can still claim it yourself below.`,
        );
        setRelayerReady(false); // que aparezca el boton normal
        return;
      }
      setTxHash(j.hash as Hex);
      setMsg("Sent — waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash: j.hash as Hex });
      setMsg("Done.");
      setVoucher(null);
      await refresh();
    } catch (e) {
      setMsg(`${e instanceof Error ? e.message : String(e)} — you can still claim it yourself below.`);
      setRelayerReady(false);
    }
  }

  async function proveAndClaimTwitter() {
    if (!address || !tweetText || !tweetUrl) return;
    setMsg("Asking Flap's oracle to verify your tweet…");
    try {
      const res = await fetch("/api/x-prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetUrl, substring: tweetText }),
      });
      const p = await res.json();
      if (!res.ok || !p.signature) {
        setMsg(`Verification failed: ${p.error ?? "oracle rejected the tweet"}`);
        return;
      }
      const proof = {
        tweetId: BigInt(p.tweet_id),
        xHandle: p.x_handle as string,
        xId: BigInt(p.x_id),
        substring: p.substring as string,
      };
      // `payoutWallet` va PRIMERO y ya no se exige `msg.sender == payout`: el substring del
      // tweet ata la prueba a esta wallet y a este vault, asi que un relayer podria mandarla.
      await sendTx("claimByProof", [address, proof, p.signature]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  // Una direccion que no salio de nuestra factory, o un RPC caido, dejaban esta pagina en
  // "Loading vault…" PARA SIEMPRE, con un stack de viem por consola y nada en pantalla. El
  // chequeo de procedencia ya existia pero su resultado no se leia en ningun lado: era codigo
  // muerto. Ahora tiene su propia rama.
  if (isKnownVault === false)
    return (
      <RSShell>
        <main className="mx-auto w-full max-w-2xl px-6 py-14">
          <h1
            style={{ fontFamily: "var(--f-display)", lineHeight: 1 }}
            className="text-[clamp(1.6rem,5vw,2.4rem)] uppercase tracking-tight"
          >
            Not a RobinShare vault.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: RS.DIM }}>
            {msg ??
              "This address was not created by the RobinShare factory, so there is nothing to claim here. Check the link you were sent."}
          </p>
          <p className="mt-6 break-all text-xs" style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }}>
            {vault}
          </p>
          <p className="mt-8">
            <Link
              href="/"
              className="text-sm font-medium underline decoration-1 underline-offset-4 hover:opacity-70"
              style={{ color: RS.DIM }}
            >
              ← Look up a vault by identity
            </Link>
          </p>
        </main>
      </RSShell>
    );

  if (!s)
    return (
      <RSShell>
        <main className="mx-auto w-full max-w-2xl px-6 py-14">
          <p style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }} className="text-sm">
            Loading vault…
          </p>
        </main>
      </RSShell>
    );

  const isBound = s.bound !== ZERO;
  const label = s.identityType === 0 ? "wallet" : s.identityType === 1 ? `github:${s.identityValue}` : `x:${s.identityValue}`;
  const effectiveConnected = isDemo ? demoConnected : isConnected;
  const effectivePending = isDemo ? demoPending : isPending;
  // `withdraw()` es PULL: solo lo puede llamar el boundWallet. Reemplazo del `sweep()` push del
  // rail de Flap, y lo que permitio borrar el Guardian entero — si la wallet no puede recibir ETH
  // en una llamada push, simplemente no llama.
  const isPayoutWallet = !!address && address.toLowerCase() === s.bound.toLowerCase();
  /// EL CHEQUEO QUE CIERRA EL CSRF DEL OAUTH.
  ///
  /// La cookie de `/api/attest/github/start` ata el flujo al navegador que lo empezo, pero eso
  /// NO alcanza: al atacante le basta con mandarle a la victima un link a NUESTRO propio
  /// `/start?vault=<el de la victima>&payout=<wallet del atacante>`. Ahi el navegador de la
  /// victima se auto-emite la cookie, va a GitHub, vuelve con ella puesta, el login matchea la
  /// identidad del vault (es el dev de verdad) y el server firma un voucher que paga al atacante.
  /// El servidor no puede distinguir ese caso: la request la hace la victima.
  ///
  /// Lo que si se puede es negarse a USAR un voucher que no le paga a quien esta mirando. La
  /// wallet conectada es del usuario; un voucher a nombre de otro no se ejecuta y se avisa.
  const voucherPaysConnectedWallet =
    !!voucher && !!address && voucher.payout.toLowerCase() === address.toLowerCase();
  const voucherForSomeoneElse = !!voucher && !!address && !voucherPaysConnectedWallet;
  const isAttached = s.token !== ZERO;
  const badge = recoveryBadge(s.recoveryAfter, Math.floor(Date.now() / 1000), isBound);

  return (
    <RSShell>
      <main className="mx-auto w-full max-w-2xl px-6 py-14">
        <div style={{ fontFamily: "var(--f-mono)", letterSpacing: "0.24em", color: RS.GREEN_TEXT }} className="text-xs font-medium uppercase">
          Claim · {label}
        </div>
        <h1
          style={{ fontFamily: "var(--f-display)", lineHeight: 1 }}
          className="mt-3 text-[clamp(1.9rem,7vw,3rem)] uppercase tracking-tight"
        >
          This vault is yours to prove.
        </h1>
        <p className="mt-3 max-w-md" style={{ color: RS.DIM }}>
          {describeVault(s.identityType, s.identityValue)}
        </p>

        <div className="relative mt-10 rounded-2xl border p-6 sm:p-8" style={{ borderColor: RS.HAIR }}>
          {isDemo && demoDrainEth !== null && (
            <span className="demo-eth-fly" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4.5 13.5 12 17.5l7.5-4L12 2Z" fill={RS.GREEN_CTA} />
                <path d="M12 17.5 4.5 13.5 12 22l7.5-8.5L12 17.5Z" fill={RS.GREEN_CTA} opacity="0.6" />
              </svg>
            </span>
          )}
          <div className="relative overflow-hidden">
            {isDemo && demoDrainEth !== null && <span className="demo-balance-sweep" aria-hidden />}
            <div
              style={{ fontFamily: "var(--f-display)", fontVariantNumeric: "tabular-nums" }}
              className={`text-[clamp(2rem,6vw,3.2rem)] tracking-tight ${
                isDemo && demoDrainEth !== null ? "demo-balance-draining" : ""
              }`}
            >
              {isDemo && demoDrainEth !== null ? demoDrainEth.toFixed(4) : formatEther(s.pending)} ETH
            </div>
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.14em]" style={{ fontFamily: "var(--f-mono)", color: RS.FAINT }}>
            pending · {formatEther(s.totalPaid)} ETH paid out
            {isBound ? ` · bound to ${s.bound.slice(0, 6)}…${s.bound.slice(-4)}` : ""}
          </div>
          {/* El badge sale de `recoveryAfter()` on-chain, no de una promesa: cualquiera puede
              leer el mismo numero en Blockscout y comprobarlo. */}
          <div className="mt-3 flex flex-wrap items-center gap-2" style={{ fontFamily: "var(--f-mono)" }}>
            <span
              className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]"
              style={
                badge.irrevocable
                  ? { background: "rgba(0,200,5,0.14)", color: RS.GREEN_TEXT }
                  : { background: "rgba(192,57,43,0.12)", color: "#c0392b" }
              }
              title="Read from recoveryAfter() on this contract"
            >
              {badge.label}
            </span>
            {!isAttached && (
              <span
                className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.14em]"
                style={{ background: "rgba(192,57,43,0.12)", color: "#c0392b" }}
                title="attachToken() has not been called yet"
              >
                not linked to a coin
              </span>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3">
            {!effectiveConnected ? (
              <>
                <button onClick={handleConnectClick} className={ghostCls} style={ghostStyle}>
                Connect wallet
                </button>
                {connectError && (
                  <p className="text-xs leading-relaxed" style={{ fontFamily: "var(--f-mono)", color: "#c0392b" }}>
                    {connectErrorHint(connectError.message)}
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Identidad ya probada. El retiro es PULL: solo el boundWallet lo puede llamar. */}
                {isBound && isPayoutWallet && (
                  <button onClick={() => sendTx("withdraw")} disabled={effectivePending} className={ctaCls} style={ctaStyle}>
                    Withdraw to {s.bound.slice(0, 6)}…{s.bound.slice(-4)}
                  </button>
                )}
                {isBound && !isPayoutWallet && (
                  <p className="text-sm leading-relaxed" style={{ color: RS.DIM }}>
                    These fees belong to {s.bound.slice(0, 6)}…{s.bound.slice(-4)} — only that wallet
                    can withdraw them, and nothing here can change that. You can still pay the gas to
                    pull the fees out of pons and into the vault for them.
                  </p>
                )}

                {/* Permissionless: cualquiera paga el gas de traer la plata desde la curva y el
                    escrow de pons hasta el vault. No hace falta estar bindeado ni ser nadie.
                    `withdraw()` ya lo hace adentro; esto sirve para que el saldo se VEA antes. */}
                {isAttached && (
                  <button
                    onClick={() => sendTx("harvest")}
                    disabled={effectivePending}
                    className={ghostCls}
                    style={ghostStyle}
                  >
                    Collect fees into the vault
                  </button>
                )}

                {!isAttached && (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-sm leading-relaxed" style={{ color: RS.DIM }}>
                      This vault is not linked to its coin yet, so trading fees stay stuck on the
                      pons curve. Anyone can link them — the contract only accepts a coin whose
                      creator fees already point here, so there is nothing to trust.
                    </p>
                    <input
                      value={attachAddr}
                      onChange={(e) => setAttachAddr(e.target.value)}
                      placeholder="0x coin address"
                      className="w-full border-0 border-b-2 bg-transparent py-2 text-sm placeholder:opacity-35 focus:outline-none"
                      style={{ borderColor: RS.INK, color: RS.INK, fontFamily: "var(--f-mono)" }}
                    />
                    <button
                      onClick={() => sendTx("attachToken", [attachAddr as Address])}
                      disabled={effectivePending || !/^0x[0-9a-fA-F]{40}$/.test(attachAddr)}
                      className={ctaCls}
                      style={ctaStyle}
                    >
                      Link the coin
                    </button>
                  </div>
                )}

                {/* Social: hay voucher listo -> Claim; si no, verificar */}
                {!isBound && s.identityType !== 0 && voucher && (isDemo || voucherPaysConnectedWallet) && (
                  <>
                    {relayerReady && !isDemo ? (
                      <>
                        <button
                          onClick={claimViaRelayer}
                          disabled={effectivePending}
                          className={ctaCls}
                          style={ctaStyle}
                        >
                          Claim to {voucher.payout.slice(0, 6)}…{voucher.payout.slice(-4)} — no gas needed
                        </button>
                        <button
                          onClick={handleClaimClick}
                          disabled={effectivePending}
                          className="text-xs underline decoration-1 underline-offset-4 hover:opacity-70"
                          style={{ color: RS.FAINT, fontFamily: "var(--f-mono)" }}
                        >
                          or send it yourself and pay the gas
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleClaimClick}
                        disabled={effectivePending}
                        className={ctaCls}
                        style={ctaStyle}
                      >
                        Claim to {voucher.payout.slice(0, 6)}…{voucher.payout.slice(-4)}
                      </button>
                    )}
                  </>
                )}
                {!isDemo && voucherForSomeoneElse && (
                  <div
                    className="rounded-xl border p-4 text-sm leading-relaxed"
                    style={{ borderColor: "#c0392b", color: "#c0392b" }}
                  >
                    <strong>Stop.</strong> This verification would send the fees to{" "}
                    <span style={{ fontFamily: "var(--f-mono)" }}>
                      {voucher!.payout.slice(0, 10)}…{voucher!.payout.slice(-8)}
                    </span>
                    , which is not the wallet you have connected. That happens when the
                    verification link was started by someone else. Nothing has been signed on-chain
                    — start the verification again from this page.
                    <button
                      onClick={() => setVoucher(null)}
                      className="mt-3 block rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em]"
                      style={{ borderColor: "#c0392b", color: "#c0392b", fontFamily: "var(--f-mono)" }}
                    >
                      Discard it
                    </button>
                  </div>
                )}
                {!isBound && s.identityType === 1 && !voucher && !demoVerified && !demoClaimed && (
                  <button onClick={handleVerifyGithubClick} disabled={effectivePending} className={ctaCls} style={ctaStyle}>
                    {demoVerifying ? (
                      <span className="inline-flex items-center gap-2.5">
                        <span className="demo-spinner" aria-hidden />
                        Verifying…
                      </span>
                    ) : (
                      "Verify with GitHub"
                    )}
                  </button>
                )}
                {isDemo && demoVerified && !voucher && (
                  <div
                    className="demo-verified-chip inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                    style={{ background: "rgba(0,200,5,0.14)", color: RS.GREEN_TEXT }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        className="demo-check-path"
                        d="M5 12.5l4 4 10-10"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                    Verified via GitHub
                  </div>
                )}
                {/* terminal state: claimed, nothing left to prove or click — the
                    button area retires into a quiet confirmation instead of
                    looping back to "Verify with GitHub" (demoClaimed above) */}
                {isDemo && demoClaimed && (
                  <div
                    className="demo-verified-chip inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
                    style={{ background: "rgba(204,255,0,0.14)", color: RS.INK }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        className="demo-check-path"
                        d="M5 12.5l4 4 10-10"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                    Claimed — fees released
                  </div>
                )}
                {!isBound && s.identityType === 2 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm leading-relaxed" style={{ color: RS.DIM }}>
                      Post this exact text on X from{" "}
                      <span className="font-semibold" style={{ color: RS.INK }}>
                        @{s.identityValue}
                      </span>
                      , then paste the tweet link. Flap&apos;s oracle verifies it and the fees release
                      to your connected wallet.
                    </p>
                    <div
                      className="break-all rounded-xl border p-4 text-xs leading-relaxed"
                      style={{ borderColor: RS.HAIR, fontFamily: "var(--f-mono)", color: RS.DIM }}
                    >
                      {tweetText ?? "loading tweet text…"}
                    </div>
                    <div className="flex gap-2.5" style={{ fontFamily: "var(--f-mono)" }}>
                      <button
                        onClick={() => tweetText && navigator.clipboard.writeText(tweetText)}
                        disabled={!tweetText}
                        className="rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] disabled:opacity-40"
                        style={{ borderColor: RS.HAIR, color: RS.DIM }}
                      >
                        Copy
                      </button>
                      <a
                        href={`https://x.com/intent/tweet?text=${encodeURIComponent(tweetText ?? "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`rounded-full border px-4 py-1.5 text-xs uppercase tracking-[0.12em] ${tweetText ? "" : "pointer-events-none opacity-40"}`}
                        style={{ borderColor: RS.HAIR, color: RS.DIM }}
                      >
                        Open X
                      </a>
                    </div>
                    <label className="flex flex-col gap-2">
                      <span className="text-[10px] uppercase" style={{ fontFamily: "var(--f-mono)", color: RS.FAINT, letterSpacing: "0.16em" }}>
                        Tweet link
                      </span>
                      <input
                        value={tweetUrl}
                        onChange={(e) => setTweetUrl(e.target.value)}
                        placeholder="x.com/…/status/…"
                        className="w-full border-0 border-b-2 bg-transparent py-2 text-sm placeholder:opacity-35 focus:outline-none"
                        style={{ borderColor: RS.INK, color: RS.INK, fontFamily: "var(--f-mono)" }}
                      />
                    </label>
                    <button onClick={proveAndClaimTwitter} disabled={isPending || !tweetText || !tweetUrl} className={ctaCls} style={ctaStyle}>
                      Verify tweet &amp; claim
                    </button>
                  </div>
                )}
                {/* Antes habia aca un bloque para `!isBound && identityType === 0`. Es
                    INALCANZABLE: el constructor del vault fija `boundWallet = identityWallet` y
                    exige que no sea 0, asi que un vault de wallet nace bindeado. Ademas su copy
                    era inexacto ("solo puede ir a la wallet del launch" — `rebindWallet` la
                    rota). Codigo muerto, borrado. */}
              </>
            )}
          </div>
        </div>

        {msg && (
          <p
            className={`mt-5 flex items-center gap-2 text-sm ${msg === "Done." ? "demo-done-pop" : ""}`}
            style={{ color: msg === "Done." ? RS.GREEN_TEXT : RS.DIM }}
          >
            {msg === "Done." && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
                <path
                  className="demo-check-path"
                  d="M7 12.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            )}
            {msg}
          </p>
        )}
        {txHash && (
          <a
            href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="demo-tx-link-in mt-2 block text-sm font-medium underline decoration-1 underline-offset-4 hover:opacity-70"
            style={{ color: RS.INK }}
          >
            View transaction →
          </a>
        )}

        <p className="mt-10">
          <Link
            href="/"
            className="text-sm font-medium underline decoration-1 underline-offset-4 hover:opacity-70"
            style={{ color: RS.DIM }}
          >
            ← All vaults
          </Link>
        </p>
      </main>
    </RSShell>
  );
}
