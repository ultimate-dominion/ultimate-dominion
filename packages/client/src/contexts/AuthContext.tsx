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

import { clearCachedDelegator } from '../lib/delegatorCache';
import { base } from '../lib/mud/supportedChains';

/**
 * Determines the wallet initialization action when no privy wallet is in the
 * local wallets array yet.
 *
 * - 'wait': user already has a wallet server-side → recovery in progress, don't create
 * - 'create': truly new user with no wallet → call createWallet()
 * - 'skip': createWallet() already in flight OR not confirmed as new user → do nothing
 */
export function resolveWalletAction(
  userWallet: { address: string } | undefined | null,
  isCreatingWallet: boolean,
  isConfirmedNewUser: boolean,
): 'wait' | 'create' | 'skip' {
  if (userWallet) return 'wait';
  if (isCreatingWallet) return 'skip';
  // Only create a wallet when the OAuth callback has explicitly confirmed this
  // is a new user. This prevents a race condition where user.wallet is briefly
  // undefined during Privy's async hydration for returning users, which would
  // otherwise trigger createWallet() and orphan their original wallet/character.
  if (!isConfirmedNewUser) return 'skip';
  return 'create';
}

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
  walletRecoveryFailed: boolean;
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
  const [isConfirmedNewUser, setIsConfirmedNewUser] = useState(false);
  const { initOAuth } = useLoginWithOAuth({
    onComplete: ({ user: privyUser, isNewUser }) => {
      console.info('[Auth] OAuth complete:', { email: privyUser?.google?.email, isNewUser });
      setIsConfirmedNewUser(!!isNewUser);
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
  const [walletRecoveryFailed, setWalletRecoveryFailed] = useState(false);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newUserFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const serverWalletAddress = user?.wallet?.address?.toLowerCase();
    console.info('[Auth] Wallet init effect:', { ready, authenticated, walletsCount: wallets.length, walletTypes: wallets.map(w => w.walletClientType), serverWallet: serverWalletAddress });
    if (!ready || !authenticated) {
      if (ready) setIsConnecting(false);
      return;
    }

    // Find embedded wallet (Privy MPC wallet).
    // For existing users, only accept the wallet matching the server-side address.
    // This prevents using a newly-created duplicate if recovery is still in progress.
    const privyWallet = serverWalletAddress
      ? wallets.find(w => w.walletClientType === 'privy' && w.address.toLowerCase() === serverWalletAddress)
      : wallets.find(w => w.walletClientType === 'privy');

    // Log if there's a mismatched privy wallet (indicates recovery issue)
    if (!privyWallet && serverWalletAddress) {
      const anyPrivyWallet = wallets.find(w => w.walletClientType === 'privy');
      if (anyPrivyWallet) {
        console.warn('[Auth] Wallet mismatch — server expects', serverWalletAddress, 'but got', anyPrivyWallet.address, '(ignoring mismatched wallet, waiting for recovery)');
      }
    }

    if (!privyWallet) {
      const action = resolveWalletAction(user?.wallet, isCreatingWallet.current, isConfirmedNewUser);
      if (action === 'wait') {
        console.info('[Auth] User already has wallet on server, waiting for recovery...', { serverWallet: serverWalletAddress });
        // Start a recovery timeout — if wallet doesn't appear in 15s, mark failed
        if (!recoveryTimerRef.current && !walletRecoveryFailed) {
          recoveryTimerRef.current = setTimeout(() => {
            console.error('[Auth] Wallet recovery timed out after 15s. Server wallet:', serverWalletAddress);
            setWalletRecoveryFailed(true);
            setIsConnecting(false);
          }, 15_000);
        }
        return;
      }
      if (action === 'skip') {
        // Fallback: on mobile redirect flows, onComplete may not fire so
        // isConfirmedNewUser stays false. If authenticated with no server
        // wallet after 3s, treat as new user and create wallet anyway.
        if (!user?.wallet && !newUserFallbackRef.current && !isCreatingWallet.current) {
          newUserFallbackRef.current = setTimeout(() => {
            console.info('[Auth] New-user fallback: onComplete did not fire, forcing wallet creation');
            setIsConfirmedNewUser(true);
          }, 3_000);
        }
        return;
      }
      // action === 'create': truly new user (or fallback triggered)
      if (newUserFallbackRef.current) {
        clearTimeout(newUserFallbackRef.current);
        newUserFallbackRef.current = null;
      }
      isCreatingWallet.current = true;
      console.info('[Auth] New user with no wallet — creating one...', { walletTypes: wallets.map(w => w.walletClientType) });
      createWallet()
        .then(w => console.info('[Auth] Wallet created:', w.address))
        .catch(err => console.warn('[Auth] createWallet failed (may already exist):', err.message))
        .finally(() => { isCreatingWallet.current = false; });
      return;
    }

    // Wallet found — clear recovery timeout
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (walletRecoveryFailed) setWalletRecoveryFailed(false);

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
  }, [ready, authenticated, wallets, user, isConfirmedNewUser]);

  // Gas funding — call /fund with retry + periodic re-registration.
  // Relayer handles dedup (skips if already funded + balance sufficient).
  // Re-registers every 10 min to survive relayer redeploys wiping tracking state.
  useEffect(() => {
    if (!embeddedAddress || !RELAYER_URL) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const callFund = async (): Promise<boolean> => {
      try {
        const res = await fetch(`${RELAYER_URL}/fund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(FUND_API_KEY ? { 'x-api-key': FUND_API_KEY } : {}),
          },
          body: JSON.stringify({ address: embeddedAddress }),
        });
        const data = await res.json();
        console.info('[Gas] Fund response:', data.status);
        return res.ok;
      } catch (err) {
        console.warn('[Gas] Funding failed:', err);
        return false;
      }
    };

    const fundWithRetry = async () => {
      const delays = [0, 5_000, 10_000, 20_000]; // immediate, then 5s, 10s, 20s
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return;
        if (i > 0) {
          await new Promise<void>(resolve => {
            const t = setTimeout(resolve, delays[i]);
            timers.push(t);
          });
        }
        if (cancelled) return;
        const ok = await callFund();
        if (ok) return;
      }
    };

    // Initial fund with retry
    fundWithRetry();

    // Periodic re-registration every 10 minutes
    const reRegInterval = setInterval(() => {
      if (!cancelled) callFund();
    }, 600_000);

    return () => {
      cancelled = true;
      timers.forEach(t => clearTimeout(t));
      clearInterval(reRegInterval);
    };
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
    // Clear cached delegator for fast-path
    clearCachedDelegator(import.meta.env.VITE_WORLD_ADDRESS || '');

    if (authenticated) {
      try {
        await logout();
      } catch {
        // ignore
      }
      setEmbeddedWalletClient(null);
      setEmbeddedAddress(null);
      setSignedInEmail(null);
      setWalletRecoveryFailed(false);
      if (recoveryTimerRef.current) { clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; }
      if (newUserFallbackRef.current) { clearTimeout(newUserFallbackRef.current); newUserFallbackRef.current = null; }
      initAddressRef.current = null;
      isCreatingWallet.current = false;
      setIsConfirmedNewUser(false);
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
        walletRecoveryFailed: false,
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
        isConnecting: !walletRecoveryFailed,
        ownerAddress: null,
        signedInEmail: null,
        walletRecoveryFailed,
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
        walletRecoveryFailed: false,
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
      walletRecoveryFailed: false,
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
    walletRecoveryFailed,
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
