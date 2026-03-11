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
import {
  type Address,
  createWalletClient,
  custom,
  type WalletClient,
} from 'viem';
import { useAccount, useDisconnect, useWalletClient } from 'wagmi';
import { usePrivy, useWallets, useLoginWithOAuth, useCreateWallet } from '@privy-io/react-auth';

import { base } from '../lib/mud/supportedChains';

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL;
const FUND_API_KEY = import.meta.env.VITE_FUND_API_KEY;

type AuthMethod = 'embedded' | 'external' | null;

type AuthContextType = {
  authMethod: AuthMethod;
  connectWithGoogle: () => Promise<void>;
  disconnect: () => Promise<void>;
  embeddedWalletClient: WalletClient | null;
  externalWalletClient: WalletClient | null;
  hasInjectedWallet: boolean;
  isAuthenticated: boolean;
  isConnecting: boolean;
  ownerAddress: Address | null;
  signedInEmail: string | null;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  // --- External wallet (MetaMask via wagmi) ---
  const {
    isConnected: wagmiConnected,
    address: wagmiAddress,
  } = useAccount();
  const { data: wagmiWalletClient } = useWalletClient();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // --- Privy ---
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const isCreatingWallet = useRef(false);
  const { initOAuth } = useLoginWithOAuth({
    onComplete: ({ user: privyUser, isNewUser }) => {
      console.info('[Auth] OAuth complete:', { email: privyUser?.google?.email, isNewUser });
    },
    onError: (error) => {
      console.error('[Auth] OAuth error:', error);
      setIsConnecting(false);
    },
  });

  const [embeddedWalletClient, setEmbeddedWalletClient] =
    useState<WalletClient | null>(null);
  const [embeddedAddress, setEmbeddedAddress] = useState<Address | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  const initAddressRef = useRef<string | null>(null);

  // Detect injected wallet (MetaMask etc.)
  useEffect(() => {
    const hidden = localStorage.getItem('ud:hideInjectedWallet') === 'true';
    setHasInjectedWallet(
      !hidden && typeof window !== 'undefined' && !!window.ethereum,
    );
  }, []);

  // Initialize Privy embedded wallet when available
  useEffect(() => {
    console.info('[Auth] Wallet init effect:', { ready, authenticated, walletsCount: wallets.length, walletTypes: wallets.map(w => w.walletClientType) });
    if (!ready || !authenticated) {
      if (ready) setIsConnecting(false);
      return;
    }

    // Find embedded wallet (Privy MPC wallet)
    const privyWallet = wallets.find(w => w.walletClientType === 'privy');
    if (!privyWallet) {
      // Prevent concurrent createWallet() calls — multiple renders can fire
      // before Privy updates the wallets array, causing duplicate wallets.
      if (isCreatingWallet.current) return;
      isCreatingWallet.current = true;
      console.info('[Auth] Authenticated but no privy wallet — creating one...', { walletTypes: wallets.map(w => w.walletClientType) });
      createWallet()
        .then(w => console.info('[Auth] Wallet created:', w.address))
        .catch(err => console.warn('[Auth] createWallet failed (may already exist):', err.message))
        .finally(() => { isCreatingWallet.current = false; });
      return;
    }

    // Skip re-init if we already initialized this wallet address.
    // Prevents address flip when Privy reorders the wallets array.
    if (initAddressRef.current === privyWallet.address) return;
    initAddressRef.current = privyWallet.address;

    let cancelled = false;

    const init = async () => {
      try {
        const provider = await privyWallet.getEthereumProvider();
        if (cancelled) return;

        // Privy's EthereumProvider doesn't track pending nonces, so concurrent
        // eth_sendTransaction calls (e.g. AllowanceContext auto-approvals +
        // character creation steps) grab the same nonce → "replacement tx underpriced".
        // Serialize all send-tx calls through a promise queue.
        let txQueue: Promise<unknown> = Promise.resolve();

        // viem v2.35 sends `wallet_sendTransaction` but Privy's EthereumProvider
        // only intercepts `eth_sendTransaction` for local MPC signing.
        const wrappedProvider = {
          ...provider,
          request: (args: { method: string; params?: unknown[] }) => {
            if (args.method === 'wallet_sendTransaction') {
              args = { ...args, method: 'eth_sendTransaction' };
            }
            if (args.method === 'eth_sendTransaction') {
              const execute = () => provider.request(args);
              const queued = txQueue.then(execute, execute);
              txQueue = queued.catch(() => {}); // don't let failures block the queue
              return queued;
            }
            return provider.request(args);
          },
        };

        const walletClient = createWalletClient({
          account: privyWallet.address as Address,
          chain: base,
          transport: custom(wrappedProvider),
        });

        setEmbeddedWalletClient(walletClient);
        setEmbeddedAddress(privyWallet.address as Address);

        // Extract email
        const email =
          user?.google?.email ||
          user?.email?.address ||
          null;
        setSignedInEmail(email);

        console.info('[Auth] Privy wallet initialized:', privyWallet.address);
      } catch (e) {
        console.error('[Auth] Failed to initialize Privy wallet:', e);
      } finally {
        if (!cancelled) setIsConnecting(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [ready, authenticated, wallets, user]);

  // First-login gas funding
  useEffect(() => {
    console.info('[Gas] Funding check:', { embeddedAddress, RELAYER_URL, hasKey: embeddedAddress ? !!localStorage.getItem(`ud:gasFunded:${embeddedAddress}`) : null });
    if (!embeddedAddress || !RELAYER_URL) return;
    const key = `ud:gasFunded:${embeddedAddress}`;
    if (localStorage.getItem(key)) return;

    fetch(`${RELAYER_URL}/fund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(FUND_API_KEY ? { 'x-api-key': FUND_API_KEY } : {}),
      },
      body: JSON.stringify({ address: embeddedAddress }),
    })
      .then(res => res.json())
      .then(data => { if (data.txHash) localStorage.setItem(key, '1'); })
      .catch(err => console.warn('[Gas] Funding failed:', err));
  }, [embeddedAddress]);

  const connectWithGoogle = useCallback(async () => {
    // If already authenticated via Privy (e.g. returning from OAuth redirect),
    // don't initiate another OAuth flow — the wallet init effect will handle it.
    if (authenticated) {
      console.info('[Auth] Already authenticated, skipping initOAuth');
      return;
    }
    setIsConnecting(true);
    try {
      await initOAuth({ provider: 'google' });
    } catch (e: any) {
      // "already logged in" means the redirect auth completed — not an error
      if (e?.message?.includes('already logged in')) {
        console.info('[Auth] OAuth redirect completed, waiting for wallet init');
        return;
      }
      console.error('[AuthContext] Google sign-in failed:', e);
      setIsConnecting(false);
      throw e;
    }
    // isConnecting will be set to false by the wallet init effect above
  }, [authenticated, initOAuth]);

  const disconnect = useCallback(async () => {
    if (authenticated) {
      try {
        await logout();
      } catch {
        // ignore
      }
      setEmbeddedWalletClient(null);
      setEmbeddedAddress(null);
      setSignedInEmail(null);
      initAddressRef.current = null;
      isCreatingWallet.current = false;
    }
    if (wagmiConnected) {
      wagmiDisconnect();
    }
  }, [authenticated, logout, wagmiConnected, wagmiDisconnect]);

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
        embeddedWalletClient,
        externalWalletClient: null,
        hasInjectedWallet,
        isAuthenticated: true,
        isConnecting: false,
        ownerAddress: embeddedAddress,
        signedInEmail,
      };
    }

    // Privy authenticated but wallet still initializing (e.g. just returned from OAuth redirect).
    // Mark isAuthenticated=true so Welcome.tsx doesn't show blank screen or sign-in modal.
    // Keep isConnecting=true so downstream knows wallet isn't ready yet.
    if (authenticated && !embeddedWalletClient) {
      return {
        authMethod: 'embedded',
        connectWithGoogle,
        disconnect,
        embeddedWalletClient: null,
        externalWalletClient: null,
        hasInjectedWallet,
        isAuthenticated: true,
        isConnecting: true,
        ownerAddress: null,
        signedInEmail: null,
      };
    }

    // External wallet (MetaMask via wagmi)
    if (wagmiConnected && wagmiAddress && wagmiWalletClient) {
      return {
        authMethod: 'external',
        connectWithGoogle,
        disconnect,
        embeddedWalletClient: null,
        externalWalletClient: wagmiWalletClient,
        hasInjectedWallet,
        isAuthenticated: true,
        isConnecting: false,
        ownerAddress: wagmiAddress,
        signedInEmail: null,
      };
    }

    // Not authenticated
    return {
      authMethod: null,
      connectWithGoogle,
      disconnect,
      embeddedWalletClient: null,
      externalWalletClient: null,
      hasInjectedWallet,
      isAuthenticated: false,
      isConnecting,
      ownerAddress: null,
      signedInEmail: null,
    };
  }, [
    authenticated,
    connectWithGoogle,
    disconnect,
    embeddedAddress,
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
