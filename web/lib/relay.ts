import { recoverAddress, isAddress, type Address, type Hex } from "viem";
import { publicClient, factoryAddress } from "./chain";
import { escrowAbi, factoryAbi } from "./abis";
import { bindDigestLocal } from "./bind";

/// El relayer: paga el gas del primer claim para que un dev que nunca tuvo ETH en esta cadena
/// pueda cobrar.
///
/// POR QUE EXISTE. La promesa del producto es "lanzá una moneda para alguien que ni siquiera
/// tiene wallet". Sin esto la promesa se rompe justo al final: el dev necesita ETH en Robinhood
/// Chain — una cadena de la que nunca oyó hablar — para pagar el gas de su propio claim, o sea
/// que tiene que bridgear plata ANTES de poder cobrar plata.
///
/// El contrato ya lo permite: `claimAndBind` valida la FIRMA del attester, no `msg.sender`.
/// Probado contra la cadena real en `ForkPons.t.sol::test_fork_fullCycle_nativePair`, donde un
/// dev con 0 ETH cobró con un tercero mandando la transacción.
///
/// EL RIESGO, Y COMO SE ACOTA. Un endpoint que firma y paga gas es una billetera abierta: si
/// cualquiera puede hacerlo disparar, te vacía el saldo. Las defensas, en orden de fuerza:
///
///   1. **Sólo relayamos vouchers que firmamos nosotros.** La firma se verifica contra el
///      attester VIGENTE, sobre un digest que el server recalcula (no se lo pide al contrato).
///      Como el attester sólo firma después de un OAuth real de GitHub que matchea la identidad
///      del vault, un atacante no puede fabricar vouchers.
///   2. **Un vault ya bindeado no se relaya.** Eso lo vuelve efectivamente de un solo uso por
///      vault, sin necesidad de estado nuestro: el límite lo lleva la cadena.
///   3. **El vault tiene que estar atado a una moneda real.** Para hacernos gastar gas, el
///      atacante primero tiene que haber pagado un launch de pons (0,0005 ETH), que cuesta más
///      que el gas que nos sacaría. Barrera económica, no una lista.
///   4. Piso de saldo del relayer, y simulación antes de mandar: un claim que revertiría no se
///      paga.
///
/// Lo que esto NO cubre, dicho explícitamente: un atacante que controle una cuenta real de
/// GitHub y pague launches de verdad puede conseguir que le paguemos el gas de sus propios
/// claims. Es gasto acotado por launch y no le da acceso a fondos ajenos.

/// Piso de saldo por debajo del cual el relayer deja de aceptar trabajo, para no quedarse sin
/// gas a mitad de camino y dejar claims a medio mandar.
export const DEFAULT_MIN_RELAYER_BALANCE_WEI = 2_000_000_000_000_000n; // 0,002 ETH

export type RelayRequest = {
  vault: Address;
  payout: Address;
  deadline: string;
  signature: Hex;
};

export type RelayRefusal = { reason: string; status: number };

const ZERO = "0x0000000000000000000000000000000000000000";

/// Valida la forma del pedido ANTES de tocar la red. Puro: testeable sin RPC.
export function parseRelayRequest(body: unknown): RelayRequest | RelayRefusal {
  const b = (body ?? {}) as Record<string, unknown>;
  const vault = b.vault;
  const payout = b.payout;
  const deadline = b.deadline;
  const signature = b.signature;

  if (typeof vault !== "string" || !isAddress(vault)) {
    return { reason: "vault must be an address", status: 400 };
  }
  if (typeof payout !== "string" || !isAddress(payout)) {
    return { reason: "payout must be an address", status: 400 };
  }
  if (payout.toLowerCase() === ZERO) {
    return { reason: "payout cannot be the zero address", status: 400 };
  }
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    // 65 bytes exactos. Una firma malformada revertiria dentro de ECDSA y nos comeria el gas.
    return { reason: "signature must be 65 bytes", status: 400 };
  }
  const d = typeof deadline === "string" || typeof deadline === "number" ? String(deadline) : null;
  if (!d || !/^\d{1,20}$/.test(d)) {
    return { reason: "deadline must be a unix timestamp", status: 400 };
  }
  return { vault: vault as Address, payout: payout as Address, deadline: d, signature: signature as Hex };
}

