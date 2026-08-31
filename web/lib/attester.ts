import { sign, privateKeyToAccount } from "viem/accounts";
import { serializeSignature, type Address, type Hex } from "viem";
import { publicClient } from "./chain";
import { escrowAbi } from "./abis";
import { bindDigestLocal } from "./bind";

const DEADLINE_S = 15 * 60;

/// La key, normalizada. `trim()` no es cosmetico: un salto de linea o un espacio al pegarla en el
/// panel de Vercel hace que `privateKeyToAccount` tire, y el sintoma es un /api/health que dice
/// que la variable falta cuando esta cargada. Se acepta tambien sin el prefijo `0x`, que es la
/// forma en que la exportan varias wallets.
function attesterKey(): Hex {
  const raw = (process.env.ATTESTER_PK ?? "").trim();
  return (raw.startsWith("0x") || raw.startsWith("0X") ? `0x${raw.slice(2)}` : `0x${raw}`) as Hex;
}

export function attesterAddress(): Address {
  return privateKeyToAccount(attesterKey()).address;
}

/// Construye el digest LOCALMENTE (dominio scopeado a `vault`) y lo firma.
/// Del contrato solo se lee `bindNonce`: aunque un contrato hostil mienta con el nonce, el
/// dominio sigue siendo el suyo, asi que la firma no vale contra ningun otro vault.
///
/// ANTES esto hacia readContract("bindDigest") y firmaba lo que el contrato devolviera. Un
/// contrato hostil que reenviaba bindDigest() al vault de otra persona conseguia una firma
/// valida contra ESE vault. Ver docs/superpowers/plans/2026-08-29-attester-blind-signature-fix.md
export async function signBindVoucher(
  vault: Address,
  payout: Address,
): Promise<{ signature: Hex; deadline: string }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_S);
  const nonce = (await publicClient.readContract({
    address: vault,
    abi: escrowAbi,
    functionName: "bindNonce",
  })) as bigint;
  const digest = bindDigestLocal(vault, payout, nonce, deadline);
  const sig = await sign({ hash: digest, privateKey: attesterKey() });
  return { signature: serializeSignature(sig), deadline: deadline.toString() };
}
