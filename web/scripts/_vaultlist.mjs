// Todos los vaults que creo la factory: se leen los VaultCreated desde el bloque del deploy.
import { createPublicClient, http, parseAbiItem, formatEther, parseAbi } from "viem";
const c = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const FACTORY = "0xBf25E1d9082B5Ad0b8C68f072E94C797028c6855";
const ev = parseAbiItem("event VaultCreated(bytes32 indexed identityHash, uint8 identityType, string identityValue, address vault, address launcher, uint64 recoveryAfter)");
// el vault del piloto se creo en el bloque 51172214-ish; se barre desde antes por las dudas
const from = 51100000n, to = await c.getBlockNumber();
const STEP = 200000n;
const found = [];
for (let b = from; b < to; b += STEP) {
  const logs = await c.getLogs({ address: FACTORY, event: ev, fromBlock: b, toBlock: b + STEP > to ? to : b + STEP });
  found.push(...logs);
  if (found.length && b > 51400000n) break; // ya pasamos la ventana del piloto
}
const vabi = parseAbi(["function pendingAmount() view returns (uint256)", "function totalPaid() view returns (uint256)", "function boundWallet() view returns (address)"]);
for (const l of found) {
  const a = l.args;
  const [pend, paid, bound] = await Promise.all([
    c.readContract({ address: a.vault, abi: vabi, functionName: "pendingAmount" }),
    c.readContract({ address: a.vault, abi: vabi, functionName: "totalPaid" }),
    c.readContract({ address: a.vault, abi: vabi, functionName: "boundWallet" }),
  ]);
  console.log(`type=${a.identityType} id="${a.identityValue}" vault=${a.vault} pending=${formatEther(pend)} paid=${formatEther(paid)} bound=${bound} recoveryAfter=${a.recoveryAfter}`);
}
console.log("total vaults:", found.length);
