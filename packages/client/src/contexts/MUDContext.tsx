import { useDisclosure } from '@chakra-ui/react';
import { type ContractWrite } from '@latticexyz/common';
import { writeObserver } from '@latticexyz/common/actions';
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
  padHex,
  slice,
} from 'viem';
import { useWalletClient } from 'wagmi';

import { applyReceiptToStore } from '../lib/gameStore/applyReceiptToStore';
import { type Burner, createBurner } from '../lib/mud/createBurner';
import { createSystemCalls } from '../lib/mud/createSystemCalls';
import {
  clearBurnerWallet,
  isDelegated,
  revokeDelegation,
} from '../lib/mud/delegation';
import {
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
  delegatorAddress: Address | null;
  delegatorEntity: string | null;
  getBurner: () => void;
  getBurnerBalance: () => void;
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
  network: NetworkResult;
  systemCalls: SystemCallsResult;
};

type Props = {
  children: ReactNode;
  setupPromise: Promise<SetupResult>;
};

// Outer component: resolves setupPromise, shows loading/error states.
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
        <p style={{ color: '#C4B89E', fontSize: '1.125rem' }}>Loading...</p>
      </div>
    );
  }

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
    network: NetworkResult;
    systemCalls: SystemCallsResult;
    walletAddress: Address;
  } | null>(null);
  const embeddedSetupDone = useRef(false);

  // Fixed gas limits for functions with variable gas costs.
  // Prevents estimation misses (spawnOnTileEnter uses block.prevrandao).
  const FIXED_GAS: Record<string, bigint> = {
    UD__move: 4_000_000n,
  };

  // =============================================
  // EMBEDDED PATH: Privy signs on-device, broadcasts directly to our RPC.
  // No relayer in the tx path — just a standard viem WalletClient.
  // =============================================
  useEffect(() => {
    if (authMethod !== 'embedded') return;
    if (!embeddedWalletClient) return;
    if (!ownerAddress) return;
    if (embeddedSetupDone.current) return;

    embeddedSetupDone.current = true;

    console.info('[MUD][EMBEDDED] Initializing embedded wallet path', {
      address: ownerAddress,
      chain: setupResult.network.publicClient.chain?.id,
    });

    const write$ = new Subject<ContractWrite>();

    if (!embeddedWalletClient.account) {
      console.error('[MUDContext] Embedded wallet client has no account');
      return;
    }

    // Privy WalletClient signs locally — extend with writeObserver for logging
    const walletClient = (embeddedWalletClient as any)
      .extend(writeObserver({ onWrite: (write: ContractWrite) => write$.next(write) }));

    const rawWorldContract = getContract({
      address: setupResult.network.worldContract.address,
      abi: IWorldAbi,
      client: { public: setupResult.network.publicClient, wallet: walletClient },
    });

    // Gas override proxy: injects fixed gas for functions with variable costs
    // (prevents estimation misses from spawnOnTileEnter using block.prevrandao)
    const worldContract = new Proxy(rawWorldContract, {
      get(target, prop) {
        if (prop === 'write') {
          return new Proxy(target.write, {
            get(writeTarget: Record<string, (...args: unknown[]) => Promise<unknown>>, fnName: string) {
              const fixedGas = FIXED_GAS[fnName];
              if (!fixedGas) return writeTarget[fnName];
              const origFn = writeTarget[fnName];
              if (typeof origFn !== 'function') return origFn;
              return (...args: unknown[]) => {
                // Inject gas into the options argument (last arg)
                const lastArg = args[args.length - 1];
                if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
                  (lastArg as Record<string, unknown>).gas = fixedGas;
                } else {
                  args.push({ gas: fixedGas });
                }
                return origFn.apply(writeTarget, args);
              };
            },
          });
        }
        return (target as Record<string | symbol, unknown>)[prop];
      },
    });

    // Wait for receipt, then inject MUD Store events into Zustand immediately.
    // Reuses the same waitForTransaction pattern with applyReceiptToStore.
    const embeddedWaitForTransaction = async (tx: Hex) => {
      const receipt = await setupResult.network.publicClient.waitForTransactionReceipt({
        hash: tx,
        pollingInterval: 150,
      });

      if (receipt.status === 'success') {
        await applyReceiptToStore(receipt, setupResult.network.publicClient, setupResult.network.worldContract.address as Hex);
      }

      if (receipt.status === 'reverted') {
        console.error(`[TX][RECEIPT] REVERTED on-chain tx=${tx} gasUsed=${receipt.gasUsed}`);

        try {
          const txData = await setupResult.network.publicClient.getTransaction({ hash: tx });
          console.error(`[TX][REVERT-DEBUG] from=${txData.from} to=${txData.to} input=${txData.input.slice(0, 10)}... block=${receipt.blockNumber}`);

          await setupResult.network.publicClient.call({
            account: txData.from,
            to: txData.to!,
            data: txData.input,
            blockNumber: receipt.blockNumber,
          });
          console.warn('[TX][REVERT-DEBUG] Replay succeeded — revert was state-dependent');
        } catch (revertErr: unknown) {
          const errMsg = revertErr instanceof Error ? revertErr.message : String(revertErr);
          const hexMatch = errMsg.match(/data:\s*(0x[0-9a-fA-F]+)/);
          if (hexMatch) {
            console.error(`[TX][REVERT-REASON] ${hexMatch[1]}`);
          }
          console.error('[TX][REVERT-DEBUG] Replay error:', errMsg.slice(0, 500));
        }
      } else {
        console.info(`[TX][RECEIPT] confirmed tx=${tx} block=${receipt.blockNumber}`);
      }

      return receipt;
    };

    const systemCalls = createSystemCalls({
      ...setupResult.network,
      waitForTransaction: embeddedWaitForTransaction,
      delegatorAddress: ownerAddress,
      worldContract,
    });

    setEmbeddedSetup({
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
  ]);

  // Reset embedded setup if wallet disconnects or user changes
  useEffect(() => {
    if (authMethod !== 'embedded' && embeddedSetupDone.current) {
      embeddedSetupDone.current = false;
      setEmbeddedSetup(null);
      setIsSynced(false);
    }
    if (
      authMethod === 'embedded' &&
      embeddedSetup &&
      ownerAddress &&
      embeddedSetup.walletAddress !== ownerAddress
    ) {
      console.info('[MUD][EMBEDDED] Wallet address changed, resetting setup', {
        old: embeddedSetup.walletAddress,
        new: ownerAddress,
      });
      embeddedSetupDone.current = false;
      setEmbeddedSetup(null);
    }
  }, [authMethod, ownerAddress, embeddedSetup]);

  // =============================================
  // EXTERNAL PATH: Delegation check via direct chain read (replaces RECS)
  // =============================================

  const checkDelegation = useCallback(async (): Promise<boolean> => {
    if (!externalWalletClient || !setupResult.network) return false;

    // Read delegation directly from the World contract's UserDelegationControl table
    // This replaces the RECS-based delegation check
    const DELEGATION_TABLE_ID =
      '0x7462776f726c640000000000000000005573657244656c65676174696f6e436f' as Hex;
    const GSF_ABI = [
      {
        name: 'getStaticField',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'tableId', type: 'bytes32' },
          { name: 'keyTuple', type: 'bytes32[]' },
          { name: 'fieldIndex', type: 'uint8' },
          { name: 'fieldLayout', type: 'bytes32' },
        ],
        outputs: [{ name: 'data', type: 'bytes32' }],
      },
    ] as const;

    try {
      const delegatorPadded = padHex(externalWalletClient.account.address, { size: 32 });
      const delegateePadded = padHex(setupResult.network.walletClient.account.address, { size: 32 });

      const delegationControlId = await setupResult.network.publicClient.readContract({
        address: setupResult.network.worldContract.address as Hex,
        abi: GSF_ABI,
        functionName: 'getStaticField',
        args: [
          DELEGATION_TABLE_ID,
          [delegatorPadded, delegateePadded],
          0,
          '0x0020000000000000000000000000000000000000000000000000000000000000' as Hex,
        ],
      });

      return isDelegated({ delegationControlId } as { delegationControlId: Hex });
    } catch {
      return false;
    }
  }, [externalWalletClient, setupResult.network]);

  const getBurner = useCallback(async () => {
    if (!(externalWalletClient && setupResult.network)) return;

    const hasDelegation = await checkDelegation();

    if (burner) return;
    if (hasDelegation) {
      burnerCreated.current = true;
      setBurner(
        createBurner(setupResult.network, externalWalletClient.account.address),
      );
    }
    setIsSynced(true);
  }, [burner, checkDelegation, externalWalletClient, setupResult]);

  // Auto-check delegation on mount for external path
  useEffect(() => {
    if (authMethod === 'embedded') return;
    if (isSynced) return;

    getBurner();
  }, [authMethod, getBurner, isSynced]);

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

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!interval) interval = setInterval(getBurnerBalance, 30000); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else { getBurnerBalance(); start(); } };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
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
      burnerCreated.current = false;
      setBurner(null);
    } finally {
      setIsRevokingDelegation(false);
    }
  }, [authMethod, externalWalletClient, setupResult.network]);

  const handleLogoutRevoke = useCallback(async () => {
    if (authMethod !== 'external' || !externalWalletClient) return;

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

    // Helper to create a delegator entity string (matches the Zustand keyBytes format)
    const makeDelegatorEntity = (addr: Address): string =>
      ('0x' + addr.slice(2).toLowerCase().padStart(64, '0'));

    // EMBEDDED PATH
    if (authMethod === 'embedded' && embeddedSetup) {
      return {
        authMethod: 'embedded' as AuthMethod,
        burnerAddress: embeddedSetup.walletAddress,
        burnerBalance,
        burnerBalanceFetched,
        delegatorAddress: embeddedSetup.walletAddress,
        delegatorEntity: makeDelegatorEntity(embeddedSetup.walletAddress),
        getBurner,
        getBurnerBalance,
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
        delegatorAddress: null,
        delegatorEntity: null,
        getBurner,
        getBurnerBalance,
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
      delegatorAddress: burner.delegatorAddress,
      delegatorEntity: burner.delegatorAddress
        ? makeDelegatorEntity(burner.delegatorAddress)
        : null,
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
    getBurnerBalance,
    handleLogoutRevoke,
    handleRevokeDelegation,
    isSynced,
    isRevokingDelegation,
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
