import { garnet, MUDChain } from "@latticexyz/common/chains";
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

// Define Pyrope chain
const pyrope: MUDChain = {
  name: "Pyrope",
  id: 695569,
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: {
      http: [(process.env.RPC_HTTP_URL || "https://rpc.pyropechain.com") as string],
      webSocket: process.env.RPC_WS_URL ? [process.env.RPC_WS_URL] : undefined,
    },
    public: {
      http: [(process.env.RPC_HTTP_URL || "https://rpc.pyropechain.com") as string],
      webSocket: process.env.RPC_WS_URL ? [process.env.RPC_WS_URL] : undefined,
    },
  },
  blockExplorers: {
    default: {
      name: "Pyrope Explorer",
      url: "https://explorer.pyropechain.com",
    },
  },
};

const SUPPORTED_CHAINS = [garnet, mudFoundry, pyrope];

export async function getNetworkConfig(): Promise<{
  privateKey: `0x${string}`;
  chainId: number;
  chain: MUDChain;
  worldAddress: string;
  initialBlockNumber: number | bigint;
}> {
  // Default to Pyrope chain ID if CHAIN_ID environment variable is not set,
  // or use Garnet chain ID in production, or Foundry for local development
  const chainId = process.env.CHAIN_ID
    ? Number(process.env.CHAIN_ID)
    : process.env.NODE_ENV === "production"
    ? Number(garnet.id)
    : Number(mudFoundry.id);

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
