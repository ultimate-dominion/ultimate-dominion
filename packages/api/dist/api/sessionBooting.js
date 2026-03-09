import { Has, HasValue, runQuery, createWorld, getComponentValue, getComponentValueStrict, } from "@latticexyz/recs";
import { defineWorld } from "@latticexyz/world";
import { SyncStep } from "@latticexyz/store-sync";
import { syncToRecs, singletonEntity } from "@latticexyz/store-sync/recs";
import { transportObserver } from "@latticexyz/common";
import { fallback, http, webSocket, createPublicClient, getContract, createWalletClient, } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getNetworkConfig } from "../lib/getNetworkConfig.js";
// Increase polling intervals but decrease wait time between them
const MAX_POLL_INTERVALS = 30;
const POLL_INTERVAL_MS = 250; // Reduced from 500ms to 250ms
function createViemClientConfig(chain) {
    // Create transports based on available URLs
    const transports = [];
    // Only add WebSocket transport if WebSocket URLs are defined
    if (chain.rpcUrls.default.webSocket && chain.rpcUrls.default.webSocket.length > 0) {
        transports.push(webSocket(chain.rpcUrls.default.webSocket[0]));
    }
    // Always add HTTP transport
    if (chain.rpcUrls.default.http && chain.rpcUrls.default.http.length > 0) {
        transports.push(http(chain.rpcUrls.default.http[0]));
    }
    return {
        chain,
        transport: transportObserver(fallback(transports)),
        pollingInterval: 1000,
    };
}
export default async function sessionBooting(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    try {
        const mudConfig = defineWorld({
            namespace: "UD",
            deploy: {},
            userTypes: {
                ResourceId: {
                    filePath: "@latticexyz/store/src/ResourceId.sol",
                    type: "bytes32",
                },
            },
            systems: {},
            tables: {
                SessionTimer: {
                    key: ["characterId"],
                    schema: {
                        characterId: "bytes32",
                        lastAction: "uint256",
                    },
                },
                Spawned: {
                    key: ["entityId"],
                    schema: {
                        entityId: "bytes32",
                        spawned: "bool",
                    },
                },
            },
        });
        const world = createWorld();
        const networkConfig = await getNetworkConfig();
        const clientOptions = createViemClientConfig(networkConfig.chain);
        // Initialize public client with shorter polling interval for faster sync
        const publicClient = createPublicClient({
            ...clientOptions,
            pollingInterval: 500, // Reduced from 1000ms to 500ms for faster polling
        });
        const serverAccount = privateKeyToAccount(networkConfig.privateKey);
        const serverWalletClient = createWalletClient({
            ...clientOptions,
            account: serverAccount,
        });
        const worldContract = getContract({
            address: networkConfig.worldAddress,
            abi: [
                {
                    type: "function",
                    name: "UD__removeEntitiesFromBoard",
                    inputs: [
                        {
                            name: "entityIds",
                            type: "bytes32[]",
                            internalType: "bytes32[]",
                        },
                    ],
                    outputs: [],
                    stateMutability: "nonpayable",
                },
            ],
            client: { public: publicClient, wallet: serverWalletClient },
        });
        console.log(`[sessionBooting] Syncing from block ${networkConfig.initialBlockNumber}`);
        // Optimize sync to reduce time to LIVE state
        const { components, waitForTransaction } = await syncToRecs({
            world,
            config: mudConfig,
            address: networkConfig.worldAddress,
            publicClient,
            startBlock: BigInt(networkConfig.initialBlockNumber),
            indexerUrl: networkConfig.chain.indexerUrl,
            // We've removed the filters and disableCache options to ensure compatibility
            // Focus on other optimizations like polling interval and timeouts
        });
        const { SessionTimer, Spawned, SyncProgress } = components;
        let syncProgress = getComponentValue(SyncProgress, singletonEntity);
        let pollIntervals = 0;
        // Optimize the sync progress polling
        console.log(`[sessionBooting] Starting sync, current step: ${syncProgress?.step}`);
        const startTime = Date.now();
        while (syncProgress?.step !== SyncStep.LIVE) {
            if (pollIntervals >= MAX_POLL_INTERVALS) {
                return res.status(500).json({
                    error: "Syncing took too long",
                    currentStep: syncProgress?.step,
                    elapsedTime: `${(Date.now() - startTime) / 1000}s`,
                    pollIntervals: pollIntervals
                });
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            syncProgress = getComponentValue(SyncProgress, singletonEntity);
            pollIntervals++;
            // Log sync progress every 5 polls
            if (pollIntervals % 5 === 0) {
                console.log(`[sessionBooting] Sync progress: ${syncProgress?.step}, poll #${pollIntervals}`);
            }
        }
        const expiredCharacterIds = Array.from(runQuery([
            Has(SessionTimer),
            Has(Spawned),
            HasValue(Spawned, { spawned: true }),
        ]))
            .map((entity) => {
            const timer = getComponentValueStrict(SessionTimer, entity);
            const { lastAction } = timer;
            return lastAction + BigInt(300) < BigInt(Date.now()) / BigInt(1000)
                ? entity
                : false;
        })
            .filter(Boolean);
        console.log(`[sessionBooting] Found ${expiredCharacterIds.length} expired characters`);
        // Only run contract simulation and transaction if there are expired characters
        if (expiredCharacterIds.length > 0) {
            await publicClient.simulateContract({
                abi: worldContract.abi,
                account: serverWalletClient.account,
                address: worldContract.address,
                args: [expiredCharacterIds],
                functionName: "UD__removeEntitiesFromBoard",
            });
        }
        else {
            console.log("[sessionBooting] No expired characters to remove");
        }
        // Only execute transaction if there are expired characters to remove
        let tx = undefined;
        if (expiredCharacterIds.length > 0) {
            console.log(`[sessionBooting] Removing ${expiredCharacterIds.length} expired characters`);
            tx = await worldContract.write.UD__removeEntitiesFromBoard([
                expiredCharacterIds,
            ]);
            // Use a timeout to avoid waiting indefinitely for transaction
            const txPromise = waitForTransaction(tx);
            const timeoutPromise = new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Transaction wait timeout")), 20000) // 20 second timeout
            );
            try {
                await Promise.race([txPromise, timeoutPromise]);
                console.log(`[sessionBooting] Transaction ${tx} complete`);
            }
            catch (error) {
                console.error(`[sessionBooting] Transaction may not have completed in time: ${error}`);
                // Continue anyway - the transaction was sent
            }
        }
        return res.status(200).json({ expiredCharacterIds: expiredCharacterIds });
    }
    catch (error) {
        console.error("[sessionBooting] Error:", error);
        return res.status(500).json({
            error: "Something went wrong",
            message: error instanceof Error ? error.message : String(error)
        });
    }
}
