/*
 * The MUD client code is built on top of viem
 * (https://viem.sh/docs/getting-started.html).
 * This line imports the functions we need from it.
 */
import { ContractWrite, createBurnerAccount } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import { setComponent } from '@latticexyz/recs';
import { SyncStep } from '@latticexyz/store-sync';
import {
  encodeEntity,
  singletonEntity,
  syncToRecs,
} from '@latticexyz/store-sync/recs';
import mudConfig from 'contracts/mud.config';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { share, Subject } from 'rxjs';
import {
  createPublicClient,
  createWalletClient,
  getContract,
  Hex,
} from 'viem';

import { debug } from '../../utils/debug';
import { trackSyncLag, trackTxRoundtrip } from '../../utils/metricsReporter';

import { createViemClientConfig } from './createViemClientConfig';
import { externalTables } from './externalTables';
import { getNetworkConfig } from './getNetworkConfig';
import { loadRecsCache, restoreRecsCache, saveRecsCache } from './recsCache';
import { world } from './world';

/*
 * Import our MUD config, which includes strong types for
 * our tables and other config options. We use this to generate
 * things like RECS components and get back strong types for them.
 *
 * See https://mud.dev/templates/typescript/contracts#mudconfigts
 * for the source of this information.
 */

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function setupNetwork() {
  const networkConfig = await getNetworkConfig();
  debug.log('Setting up network with config', networkConfig);

  const clientOptions = createViemClientConfig(networkConfig.chain);
  const publicClient = createPublicClient(clientOptions);

  /*
   * Create an observable for contract writes that we can
   * pass into MUD dev tools for transaction observability.
   */
  const write$ = new Subject<ContractWrite>();

  /*
   * Create a temporary wallet and a viem client for it
   * (see https://viem.sh/docs/clients/wallet.html).
   */
  const burnerAccount = createBurnerAccount(networkConfig.privateKey as Hex);
  const burnerWalletClient = createWalletClient({
    ...clientOptions,
    account: burnerAccount,
  })
    .extend(transactionQueue())
    .extend(writeObserver({ onWrite: write => write$.next(write) }));

  /*
   * Create an object for communicating with the deployed World.
   */
  const worldContract = getContract({
    address: networkConfig.worldAddress as Hex,
    abi: IWorldAbi,
    client: { public: publicClient, wallet: burnerWalletClient },
  });

  // Optional indexer URL
  const indexerUrl =
    (import.meta.env.VITE_INDEXER_URL as string) || undefined;

  // Load RECS cache from IndexedDB for instant page loads
  const cache = await loadRecsCache(
    networkConfig.worldAddress,
    networkConfig.chainId,
  );

  const startBlock = cache
    ? cache.blockNumber
    : BigInt(networkConfig.initialBlockNumber);

  debug.log('Starting sync from block', startBlock.toString());

  const {
    components,
    latestBlock$,
    storedBlockLogs$,
    stopSync,
    waitForTransaction: mudWaitForTransaction,
  } = await syncToRecs({
      world,
      config: mudConfig,
      address: networkConfig.worldAddress as Hex,
      publicClient,
      startBlock,
      tables: externalTables,
      indexerUrl: indexerUrl || false,
    });

  // If we had a cache, restore all component values immediately so the UI
  // becomes usable while the background sync catches up on the delta.
  if (cache) {
    try {
      const restored = restoreRecsCache(world, cache);
      console.info(`[CACHE] Restored ${restored} entities from cache (block ${cache.blockNumber})`);

      // Mark sync as LIVE so the UI doesn't show a loading bar.
      // The background sync from cachedBlock will overwrite stale values.
      setComponent(components.SyncProgress, singletonEntity, {
        step: SyncStep.LIVE,
        message: 'Restored from cache',
        percentage: 100,
        latestBlockNumber: cache.blockNumber,
        lastBlockNumberProcessed: cache.blockNumber,
      });
    } catch (e) {
      console.warn('[CACHE] Failed to restore cache, continuing with sync', e);
    }
  }

  // Periodic cache save — use storedBlockLogs$ (NOT latestBlock$) because
  // latestBlock$ is the chain tip, while storedBlockLogs$ only emits after
  // logs have been applied to RECS. Using the chain tip would save a block
  // number ahead of what RECS has processed, creating gaps on restore.
  const CACHE_SAVE_INTERVAL_MS = 30_000;
  let lastProcessedBlock = 0n;
  let hasSavedOnce = false;

  storedBlockLogs$.subscribe({
    next: (blockLogs) => {
      const blockNum = blockLogs.blockNumber;
      if (blockNum <= lastProcessedBlock) return;
      lastProcessedBlock = blockNum;

      // Track sync lag: time between block timestamp and when we processed it
      if (blockLogs.blocks?.length) {
        const block = blockLogs.blocks[blockLogs.blocks.length - 1];
        if (block?.timestamp) {
          trackSyncLag(Number(block.timestamp), blockNum);
        }
      }

      // Save immediately on the first processed block (ensures cache exists
      // for next visit even if the user navigates away quickly).
      if (!hasSavedOnce) {
        hasSavedOnce = true;
        saveRecsCache(
          world,
          blockNum,
          networkConfig.worldAddress,
          networkConfig.chainId,
        ).then(() => {
          console.info(`[CACHE] Initial save at block ${blockNum}`);
        });
      }
    },
  });

  // Periodic save on a fixed interval
  const cacheInterval = setInterval(() => {
    if (lastProcessedBlock > 0n) {
      saveRecsCache(
        world,
        lastProcessedBlock,
        networkConfig.worldAddress,
        networkConfig.chainId,
      ).then(() => {
        debug.log(`[CACHE] Periodic save at block ${lastProcessedBlock}`);
      });
    }
  }, CACHE_SAVE_INTERVAL_MS);

  // Best-effort save on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      stopSync();
      clearInterval(cacheInterval);
      if (lastProcessedBlock > 0n) {
        saveRecsCache(
          world,
          lastProcessedBlock,
          networkConfig.worldAddress,
          networkConfig.chainId,
        );
      }
    });
  }

  // Wrap waitForTransaction with retry logic and metrics tracking
  const waitForTransaction = async (tx: Hex) => {
    const startMs = Date.now();
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await mudWaitForTransaction(tx);
        trackTxRoundtrip('waitForTransaction', startMs, true);
        return result;
      } catch (e) {
        const isReceiptNotFound =
          e instanceof Error &&
          e.message.includes('could not be found');
        if (isReceiptNotFound && attempt < maxRetries - 1) {
          debug.log(
            `waitForTransaction retry ${attempt + 1}/${maxRetries} for ${tx}`,
          );
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        trackTxRoundtrip('waitForTransaction', startMs, false);
        throw e;
      }
    }
    // Unreachable, but TypeScript needs it
    return mudWaitForTransaction(tx);
  };

  return {
    components,
    latestBlock$,
    playerEntity: encodeEntity(
      { address: 'address' },
      { address: burnerWalletClient.account.address },
    ),
    publicClient,
    storedBlockLogs$,
    waitForTransaction,
    walletClient: burnerWalletClient,
    world,
    worldContract,
    write$: write$.asObservable().pipe(share()),
  };
}
