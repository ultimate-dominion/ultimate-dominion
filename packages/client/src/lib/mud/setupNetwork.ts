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
import { debounceTime, share, Subject } from 'rxjs';
import {
  createPublicClient,
  createWalletClient,
  getContract,
  Hex,
  type TransactionReceipt,
} from 'viem';

import { debug } from '../../utils/debug';

import { createViemClientConfig } from './createViemClientConfig';
import { externalTables } from './externalTables';
import { getNetworkConfig } from './getNetworkConfig';
import { handleIndexerError } from './indexerFallback';
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

  // Use proxy URL in development, direct URL in production
  const isDev = import.meta.env.DEV;
  const rawIndexerUrl =
    (import.meta.env.VITE_INDEXER_URL as string) ?? undefined;
  const indexerUrl = isDev && rawIndexerUrl
    ? rawIndexerUrl.replace(/https?:\/\/[^/]+/, '/mud-indexer')
    : rawIndexerUrl;

  debug.log('Using indexer URL', { isDev, rawIndexerUrl, indexerUrl });

  // Load RECS cache from IndexedDB for instant page loads
  const cache = await loadRecsCache(
    networkConfig.worldAddress,
    networkConfig.chainId,
  );
  if (cache) {
    console.info('[CACHE] Found cached state', {
      blockNumber: cache.blockNumber.toString(),
      components: cache.components.length,
    });
  } else {
    console.info('[CACHE] No cached state found — full sync');
  }

  const startBlock = cache
    ? cache.blockNumber
    : BigInt(networkConfig.initialBlockNumber);

  const fallbackFn = async (url: string, opts: RequestInit) => {
    if (!url.toString().includes(indexerUrl ?? '')) {
      return fetch(url, opts).then(r => r.json());
    }
    return handleIndexerError(url.toString(), async () => {
      debug.log('Using RPC fallback for indexer');
      return null;
    });
  };

  const {
    components,
    latestBlock$,
    storedBlockLogs$,
    waitForTransaction: mudWaitForTransaction,
  } = await syncToRecs({
      world,
      config: mudConfig,
      address: networkConfig.worldAddress as Hex,
      publicClient,
      startBlock,
      tables: externalTables,
      indexerUrl,
      fetchJson: async (url: string, opts?: RequestInit) => {
        const proxyUrl = isDev
          ? url.toString()
          : `/api/proxy?url=${encodeURIComponent(url.toString())}`;

        debug.log('Fetching through proxy', {
          url: url.toString(),
          proxyUrl,
        });

        try {
          const response = await fetch(proxyUrl, {
            ...opts,
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            debug.log('Proxy request failed, falling back to RPC', {
              status: response.status,
              statusText: response.statusText,
            });
            return fallbackFn(url, opts ?? {});
          }

          return response.json();
        } catch (error) {
          debug.log('Error fetching through proxy, falling back to RPC', error);
          return fallbackFn(url, opts ?? {});
        }
      },
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

  // Periodic cache save — every 30s while synced, plus save immediately on
  // first LIVE so short sessions still produce a usable cache.
  const CACHE_SAVE_INTERVAL_MS = 30_000;
  let lastSavedBlock = 0n;
  let hasSavedOnce = false;

  latestBlock$.subscribe({
    next: (block) => {
      const blockNum = block.number ?? 0n;
      if (blockNum <= lastSavedBlock) return;
      lastSavedBlock = blockNum;

      // Save immediately on the first block update (ensures cache exists
      // for next visit even if the user navigates away quickly).
      // After that, save at the periodic interval.
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
    if (lastSavedBlock > 0n) {
      saveRecsCache(
        world,
        lastSavedBlock,
        networkConfig.worldAddress,
        networkConfig.chainId,
      ).then(() => {
        debug.log(`[CACHE] Periodic save at block ${lastSavedBlock}`);
      });
    }
  }, CACHE_SAVE_INTERVAL_MS);

  // Best-effort save on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      clearInterval(cacheInterval);
      if (lastSavedBlock > 0n) {
        saveRecsCache(
          world,
          lastSavedBlock,
          networkConfig.worldAddress,
          networkConfig.chainId,
        );
      }
    });
  }

  // Wrap waitForTransaction with retry logic to handle anvil receipt timing
  const waitForTransaction = async (
    tx: Hex,
  ): Promise<TransactionReceipt & { blockNumber: bigint }> => {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await mudWaitForTransaction(tx);
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
