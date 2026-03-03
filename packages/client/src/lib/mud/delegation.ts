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

// Old unlimited delegation (kept for backwards compat detection)
// Format: RESOURCE_SYSTEM (2 bytes "sy") + ROOT_NAMESPACE (14 zero bytes) + name (16 bytes "unlimited" padded)
const UNLIMITED_DELEGATION: Hex = '0x73790000000000000000000000000000756e6c696d6974656400000000000000';

// New GameDelegationControl - restricts burner to whitelisted gameplay systems only
// Format: RESOURCE_SYSTEM (2 bytes "sy") + namespace "UD" (14 bytes padded) + name "GameDelegation" (16 bytes padded)
// "sy" = 0x7379, "UD" = 0x5544 + 12 zero bytes, "GameDelegation" = 0x47616d6544656c65676174696f6e + 2 zero bytes
const GAME_DELEGATION: Hex = '0x73795544000000000000000000000000' + '47616d6544656c65676174696f6e0000' as Hex;

// ABI for GameDelegationControl.initDelegation(address)
const GAME_DELEGATION_ABI = [
  {
    name: 'initDelegation',
    type: 'function',
    inputs: [{ name: 'delegatee', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export async function setupDelegation(
  network: SetupNetworkResult,
  externalWalletClient: WalletClient<Transport, Chain, Account>,
  delegateeAddress: Hex,
): Promise<void> {
  try {
    const delegationControlId = GAME_DELEGATION;

    // Encode initDelegation(delegateeAddress) as the init calldata
    const initCallData = encodeFunctionData({
      abi: GAME_DELEGATION_ABI,
      functionName: 'initDelegation',
      args: [delegateeAddress as Address],
    });

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
      args: [delegateeAddress, delegationControlId, initCallData],
    });

    const delegationTx = await externalWalletClient.sendTransaction({
      account: externalWalletClient.account,
      to: network.worldContract.address,
      data,
      ...gasConfig,
    });

    await network.waitForTransaction(delegationTx);
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
  // Accept both old unlimited delegation and new game delegation (backwards compat)
  return (
    delegation?.delegationControlId === GAME_DELEGATION ||
    delegation?.delegationControlId === UNLIMITED_DELEGATION
  );
}
