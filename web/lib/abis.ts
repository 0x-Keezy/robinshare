// ABIs minimos de los contratos de RobinShare sobre el rail pons v2 (congelados aca desde
// contracts/src). El attester NO lee `bindDigest` del vault: arma el typed-data el mismo
// (lib/bind.ts) — si lo leyera, un contrato hostil que reenvie esa funcion al vault de otra
// persona conseguiria una firma valida contra ESE vault.

const escrowFunctionsAbi = [
  // ── identidad ──
  { type: "function", name: "identityType", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "identityValue", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "attester", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "xVerifier", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "boundWallet", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "bindNonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "launcher", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },

  // ── el launch de pons al que esta atado ──
  // `token`/`curve` arrancan en 0x0 y los fija `attachToken()` DESPUES del launch: la direccion
  // del token depende de la de este vault, asi que no se puede predecir antes de crearlo.
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "curve", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "attachToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },

  // ── plata ──
  // `pendingAmount` = lo que ya esta en el vault + lo acreditado en el escrow de pons. NO incluye
  // lo que siga sin barrer en la curva: eso lo mueve `sweepCurve()`/`harvest()`.
  { type: "function", name: "pendingAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalPaid", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  // permissionless: cualquiera puede pagar el gas de traer la plata hasta el vault.
  { type: "function", name: "sweepCurve", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "pull", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "harvest", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
  // payout PULL: reemplaza al `sweep()` push del rail de Flap. Solo lo llama el boundWallet, y es
  // lo que permitio borrar el Guardian — si la wallet no puede recibir, simplemente no llama.
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "withdrawToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "erc20", type: "address" }],
    outputs: [],
  },

  // ── recovery ──
  // 0 = NUNCA (el default del producto). La UI muestra el badge leyendo ESTO, no una promesa.
  { type: "function", name: "recoveryAfter", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },

  // ── claims ──
  {
    type: "function",
    name: "bindDigest",
    stateMutability: "view",
    inputs: [
      { name: "payoutWallet", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "claimAndBind",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payoutWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "expectedTweet",
    stateMutability: "view",
    inputs: [{ name: "beneficiary", type: "address" }],
    outputs: [{ type: "string" }],
  },
  // OJO: cambio respecto del rail de Flap. Ahora toma `payoutWallet` como primer argumento y NO
  // exige `msg.sender == payout`: el substring del tweet ata la prueba a esa wallet y a este
  // vault, asi que un relayer puede pagar el gas del primer claim. Sin esto, un dev sin ETH en la
  // cadena no podia cobrar — justo en la ruta mas viral.
  {
    type: "function",
    name: "claimByProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payoutWallet", type: "address" },
      {
        name: "proof",
        type: "tuple",
        components: [
          { name: "tweetId", type: "uint128" },
          { name: "xHandle", type: "string" },
          { name: "xId", type: "uint128" },
          { name: "substring", type: "string" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "rebindWallet",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPayout", type: "address" }],
    outputs: [],
  },
] as const;

const factoryFunctionsAbi = [
  { type: "function", name: "attester", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  // La factory del rail pons expone un registro directo. Reemplaza al par
  // identityHashFor+getVaults para el chequeo de procedencia del attester: es O(1), no depende de
  // reimplementar la normalizacion de handles del contrato off-chain, y no crece con la cantidad
  // de vaults de una identidad.
  {
    type: "function",
    name: "isVault",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  // OJO: la firma cambio respecto de la factory de Flap, que tomaba (string typeStr, ...).
  // La del rail pons toma el tipo como uint8. Con la firma vieja el selector no existe y la
  // llamada revierte.
  {
    type: "function",
    name: "identityHashFor",
    stateMutability: "pure",
    inputs: [
      { name: "identityType", type: "uint8" },
      { name: "rawValue", type: "string" },
      { name: "identityWallet", type: "address" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getVaults",
    stateMutability: "view",
    inputs: [{ name: "identityHash", type: "bytes32" }],
    outputs: [{ type: "address[]" }],
  },
  // El entrypoint del rail pons. El vault va PRIMERO: la creation code de la curva de pons
  // incluye el `creatorFeeRecipient`, asi que la direccion del token depende de la del vault y no
  // se puede predecir al reves.
  {
    type: "function",
    name: "createVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityType", type: "uint8" },
      { name: "rawValue", type: "string" },
      { name: "identityWallet", type: "address" },
      { name: "recoveryDays", type: "uint256" },
    ],
    outputs: [{ name: "vault", type: "address" }],
  },
  {
    type: "event",
    name: "VaultCreated",
    inputs: [
      { name: "identityHash", type: "bytes32", indexed: true },
      { name: "identityType", type: "uint8" },
      { name: "identityValue", type: "string" },
      { name: "vault", type: "address" },
      { name: "launcher", type: "address" },
      { name: "recoveryAfter", type: "uint64" },
    ],
  },
] as const;

/// LOS CUSTOM ERRORS. Sin estos, la tabla de traducciones no puede funcionar NUNCA.
///
/// viem solo decodifica un custom error si su definicion esta en el ABI que se le pasa. Estos ABIs
/// no las tenian, asi que CADA revert le llegaba al usuario como
/// `reverted with the following signature: 0x157fd87e / Unable to decode signature ... Version:
/// viem@2.55.0` — y como `ponsRevertHint` matchea por NOMBRE sobre ese mismo texto, las 16
/// traducciones ya escritas devolvian `null` siempre. La feature estaba deployada y muerta.
///
/// Verificado contra el vault vivo: `claimAndBind` con deadline vencido devolvia `0x157fd87e`
/// (= `cast sig "VoucherExpired()"`) sin una palabra que dijera "volve a verificar con GitHub",
/// que era todo lo que el builder tenia que hacer.
///
/// GENERADO del ABI compilado (`contracts/out/*.json`), no escrito a mano.
export const vaultErrorsAbi = [
  { type: "error", name: "AlreadyBound", inputs: [] },
  { type: "error", name: "AttesterRequired", inputs: [] },
  { type: "error", name: "BadAttesterSignature", inputs: [] },
  { type: "error", name: "BadIdentityType", inputs: [] },
  { type: "error", name: "BuybackMustBeDisabled", inputs: [] },
  { type: "error", name: "ECDSAInvalidSignature", inputs: [] },
  { type: "error", name: "ECDSAInvalidSignatureLength", inputs: [{ name: "length", type: "uint256" }] },
  { type: "error", name: "ECDSAInvalidSignatureS", inputs: [{ name: "s", type: "bytes32" }] },
  { type: "error", name: "GithubOnly", inputs: [] },
  { type: "error", name: "InvalidProof", inputs: [] },
  { type: "error", name: "InvalidShortString", inputs: [] },
  { type: "error", name: "LaunchedByStranger", inputs: [] },
  { type: "error", name: "NotBoundWallet", inputs: [] },
  { type: "error", name: "NotBoundYet", inputs: [] },
  { type: "error", name: "NotIdentityWallet", inputs: [] },
  { type: "error", name: "NotOurLaunch", inputs: [] },
  { type: "error", name: "NothingToSweep", inputs: [] },
  { type: "error", name: "OnlyLauncher", inputs: [] },
  { type: "error", name: "OutdatedProof", inputs: [] },
  { type: "error", name: "PairMustBeNative", inputs: [] },
  { type: "error", name: "RecoveryDisabled", inputs: [] },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
  { type: "error", name: "SafeERC20FailedOperation", inputs: [{ name: "token", type: "address" }] },
  { type: "error", name: "SelfPayout", inputs: [] },
  { type: "error", name: "StringTooLong", inputs: [{ name: "str", type: "string" }] },
  { type: "error", name: "StringsInsufficientHexLength", inputs: [{ name: "value", type: "uint256" }, { name: "length", type: "uint256" }] },
  { type: "error", name: "SubstringMismatch", inputs: [] },
  { type: "error", name: "TokenAlreadyAttached", inputs: [] },
  { type: "error", name: "TooEarly", inputs: [] },
  { type: "error", name: "TwitterOnly", inputs: [] },
  { type: "error", name: "VoucherExpired", inputs: [] },
  { type: "error", name: "WalletOnly", inputs: [] },
  { type: "error", name: "WalletRequired", inputs: [] },
  { type: "error", name: "WrongXHandle", inputs: [] },
  { type: "error", name: "XVerifierMissing", inputs: [] },
  { type: "error", name: "ZeroPayout", inputs: [] },
] as const;

export const factoryErrorsAbi = [
  { type: "error", name: "BadHandleCharset", inputs: [] },
  { type: "error", name: "BadHandleLength", inputs: [] },
  { type: "error", name: "BadIdentityType", inputs: [] },
  { type: "error", name: "OnlyAttester", inputs: [] },
  { type: "error", name: "RecoveryWindowTooLong", inputs: [] },
  { type: "error", name: "RecoveryWindowTooShort", inputs: [] },
  { type: "error", name: "ValueMustBeEmptyForWallet", inputs: [] },
  { type: "error", name: "WalletRequired", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
] as const;

/// Los ABIs que consume la UI: funciones + errores. Se componen aca para que sea imposible
/// importar uno sin el otro.
export const escrowAbi = [...escrowFunctionsAbi, ...vaultErrorsAbi] as const;
export const factoryAbi = [...factoryFunctionsAbi, ...factoryErrorsAbi] as const;
