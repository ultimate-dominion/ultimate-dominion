import { resourceToHex } from '@latticexyz/common';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import {
  type Account,
  type Chain,
  type Hex,
  type Transport,
  type WalletClient,
} from 'viem';

import { type SetupNetworkResult } from '../mud/setupNetwork';

const UNLIMITED_DELEGATION = resourceToHex({
  type: 'system',
  namespace: '',
  name: 'unlimited',
});

export async function setupDelegation(
  network: SetupNetworkResult,
  externalWalletClient: WalletClient<Transport, Chain, Account>,
  delegateeAddress: Hex,
): Promise<void> {
  const { request } = await network.publicClient.simulateContract({
    account: externalWalletClient.account,
    address: network.worldContract.address,
    abi: IWorldAbi,
    functionName: 'registerDelegation',
    args: [delegateeAddress, UNLIMITED_DELEGATION, '0x0'],
  });

  const delegationTx = await externalWalletClient.writeContract(request);
  await network.waitForTransaction(delegationTx);
}

export function isDelegated(
  delegation: { delegationControlId: Hex } | undefined,
): boolean {
  return delegation?.delegationControlId === UNLIMITED_DELEGATION;
}
