import { type ContractWrite } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import { garnet } from '@latticexyz/common/chains';
import { createClient as createFaucetClient } from '@latticexyz/faucet';
import { getComponentValue, overridableComponent } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { callFrom } from '@latticexyz/world/internal';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { share, Subject } from 'rxjs';
import {
  type Address,
  createWalletClient,
  getContract,
  type Hex,
  padHex,
  parseEther,
  slice,
} from 'viem';

import { createSystemCalls } from '../mud/createSystemCalls';
import { type SetupNetworkResult } from '../mud/setupNetwork';
import { DEFAULT_CHAIN_ID } from '../web3';

import { createViemClientConfig } from './createViemClientConfig';
import { getBurnerAccount } from './getBurnerAccount';

export type Burner = ReturnType<typeof createBurner>;
export type WorldContract = Burner['worldContract'];

// Create a burner object including `walletClient` and `worldContract`.
//
// A burner account is a temporary account stored in local storage.
// This function checks its existence in storage; if absent, generates and saves the account.
//
// If `delegatorAddress` is provided, delegation is automatically applied to `walletClient.writeContract(world...)` and `worldContract.write()`.

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createBurner(
  network: SetupNetworkResult,
  delegatorAddress?: Address,
) {
  /*
   * Create an observable for contract writes that we can
   * pass into MUD dev tools for transaction observability.
   */
  const write$ = new Subject<ContractWrite>();

  /*
   * Get or create a burner account, and create a viem client for it
   * (see https://viem.sh/docs/clients/wallet.html).
   */
  let walletClient = createWalletClient({
    ...createViemClientConfig(network.publicClient.chain),
    account: getBurnerAccount(),
  })
    .extend(transactionQueue())
    .extend(writeObserver({ onWrite: write => write$.next(write) }));

  if (delegatorAddress) {
    walletClient = walletClient.extend(
      callFrom({
        worldAddress: network.worldContract.address,
        delegatorAddress,
        worldFunctionToSystemFunction: async worldFunctionSelector => {
          // Fast path: read from RECS (populated by sync)
          const encodedWorldFunctionSelector = encodeEntity(
            { string: 'bytes4' },
            { string: worldFunctionSelector },
          );

          const systemFunction = getComponentValue(
            network.components.FunctionSelectors,
            encodedWorldFunctionSelector,
          );

          if (systemFunction) {
            return {
              systemId: systemFunction.systemId as Hex,
              systemFunctionSelector:
                systemFunction.systemFunctionSelector as Hex,
            };
          }

          // Fallback: read FunctionSelectors directly from the World contract.
          // This handles cases where RECS sync hasn't loaded the table yet.
          // eslint-disable-next-line no-console
          console.warn(
            `[callFrom] FunctionSelectors not in RECS for ${worldFunctionSelector}, reading from chain`,
          );

          const TABLE_ID =
            '0x7462776f726c6400000000000000000046756e6374696f6e53656c6563746f72' as Hex;
          const LAYOUT =
            '0x0024020020040000000000000000000000000000000000000000000000000000' as Hex;
          const GSF_ABI = [
            {
              name: 'getStaticField',
              type: 'function',
              stateMutability: 'view',
              inputs: [
                { name: 'tableId', type: 'bytes32' },
                { name: 'keyTuple', type: 'bytes32[]' },
                { name: 'fieldIndex', type: 'uint8' },
                { name: 'fieldLayout', type: 'bytes32' },
              ],
              outputs: [{ name: 'data', type: 'bytes32' }],
            },
          ] as const;

          // bytes4 → bytes32: value in high bytes (right-pad with zeros)
          const paddedKey = padHex(worldFunctionSelector, { size: 32, dir: 'right' });

          const [systemId, rawSystemFnSel] = await Promise.all([
            network.publicClient.readContract({
              address: network.worldContract.address as Hex,
              abi: GSF_ABI,
              functionName: 'getStaticField',
              args: [TABLE_ID, [paddedKey], 0, LAYOUT],
            }),
            network.publicClient.readContract({
              address: network.worldContract.address as Hex,
              abi: GSF_ABI,
              functionName: 'getStaticField',
              args: [TABLE_ID, [paddedKey], 1, LAYOUT],
            }),
          ]);

          if (
            systemId ===
            '0x0000000000000000000000000000000000000000000000000000000000000000'
          ) {
            throw new Error(
              `Function selector ${worldFunctionSelector} not registered on World`,
            );
          }

          // systemFunctionSelector is bytes4 in high bytes of bytes32
          const systemFunctionSel = slice(
            rawSystemFnSel,
            0,
            4,
          ) as Hex;

          return {
            systemId: systemId as Hex,
            systemFunctionSelector: systemFunctionSel,
          };
        },
      }),
    );

    if (DEFAULT_CHAIN_ID === garnet.id) {
      const address = walletClient.account.address;
      // eslint-disable-next-line no-console
      console.info('[Dev Faucet]: Player address -> ', address);

      const faucetClient = createFaucetClient({
        url: 'https://ultimate-dominion-faucet.vercel.app/trpc',
      });

      const requestDrip = async () => {
        const balance = await network.publicClient.getBalance({ address });
        // eslint-disable-next-line no-console
        console.info(`[Dev Faucet]: Player balance -> ${balance}`);
        const lowBalance = balance < parseEther('0.00001');
        if (lowBalance) {
          // eslint-disable-next-line no-console
          console.info(
            '[Dev Faucet]: Balance is low, dripping funds to player',
          );

          await faucetClient.drip.mutate({
            address,
          });
        }
      };

      requestDrip();
      // Note: No cleanup available here (not a React hook).
      // Only runs on garnet chain, which is not the production chain.
    }
  }

  /*
   * Create an object for communicating with the deployed World.
   */
  const worldContract = getContract({
    address: network.worldContract.address,
    abi: IWorldAbi,
    client: { public: network.publicClient, wallet: walletClient },
  });

  const burnerComponents = {
    ...network.components,
    Position: overridableComponent(network.components.Position),
  };

  return {
    components: burnerComponents,
    delegatorAddress,
    delegatorEntity: delegatorAddress
      ? encodeEntity({ address: 'address' }, { address: delegatorAddress })
      : undefined,
    network: {
      ...network,
      walletClient,
      worldContract,
      write$: write$.asObservable().pipe(share()),
    },
    playerEntity: encodeEntity(
      { address: 'address' },
      { address: walletClient.account.address },
    ),
    systemCalls: createSystemCalls(
      {
        ...network,
        delegatorAddress,
        worldContract: worldContract,
      },
      burnerComponents,
    ),
    walletClient,
    worldContract,
    write$: write$.asObservable().pipe(share()),
  };
}