export function isRefusal(x: RelayRequest | RelayRefusal): x is RelayRefusal {
  return (x as RelayRefusal).reason !== undefined;
}

/// Chequeos contra la cadena. Devuelve `null` si se puede relayar, o el motivo del rechazo.
///
/// Todo lo que decide se LEE DE LA CADENA. Nada de lo que manda el cliente se cree: la firma se
/// verifica contra el digest que reconstruimos nosotros con el nonce on-chain.
export async function assertRelayable(
  req: RelayRequest,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<RelayRefusal | null> {
  const factory = factoryAddress();
  if (!factory) return { reason: "factory address not configured", status: 503 };

  if (Number(req.deadline) <= nowSeconds) {
    return { reason: "voucher expired — verify again", status: 400 };
  }

  // (1) procedencia: tiene que ser un vault de NUESTRA factory
  const known = (await publicClient.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "isVault",
    args: [req.vault],
  })) as boolean;
  if (!known) return { reason: "not a RobinShare vault", status: 403 };

  const [identityType, boundWallet, token, bindNonce, attester] = await Promise.all([
    publicClient.readContract({ address: req.vault, abi: escrowAbi, functionName: "identityType" }),
    publicClient.readContract({ address: req.vault, abi: escrowAbi, functionName: "boundWallet" }),
    publicClient.readContract({ address: req.vault, abi: escrowAbi, functionName: "token" }),
    publicClient.readContract({ address: req.vault, abi: escrowAbi, functionName: "bindNonce" }),
    publicClient.readContract({ address: req.vault, abi: escrowAbi, functionName: "attester" }),
  ]);

  // (2) sólo la ruta GitHub. La de X se relaya con `claimByProof`, que todavía no tiene su
  //     camino positivo probado contra el oráculo real — ver PENDIENTES §4.
  if (Number(identityType) !== 1) {
    return { reason: "only GitHub vaults are relayed today", status: 400 };
  }

  // (3) ya bindeado: no hay nada que relayar, y es el límite natural por vault
  if ((boundWallet as string).toLowerCase() !== ZERO) {
    return { reason: "already claimed", status: 409 };
  }

  // (4) barrera económica: el vault tiene que estar atado a un launch real de pons
  if ((token as string).toLowerCase() === ZERO) {
    return { reason: "vault is not linked to a coin yet", status: 409 };
  }

  // (5) LA defensa: la firma tiene que ser del attester vigente, sobre el digest que
  //     reconstruimos nosotros. Sólo relayamos lo que nosotros mismos autorizamos.
  const digest = bindDigestLocal(req.vault, req.payout, bindNonce as bigint, BigInt(req.deadline));
  let signer: Address;
  try {
    signer = await recoverAddress({ hash: digest, signature: req.signature });
  } catch {
    return { reason: "malformed signature", status: 400 };
  }
  if (signer.toLowerCase() !== (attester as string).toLowerCase()) {
    return { reason: "voucher was not issued by this attester", status: 403 };
  }

  return null;
}

/// Dedupe en memoria mientras una transacción está en vuelo.
///
/// No es la defensa principal — en serverless cada instancia tiene su propio mapa, y de todas
/// formas el chequeo de `boundWallet` on-chain es el que manda. Esto sólo evita el desperdicio
/// obvio de dos clicks seguidos en la misma instancia.
const inFlight = new Map<string, number>();
const IN_FLIGHT_MS = 90_000;

export function claimInFlight(vault: Address, now: number = Date.now()): boolean {
  const at = inFlight.get(vault.toLowerCase());
  if (at === undefined) return false;
  if (now - at > IN_FLIGHT_MS) {
    inFlight.delete(vault.toLowerCase());
    return false;
  }
  return true;
}

export function markInFlight(vault: Address, now: number = Date.now()): void {
  inFlight.set(vault.toLowerCase(), now);
}

export function clearInFlight(vault: Address): void {
  inFlight.delete(vault.toLowerCase());
}
