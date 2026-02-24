import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import {
  type Account,
  type Address,
  type Chain,
  encodeFunctionData,
  type Hex,
  parseGwei,
  type Transport,
  type WalletClient,
} from 'viem';

import { type SetupNetworkResult } from '../mud/setupNetwork';

// Use built-in unlimited delegation control - this is available without any modules
// Hardcoded to match MUD's UNLIMITED_DELEGATION constant from @latticexyz/world/src/constants.sol
// Format: RESOURCE_SYSTEM (2 bytes "sy") + ROOT_NAMESPACE (14 zero bytes) + name (16 bytes "unlimited" padded)
const UNLIMITED_DELEGATION: Hex = '0x73790000000000000000000000000000756e6c696d6974656400000000000000';

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

    // Check if we're on a local chain (chainId 31337)
    const chainId = externalWalletClient.chain?.id;
    const isLocalChain = chainId === 31337;

    // For local Anvil chains, we need to set explicit gas price to avoid
    // MetaMask's gas estimation which often fails with Anvil's default settings
    const gasConfig = isLocalChain
      ? {
          gas: 200000n,
          maxFeePerGas: parseGwei('20'),
          maxPriorityFeePerGas: parseGwei('1'),
        }
      : {
          gas: 200000n,
        };

    // Pre-encode the calldata and use sendTransaction to minimize
    // RPC calls MetaMask needs to make (no eth_call simulation)
    const data = encodeFunctionData({
      abi: IWorldAbi,
      functionName: 'registerDelegation',
      args: [delegateeAddress, delegationControlId, '0x'],
    });

    const delegationTx = await externalWalletClient.sendTransaction({
      account: externalWalletClient.account,
      to: network.worldContract.address,
      data,
      ...gasConfig,
    });

    console.log('Delegation transaction sent:', delegationTx);
    await network.waitForTransaction(delegationTx);
    console.log('Delegation transaction confirmed');
  } catch (error) {
    console.error('Delegation failed with error:', error);
    throw error;
  }
}

export async function revokeDelegation(
  network: SetupNetworkResult,
  externalWalletClient: WalletClient<Transport, Chain, Account>,
  delegateeAddress: Address,
): Promise<void> {
  const chainId = externalWalletClient.chain?.id;
  const isLocalChain = chainId === 31337;

  const gasConfig = isLocalChain
    ? {
        gas: 200000n,
        maxFeePerGas: parseGwei('20'),
        maxPriorityFeePerGas: parseGwei('1'),
      }
    : {
        gas: 200000n,
      };

  const data = encodeFunctionData({
    abi: IWorldAbi,
    functionName: 'unregisterDelegation',
    args: [delegateeAddress],
  });

  const txHash = await externalWalletClient.sendTransaction({
    account: externalWalletClient.account,
    to: network.worldContract.address,
    data,
    ...gasConfig,
  });

  await network.waitForTransaction(txHash);
}

export function clearBurnerWallet(): void {
  localStorage.removeItem('mud:burnerWallet');
}

export function isDelegated(
  delegation: { delegationControlId: Hex } | undefined,
): boolean {
  return delegation?.delegationControlId === UNLIMITED_DELEGATION;
}
