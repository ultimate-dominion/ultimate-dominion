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
  console.log('Setting up delegation with:', {
    delegateeAddress,
    worldAddress: network.worldContract.address,
    unlimitedDelegation: UNLIMITED_DELEGATION,
  });

  try {
    const delegationTx = await externalWalletClient.writeContract({
      account: externalWalletClient.account,
      address: network.worldContract.address,
      abi: IWorldAbi,
      functionName: 'registerDelegation',
      args: [delegateeAddress, UNLIMITED_DELEGATION, '0x00'],
      gas: 100000n, // Set explicit gas limit to avoid gas estimation issues
    });

    console.log('Delegation transaction sent:', delegationTx);
    await network.waitForTransaction(delegationTx);
    console.log('Delegation transaction confirmed');
  } catch (error) {
    console.error('Delegation failed with error:', error);
    throw error;
  }
}

export function isDelegated(
  delegation: { delegationControlId: Hex } | undefined,
): boolean {
  return delegation?.delegationControlId === UNLIMITED_DELEGATION;
}
