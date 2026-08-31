import { parseEventLogs, toHex, type Address, type Hex, type Log } from "viem";
import { factoryAbi } from "./abis";

/// Rail pons v2 en Robinhood Chain (chainId 4663).
///
/// Gemelo de `contracts/src/pons/PonsAddresses.sol` — mismo rol, mismo comentario: es el UNICO
/// lugar del front donde viven estas direcciones. Todas VERIFICADAS con `cast call` contra
/// https://rpc.mainnet.chain.robinhood.com el 2026-08-30 (bloque 50.396.351).

/// PonsV2LaunchFactory. Verificado en Blockscout, NO es proxy.
export const PONS_LAUNCH_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e" as const;

/// V2FeeEscrow — el ledger pull-payment donde se acreditan las creator fees.
export const PONS_FEE_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e" as const;

/// El unico launch config habilitado hoy (`launchConfigCount() == 1`).
export const PONS_LAUNCH_CONFIG_ID = 0n;

/// RobinShare lanza SIEMPRE contra ETH nativo. No es una preferencia: con un par ERC-20 las fees
/// se acreditan en el ledger POR TOKEN del escrow y el vault entregaria CERO, asi que
/// `attachToken()` rechaza esos launches en el contrato.
export const PONS_NATIVE_PAIR = "0x0000000000000000000000000000000000000000" as const;

/// Valor MEDIDO de `launchFee()`. Es estado mutable del owner de pons (un Safe 2-de-3), no una
/// constante del protocolo: el flujo real lo LEE de la cadena y usa esto solo para avisar si se
/// movio. `launchToken` exige `msg.value == launchFee` EXACTO — ni un wei de mas.
export const EXPECTED_LAUNCH_FEE = 500_000_000_000_000n; // 0,0005 ETH

/// Valor MEDIDO de `maxCreatorTaxBps()`. Tambien mutable; tambien se lee en vivo.
export const MAX_CREATOR_TAX_BPS = 1000; // 10,00%

export type IdentityType = "wallet" | "github" | "twitter";

/// Los mismos numeros que las constantes del contrato (TYPE_WALLET / TYPE_GITHUB / TYPE_TWITTER).
export function identityTypeId(t: IdentityType): 0 | 1 | 2 {
  return t === "wallet" ? 0 : t === "github" ? 1 : 2;
}

export const ZERO_BYTES32 = `0x${"00".repeat(32)}` as Hex;

// ─────────────────────────────── ABI de pons ───────────────────────────────

