/*
 * Stripped version: no RECS, no IndexedDB cache, no syncToRecs.
 * Just creates viem clients and the world contract.
 * Game state is managed by the indexer + Zustand store.
 */
import { ContractWrite, createBurnerAccount } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { share, Subject } from 'rxjs';
import {
  createPublicClient,
  createWalletClient,
  getContract,
  Hex,
} from 'viem';

import { applyReceiptToStore } from '../gameStore/applyReceiptToStore';
import { debug } from '../../utils/debug';
import { trackTxRoundtrip } from '../../utils/metricsReporter';

import { createViemClientConfig } from './createViemClientConfig';
import { getNetworkConfig } from './getNetworkConfig';

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
   * Create a temporary wallet and a viem client for it.
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

  // Wait for receipt, then inject MUD Store events into Zustand immediately.
  // WebSocket delivers the same updates later as an idempotent overwrite.
  const waitForTransaction = async (tx: Hex) => {
    const startMs = Date.now();
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: tx,
          pollingInterval: 150,
        });
        if (receipt.status !== 'reverted') {
          applyReceiptToStore(receipt, publicClient, networkConfig.worldAddress as Hex);
        }
        trackTxRoundtrip('waitForTransaction', startMs, true);
        return receipt;
      } catch (e) {
        const isReceiptNotFound =
          e instanceof Error &&
          e.message.includes('could not be found');
        if (isReceiptNotFound && attempt < maxRetries - 1) {
          debug.log(
            `waitForTransaction retry ${attempt + 1}/${maxRetries} for ${tx}`,
          );
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        trackTxRoundtrip('waitForTransaction', startMs, false);
        throw e;
      }
    }
    // Unreachable, but TypeScript needs it
    return publicClient.waitForTransactionReceipt({ hash: tx });
  };

  return {
    publicClient,
    waitForTransaction,
    walletClient: burnerWalletClient,
    worldContract,
    write$: write$.asObservable().pipe(share()),
  };
}
