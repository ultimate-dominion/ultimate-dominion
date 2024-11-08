import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  Has,
  HasValue,
  runQuery,
  createWorld,
  getComponentValue,
  getComponentValueStrict,
} from "@latticexyz/recs";
import { defineWorld } from "@latticexyz/world";
import { SyncStep } from "@latticexyz/store-sync";
import { syncToRecs, singletonEntity } from "@latticexyz/store-sync/recs";
import { ContractWrite, transportObserver } from "@latticexyz/common";
import { transactionQueue, writeObserver } from "@latticexyz/common/actions";
import { type MUDChain } from "@latticexyz/common/chains";
import { Subject } from "rxjs";
import {
  type ClientConfig,
  fallback,
  FallbackTransport,
  http,
  webSocket,
  createPublicClient,
  Hex,
  getContract,
  createWalletClient,
  Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getNetworkConfig } from "../lib/getNetworkConfig.js";

const MAX_POLL_INTERVALS = 5;

function createViemClientConfig(chain: MUDChain): {
  readonly chain: MUDChain;
  readonly transport: FallbackTransport;
  readonly pollingInterval: 1000;
} {
  return {
    chain,
    transport: transportObserver(fallback([webSocket(), http()])),
    pollingInterval: 1000,
  } as const satisfies ClientConfig;
}

export default async function sessionBooting(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  // if (!(req.method === "POST" || req.method == "OPTIONS")) {
  //   return res.status(405).json({ error: "Method not allowed" });
  // }

  // if (req.method === "OPTIONS") {
  //   return res.status(200).end();
  // }

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
    const publicClient = createPublicClient(clientOptions);

    const write$ = new Subject<ContractWrite>();
    const serverAccount = privateKeyToAccount(networkConfig.privateKey as Hex);
    const serverWalletClient = createWalletClient({
      ...clientOptions,
      account: serverAccount,
    })
      .extend(transactionQueue())
      .extend(writeObserver({ onWrite: (write) => write$.next(write) }));

    const worldContract = getContract({
      address: networkConfig.worldAddress as Hex,
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

    const { components, waitForTransaction } = await syncToRecs({
      world,
      config: mudConfig,
      address: networkConfig.worldAddress as Hex,
      publicClient,
      startBlock: BigInt(networkConfig.initialBlockNumber),
      indexerUrl: networkConfig.chain.indexerUrl,
    });

    const { SessionTimer, Spawned, SyncProgress } = components;

    let syncProgress = getComponentValue(SyncProgress, singletonEntity);
    let pollIntervals = 0;

    while (syncProgress?.step !== SyncStep.LIVE) {
      if (pollIntervals >= MAX_POLL_INTERVALS) {
        res.status(500).json({ error: "Syncing took too long" });
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      syncProgress = getComponentValue(SyncProgress, singletonEntity);
      pollIntervals++;
    }

    const expiredCharacterIds = Array.from(
      runQuery([
        Has(SessionTimer),
        Has(Spawned),
        HasValue(Spawned, { spawned: true }),
      ])
    )
      .map((entity) => {
        const timer = getComponentValueStrict(SessionTimer, entity);
        const { lastAction } = timer;

        return lastAction + BigInt(300) < BigInt(Date.now()) / BigInt(1000)
          ? entity
          : false;
      })
      .filter(Boolean) as Hash[];

    await publicClient.simulateContract({
      abi: worldContract.abi,
      account: serverWalletClient.account,
      address: worldContract.address,
      args: [expiredCharacterIds],
      functionName: "UD__removeEntitiesFromBoard",
    });

    const tx = await worldContract.write.UD__removeEntitiesFromBoard([
      expiredCharacterIds as Hash[],
    ]);

    await waitForTransaction(tx);

    return res.status(200).json({ expiredCharacterIds: expiredCharacterIds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
