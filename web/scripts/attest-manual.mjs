// web/scripts/attest-manual.mjs — USO EXCEPCIONAL (piloto): atestacion MANUAL.
// La verificacion de identidad la hace UN HUMANO fuera de banda (mira el GitHub/X del
// receptor y confirma que es quien dice). Centralizado a proposito — solo para cuando
// GitHub/X esten caidos. Firma con la MISMA key del attester canonico.
//
// Uso:  ATTESTER_PK=0x.. [RPC_URL=..] node scripts/attest-manual.mjs <vault> <payout>
// Salida (JSON): {vault, payout, deadline, signature}  -> pegar en claimAndBind.
import { createPublicClient, http, serializeSignature } from "viem";
import { sign } from "viem/accounts";

const [vault, payout] = process.argv.slice(2);
if (!vault || !payout || !process.env.ATTESTER_PK) {
  console.error("uso: ATTESTER_PK=0x.. node scripts/attest-manual.mjs <vault> <payout>");
  process.exit(1);
}

const client = createPublicClient({
  transport: http(process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com"),
});
const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);

const digest = await client.readContract({
  address: vault,
  abi: [
    {
      type: "function",
      name: "bindDigest",
      stateMutability: "view",
      inputs: [{ type: "address" }, { type: "uint256" }],
      outputs: [{ type: "bytes32" }],
    },
  ],
  functionName: "bindDigest",
  args: [payout, deadline],
});

const sig = await sign({ hash: digest, privateKey: process.env.ATTESTER_PK });
console.log(JSON.stringify({ vault, payout, deadline: deadline.toString(), signature: serializeSignature(sig) }, null, 2));
