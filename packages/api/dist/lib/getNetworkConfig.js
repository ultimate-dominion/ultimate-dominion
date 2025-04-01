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
    throw new Error(`Invalid/Missing environment variable: "INITIAL_BLOCK_NUMBER"`);
}
// Define Pyrope chain
const pyrope = {
    name: "Pyrope",
    id: 695569,
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: {
        default: {
            http: [(process.env.RPC_HTTP_URL || "https://rpc.pyropechain.com")],
            webSocket: process.env.RPC_WS_URL ? [process.env.RPC_WS_URL] : ["wss://ws.pyropechain.com"],
        },
        public: {
            http: [(process.env.RPC_HTTP_URL || "https://rpc.pyropechain.com")],
            webSocket: process.env.RPC_WS_URL ? [process.env.RPC_WS_URL] : ["wss://ws.pyropechain.com"],
        },
    },
    blockExplorers: {
        default: {
            name: "Pyrope Explorer",
            url: "https://explorer.pyropechain.com",
        },
    },
    // Add indexer URL for MUD sync
    indexerUrl: process.env.INDEXER_URL || "https://indexer.mud.pyropechain.com",
};
const SUPPORTED_CHAINS = [mudFoundry, pyrope];
export async function getNetworkConfig() {
    // Always use Pyrope in production, regardless of CHAIN_ID
    // In development, use CHAIN_ID if set, otherwise use local Foundry chain
    let chainId;
    if (process.env.NODE_ENV === "production") {
        chainId = Number(pyrope.id);
        console.log("[getNetworkConfig] Using Pyrope chain in production");
    }
    else {
        chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : Number(mudFoundry.id);
        console.log(`[getNetworkConfig] Using chain ID: ${chainId}`);
    }
    const chainIndex = SUPPORTED_CHAINS.findIndex((c) => c.id === chainId);
    const chain = SUPPORTED_CHAINS[chainIndex];
    if (!chain) {
        throw new Error(`Chain ${chainId} not found`);
    }
    return {
        privateKey: PRIVATE_KEY,
        chainId,
        chain,
        worldAddress: WORLD_ADDRESS,
        initialBlockNumber: BigInt(INITIAL_BLOCK_NUMBER),
    };
}
