import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { formatEther } from 'viem';

import { type Burner } from '../lib/mud/createBurner';
import {
  ComponentsResult,
  NetworkResult,
  SystemCallsResult,
} from '../lib/mud/setup';

const MUDContext = createContext<{
  burner: Burner | null;
  burnerBalance: string;
  components: ComponentsResult;
  network: NetworkResult;
  setBurnerWithCleanup: (burner: Burner) => () => void;
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
  const [burner, setBurner] = useState<Burner | null>(null);
  const [burnerBalance, setBurnerBalance] = useState<string>('0');
  const [components, setComponents] = useState<ComponentsResult | null>(null);
  const [network, setNetwork] = useState<NetworkResult | null>(null);
  const [systemCalls, setSystemCalls] = useState<SystemCallsResult | null>(
    null,
  );

  const setBurnerWithCleanup = useCallback((burner: Burner) => {
    setBurner(burner);

    return () => {
      setBurner(null);
    };
  }, []);

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
    if (!burner) {
      return {
        burner,
        burnerBalance,
        components: setupResult.components,
        network: setupResult.network,
        setBurnerWithCleanup,
        systemCalls: setupResult.systemCalls,
      };
    }

    return {
      network: burner.network,
      components: burner.components,
      systemCalls: burner.systemCalls,
      burner,
      burnerBalance,
      setBurnerWithCleanup,
    };
  }, [burner, burnerBalance, setBurnerWithCleanup, setupResult]);

  // const currentValue = useContext(MUDContext);
  // if (currentValue) throw new Error('MUDProvider can only be used once');
  return <MUDContext.Provider value={value}>{children}</MUDContext.Provider>;
};

export const useMUD = (): {
  burner: Burner | null;
  burnerBalance: string;
  components: ComponentsResult;
  network: NetworkResult;
  setBurnerWithCleanup: (burner: Burner) => () => void;
  systemCalls: SystemCallsResult;
} => {
  const value = useContext(MUDContext);
  if (!value) throw new Error('Must be used within a MUDProvider');
  return value;
};
