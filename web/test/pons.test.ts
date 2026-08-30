import { describe, it, expect } from "vitest";
import { encodeEventTopics, encodeAbiParameters, type Address, type Hex } from "viem";
import {
  PONS_LAUNCH_FACTORY,
  PONS_NATIVE_PAIR,
  EXPECTED_LAUNCH_FEE,
  MAX_CREATOR_TAX_BPS,
  identityTypeId,
  buildTokenParams,
  randomSalt,
  vaultFromReceiptLogs,
  ponsRevertHint,
  launchFromReceiptLogs,
  ponsAbi,
  recoveryBadge,
} from "@/lib/pons";
import { factoryAbi } from "@/lib/abis";

const VAULT = "0x1111111111111111111111111111111111111111" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

describe("direcciones del rail", () => {
  it("apunta al factory de pons v2 verificado on-chain", () => {
    expect(PONS_LAUNCH_FACTORY.toLowerCase()).toBe("0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e");
  });

  it("el par nativo es address(0) — RobinShare NO soporta pares ERC-20", () => {
    expect(PONS_NATIVE_PAIR).toBe(ZERO);
  });

  it("el launch fee medido es 0,0005 ETH", () => {
    expect(EXPECTED_LAUNCH_FEE).toBe(500_000_000_000_000n);
  });
});

describe("identityTypeId", () => {
  it("matchea las constantes del contrato (0 wallet / 1 github / 2 twitter)", () => {
    expect(identityTypeId("wallet")).toBe(0);
    expect(identityTypeId("github")).toBe(1);
    expect(identityTypeId("twitter")).toBe(2);
  });
});

describe("buildTokenParams", () => {
  const base = {
    name: "Aveline Coin",
    symbol: "AVE",
    description: "",
    vault: VAULT,
    creatorTaxBps: 300,
    identity: { type: "github" as const, handle: "torvalds" },
    salt: ("0x" + "ab".repeat(32)) as Hex,
  };

  it("manda las creator fees AL VAULT, que es todo el producto", () => {
    expect(buildTokenParams(base).creatorFeeRecipient).toBe(VAULT);
  });

  it("apaga el buyback SIEMPRE — no es configurable", () => {
    // Con buyback activo, buybackBurnBps=5000 se lleva la mitad del bucket del creador y la
    // vestea 5 anios. El contrato ademas rechaza el attach, asi que un true aca crearia un
    // launch huerfano que nunca podria cobrar.
    expect(buildTokenParams(base).buybackEnabled).toBe(false);
  });

  it("rechaza un creator tax por encima del tope de pons", () => {
    expect(() => buildTokenParams({ ...base, creatorTaxBps: MAX_CREATOR_TAX_BPS + 1 })).toThrow(
      /creator tax/i,
    );
  });

  it("acepta exactamente el tope", () => {
    expect(buildTokenParams({ ...base, creatorTaxBps: MAX_CREATOR_TAX_BPS }).creatorTaxBps).toBe(
      MAX_CREATOR_TAX_BPS,
    );
  });

  it("rechaza un tax no entero o negativo", () => {
    expect(() => buildTokenParams({ ...base, creatorTaxBps: -1 })).toThrow(/creator tax/i);
    expect(() => buildTokenParams({ ...base, creatorTaxBps: 12.5 })).toThrow(/creator tax/i);
  });

  it("exige nombre y ticker (pons revierte InvalidTokenParams sin ellos)", () => {
    expect(() => buildTokenParams({ ...base, name: "  " })).toThrow(/name/i);
    expect(() => buildTokenParams({ ...base, symbol: "" })).toThrow(/ticker|symbol/i);
  });

  it("usa el avatar de GitHub como logo por default", () => {
    expect(buildTokenParams(base).logo).toBe("https://github.com/torvalds.png");
  });

  it("un logo propio le gana al default", () => {
    const p = buildTokenParams({ ...base, logoUrl: "https://example.com/a.png" });
    expect(p.logo).toBe("https://example.com/a.png");
  });

  it("no inventa un logo para identidades que no son de GitHub", () => {
    expect(buildTokenParams({ ...base, identity: { type: "wallet", wallet: VAULT } }).logo).toBe("");
  });

  it("cablea los socials segun la identidad", () => {
    expect(buildTokenParams(base).socials.website).toBe("https://github.com/torvalds");
    const x = buildTokenParams({ ...base, identity: { type: "twitter", handle: "0xkeezy" } });
    expect(x.socials.twitter).toBe("https://x.com/0xkeezy");
    expect(x.socials.website).toBe("");
  });

  it("pasa el pin de economia tal cual lo dio la cadena", () => {
    const pin = ("0x" + "cd".repeat(32)) as Hex;
    expect(buildTokenParams({ ...base, expectedEconomics: pin }).expectedEconomics).toBe(pin);
  });

  it("sin pin manda bytes32(0), que es el valor que pons interpreta como 'sin chequeo'", () => {
    expect(buildTokenParams(base).expectedEconomics).toBe(`0x${"00".repeat(32)}`);
  });
});

