import type { MUDChain } from "@latticexyz/common/chains";
import { mudFoundry } from "@latticexyz/common/chains";
import "dotenv/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WORLD_ADDRESS = process.env.WORLD_ADDRESS;
const INITIAL_BLOCK_NUMBER = process.env.INITIAL_BLOCK_NUMBER;

if (!PRIVATE_KEY) {
  throw new Error(`Invalid/Missing environment variable: "PRIVATE_KEY"`);
}

if (!WORLD_ADDRESS) {
  throw new Error(`Invalid/Missing environment variable: "WORLD_ADDRESS"`);
}

if (!INITIAL_BLOCK_NUMBER) {
  throw new Error(
    `Invalid/Missing environment variable: "INITIAL_BLOCK_NUMBER"`
  );
}

// Define Base mainnet chain
const base: MUDChain = {
  name: "Base",
  id: 8453,
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: {
      http: [(process.env.RPC_HTTP_URL || "https://mainnet.base.org") as string],
      webSocket: process.env.RPC_WS_URL ? [process.env.RPC_WS_URL] : [],
    },
    public: {
      http: [(process.env.RPC_HTTP_URL || "https://mainnet.base.org") as string],
      webSocket: process.env.RPC_WS_URL ? [process.env.RPC_WS_URL] : [],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: "https://basescan.org",
    },
  },
};

const SUPPORTED_CHAINS = [mudFoundry, base];

export async function getNetworkConfig(): Promise<{
  privateKey: `0x${string}`;
  chainId: number;
  chain: MUDChain;
  worldAddress: string;
  initialBlockNumber: number | bigint;
}> {
  // In production, use CHAIN_ID env var (defaults to Base mainnet)
  // In development, use CHAIN_ID if set, otherwise use local Foundry chain
  let chainId: number;
  if (process.env.NODE_ENV === "production") {
    chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : Number(base.id);
    console.log(`[getNetworkConfig] Using chain ${chainId} in production`);
  } else {
    chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : Number(mudFoundry.id);
    console.log(`[getNetworkConfig] Using chain ID: ${chainId}`);
  }

  const chainIndex = SUPPORTED_CHAINS.findIndex((c) => c.id === chainId);
  const chain = SUPPORTED_CHAINS[chainIndex];
  if (!chain) {
    throw new Error(`Chain ${chainId} not found`);
  }

  return {
    privateKey: PRIVATE_KEY as `0x${string}`,
    chainId,
    chain,
    worldAddress: WORLD_ADDRESS as string,
    initialBlockNumber: BigInt(INITIAL_BLOCK_NUMBER as string),
  };
}
