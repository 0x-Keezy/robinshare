import { describe, it, expect, beforeEach, vi } from "vitest";
import { privateKeyToAccount, sign } from "viem/accounts";
import { serializeSignature, type Address, type Hex } from "viem";

process.env.ATTESTER_STATE_SECRET = "test-secret";

const VAULT = "0x1111111111111111111111111111111111111111" as Address;
const PAYOUT = "0x2222222222222222222222222222222222222222" as Address;
const TOKEN = "0x3333333333333333333333333333333333333333" as Address;
const FACTORY = "0x9999999999999999999999999999999999999999" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

const ATTESTER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const OTHER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const attesterAddress = privateKeyToAccount(ATTESTER_PK).address;

// Estado on-chain simulado; cada test lo mueve para ejercer un chequeo distinto.
let isVault = true;
let identityType = 1;
let boundWallet: Address = ZERO;
let token: Address = TOKEN;
let bindNonce = 0n;
let attester: Address = attesterAddress;

vi.mock("@/lib/chain", () => ({
  publicClient: {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case "isVault":
          return isVault;
        case "identityType":
          return identityType;
        case "boundWallet":
          return boundWallet;
        case "token":
          return token;
        case "bindNonce":
          return bindNonce;
        case "attester":
          return attester;
        default:
          return 0;
      }
    }),
  },
  factoryAddress: () => FACTORY,
  robinhoodChain: { id: 4663 },
}));

const {
  CLAIM_GAS_LIMIT,
  parseRelayRequest,
  isRefusal,
  assertRelayable,
  acquireClaimLock,
  releaseClaimLock,
  isClaimLocked,
  isCanonicalSignature,
  __resetClaimLocksForTests,
} = await import("@/lib/relay");
const { bindDigestLocal } = await import("@/lib/bind");

const NOW = 1_800_000_000;
const DEADLINE = String(NOW + 900);

async function voucher(pk: Hex, opts: Partial<{ vault: Address; payout: Address; deadline: string; nonce: bigint }> = {}) {
  const digest = bindDigestLocal(
    opts.vault ?? VAULT,
    opts.payout ?? PAYOUT,
    opts.nonce ?? bindNonce,
    BigInt(opts.deadline ?? DEADLINE),
  );
  return serializeSignature(await sign({ hash: digest, privateKey: pk }));
}

beforeEach(() => {
  isVault = true;
  identityType = 1;
  boundWallet = ZERO;
  token = TOKEN;
  bindNonce = 0n;
  attester = attesterAddress;
  __resetClaimLocksForTests();
});

describe("parseRelayRequest — nada del cliente se cree", () => {
  const good = { vault: VAULT, payout: PAYOUT, deadline: DEADLINE, signature: "0x" + "ab".repeat(65) };

  it("acepta un pedido bien formado", () => {
    expect(isRefusal(parseRelayRequest(good))).toBe(false);
  });

  it("rechaza direcciones invalidas", () => {
    expect(isRefusal(parseRelayRequest({ ...good, vault: "no-soy-una-address" }))).toBe(true);
    expect(isRefusal(parseRelayRequest({ ...good, payout: "0x123" }))).toBe(true);
  });

  it("rechaza el payout cero (el contrato revertiria ZeroPayout y nos comeria el gas)", () => {
    expect(isRefusal(parseRelayRequest({ ...good, payout: ZERO }))).toBe(true);
  });

  it("exige una firma de 65 bytes exactos", () => {
    // Una firma corta revierte DENTRO de ECDSA, o sea despues de gastar gas.
    expect(isRefusal(parseRelayRequest({ ...good, signature: "0xdeadbeef" }))).toBe(true);
    expect(isRefusal(parseRelayRequest({ ...good, signature: "0x" + "ab".repeat(64) }))).toBe(true);
  });

  it("rechaza un deadline que no es un numero", () => {
    expect(isRefusal(parseRelayRequest({ ...good, deadline: "pronto" }))).toBe(true);
  });

  it("no explota con un body vacio", () => {
    expect(isRefusal(parseRelayRequest(undefined))).toBe(true);
    expect(isRefusal(parseRelayRequest({}))).toBe(true);
  });
});