describe("randomSalt", () => {
  it("es un bytes32 y no se repite", () => {
    const a = randomSalt();
    const b = randomSalt();
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("vaultFromReceiptLogs", () => {
  const factory = "0x2222222222222222222222222222222222222222" as Address;

  function vaultCreatedLog(vault: Address, emitter: Address) {
    // VaultCreated(bytes32 indexed identityHash, uint8 identityType, string identityValue,
    //              address vault, address launcher, uint64 recoveryAfter)
    const topics = encodeEventTopics({
      abi: factoryAbi,
      eventName: "VaultCreated",
      args: { identityHash: ("0x" + "11".repeat(32)) as Hex },
    });
    const data = encodeAbiParameters(
      [
        { type: "uint8" },
        { type: "string" },
        { type: "address" },
        { type: "address" },
        { type: "uint64" },
      ],
      [1, "torvalds", vault, factory, 0n],
    );
    return { address: emitter, topics, data };
  }

  it("saca la direccion del vault del evento de la factory", () => {
    expect(vaultFromReceiptLogs([vaultCreatedLog(VAULT, factory)], factory)).toBe(VAULT);
  });

  it("IGNORA un VaultCreated emitido por otro contrato", () => {
    // Sin este filtro, un contrato hostil podria emitir un VaultCreated falso en la misma
    // transaccion y hacernos apuntar las creator fees a un vault que no es nuestro.
    const impostor = "0x3333333333333333333333333333333333333333" as Address;
    expect(vaultFromReceiptLogs([vaultCreatedLog(VAULT, impostor)], factory)).toBeNull();
  });

  it("devuelve null si no hay evento", () => {
    expect(vaultFromReceiptLogs([], factory)).toBeNull();
  });
});

describe("ponsRevertHint", () => {
  it("traduce los reverts de pons que el usuario puede causar", () => {
    expect(ponsRevertHint("execution reverted: LaunchFeeNotPaid()")).toMatch(/launch fee/i);
    expect(ponsRevertHint("CreatorTaxTooHigh()")).toMatch(/creator tax/i);
    expect(ponsRevertHint("LaunchEconomicsMismatch(0x.., 0x..)")).toMatch(/changed the launch terms/i);
    expect(ponsRevertHint("NotWhitelisted()")).toMatch(/closed|whitelist/i);
    expect(ponsRevertHint("PairTokenNotApproved()")).toMatch(/pair/i);
  });

  it("traduce tambien los del vault", () => {
    expect(ponsRevertHint("PairMustBeNative()")).toMatch(/native ETH/i);
    expect(ponsRevertHint("BuybackMustBeDisabled()")).toMatch(/buyback/i);
  });

  it("no inventa nada para un error desconocido", () => {
    expect(ponsRevertHint("some unrelated failure")).toBeNull();
  });
});

describe("launchFromReceiptLogs", () => {
  function tokenLaunchedLog(token: Address, curve: Address, emitter: Address) {
    const topics = encodeEventTopics({
      abi: ponsAbi,
      eventName: "TokenLaunched",
      args: { token, curve, deployer: VAULT },
    });
    const data = encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
      [ZERO, 0n, 42n],
    );
    return { address: emitter, topics, data };
  }

  const TOKEN = "0x4444444444444444444444444444444444444444" as Address;
  const CURVE = "0x5555555555555555555555555555555555555555" as Address;

  it("saca token y curva del evento de pons", () => {
    expect(launchFromReceiptLogs([tokenLaunchedLog(TOKEN, CURVE, PONS_LAUNCH_FACTORY)])).toEqual({
      token: TOKEN,
      curve: CURVE,
    });
  });

  it("IGNORA un TokenLaunched emitido por otro contrato", () => {
    const impostor = "0x6666666666666666666666666666666666666666" as Address;
    expect(launchFromReceiptLogs([tokenLaunchedLog(TOKEN, CURVE, impostor)])).toBeNull();
  });

  it("devuelve null si no hay evento", () => {
    expect(launchFromReceiptLogs([])).toBeNull();
  });
});

describe("recoveryBadge", () => {
  const DAY = 86400;
  const NOW = 1_800_000_000;

  it("recoveryAfter = 0 es IRREVOCABLE — el default del producto", () => {
    const b = recoveryBadge(0n, NOW, false);
    expect(b.irrevocable).toBe(true);
    expect(b.label).toMatch(/irrevocable/i);
  });

  it("con plazo pendiente dice cuantos dias faltan", () => {
    const b = recoveryBadge(BigInt(NOW + 30 * DAY), NOW, false);
    expect(b.irrevocable).toBe(false);
    expect(b.label).toBe("revocable in 30 days");
  });

  it("redondea hacia arriba: un plazo a medio dia sigue siendo un dia", () => {
    expect(recoveryBadge(BigInt(NOW + DAY + 1), NOW, false).label).toBe("revocable in 2 days");
    expect(recoveryBadge(BigInt(NOW + DAY), NOW, false).label).toBe("revocable in 1 day");
  });

  it("vencido y sin bind: el launcher puede reclamar YA", () => {
    expect(recoveryBadge(BigInt(NOW - 1), NOW, false).label).toMatch(/revocable now/i);
  });

  it("una vez bindeado ya NO hay recovery posible, aunque el plazo exista", () => {
    // `recoverUnclaimed` revierte AlreadyBound despues de cualquier bind. Mostrar
    // "revocable" ahi seria mentirle al dev que acaba de probar su identidad.
    const b = recoveryBadge(BigInt(NOW + 30 * DAY), NOW, true);
    expect(b.irrevocable).toBe(true);
    expect(b.label).toMatch(/irrevocable/i);
  });
});
