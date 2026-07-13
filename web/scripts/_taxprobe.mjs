// Sondeo diferencial del límite de tax del VaultPortal de Flap (Robinhood Chain).
// eth_call (simulación, nada se broadcastea) con params idénticos salvo el tax.
// Si dos taxes revierten con la MISMA data, ambos pasaron (o fallaron) la misma
// validación; un revert DISTINTO al subir el tax marca la frontera del cap.
import { createPublicClient, http, encodeAbiParameters, getContractAddress, numberToHex, encodeFunctionData } from "viem";

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const VAULT_PORTAL = "0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B";
const PORTAL = "0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09";
const HASH = "0x6ce33cede557fe3331031c87bf9be28f493a6086cdc8770ac0a4c7dd7320dea7";
const ZERO = "0x0000000000000000000000000000000000000000";
const ZERO32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const abi = [{
  type: "function", name: "newTokenV6WithVault", stateMutability: "payable",
  inputs: [{ name: "params", type: "tuple", components: [
    { name: "name", type: "string" }, { name: "symbol", type: "string" }, { name: "meta", type: "string" },
    { name: "dexThresh", type: "uint8" }, { name: "salt", type: "bytes32" }, { name: "migratorType", type: "uint8" },
    { name: "quoteToken", type: "address" }, { name: "quoteAmt", type: "uint256" }, { name: "permitData", type: "bytes" },
    { name: "extensionID", type: "bytes32" }, { name: "extensionData", type: "bytes" }, { name: "dexId", type: "uint8" },
    { name: "lpFeeProfile", type: "uint8" }, { name: "buyTaxRate", type: "uint16" }, { name: "sellTaxRate", type: "uint16" },
    { name: "taxDuration", type: "uint64" }, { name: "antiFarmerDuration", type: "uint64" }, { name: "mktBps", type: "uint16" },
    { name: "deflationBps", type: "uint16" }, { name: "dividendBps", type: "uint16" }, { name: "lpBps", type: "uint16" },
    { name: "minimumShareBalance", type: "uint256" }, { name: "dividendToken", type: "address" },
    { name: "commissionReceiver", type: "address" }, { name: "tokenVersion", type: "uint8" },
    { name: "vaultFactory", type: "address" }, { name: "vaultData", type: "bytes" },
  ]}],
  outputs: [{ name: "token", type: "address" }],
}];

const client = createPublicClient({ transport: http(RPC) });

// minar salt vanity 7777 (igual que la UI)
let salt, token;
for (let i = 1; ; i++) {
  salt = numberToHex(BigInt(i), { size: 32 });
  token = getContractAddress({ opcode: "CREATE2", from: PORTAL, salt, bytecodeHash: HASH });
  if ((BigInt(token) & 0xffffn) === 0x7777n) break;
}
console.log("salt minado:", salt, "token:", token);

const vaultData = encodeAbiParameters(
  [{ type: "string" }, { type: "string" }, { type: "address" }, { type: "uint256" }],
  ["github", "octocat", ZERO, 0n],
);

function params(taxBps) {
  return {
    name: "Probe", symbol: "PRB", meta: "{}", dexThresh: 1, salt, migratorType: 1,
    quoteToken: ZERO, quoteAmt: 0n, permitData: "0x", extensionID: ZERO32, extensionData: "0x",
    dexId: 0, lpFeeProfile: 0, buyTaxRate: taxBps, sellTaxRate: taxBps,
    taxDuration: 3153600000n, antiFarmerDuration: 259200n, mktBps: 10000,
    deflationBps: 0, dividendBps: 0, lpBps: 0, minimumShareBalance: 0n,
    dividendToken: ZERO, commissionReceiver: ZERO, tokenVersion: 6,
    // vaultFactory: address sin código — si el tax pasa la validación, el revert
    // llega recién acá (mismo revert para todo tax válido = señal limpia)
    vaultFactory: "0x000000000000000000000000000000000000dEaD",
    vaultData,
  };
}

async function probe(taxBps) {
  const data = encodeFunctionData({ abi, functionName: "newTokenV6WithVault", args: [params(taxBps)] });
  try {
    await client.call({ to: VAULT_PORTAL, data, account: "0x1111111111111111111111111111111111111111" });
    return "SUCCESS(?)";
  } catch (e) {
    // extraer la data cruda del revert para comparar firmas
    const detail = e.walk ? e.walk() : e;
    const raw = detail?.data ?? detail?.cause?.data ?? e.details ?? e.shortMessage ?? String(e);
    return typeof raw === "string" ? raw.slice(0, 120) : JSON.stringify(raw).slice(0, 120);
  }
}

for (const bps of [1, 10, 25, 50, 99, 100]) {
  const r = await probe(bps);
  console.log(`tax ${String(bps).padStart(5)} bps (${(bps / 100).toFixed(1)}%): ${r}`);
}
