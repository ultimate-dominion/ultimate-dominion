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

// Use built-in unlimited delegation control - this is available without any modules
const UNLIMITED_DELEGATION = resourceToHex({
  type: 'system',
  namespace: '',
  name: 'unlimited',
}) as Hex;

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
    // Use the built-in unlimited delegation control ID
    const delegationControlId = UNLIMITED_DELEGATION;
    console.log('Using delegation control ID:', delegationControlId);

    // Use the same approach as the working cast command - no gas estimation
    const delegationTx = await externalWalletClient.writeContract({
      account: externalWalletClient.account,
      address: network.worldContract.address,
      abi: IWorldAbi,
      functionName: 'registerDelegation',
      args: [delegateeAddress, delegationControlId, '0x00'],
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
