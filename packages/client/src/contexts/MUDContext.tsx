import { useDisclosure } from '@chakra-ui/react';
import { type ContractWrite } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValue, overridableComponent } from '@latticexyz/recs';
import { SyncStep } from '@latticexyz/store-sync';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import IWorldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
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
import { share, Subject } from 'rxjs';
import {
  type Address,
  formatEther,
  getContract,
  type Hex,
} from 'viem';
import { useWalletClient } from 'wagmi';

import { type Burner, createBurner } from '../lib/mud/createBurner';
import { createSystemCalls } from '../lib/mud/createSystemCalls';
import {
  clearBurnerWallet,
  isDelegated,
  revokeDelegation,
} from '../lib/mud/delegation';
import {
  ComponentsResult,
  NetworkResult,
  SystemCallsResult,
} from '../lib/mud/setup';

import { useAuth } from './AuthContext';

type AuthMethod = 'embedded' | 'external' | null;

type MUDContextType = {
  authMethod: AuthMethod;
  burnerAddress: Address;
  burnerBalance: string;
  burnerBalanceFetched: boolean;
  components: ComponentsResult;
  delegatorAddress: Address | null;
  delegatorEntity: string | null;
  getBurner: () => void;
  handleLogoutRevoke: () => Promise<void>;
  handleRevokeDelegation: () => Promise<void>;
  isRevokingDelegation: boolean;
  isSynced: boolean;
  isWalletDetailsModalOpen: boolean;
  network: NetworkResult;
  onCloseWalletDetailsModal: () => void;
  onOpenWalletDetailsModal: () => void;
  systemCalls: SystemCallsResult;
};

const MUDContext = createContext<MUDContextType | null>(null);

type SetupResult = {
  components: ComponentsResult;
  network: NetworkResult;
  systemCalls: SystemCallsResult;
};

type Props = {
  children: ReactNode;
  setupPromise: Promise<SetupResult>;
};

// Outer component: resolves setupPromise, shows loading/error states.
// No hooks that depend on setupResult live here — they're all in MUDProviderInner.
export const MUDProvider = ({ children, setupPromise }: Props): JSX.Element => {
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [setupError, setSetupError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setupPromise
      .then(result => {
        if (!cancelled) setSetupResult(result);
      })
      .catch(err => {
        if (!cancelled) setSetupError(err);
      });
    return () => { cancelled = true; };
  }, [setupPromise]);

  if (setupError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', flexDirection: 'column', gap: '1rem' }}>
        <p>Failed to initialize game</p>
        <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>{setupError.message}</p>
      </div>
    );
  }

  if (!setupResult) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <img src="/images/ultimate-dominion-logo.svg" alt="Ultimate Dominion" style={{ width: '200px', opacity: 0.8 }} />
        <p style={{ color: 'white', fontSize: '1.125rem' }}>Loading...</p>
      </div>
    );
  }

  // setupResult is guaranteed non-null from here — hand off to inner component
  // where ALL hooks are called unconditionally on every render.
  return <MUDProviderInner setupResult={setupResult}>{children}</MUDProviderInner>;
};

