import { getNetworkConfig } from "../lib/getNetworkConfig.js";
import { createPublicClient, http, } from "viem";
export default async function sessionLite(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    try {
        // Get network configuration (this is already working based on diagnostic)
        const networkConfig = await getNetworkConfig();
        console.log("[session_lite] Using chain ID:", networkConfig.chain.id);
        // Create a simple public client (HTTP only, no WebSocket)
        const publicClient = createPublicClient({
            chain: networkConfig.chain,
            transport: http(networkConfig.chain.rpcUrls.default.http[0]),
        });
        // Get current block number as proof of connectivity
        const blockNumber = await publicClient.getBlockNumber();
        // Simple check if world contract exists
        const bytecode = await publicClient.getBytecode({
            address: networkConfig.worldAddress
        });
        return res.status(200).json({
            status: "ok",
            message: "Session endpoint is working correctly",
            chainId: networkConfig.chain.id,
            chainName: networkConfig.chain.name,
            blockNumber: blockNumber.toString(),
            worldContractExists: bytecode !== undefined && bytecode.length > 0,
            worldAddress: networkConfig.worldAddress,
            // Since we're not doing the full sync, return empty array for now
            expiredCharacterIds: []
        });
    }
    catch (error) {
        console.error("Session_lite error:", error);
        return res.status(500).json({
            error: "Something went wrong",
            message: error instanceof Error ? error.message : String(error)
        });
    }
}
