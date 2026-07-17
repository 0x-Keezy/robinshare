// ABIs mínimos de los contratos FLEDGE (extraídos de contracts/src, congelados aquí).
// El attester lee bindDigest/bindNonce del propio vault (fuente única de verdad del typed-data).

export const escrowAbi = [
  { type: "function", name: "identityType", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "identityValue", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "attester", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "boundWallet", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "bindNonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pendingAmount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalPaid", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "taxToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "recoveryAfter", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
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
  { type: "function", name: "sweep", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "xVerifier", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "expectedTweet",
    stateMutability: "view",
    inputs: [{ name: "beneficiary", type: "address" }],
    outputs: [{ type: "string" }],
  },
  {
    // Audit v4 (774664f8): firma aplanada -- ver AUDIT-NOTES.md / claimByProof en
    // SocialFeeEscrow.sol. Antes tomaba un struct XGeneralProof + bytes; el vocabulario de
    // fieldType del schema on-chain no tiene "tuple", asi que el struct era inexpresable ahi.
    type: "function",
    name: "claimByProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tweetId", type: "uint256" },
      { name: "xHandle", type: "string" },
      { name: "xId", type: "uint256" },
      { name: "substring", type: "string" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const factoryAbi = [
  { type: "function", name: "attester", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "identityHashFor",
    stateMutability: "pure",
    inputs: [
      { name: "typeStr", type: "string" },
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
] as const;