describe("assertRelayable — la politica anti-abuso", () => {
  async function req(over: Partial<{ signature: Hex; deadline: string; payout: Address }> = {}) {
    return {
      vault: VAULT,
      payout: over.payout ?? PAYOUT,
      deadline: over.deadline ?? DEADLINE,
      signature: over.signature ?? (await voucher(ATTESTER_PK)),
    };
  }

  it("relaya un voucher legitimo", async () => {
    expect(await assertRelayable(await req(), NOW)).toBeNull();
  });

  it("LA defensa: no relaya un voucher que no firmamos nosotros", async () => {
    // Sin esto el endpoint es una billetera abierta: cualquiera arma un pedido y le pagamos el
    // gas. La firma se verifica contra el attester VIGENTE, sobre un digest que recalculamos.
    const forged = await voucher(OTHER_PK);
    const r = await assertRelayable(await req({ signature: forged }), NOW);
    expect(r?.status).toBe(403);
    expect(r?.reason).toMatch(/not issued by this attester/i);
  });

  it("no relaya si el attester rotó después de firmarse el voucher", async () => {
    attester = privateKeyToAccount(OTHER_PK).address;
    const r = await assertRelayable(await req(), NOW);
    expect(r?.status).toBe(403);
  });

  it("no relaya un voucher cuyo payout fue cambiado (el digest deja de cerrar)", async () => {
    const sig = await voucher(ATTESTER_PK, { payout: PAYOUT });
    const otro = "0x4444444444444444444444444444444444444444" as Address;
    const r = await assertRelayable(await req({ signature: sig, payout: otro }), NOW);
    expect(r?.status).toBe(403);
  });

  it("no relaya un voucher viejo aunque la firma sea nuestra (el nonce ya avanzó)", async () => {
    const sig = await voucher(ATTESTER_PK, { nonce: 0n });
    bindNonce = 1n;
    const r = await assertRelayable(await req({ signature: sig }), NOW);
    expect(r?.status).toBe(403);
  });

  it("rechaza una direccion que no salio de nuestra factory", async () => {
    isVault = false;
    const r = await assertRelayable(await req(), NOW);
    expect(r?.status).toBe(403);
    expect(r?.reason).toMatch(/not a RobinShare vault/i);
  });

  it("rechaza un vault ya bindeado — es el limite natural por vault, sin estado nuestro", async () => {
    boundWallet = PAYOUT;
    const r = await assertRelayable(await req(), NOW);
    expect(r?.status).toBe(409);
    expect(r?.reason).toMatch(/already claimed/i);
  });

  it("rechaza un vault sin moneda atada — la barrera economica", async () => {
    // Para hacernos gastar gas, el atacante primero tiene que pagar un launch real de pons
    // (0,0005 ETH), que cuesta mas que el gas que nos sacaria.
    token = ZERO;
    const r = await assertRelayable(await req(), NOW);
    expect(r?.status).toBe(409);
    expect(r?.reason).toMatch(/not linked to a coin/i);
  });

  it("rechaza un voucher vencido", async () => {
    const past = String(NOW - 1);
    const sig = await voucher(ATTESTER_PK, { deadline: past });
    const r = await assertRelayable(await req({ signature: sig, deadline: past }), NOW);
    expect(r?.status).toBe(400);
    expect(r?.reason).toMatch(/expired/i);
  });

  it("hoy solo relaya la ruta GitHub", async () => {
    identityType = 2; // X
    const r = await assertRelayable(await req(), NOW);
    expect(r?.status).toBe(400);
    expect(r?.reason).toMatch(/GitHub/i);
  });
});

describe("firmas canonicas (malleabilidad)", () => {
  // Para toda firma (r,s,v) existe la gemela (r, n-s, v invertido) que recupera la MISMA
  // direccion. `recoverAddress` acepta las dos; el ECDSA de OpenZeppelin que corre en el
  // contrato rechaza la de `s` alto. Sin este filtro el server aprobaba variantes que la cadena
  // despues rechaza, y lo unico que evitaba pagar ese gas era el simulate — o sea que la defensa
  // declarada no era la que estaba funcionando.
  const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

  function malleate(sig: string): Hex {
    const r = sig.slice(2, 66);
    const s = BigInt(`0x${sig.slice(66, 130)}`);
    const v = parseInt(sig.slice(130, 132), 16);
    const flipped = (N - s).toString(16).padStart(64, "0");
    const newV = (v === 27 ? 28 : 27).toString(16).padStart(2, "0");
    return `0x${r}${flipped}${newV}` as Hex;
  }

  it("acepta la firma canonica", async () => {
    expect(isCanonicalSignature(await voucher(ATTESTER_PK))).toBe(true);
  });

  it("RECHAZA la gemela malleada, que es la que el contrato rechazaria", async () => {
    const good = await voucher(ATTESTER_PK);
    const evil = malleate(good);
    expect(evil).not.toBe(good);
    expect(isCanonicalSignature(evil)).toBe(false);
  });

  it("la politica completa tambien la rechaza, sin llegar a la cadena", async () => {
    const evil = malleate(await voucher(ATTESTER_PK));
    const r = await assertRelayable(
      { vault: VAULT, payout: PAYOUT, deadline: DEADLINE, signature: evil },
      NOW,
    );
    expect(r?.status).toBe(400);
    expect(r?.reason).toMatch(/non-canonical/i);
  });
});

