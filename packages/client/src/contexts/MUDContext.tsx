import { useComponentValue } from '@latticexyz/react';
import { getComponentValue } from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
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

type MUDContextType = {
  burnerAddress: Address;
  burnerBalance: string;
  components: ComponentsResult;
  delegatorAddress: Address | null;
  delegatorEntity: string | null;
  getBurner: () => void;
  isSynced: boolean;
  network: NetworkResult;
  systemCalls: SystemCallsResult;
};

const MUDContext = createContext<MUDContextType | null>(null);

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
  const [isSynced, setIsSynced] = useState(false);

  const syncProgress = useComponentValue(
    setupResult.components.SyncProgress,
    singletonEntity,
  );

  const getBurner = useCallback(async () => {
    if (!(externalWalletClient && setupResult.network)) return;

    const delegation = getComponentValue(
      setupResult.components.UserDelegationControl,
      encodeEntity(
        { delegatee: 'address', delegator: 'address' },
        {
          delegatee: externalWalletClient.account.address,
          delegator: setupResult.network.walletClient.account.address,
        },
      ),
    );

    if (burner) return;
    if (isDelegated(delegation as { delegationControlId: Hex })) {
      setBurner(
        createBurner(setupResult.network, externalWalletClient.account.address),
      );
    }
    setIsSynced(true);
  }, [burner, externalWalletClient, setupResult]);

  useEffect(() => {
    if (syncProgress?.step !== 'live') return;
    if (isSynced) return;

    getBurner();
  }, [getBurner, isSynced, syncProgress]);

  const getBurnerBalance = useCallback(async () => {
    if (!(burner && setupResult.network)) return;
    const balance = await setupResult.network.publicClient.getBalance({
      address: burner.walletClient.account.address,
    });
    setBurnerBalance(formatEther(balance));
  }, [burner, setupResult.network]);

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
        getBurner,
        isSynced,
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
      getBurner,
      isSynced,
      network: burner.network,
      systemCalls: burner.systemCalls,
    };
  }, [burner, burnerBalance, getBurner, isSynced, setupResult]);

  // const currentValue = useContext(MUDContext);
  // if (currentValue) throw new Error('MUDProvider can only be used once');
  return <MUDContext.Provider value={value}>{children}</MUDContext.Provider>;
};

export const useMUD = (): MUDContextType => {
  const value = useContext(MUDContext);
  if (!value) throw new Error('Must be used within a MUDProvider');
  return value;
};
