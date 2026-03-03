import { type ContractWrite } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import { callFrom } from '@latticexyz/world/internal';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { share, Subject } from 'rxjs';
import {
  type Address,
  createWalletClient,
  getContract,
  type Hex,
  padHex,
  slice,
} from 'viem';

import { createSystemCalls } from '../mud/createSystemCalls';
import { type SetupNetworkResult } from '../mud/setupNetwork';

import { createViemClientConfig } from './createViemClientConfig';
import { getBurnerAccount } from './getBurnerAccount';

export type Burner = ReturnType<typeof createBurner>;
export type WorldContract = Burner['worldContract'];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createBurner(
  network: SetupNetworkResult,
  delegatorAddress?: Address,
) {
  const write$ = new Subject<ContractWrite>();

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
          // Read FunctionSelectors directly from the World contract.
          // (No longer uses RECS — always reads from chain)
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
  }

  const worldContract = getContract({
    address: network.worldContract.address,
    abi: IWorldAbi,
    client: { public: network.publicClient, wallet: walletClient },
  });

  // Helper to create a delegator entity string (matches Zustand keyBytes format)
  const delegatorEntity = delegatorAddress
    ? ('0x' + delegatorAddress.slice(2).toLowerCase().padStart(64, '0'))
    : undefined;

  return {
    delegatorAddress,
    delegatorEntity,
    network: {
      ...network,
      walletClient,
      worldContract,
      write$: write$.asObservable().pipe(share()),
    },
    playerEntity: walletClient.account.address
      ? ('0x' + walletClient.account.address.slice(2).toLowerCase().padStart(64, '0'))
      : undefined,
    systemCalls: createSystemCalls({
      ...network,
      delegatorAddress,
      worldContract: worldContract,
    }),
    walletClient,
    worldContract,
    write$: write$.asObservable().pipe(share()),
  };
}
