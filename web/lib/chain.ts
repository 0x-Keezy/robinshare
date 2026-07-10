import { createPublicClient, defineChain, http } from "viem";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com"),
});

export const factoryAddress = () => {
  const a = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (!a || !a.startsWith("0x") || a.length !== 42) return null;
  return a as `0x${string}`;
};
