import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type Address, type WalletClient } from 'viem';
import { useAccount, useDisconnect, useWalletClient } from 'wagmi';
import {
  createThirdwebClient,
  defineChain as defineThirdwebChain,
  type ThirdwebClient,
} from 'thirdweb';
import { type Wallet } from 'thirdweb/wallets';

import { DEFAULT_CHAIN_ID, SUPPORTED_CHAINS } from '../lib/web3';

const THIRDWEB_CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID || '';

type AuthMethod = 'embedded' | 'external' | null;

type AuthContextType = {
  authMethod: AuthMethod;
  connectWithGoogle: () => Promise<void>;
  disconnect: () => Promise<void>;
  embeddedWallet: Wallet | null;
  embeddedWalletClient: WalletClient | null;
  externalWalletClient: WalletClient | null;
  hasInjectedWallet: boolean;
  isAuthenticated: boolean;
  isConnecting: boolean;
  ownerAddress: Address | null;
  thirdwebChain: ReturnType<typeof defineThirdwebChain>;
  thirdwebClient: ThirdwebClient;
};

const thirdwebClient = createThirdwebClient({
  clientId: THIRDWEB_CLIENT_ID,
});

const activeChain = SUPPORTED_CHAINS[0];

// Let Thirdweb use its built-in RPC Edge CDN (150+ global edge locations)
// instead of routing through our single RPC URL. Faster geographic routing.
const thirdwebChain = defineThirdwebChain({
  id: activeChain.id,
});

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { isConnected: wagmiConnected, address: wagmiAddress } = useAccount();
  const { data: wagmiWalletClient } = useWalletClient();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const [embeddedWallet, setEmbeddedWallet] = useState<Wallet | null>(null);
  const [embeddedWalletClient, setEmbeddedWalletClient] =
    useState<WalletClient | null>(null);
  const [embeddedAddress, setEmbeddedAddress] = useState<Address | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);

  // Detect injected wallet (MetaMask etc.)
  // Use localStorage flag to hide MetaMask for testing embedded flow:
  //   localStorage.setItem('ud:hideInjectedWallet', 'true')  — hides Connect Wallet
  //   localStorage.removeItem('ud:hideInjectedWallet')        — restores it
  useEffect(() => {
    const hidden = localStorage.getItem('ud:hideInjectedWallet') === 'true';
    setHasInjectedWallet(
      !hidden && typeof window !== 'undefined' && !!window.ethereum,
    );
  }, []);

  // Convert Thirdweb wallet to viem WalletClient after connection
  const initEmbeddedClient = useCallback(
    async (wallet: Wallet) => {
      try {
        const account = wallet.getAccount();
        if (!account) return;

        const { viemAdapter } = await import('thirdweb/adapters/viem');
        const viemClient = viemAdapter.walletClient.toViem({
          client: thirdwebClient,
          chain: thirdwebChain,
          account,
        });

        setEmbeddedWalletClient(viemClient as WalletClient);
        setEmbeddedAddress(account.address as Address);
        setEmbeddedWallet(wallet);
      } catch (e) {
        console.error('[AuthContext] Failed to initialize embedded client:', e);
      }
    },
    [],
  );

  // EIP-7702: embedded wallet transacts as a standard EOA with gas sponsorship.
  // No bundler, no EntryPoint — direct chain transactions.
  const executionModeConfig = useMemo(
    () => ({
      mode: "EIP7702" as const,
      sponsorGas: true,
    }),
    [],
  );

  // Auto-reconnect persisted Thirdweb session on mount
  useEffect(() => {
    const tryReconnect = async () => {
      try {
        const { inAppWallet } = await import('thirdweb/wallets/in-app');
        const wallet = inAppWallet({
          executionMode: executionModeConfig,
        });
        const connected = await wallet.autoConnect({
          client: thirdwebClient,
          timeout: 5000,
        });
        if (connected) {
          await initEmbeddedClient(wallet);
        }
      } catch {
        // No persisted session or auto-connect failed — that's fine
      } finally {
        setIsConnecting(false);
      }
    };
    tryReconnect();
  }, [initEmbeddedClient, executionModeConfig]);

  const connectWithGoogle = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { inAppWallet } = await import('thirdweb/wallets/in-app');
      const wallet = inAppWallet({
        executionMode: executionModeConfig,
      });
      await wallet.connect({
        client: thirdwebClient,
        chain: thirdwebChain,
        strategy: 'google',
      });
      await initEmbeddedClient(wallet);
    } catch (e) {
      console.error('[AuthContext] Google sign-in failed:', e);
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, [initEmbeddedClient, executionModeConfig]);

  const disconnect = useCallback(async () => {
    if (embeddedWallet) {
      try {
        await embeddedWallet.disconnect();
      } catch {
        // ignore
      }
      setEmbeddedWallet(null);
      setEmbeddedWalletClient(null);
      setEmbeddedAddress(null);
    }
    if (wagmiConnected) {
      wagmiDisconnect();
    }
  }, [embeddedWallet, wagmiConnected, wagmiDisconnect]);

  const value = useMemo((): AuthContextType => {
    // Embedded wallet takes priority if connected
    if (embeddedAddress && embeddedWalletClient) {
      return {
        authMethod: 'embedded',
        connectWithGoogle,
        disconnect,
        embeddedWallet,
        embeddedWalletClient,
        externalWalletClient: null,
        hasInjectedWallet,
        isAuthenticated: true,
        isConnecting,
        ownerAddress: embeddedAddress,
        thirdwebChain,
        thirdwebClient,
      };
    }

    // External wallet (MetaMask via wagmi)
    if (wagmiConnected && wagmiAddress && wagmiWalletClient) {
      return {
        authMethod: 'external',
        connectWithGoogle,
        disconnect,
        embeddedWallet: null,
        embeddedWalletClient: null,
        externalWalletClient: wagmiWalletClient,
        hasInjectedWallet,
        isAuthenticated: true,
        isConnecting: false,
        ownerAddress: wagmiAddress,
        thirdwebChain,
        thirdwebClient,
      };
    }

    // Not authenticated
    return {
      authMethod: null,
      connectWithGoogle,
      disconnect,
      embeddedWallet: null,
      embeddedWalletClient: null,
      externalWalletClient: null,
      hasInjectedWallet,
      isAuthenticated: false,
      isConnecting,
      ownerAddress: null,
      thirdwebChain,
      thirdwebClient,
    };
  }, [
    connectWithGoogle,
    disconnect,
    embeddedAddress,
    embeddedWallet,
    embeddedWalletClient,
    hasInjectedWallet,
    isConnecting,
    wagmiAddress,
    wagmiConnected,
    wagmiWalletClient,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Must be used within an AuthProvider');
  return value;
};
