import { useComponentValue } from '@latticexyz/react';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Address, formatEther, Hex } from 'viem';
import { useWalletClient } from 'wagmi';

import { type Burner, createBurner } from '../lib/mud/createBurner';
import { isDelegated } from '../lib/mud/delegation';
import {
  ComponentsResult,
  NetworkResult,
  SystemCallsResult,
} from '../lib/mud/setup';

const MUDContext = createContext<{
  burnerAddress: Address;
  burnerBalance: string;
  components: ComponentsResult;
  delegatorAddress: Address | null;
  delegatorEntity: string | null;
  network: NetworkResult;
  systemCalls: SystemCallsResult;
} | null>(null);

type Props = {
  children: ReactNode;
  setupResult: {
    components: ComponentsResult;
    network: NetworkResult;
    systemCalls: SystemCallsResult;
  };
};

export const MUDProvider = ({ children, setupResult }: Props): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();

  const [burner, setBurner] = useState<Burner | null>(null);
  const [burnerBalance, setBurnerBalance] = useState<string>('0');
  const [components, setComponents] = useState<ComponentsResult | null>(null);
  const [network, setNetwork] = useState<NetworkResult | null>(null);
  const [systemCalls, setSystemCalls] = useState<SystemCallsResult | null>(
    null,
  );

  const delegation = useComponentValue(
    setupResult.components.UserDelegationControl,
    externalWalletClient
      ? encodeEntity(
          { delegatee: 'address', delegator: 'address' },
          {
            delegatee: externalWalletClient.account.address,
            delegator: setupResult.network.walletClient.account.address,
          },
        )
      : undefined,
  );

  useEffect(() => {
    if (!(delegation && externalWalletClient && network)) return;
    if (burner) return;
    if (isDelegated(delegation as { delegationControlId: Hex })) {
      setBurner(createBurner(network, externalWalletClient.account.address));
    }
  }, [burner, delegation, externalWalletClient, network]);

  useEffect(() => {
    if (network && components && systemCalls) return;
    if (setupResult) {
      setComponents(setupResult.components);
      setNetwork(setupResult.network);
      setSystemCalls(setupResult.systemCalls);
    }
  }, [components, network, setupResult, systemCalls]);

  const getBurnerBalance = useCallback(async () => {
    if (!(burner && network)) return;
    const balance = await network.publicClient.getBalance({
      address: burner.walletClient.account.address,
    });
    setBurnerBalance(formatEther(balance));
  }, [burner, network]);

  useEffect(() => {
    if (!burner) return () => {};
    getBurnerBalance();

    const interval = setInterval(getBurnerBalance, 5000);
    return () => clearInterval(interval);
  }, [burner, getBurnerBalance]);

  const value = useMemo(() => {
    if (!setupResult) return null;
    if (!(burner && burner.delegatorAddress)) {
      return {
        burnerAddress: setupResult.network.walletClient.account.address,
        burnerBalance,
        components: setupResult.components,
        delegatorAddress: null,
        delegatorEntity: null,
        network: setupResult.network,
        systemCalls: setupResult.systemCalls,
      };
    }

    return {
      burnerAddress: burner.walletClient.account.address,
      burnerBalance,
      components: burner.components,
      delegatorAddress: burner.delegatorAddress,
      delegatorEntity: encodeEntity(
        { address: 'address' },
        { address: burner.delegatorAddress },
      ),
      network: burner.network,
      systemCalls: burner.systemCalls,
    };
  }, [burner, burnerBalance, setupResult]);

  // const currentValue = useContext(MUDContext);
  // if (currentValue) throw new Error('MUDProvider can only be used once');
  return <MUDContext.Provider value={value}>{children}</MUDContext.Provider>;
};

export const useMUD = (): {
  burnerAddress: Address;
  burnerBalance: string;
  components: ComponentsResult;
  delegatorAddress: Address | null;
  delegatorEntity: string | null;
  network: NetworkResult;
  systemCalls: SystemCallsResult;
} => {
  const value = useContext(MUDContext);
  if (!value) throw new Error('Must be used within a MUDProvider');
  return value;
};
