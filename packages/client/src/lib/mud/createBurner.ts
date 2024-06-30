import { type ContractWrite } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import { getComponentValue, overridableComponent } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { callFrom } from '@latticexyz/world/internal';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { share, Subject } from 'rxjs';
import { createWalletClient, getContract, type Hex } from 'viem';

import { createSystemCalls } from '../mud/createSystemCalls';
import { type SetupNetworkResult } from '../mud/setupNetwork';
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
  delegatorAddress?: Hex,
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
          const encodedWorldFunctionSelector = encodeEntity(
            { string: 'bytes4' },
            { string: worldFunctionSelector },
          );

          const systemFunction = getComponentValue(
            network.components.FunctionSelectors,
            encodedWorldFunctionSelector,
          );

          if (!systemFunction)
            throw new Error(
              `Possibly store not synced: ${worldFunctionSelector}`,
            );

          return {
            systemId: systemFunction.systemId as Hex,
            systemFunctionSelector:
              systemFunction.systemFunctionSelector as Hex,
          };
        },
      }),
    );
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
        worldContract: worldContract,
      },
      burnerComponents,
    ),
    walletClient,
    worldContract,
    write$: write$.asObservable().pipe(share()),
  };
}
