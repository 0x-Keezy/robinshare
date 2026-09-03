// Que dice la CADENA del piloto: el token del vault y el creator tax con el que se lanzo.
import { createPublicClient, http, parseAbi } from "viem";
const RPC = process.env.RH_RPC || "https://rpc.robinhood.com";
const VAULT = "0xcEd1174535C024BfEf0C9E6d2C2a825Cf5B8C2F3";
const FACTORY = "0xBf25E1d9082B5Ad0b8C68f072E94C797028c6855";
const client = createPublicClient({ transport: http(RPC) });
const abi = parseAbi([
  "function token() view returns (address)",
  "function totalPaidOut() view returns (uint256)",
  "function pendingAmount() view returns (uint256)",
  "function identityValue() view returns (string)",
  "function recoveryAfter() view returns (uint256)",
  "function boundWallet() view returns (address)",
]);
for (const fn of ["token", "totalPaidOut", "pendingAmount", "identityValue", "recoveryAfter", "boundWallet"]) {
  try { console.log(fn, "=", String(await client.readContract({ address: VAULT, abi, functionName: fn }))); }
  catch (e) { console.log(fn, "ERROR", String(e).slice(0, 90)); }
}
console.log("chainId =", await client.getChainId());
console.log("factory code bytes =", ((await client.getCode({ address: FACTORY })) ?? "0x").length / 2 - 1);
console.log("vault code bytes =", ((await client.getCode({ address: VAULT })) ?? "0x").length / 2 - 1);
