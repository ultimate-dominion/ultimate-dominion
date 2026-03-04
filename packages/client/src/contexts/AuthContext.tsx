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
import { setThirdwebDomains } from 'thirdweb/utils';
import { type Wallet } from 'thirdweb/wallets';

import { DEFAULT_CHAIN_ID, SUPPORTED_CHAINS } from '../lib/web3';

const THIRDWEB_CLIENT_ID = import.meta.env.VITE_THIRDWEB_CLIENT_ID || '';
const RELAYER_URL = import.meta.env.VITE_RELAYER_URL;

// Override bundler domain to route through self-hosted relayer
if (RELAYER_URL) {
  setThirdwebDomains({ bundler: RELAYER_URL });
}

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
  signedInEmail: string | null;
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
  const {
    isConnected: wagmiConnected,
    isReconnecting: wagmiReconnecting,
    address: wagmiAddress,
  } = useAccount();
  const { data: wagmiWalletClient } = useWalletClient();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const [embeddedWallet, setEmbeddedWallet] = useState<Wallet | null>(null);
  const [embeddedWalletClient, setEmbeddedWalletClient] =
    useState<WalletClient | null>(null);
  const [embeddedAddress, setEmbeddedAddress] = useState<Address | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  // Start as true so consumers (GameBoard, etc.) wait for auto-reconnect
  // before making redirect decisions. The tryReconnect effect below sets
  // this to false in its finally block once autoConnect resolves or fails.
  // For new users (no persisted session), autoConnect returns immediately
  // so the delay is imperceptible.
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);

  // Guard: when true, a manual Google sign-in is in progress and autoConnect
  // results should be discarded to prevent a stale session from overwriting.
  const manualSignInActive = useRef(false);

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
        // Retry getAccount — new embedded wallets may need a moment to provision
        let account = wallet.getAccount();
        if (!account) {
          console.info('[Auth] Wallet account not ready, retrying...');
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 500));
            account = wallet.getAccount();
            if (account) break;
          }
        }
        if (!account) {
          console.error('[Auth] Wallet has no account after connect — giving up');
          throw new Error('Account not available after sign-in. Please try again.');
        }

        // Log full account details to debug wrong-account bug
        console.info('[Auth] Wallet account details:', {
          address: account.address,
          type: (account as any).type,
          // EIP-7702 may wrap EOA — check for delegation target
          delegatedAddress: (account as any).delegatedAddress,
        });

        // Get user email from Thirdweb — both for diagnostics and UI display
        try {
          const { getUserEmail } = await import('thirdweb/wallets');
          const email = await getUserEmail({ client: thirdwebClient });
          console.info('[Auth] Signed-in email:', email);
          setSignedInEmail(email ?? null);
        } catch {
          console.info('[Auth] Could not retrieve user email (non-fatal)');
          setSignedInEmail(null);
        }

        console.info('[Auth] Initializing viem client for', account.address);
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
        console.error('[Auth] Failed to initialize embedded client:', e);
        throw e;
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
      let wallet: Wallet | null = null;
      try {
        const { inAppWallet } = await import('thirdweb/wallets/in-app');
        wallet = inAppWallet({
          executionMode: executionModeConfig,
        });
        const connected = await wallet.autoConnect({
          client: thirdwebClient,
          chain: thirdwebChain,
          timeout: 10000,
        });
        if (connected) {
          const acct = wallet.getAccount();
          console.info('[Auth] autoConnect succeeded, recovered address:', acct?.address);
          // If user already clicked "Sign in with Google", discard stale session
          if (manualSignInActive.current) {
            console.info('[Auth] autoConnect ignored — manual sign-in in progress');
            try { await wallet.disconnect(); } catch { /* best-effort */ }
            return;
          }
          await initEmbeddedClient(wallet);
        } else {
          console.info('[Auth] autoConnect returned no account — no persisted session');
        }
      } catch (e) {
        console.warn('[Auth] autoConnect failed:', e);
        // Clear stale Thirdweb session data so fresh sign-in isn't blocked
        if (wallet) {
          try {
            await wallet.disconnect();
          } catch {
            // ignore — best-effort cleanup
          }
        }
      } finally {
        setIsConnecting(false);
      }
    };
    tryReconnect();
  }, [initEmbeddedClient, executionModeConfig]);

  const connectWithGoogle = useCallback(async () => {
    setIsConnecting(true);
    manualSignInActive.current = true;
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
      setSignedInEmail(null);
    }
    if (wagmiConnected) {
      wagmiDisconnect();
    }

    // Aggressively clear Thirdweb session storage to prevent stale
    // autoConnect from recovering a different user's session
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('thirdweb') || key.startsWith('walletConnect'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      if (keysToRemove.length > 0) {
        console.info('[Auth] Cleared', keysToRemove.length, 'Thirdweb storage keys');
      }
    } catch {
      // ignore — best-effort cleanup
    }

    // Also clear sessionStorage and IndexedDB for Thirdweb
    try {
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('thirdweb') || key.startsWith('walletConnect'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch { /* best-effort */ }

    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && (db.name.includes('thirdweb') || db.name.includes('walletconnect'))) {
          indexedDB.deleteDatabase(db.name);
          console.info('[Auth] Deleted IndexedDB:', db.name);
        }
      }
    } catch { /* best-effort */ }
  }, [embeddedWallet, wagmiConnected, wagmiDisconnect]);

  // Auto-register email with backend on Google auth
  useEffect(() => {
    if (!signedInEmail || !embeddedAddress) return;
    const key = `ud:emailRegistered:${embeddedAddress}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const indexerUrl = (import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

    // Add to Resend audience + welcome email
    fetch(`${apiUrl}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: signedInEmail }),
    }).catch(() => {});

    // Store wallet→email for queue notifications
    fetch(`${indexerUrl}/api/queue/player/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: embeddedAddress.toLowerCase(), email: signedInEmail }),
    }).catch(() => {});
  }, [signedInEmail, embeddedAddress]);

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
        signedInEmail,
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
        signedInEmail: null,
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
      signedInEmail: null,
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
    signedInEmail,
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
