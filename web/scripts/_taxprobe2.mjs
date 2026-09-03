// Con que creator tax se lanzo REALMENTE el token del piloto. Se lee del registro de pons.
import { createPublicClient, http, parseAbi } from "viem";
const client = createPublicClient({ transport: http("https://rpc.mainnet.chain.robinhood.com") });
const PONS = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const TOKEN = "0xDDdd08BFd8Fd58Ba78081e7EE0da03845Ad7592E";
const abi = parseAbi([
  "struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }",
  "function getLaunchedToken(address token) view returns (LaunchedToken)",
  "function maxCreatorTaxBps() view returns (uint16)",
]);
const t = await client.readContract({ address: PONS, abi, functionName: "getLaunchedToken", args: [TOKEN] });
console.log("creatorTaxBps =", t.creatorTaxBps, "-> tax visible", 1 + t.creatorTaxBps / 100, "% / al vault", (0.7 + t.creatorTaxBps / 100).toFixed(2), "%");
console.log("creatorFeeRecipient =", t.creatorFeeRecipient);
console.log("pairToken =", t.pairToken, "phase =", t.phase, "exists =", t.exists);
console.log("maxCreatorTaxBps (hoy) =", await client.readContract({ address: PONS, abi, functionName: "maxCreatorTaxBps" }));
