import { useComponentValue } from '@latticexyz/react';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useMemo } from 'react';
import type { Account, Chain, Hex, Transport, WalletClient } from 'viem';
import { useAccount } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { isDelegated, setupDelegation } from '../lib/mud/delegation';
import { getBurnerAccount } from '../lib/mud/getBurnerAccount';

export function useDelegation(
  externalWalletClient: WalletClient<Transport, Chain, Account>,
):
  | {
      status: 'delegated';
      setupDelegation?: undefined;
    }
  | {
      status: 'unset';
      setupDelegation: () => Promise<void>;
    } {
  const {
    network,
    components: { UserDelegationControl },
  } = useMUD();
  const { address } = useAccount();

  const burnerAddress = useMemo(() => getBurnerAccount().address, []);

  const delegation = useComponentValue(
    UserDelegationControl,
    encodeEntity(
      { delegatee: 'address', delegator: 'address' },
      { delegatee: address ?? '0x', delegator: burnerAddress },
    ),
  );

  if (isDelegated(delegation as { delegationControlId: Hex }))
    return { status: 'delegated' as const };

  return {
    status: 'unset' as const,
    setupDelegation: () =>
      setupDelegation(network, externalWalletClient, burnerAddress),
  };
}