/// Superficie de pons que usa la web. La forma de `TokenParams` esta VERIFICADA por selector:
///   launchToken((string,string,string,string,(string,string,string,string,string),
///                address,uint16,bool,bytes32,bytes32),uint256,address)  ->  0xf35abbcf
/// que es exactamente el selector que el spec §16 registra del contrato desplegado.
export const ponsAbi = [
  {
    type: "function",
    name: "launchToken",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "logo", type: "string" },
          { name: "description", type: "string" },
          {
            name: "socials",
            type: "tuple",
            components: [
              { name: "twitter", type: "string" },
              { name: "telegram", type: "string" },
              { name: "discord", type: "string" },
              { name: "website", type: "string" },
              { name: "farcaster", type: "string" },
            ],
          },
          { name: "creatorFeeRecipient", type: "address" },
          { name: "creatorTaxBps", type: "uint16" },
          { name: "buybackEnabled", type: "bool" },
          { name: "expectedEconomics", type: "bytes32" },
          { name: "salt", type: "bytes32" },
        ],
      },
      { name: "launchConfigId", type: "uint256" },
      { name: "pairToken", type: "address" },
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "curve", type: "address" },
    ],
  },
  { type: "function", name: "launchFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxCreatorTaxBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "launchEnabled", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "canLaunch",
    stateMutability: "view",
    inputs: [{ name: "launcher", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "previewLaunchEconomics",
    stateMutability: "view",
    inputs: [
      { name: "launchConfigId", type: "uint256" },
      { name: "pairToken", type: "address" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "event",
    name: "TokenLaunched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "curve", type: "address", indexed: true },
      { name: "deployer", type: "address", indexed: true },
      { name: "pairToken", type: "address" },
      { name: "launchConfigId", type: "uint256" },
      { name: "graduationThreshold", type: "uint256" },
    ],
  },
] as const;

// ─────────────────────────────── params del launch ───────────────────────────────

export type LaunchIdentity =
  | { type: "github"; handle: string }
  | { type: "twitter"; handle: string }
  | { type: "wallet"; wallet: Address };

export type BuildTokenParamsInput = {
  name: string;
  symbol: string;
  description?: string;
  /// El vault recien creado. Aca van TODAS las creator fees.
  vault: Address;
  creatorTaxBps: number;
  identity: LaunchIdentity;
  /// Salt CREATE2. Namespaced por cuenta en pons: basta que no se repita entre los launches de
  /// la misma wallet. NO se mina: pons no exige vanity.
  salt: Hex;
  logoUrl?: string;
  /// Pin de la economia cotizada, de `previewLaunchEconomics`. Omitirlo manda bytes32(0), que
  /// pons interpreta como "sin chequeo".
  expectedEconomics?: Hex;
};

export type PonsTokenParams = {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
  creatorFeeRecipient: Address;
  creatorTaxBps: number;
  buybackEnabled: false;
  expectedEconomics: Hex;
  salt: Hex;
};

/// Arma el `TokenParams` de `launchToken`. Puro: no toca la red, para que sea testeable.
///
/// Dos invariantes que NO son configurables y por eso viven aca y no en la UI:
///   - `creatorFeeRecipient` es siempre el vault (es el producto entero);
///   - `buybackEnabled` es siempre false — con buyback activo `buybackBurnBps = 5000` se lleva la
///     mitad del bucket del creador y la vestea 5 anios, y ademas `attachToken()` lo rechaza, o
///     sea que el launch quedaria huerfano.
export function buildTokenParams(input: BuildTokenParamsInput): PonsTokenParams {
  const name = input.name.trim();
  const symbol = input.symbol.trim();
  if (!name) throw new Error("Token name is required.");
  if (!symbol) throw new Error("Ticker (symbol) is required.");

  const tax = input.creatorTaxBps;
  if (!Number.isInteger(tax) || tax < 0 || tax > MAX_CREATOR_TAX_BPS) {
    throw new Error(
      `Creator tax must be a whole number between 0 and ${MAX_CREATOR_TAX_BPS} bps (${MAX_CREATOR_TAX_BPS / 100}%).`,
    );
  }

  const gh = input.identity.type === "github" ? input.identity.handle.trim() : "";
  const x = input.identity.type === "twitter" ? input.identity.handle.trim() : "";

  return {
    name,
    symbol,
    // `logo` es una URL en pons (queda en el propio token, `PonsV2LauncherToken.logo`). Para una
    // identidad de GitHub el avatar publico del dev es una URL real y estable, asi que el launch
    // sale ilustrado sin que nadie suba nada.
    logo: input.logoUrl?.trim() || (gh ? `https://github.com/${gh}.png` : ""),
    description: input.description?.trim() ?? "",
    socials: {
      twitter: x ? `https://x.com/${x}` : "",
      telegram: "",
      discord: "",
      website: gh ? `https://github.com/${gh}` : "",
      farcaster: "",
    },
    creatorFeeRecipient: input.vault,
    creatorTaxBps: tax,
    buybackEnabled: false,
    expectedEconomics: input.expectedEconomics ?? ZERO_BYTES32,
    salt: input.salt,
  };
}

/// Salt aleatorio de 32 bytes. Reemplaza al minado de vanity `0x7777` que exigia el portal de
/// Flap: pons no pide ningun patron, solo que el valor no se haya usado antes desde esa cuenta.
export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/// Saca la direccion del vault del `VaultCreated` de NUESTRA factory.
///
/// El filtro por emisor no es decorativo: `parseEventLogs` decodifica por firma, asi que sin el
/// un contrato hostil que emita un `VaultCreated` falso en la misma transaccion podria hacernos
/// apuntar las creator fees a un vault ajeno.
/// Forma minima de un log, para que la firma acepte tanto `receipt.logs` de viem como los logs
/// sinteticos de los tests sin arrastrar los tipos literales de `encodeEventTopics`.
export type LogLike = { address: string; topics: readonly unknown[]; data: string };

export function vaultFromReceiptLogs(logs: readonly LogLike[], factory: Address): Address | null {
  const parsed = parseEventLogs({
    abi: factoryAbi,
    eventName: "VaultCreated",
    logs: logs as unknown as Log[],
  });
  const mine = parsed.find((l) => l.address.toLowerCase() === factory.toLowerCase());
  return (mine?.args as { vault?: Address } | undefined)?.vault ?? null;
}

/// Gemelo del anterior para el `TokenLaunched` de pons: devuelve el token y su curva.
///
/// Mismo filtro por emisor, y por el mismo motivo: el token que sale de aca es el que despues se
/// le pasa a `attachToken()`. Un evento falsificado por otro contrato en la misma transaccion no
/// puede secuestrar ese paso. (El contrato lo re-verifica igual contra el registro de pons — esto
/// es la primera de las dos capas, no la unica.)
export function launchFromReceiptLogs(
  logs: readonly LogLike[],
): { token: Address; curve: Address } | null {
  const parsed = parseEventLogs({
    abi: ponsAbi,
    eventName: "TokenLaunched",
    logs: logs as unknown as Log[],
  });
  const mine = parsed.find((l) => l.address.toLowerCase() === PONS_LAUNCH_FACTORY.toLowerCase());
  const args = mine?.args as { token?: Address; curve?: Address } | undefined;
  return args?.token && args?.curve ? { token: args.token, curve: args.curve } : null;
}

// ─────────────────────────────── errores legibles ───────────────────────────────

/// Los custom errors que un usuario puede provocar, traducidos. Todo lo demas devuelve null:
/// inventar una explicacion para un revert que no reconocemos seria peor que mostrar el crudo.
const REVERT_HINTS: [RegExp, string][] = [
  [/LaunchFeeNotPaid/, "pons requires the launch fee exactly — not a wei more or less. Reload and try again; the fee may have changed on-chain."],
  [/CreatorTaxTooHigh|CombinedFeeTooHigh/, "The creator tax is above what pons allows right now. Lower it and retry."],
  [/LaunchEconomicsMismatch/, "pons changed the launch terms while your transaction was in flight, so it reverted instead of launching under different economics. Reload and try again."],
  [/NotWhitelisted/, "Launching on pons is closed to the public right now (whitelist only). Nothing was spent."],
  [/PairTokenNotApproved/, "That pair token is not approved on pons."],
  [/InvalidTokenParams/, "pons rejected the name or ticker — both are required."],
  [/LaunchConfigDisabled|InvalidLaunchConfigId/, "The pons launch config this app uses is no longer available. This needs a code update."],
  [/PairMustBeNative/, "RobinShare only supports launches paired against native ETH."],
  [/BuybackMustBeDisabled/, "The launch has pons' buyback enabled, which would divert half the builder's fees into a 5-year vest. The vault refuses to attach to it."],
  [/NotOurLaunch/, "That launch does not route its creator fees to this vault."],
  [/LaunchedByStranger/, "That coin was launched by a different wallet than the one that created this vault. Send this last step from the wallet that created it, or launch the coin from that same wallet."],
  [/TokenAlreadyAttached/, "This vault is already attached to a token."],
  [/BadHandleCharset/, "That handle has characters no real account can have (only a-z, 0-9 and - or _)."],
  [/BadHandleLength/, "That handle is too long or empty."],
  [/RecoveryWindowTooShort/, "Recovery must be 0 (never) or at least 30 days."],
  [/RecoveryWindowTooLong/, "Recovery cannot be more than 3650 days."],
];

export function ponsRevertHint(message: string): string | null {
  for (const [re, hint] of REVERT_HINTS) if (re.test(message)) return hint;
  return null;
}

// ─────────────────────────────── badge de recovery ───────────────────────────────

/// Lee el estado de recovery de un vault y lo dice EN CLARO. El badge sale de `recoveryAfter()`
/// on-chain, no de una promesa de marketing: es exactamente la diferencia entre "confia en
/// nosotros" y "verificalo vos".
///
/// Dos fuentes de irrevocabilidad, y las dos son duras en el contrato:
///   - `recoveryAfter == 0` -> `recoverUnclaimed` revierte `RecoveryDisabled` para siempre;
///   - ya hay un `boundWallet` -> revierte `AlreadyBound`, aunque el plazo exista y venza.
export function recoveryBadge(
  recoveryAfter: bigint,
  nowSeconds: number,
  bound: boolean,
): { irrevocable: boolean; label: string } {
  if (recoveryAfter === 0n || bound) return { irrevocable: true, label: "irrevocable" };
  const remaining = Number(recoveryAfter) - nowSeconds;
  if (remaining <= 0) return { irrevocable: false, label: "revocable now" };
  const days = Math.ceil(remaining / 86400);
  return { irrevocable: false, label: `revocable in ${days} ${days === 1 ? "day" : "days"}` };
}