describe("el candado de concurrencia", () => {
  it("lo toma UNO solo: N pedidos simultaneos no pueden pasar todos", () => {
    // El bug que esto cierra: el chequeo estaba al entrar y la marca cuatro round-trips de RPC
    // despues, asi que 25 POST en paralelo conseguian 25 transacciones firmadas. Tomarlo de
    // forma SINCRONA es lo que lo arregla: Node no interrumpe entre `await`s.
    const tokens = Array.from({ length: 25 }, (_, i) => NOW * 1000 + i);
    const ganadores = tokens.filter((t) => acquireClaimLock(VAULT, t));
    expect(ganadores).toHaveLength(1);
  });

  it("solo lo suelta el que lo tomo", () => {
    const mio = NOW * 1000;
    expect(acquireClaimLock(VAULT, mio)).toBe(true);
    releaseClaimLock(VAULT, mio + 999); // un hermano intentando soltarlo
    expect(isClaimLocked(VAULT, mio)).toBe(true);
    releaseClaimLock(VAULT, mio);
    expect(isClaimLocked(VAULT, mio)).toBe(false);
  });

  it("expira solo, para que una tx colgada no bloquee el vault para siempre", () => {
    acquireClaimLock(VAULT, NOW * 1000);
    expect(isClaimLocked(VAULT, NOW * 1000 + 91_000)).toBe(false);
    expect(acquireClaimLock(VAULT, NOW * 1000 + 91_000)).toBe(true);
  });
});


describe("el gas limit explicito del claim (sin esto el relayer NO funciona en esta cadena)", () => {
  /// EL BUG QUE ESTO IMPIDE QUE VUELVA.
  ///
  /// Si a `simulateContract` se le pasa `maxFeePerGas` pero NO `gas`, viem estima el gas y esa
  /// estimacion acota el limite superior por el gas limit del BLOQUE. En Robinhood Chain
  /// (Arbitrum Orbit) ese limite es 1.125.899.906.842.624 (2^50), no los ~30M de una L1: el
  /// chequeo de saldo pasa a exigir 2^50 * 2 gwei = 2.251.799 ETH y TODO claim muere con "the
  /// total cost of executing this transaction exceeds the balance of the account".
  ///
  /// No es teorico: se midio contra un fork de la cadena real y fallaba igual con el relayer
  /// fondeado con 100 ETH. Con el `gas` explicito, el mismo claim paso con 0,01 ETH.
  const GAS_LIMIT_DEL_BLOQUE = 1_125_899_906_842_624n; // medido en mainnet 4663
  const COSTO_MEDIDO = 169_365n; // gasUsed real de un claimAndBind con harvest + payout

  it("existe y alcanza para el costo medido, con margen", () => {
    expect(CLAIM_GAS_LIMIT).toBeGreaterThan(COSTO_MEDIDO * 2n);
  });

  it("es MUCHO menor que el gas limit del bloque — que es justamente el punto", () => {
    expect(CLAIM_GAS_LIMIT).toBeLessThan(GAS_LIMIT_DEL_BLOQUE / 1_000_000n);
  });

  it("al tope de fee, el saldo que le exige al relayer es pagable", () => {
    // Con el bug, esto daba 2,25 millones de ETH.
    const requerido = CLAIM_GAS_LIMIT * 2_000_000_000n; // 2 gwei
    expect(requerido).toBeLessThan(10_000_000_000_000_000n); // < 0,01 ETH
  });

  it("la ruta del relayer lo pasa a simulateContract", async () => {
    // Guarda anti-borrado: el valor puede ser correcto y no usarse.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app", "api", "relay", "claim", "route.ts"),
      "utf8",
    );
    expect(src).toMatch(/gas:\s*CLAIM_GAS_LIMIT/);
  });
});