// Inner component: setupResult is always defined, so all hooks run unconditionally.
const MUDProviderInner = ({
  children,
  setupResult,
}: {
  children: ReactNode;
  setupResult: SetupResult;
}): JSX.Element => {
  const { authMethod, embeddedWalletClient, ownerAddress } = useAuth();
  const { data: externalWalletClient } = useWalletClient();

  const {
    isOpen: isWalletDetailsModalOpen,
    onOpen: onOpenWalletDetailsModal,
    onClose: onCloseWalletDetailsModal,
  } = useDisclosure();

  // --- External path state ---
  const [burner, setBurner] = useState<Burner | null>(null);
  const [burnerBalance, setBurnerBalance] = useState<string>('0');
  const [burnerBalanceFetched, setBurnerBalanceFetched] = useState(false);

  const [isSynced, setIsSynced] = useState(false);
  const burnerCreated = useRef(false);

  // --- Embedded path state ---
  const [embeddedSetup, setEmbeddedSetup] = useState<{
    components: ComponentsResult;
    network: NetworkResult;
    systemCalls: SystemCallsResult;
    walletAddress: Address;
  } | null>(null);
  const embeddedSetupDone = useRef(false);

  const syncProgress = useComponentValue(
    setupResult.components.SyncProgress,
    singletonEntity,
  );

  // =============================================
  // EMBEDDED PATH: Set up when embedded wallet is connected
  // =============================================
  useEffect(() => {
    if (authMethod !== 'embedded') return;
    if (!embeddedWalletClient) return;
    if (!ownerAddress) return;
    if (embeddedSetupDone.current) return;
    if (syncProgress?.step !== SyncStep.LIVE) return;

    embeddedSetupDone.current = true;

    const write$ = new Subject<ContractWrite>();

    if (!embeddedWalletClient.account) {
      console.error('[MUDContext] Embedded wallet client has no account');
      return;
    }

    // EIP-7702: the embedded wallet is an EOA with standard nonce management,
    // so transactionQueue() works normally (unlike the old ERC-4337 path).
    const walletClient = (embeddedWalletClient as any)
      .extend(transactionQueue())
      .extend(writeObserver({ onWrite: write => write$.next(write) }));

    const worldContract = getContract({
      address: setupResult.network.worldContract.address,
      abi: IWorldAbi,
      client: { public: setupResult.network.publicClient, wallet: walletClient },
    });

    const embeddedComponents = {
      ...setupResult.components,
      Position: overridableComponent(setupResult.components.Position),
    };

    // EIP-7702: standard tx hashes work with MUD's default waitForTransaction
    // (RECS block sync). No custom polling needed like the old ERC-4337 path.
    const systemCalls = createSystemCalls(
      {
        ...setupResult.network,
        delegatorAddress: ownerAddress,
        worldContract,
      },
      embeddedComponents,
    );

    setEmbeddedSetup({
      components: embeddedComponents,
      network: {
        ...setupResult.network,
        walletClient,
        worldContract,
        write$: write$.asObservable().pipe(share()),
      },
      systemCalls,
      walletAddress: ownerAddress,
    });

    setIsSynced(true);
  }, [
    authMethod,
    embeddedWalletClient,
    ownerAddress,
    setupResult,
    syncProgress,
  ]);

  // Reset embedded setup if wallet disconnects
  useEffect(() => {
    if (authMethod !== 'embedded' && embeddedSetupDone.current) {
      embeddedSetupDone.current = false;
      setEmbeddedSetup(null);
    }
  }, [authMethod]);

  // =============================================
  // EXTERNAL PATH: Existing delegation + burner flow (unchanged)
  // =============================================

  // Reactively watch the delegation component so we detect delegation
  // even if it syncs after getBurner was called
  const delegationEntity = useMemo(() => {
    if (!externalWalletClient) return undefined;
    return encodeEntity(
      { delegator: 'address', delegatee: 'address' },
      {
        delegator: externalWalletClient.account.address,
        delegatee: setupResult.network.walletClient.account.address,
      },
    );
  }, [externalWalletClient, setupResult.network]);

  const delegationValue = useComponentValue(
    setupResult.components.UserDelegationControl,
    delegationEntity,
  );

  const getBurner = useCallback(async () => {
    if (!(externalWalletClient && setupResult.network)) return;

    const delegation = getComponentValue(
      setupResult.components.UserDelegationControl,
      encodeEntity(
        { delegator: 'address', delegatee: 'address' },
        {
          delegator: externalWalletClient.account.address,
          delegatee: setupResult.network.walletClient.account.address,
        },
      ),
    );

    if (burner) return;
    if (isDelegated(delegation as { delegationControlId: Hex })) {
      burnerCreated.current = true;
      setBurner(
        createBurner(setupResult.network, externalWalletClient.account.address),
      );
    }
    setIsSynced(true);
  }, [burner, externalWalletClient, setupResult]);

  useEffect(() => {
    if (authMethod === 'embedded') return; // Skip for embedded path
    if (syncProgress?.step !== SyncStep.LIVE) return;
    if (isSynced) return;

    getBurner();
  }, [authMethod, getBurner, isSynced, syncProgress]);

  // Reactively create burner when delegation appears in the RECS store
  // This handles the race condition where getBurner runs before MUD syncs the delegation
  useEffect(() => {
    if (authMethod === 'embedded') return; // Skip for embedded path
    if (burnerCreated.current || burner) return;
    if (!(externalWalletClient && setupResult.network)) return;
    if (!isDelegated(delegationValue as { delegationControlId: Hex })) return;

    burnerCreated.current = true;
    setBurner(
      createBurner(setupResult.network, externalWalletClient.account.address),
    );
  }, [authMethod, burner, delegationValue, externalWalletClient, setupResult]);

  // =============================================
  // Burner balance polling (shared, works for both paths)
  // =============================================
  const activeWalletAddress = useMemo(() => {
    if (authMethod === 'embedded' && embeddedSetup) {
      return embeddedSetup.walletAddress;
    }
    if (burner) {
      return burner.walletClient.account.address;
    }
    return null;
  }, [authMethod, burner, embeddedSetup]);

  const getBurnerBalance = useCallback(async () => {
    if (!activeWalletAddress) return;
    const balance = await setupResult.network.publicClient.getBalance({
      address: activeWalletAddress,
    });
    setBurnerBalance(formatEther(balance));
    setBurnerBalanceFetched(true);
  }, [activeWalletAddress, setupResult.network]);

  useEffect(() => {
    if (!activeWalletAddress) return () => {};
    getBurnerBalance();

    const interval = setInterval(getBurnerBalance, 30000);
    return () => clearInterval(interval);
  }, [activeWalletAddress, getBurnerBalance]);

  // =============================================
  // Revoke delegation
  // =============================================
  const [isRevokingDelegation, setIsRevokingDelegation] = useState(false);

  const handleRevokeDelegation = useCallback(async () => {
    if (!externalWalletClient || authMethod !== 'external') return;

    setIsRevokingDelegation(true);
    try {
      await revokeDelegation(
        setupResult.network,
        externalWalletClient,
        setupResult.network.walletClient.account.address,
      );
      // RECS will sync the delegation removal automatically,
      // causing delegationValue to become undefined and the UI
      // to transition back to "pre-delegation" state.
      // Reset burner state so the UI shows the pre-delegation view.
      burnerCreated.current = false;
      setBurner(null);
    } finally {
      setIsRevokingDelegation(false);
    }
  }, [authMethod, externalWalletClient, setupResult.network]);

  const handleLogoutRevoke = useCallback(async () => {
    if (authMethod !== 'external' || !externalWalletClient) return;

    // Best-effort revoke — if it fails, still proceed with logout
    try {
      await revokeDelegation(
        setupResult.network,
        externalWalletClient,
        setupResult.network.walletClient.account.address,
      );
    } catch (e) {
      console.warn('Failed to revoke delegation during logout:', e);
    }

    clearBurnerWallet();
  }, [authMethod, externalWalletClient, setupResult.network]);

  // =============================================
  // Build context value
  // =============================================
  const value = useMemo(() => {
    const noopRevoke = async () => {};

    // EMBEDDED PATH: use embedded wallet directly, no delegation needed
    if (authMethod === 'embedded' && embeddedSetup) {
      return {
        authMethod: 'embedded' as AuthMethod,
        burnerAddress: embeddedSetup.walletAddress,
        burnerBalance,
        burnerBalanceFetched,
        components: embeddedSetup.components,
        delegatorAddress: embeddedSetup.walletAddress, // Same address — IS the signer
        delegatorEntity: encodeEntity(
          { address: 'address' },
          { address: embeddedSetup.walletAddress },
        ),
        getBurner,
        handleLogoutRevoke: noopRevoke,
        handleRevokeDelegation: noopRevoke,
        isRevokingDelegation: false,
        isSynced,
        isWalletDetailsModalOpen,
        network: embeddedSetup.network,
        onCloseWalletDetailsModal,
        onOpenWalletDetailsModal,
        systemCalls: embeddedSetup.systemCalls,
      };
    }

    // EXTERNAL PATH: burner + delegation
    if (!(burner && burner.delegatorAddress)) {
      return {
        authMethod: (authMethod ?? 'external') as AuthMethod,
        burnerAddress: setupResult.network.walletClient.account.address,
        burnerBalance,
        burnerBalanceFetched,
        components: setupResult.components,
        delegatorAddress: null,
        delegatorEntity: null,
        getBurner,
        handleLogoutRevoke,
        handleRevokeDelegation,
        isRevokingDelegation,
        isSynced,
        isWalletDetailsModalOpen,
        network: setupResult.network,
        onCloseWalletDetailsModal,
        onOpenWalletDetailsModal,
        systemCalls: setupResult.systemCalls,
      };
    }

    return {
      authMethod: 'external' as AuthMethod,
      burnerAddress: burner.walletClient.account.address,
      burnerBalance,
      burnerBalanceFetched,
      components: burner.components,
      delegatorAddress: burner.delegatorAddress,
      delegatorEntity: encodeEntity(
        { address: 'address' },
        { address: burner.delegatorAddress },
      ),
      getBurner,
      handleLogoutRevoke,
      handleRevokeDelegation,
      isRevokingDelegation,
      isSynced,
      isWalletDetailsModalOpen,
      network: burner.network,
      onCloseWalletDetailsModal,
      onOpenWalletDetailsModal,
      systemCalls: burner.systemCalls,
    };
  }, [
    authMethod,
    burner,
    burnerBalance,
    burnerBalanceFetched,
    embeddedSetup,
    getBurner,
    handleLogoutRevoke,
    handleRevokeDelegation,
    isRevokingDelegation,
    isSynced,
    isWalletDetailsModalOpen,
    onCloseWalletDetailsModal,
    onOpenWalletDetailsModal,
    setupResult,
  ]);

  return <MUDContext.Provider value={value}>{children}</MUDContext.Provider>;
};

export const useMUD = (): MUDContextType => {
  const value = useContext(MUDContext);
  if (!value) throw new Error('Must be used within a MUDProvider');
  return value;
};
