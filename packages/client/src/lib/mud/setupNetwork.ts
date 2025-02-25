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
import { createPublicClient, createWalletClient, getContract, Hex } from 'viem';

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

  const indexerUrl = (import.meta.env.VITE_INDEXER_URL as string) ?? undefined;
  debug.log('Using indexer URL', indexerUrl);

  /*
   * Sync on-chain state into RECS and keeps our client in sync.
   * Uses the MUD indexer if available, otherwise falls back
   * to the viem publicClient to make RPC calls to fetch MUD
   * events from the chain.
   */
  const { components, latestBlock$, storedBlockLogs$, waitForTransaction } =
    await syncToRecs({
      world,
      config: mudConfig,
      address: networkConfig.worldAddress as Hex,
      publicClient,
      startBlock: BigInt(networkConfig.initialBlockNumber),
      tables: externalTables,
      indexerUrl,
      async fetchJson(url, opts) {
        if (!url.toString().includes(indexerUrl ?? '')) {
          return fetch(url, opts).then(r => r.json());
        }
        return handleIndexerError(url.toString(), async () => {
          debug.log('Using RPC fallback for indexer');
          return null;
        });
      },
    });

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
