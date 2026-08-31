import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Address } from "viem";

const EXP_MS = 20 * 60 * 1000;

/// Nombre de la cookie que ata el flujo de OAuth al navegador que lo empezo.
export const OAUTH_NONCE_COOKIE = "rs_oauth_nonce";

const secret = () => {
  const s = process.env.ATTESTER_STATE_SECRET;
  if (!s) throw new Error("ATTESTER_STATE_SECRET missing");
  return s;
};

const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function newNonce(): string {
  return randomBytes(24).toString("base64url");
}

/// Comparacion en tiempo constante y tolerante a longitudes distintas.
export function nonceMatches(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function encodeState(p: { vault: Address; payout: Address; nonce?: string }): string {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Date.now() + EXP_MS })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function decodeState(
  s: string,
): { vault: Address; payout: Address; nonce?: string } | null {
  const [body, tag] = s.split(".");
  if (!body || !tag) return null;
  const expected = mac(body);
  const a = Buffer.from(tag);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString());
  if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
  return { vault: parsed.vault, payout: parsed.payout, nonce: parsed.nonce };
}
