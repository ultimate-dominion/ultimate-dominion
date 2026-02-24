/*
 * The MUD client code is built on top of viem
 * (https://viem.sh/docs/getting-started.html).
 * This line imports the functions we need from it.
 */
import { ContractWrite, createBurnerAccount } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import { encodeEntity, syncToRecs } from '@latticexyz/store-sync/recs';
import mudConfig from 'contracts/mud.config';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { share, Subject } from 'rxjs';
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
  const indexerUrl = isDev
    ? rawIndexerUrl?.replace(
        'https://indexer.mud.garnetchain.com',
        '/mud-indexer',
      )
    : rawIndexerUrl;

  debug.log('Using indexer URL', { isDev, rawIndexerUrl, indexerUrl });

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
      startBlock: BigInt(networkConfig.initialBlockNumber),
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
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
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
