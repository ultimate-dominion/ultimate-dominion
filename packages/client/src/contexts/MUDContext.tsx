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
  createWalletClient,
  formatEther,
  getContract,
  type Hex,
} from 'viem';
import { useWalletClient } from 'wagmi';

import { type Burner, createBurner } from '../lib/mud/createBurner';
import { createSystemCalls } from '../lib/mud/createSystemCalls';
import { createViemClientConfig } from '../lib/mud/createViemClientConfig';
import { isDelegated } from '../lib/mud/delegation';
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
  isSynced: boolean;
  isWalletDetailsModalOpen: boolean;
  network: NetworkResult;
  onCloseWalletDetailsModal: () => void;
  onOpenWalletDetailsModal: () => void;
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
  const { authMethod, embeddedWalletClient, ownerAddress } = useAuth();
  const { data: externalWalletClient } = useWalletClient();

  const {
    isOpen: isWalletDetailsModalOpen,
    onOpen: onOpenWalletDetailsModal,
    onClose: onCloseWalletDetailsModal,
  } = useDisclosure();

  // --- External path state (unchanged) ---
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

    const account = embeddedWalletClient.account;
    if (!account) {
      console.error('[MUDContext] Embedded wallet client has no account');
      return;
    }

    // Create a wallet client using the network's transport config (http/ws)
    // with the embedded wallet's account for signing
    const chain = setupResult.network.publicClient.chain;
    let walletClient = createWalletClient({
      ...createViemClientConfig(chain),
      account,
    })
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

    const interval = setInterval(getBurnerBalance, 5000);
    return () => clearInterval(interval);
  }, [activeWalletAddress, getBurnerBalance]);

  // =============================================
  // Build context value
  // =============================================
  const value = useMemo(() => {
    if (!setupResult) return null;

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
        isSynced,
        isWalletDetailsModalOpen,
        network: embeddedSetup.network,
        onCloseWalletDetailsModal,
        onOpenWalletDetailsModal,
        systemCalls: embeddedSetup.systemCalls,
      };
    }

    // EXTERNAL PATH (unchanged): burner + delegation
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
