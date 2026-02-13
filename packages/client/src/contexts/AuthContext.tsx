import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { inAppWallet, preAuthenticate } from 'thirdweb/wallets/in-app';
import { viemAdapter } from 'thirdweb/adapters/viem';

import { DEFAULT_CHAIN_ID, SUPPORTED_CHAINS } from '../lib/web3';

const THIRDWEB_CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID || '';

type AuthMethod = 'embedded' | 'external' | null;

type AuthContextType = {
  authMethod: AuthMethod;
  disconnect: () => Promise<void>;
  embeddedWalletClient: WalletClient | null;
  externalWalletClient: WalletClient | null;
  hasInjectedWallet: boolean;
  isAuthenticated: boolean;
  isConnecting: boolean;
  ownerAddress: Address | null;
  thirdwebChain: ReturnType<typeof defineThirdwebChain>;
  thirdwebClient: ThirdwebClient;
  connectWithGoogle: () => Promise<void>;
  connectWithApple: () => Promise<void>;
  connectWithEmail: (email: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  pendingEmailVerification: boolean;
};

const thirdwebClient = createThirdwebClient({
  clientId: THIRDWEB_CLIENT_ID,
});

const activeChain = SUPPORTED_CHAINS[0];

const thirdwebChain = defineThirdwebChain({
  id: activeChain.id,
  rpc: activeChain.rpcUrls.default.http[0],
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  const [pendingEmailVerification, setPendingEmailVerification] =
    useState(false);

  const emailVerificationRef = useRef<{
    sendVerificationCode: () => Promise<void>;
    verifyCode: (otp: string) => Promise<void>;
  } | null>(null);

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

  // Auto-reconnect persisted Thirdweb session on mount
  useEffect(() => {
    const tryReconnect = async () => {
      try {
        const wallet = inAppWallet();
        const connected = await wallet.autoConnect({
          client: thirdwebClient,
        });
        if (connected) {
          await initEmbeddedClient(wallet);
        }
      } catch {
        // No persisted session or auto-connect failed — that's fine
      }
    };
    tryReconnect();
  }, [initEmbeddedClient]);

  const connectWithGoogle = useCallback(async () => {
    setIsConnecting(true);
    try {
      const wallet = inAppWallet();
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
  }, [initEmbeddedClient]);

  const connectWithApple = useCallback(async () => {
    setIsConnecting(true);
    try {
      const wallet = inAppWallet();
      await wallet.connect({
        client: thirdwebClient,
        chain: thirdwebChain,
        strategy: 'apple',
      });
      await initEmbeddedClient(wallet);
    } catch (e) {
      console.error('[AuthContext] Apple sign-in failed:', e);
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, [initEmbeddedClient]);

  const connectWithEmail = useCallback(
    async (email: string) => {
      setIsConnecting(true);
      try {
        const wallet = inAppWallet();
        await preAuthenticate({
          client: thirdwebClient,
          strategy: 'email',
          email,
        });

        // Store verification callbacks for OTP step
        emailVerificationRef.current = {
          sendVerificationCode: async () => {
            await preAuthenticate({
              client: thirdwebClient,
              strategy: 'email',
              email,
            });
          },
          verifyCode: async (otp: string) => {
            await wallet.connect({
              client: thirdwebClient,
              chain: thirdwebChain,
              strategy: 'email',
              email,
              verificationCode: otp,
            });
            await initEmbeddedClient(wallet);
          },
        };

        setPendingEmailVerification(true);
      } catch (e) {
        console.error('[AuthContext] Email sign-in failed:', e);
        setIsConnecting(false);
        throw e;
      }
    },
    [initEmbeddedClient],
  );

  const verifyOtp = useCallback(async (otp: string) => {
    try {
      if (!emailVerificationRef.current) {
        throw new Error('No pending email verification');
      }
      await emailVerificationRef.current.verifyCode(otp);
      setPendingEmailVerification(false);
      emailVerificationRef.current = null;
    } catch (e) {
      console.error('[AuthContext] OTP verification failed:', e);
      throw e;
    } finally {
      setIsConnecting(false);
    }
  }, []);

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
    setPendingEmailVerification(false);
    emailVerificationRef.current = null;
  }, [embeddedWallet, wagmiConnected, wagmiDisconnect]);

  const value = useMemo((): AuthContextType => {
    // Embedded wallet takes priority if connected
    if (embeddedAddress && embeddedWalletClient) {
      return {
        authMethod: 'embedded',
        disconnect,
        embeddedWalletClient,
        externalWalletClient: null,
        hasInjectedWallet,
        isAuthenticated: true,
        isConnecting,
        ownerAddress: embeddedAddress,
        thirdwebChain,
        thirdwebClient,
        connectWithGoogle,
        connectWithApple,
        connectWithEmail,
        verifyOtp,
        pendingEmailVerification,
      };
    }

    // External wallet (MetaMask via wagmi)
    if (wagmiConnected && wagmiAddress && wagmiWalletClient) {
      return {
        authMethod: 'external',
        disconnect,
        embeddedWalletClient: null,
        externalWalletClient: wagmiWalletClient,
        hasInjectedWallet,
        isAuthenticated: true,
        isConnecting: false,
        ownerAddress: wagmiAddress,
        thirdwebChain,
        thirdwebClient,
        connectWithGoogle,
        connectWithApple,
        connectWithEmail,
        verifyOtp,
        pendingEmailVerification,
      };
    }

    // Not authenticated
    return {
      authMethod: null,
      disconnect,
      embeddedWalletClient: null,
      externalWalletClient: null,
      hasInjectedWallet,
      isAuthenticated: false,
      isConnecting,
      ownerAddress: null,
      thirdwebChain,
      thirdwebClient,
      connectWithGoogle,
      connectWithApple,
      connectWithEmail,
      verifyOtp,
      pendingEmailVerification,
    };
  }, [
    connectWithApple,
    connectWithEmail,
    connectWithGoogle,
    disconnect,
    embeddedAddress,
    embeddedWalletClient,
    hasInjectedWallet,
    isConnecting,
    pendingEmailVerification,
    verifyOtp,
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
