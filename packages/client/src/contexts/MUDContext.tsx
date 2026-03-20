import { useDisclosure } from '@chakra-ui/react';
import { type ContractWrite } from '@latticexyz/common';
import { transactionQueue, writeObserver } from '@latticexyz/common/actions';
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
import { clearCachedDelegator, setCachedDelegator } from '../lib/delegatorCache';

import { useAuth } from './AuthContext';

type AuthMethod = 'embedded' | 'external' | null;

type MUDContextType = {
  authMethod: AuthMethod;
  burnerAddress: Address;
  burnerBalance: string;
  burnerBalanceFetched: boolean;
  delegatorAddress: Address | null;
  delegatorEntity: string | null;
  getBurner: (forceCreate?: boolean) => void;
  getBurnerBalance: () => void;
  handleLogoutRevoke: () => Promise<void>;
  handleRevokeDelegation: () => Promise<void>;
  isRevokingDelegation: boolean;
  isSynced: boolean;
  isWalletDetailsModalOpen: boolean;
  network: NetworkResult;
  onCloseWalletDetailsModal: () => void;
  onOpenWalletDetailsModal: () => void;
  ready: boolean;
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

// --- Loading stubs for non-blocking render ---
const notReady = async () => ({ success: false as const, error: 'Game not ready' });
const LOADING_SYSTEM_CALLS: SystemCallsResult = {
  autoAdventure: notReady, buy: notReady, buyGas: notReady,
  cancelOrder: notReady, checkCombatFragmentTriggers: notReady,
  chooseRace: notReady, choosePowerSource: notReady,
  claimFragment: notReady, triggerFragment: notReady,
  createEncounter: notReady, createOrder: notReady,
  depositToEscrow: notReady, endShopEncounter: notReady,
  endWorldEncounter: notReady, endTurn: notReady,
  enterGame: notReady, equipItems: notReady, fleePvp: notReady,
  fulfillOrder: notReady, autoFight: notReady,
  levelCharacter: notReady, mintCharacter: notReady,
  move: notReady, removeEntityFromBoard: notReady,
  rest: notReady, restock: notReady,
  rollBaseStats: notReady, rollStats: notReady,
  selectAdvancedClass: notReady, sell: notReady,
  spawn: notReady, unequipItem: notReady,
  updateTokenUri: notReady, useWorldConsumableItem: notReady,
  withdrawFromEscrow: notReady,
} as unknown as SystemCallsResult;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const LOADING_NETWORK = {
  publicClient: null as any,
  walletClient: null as any,
  worldContract: { address: ZERO_ADDRESS } as any,
  waitForTransaction: async () => { throw new Error('Not ready'); },
  write$: { pipe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) } as any,
} as NetworkResult;

const LOADING_CONTEXT_VALUE: MUDContextType = {
  ready: false,
  authMethod: null,
  burnerAddress: ZERO_ADDRESS,
  burnerBalance: '0',
  burnerBalanceFetched: false,
  delegatorAddress: null,
  delegatorEntity: null,
  getBurner: () => {},
  getBurnerBalance: () => {},
  handleLogoutRevoke: async () => {},
  handleRevokeDelegation: async () => {},
  isRevokingDelegation: false,
  isSynced: false,
  isWalletDetailsModalOpen: false,
  network: LOADING_NETWORK,
  onCloseWalletDetailsModal: () => {},
  onOpenWalletDetailsModal: () => {},
  systemCalls: LOADING_SYSTEM_CALLS,
};

// Outer component: resolves setupPromise, renders children immediately with loading stubs.
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
        <p style={{ fontSize: '1rem', opacity: 0.7 }}>{setupError.message}</p>
      </div>
    );
  }

  if (!setupResult) {
    return (
      <MUDContext.Provider value={LOADING_CONTEXT_VALUE}>
        {children}
      </MUDContext.Provider>
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

  // Fixed gas limits — skip estimation for functions where the Privy RPC
  // serves stale state (Base flashblocks propagate faster than block headers).
  // Without this, gas estimation reverts against stale state and the TX never sends.
  const FIXED_GAS: Record<string, bigint> = {
    UD__move: 4_000_000n,
    UD__rollBaseStats: 4_000_000n,
    UD__chooseRace: 500_000n,
    UD__choosePowerSource: 500_000n,
    UD__enterGame: 8_000_000n,
  };

  // =============================================
  // EMBEDDED PATH: Privy signs on-device, broadcasts directly to our RPC.
  // No relayer in the tx path — just a standard viem WalletClient.
  // =============================================
  useEffect(() => {
    if (authMethod !== 'embedded') return;
    if (!embeddedWalletClient) return;
    if (!ownerAddress) return;
    // Skip if already set up for this exact address.
    // Using state (not just a ref) so the effect re-runs when the reset
    // effect nullifies embeddedSetup after an address change.
    if (embeddedSetup?.walletAddress === ownerAddress) return;

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

    // Privy WalletClient signs locally — extend with transactionQueue (nonce
    // management + serialization) and writeObserver for logging.  Matches the
    // external/burner path in setupNetwork.ts / createBurner.ts.
    const walletClient = (embeddedWalletClient as any)
      .extend(transactionQueue())
      .extend(writeObserver({ onWrite: (write: ContractWrite) => write$.next(write) }));

    const rawWorldContract = getContract({
      address: setupResult.network.worldContract.address,
      abi: IWorldAbi,
      client: { public: setupResult.network.publicClient, wallet: walletClient },
    });

    // Gas override proxy: injects fixed gas for functions with variable costs
    // (prevents estimation misses from spawnOnTileEnter using block.prevrandao).
    // Only injects when the caller hasn't already set gas explicitly.
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
                // Inject gas into the options argument (last arg),
                // but don't override if the caller already set gas explicitly
                // (e.g. move retries use MOVE_GAS_LIMIT = 8M).
                const lastArg = args[args.length - 1];
                if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg)) {
                  const opts = lastArg as Record<string, unknown>;
                  if (opts.gas === undefined) {
                    opts.gas = fixedGas;
                  }
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
    // Includes timeout + retry to handle flaky WS/RPC transports (matches
    // the external path in setupNetwork.ts).
    const embeddedWaitForTransaction = async (tx: Hex) => {
      const maxRetries = 3;
      let receipt: Awaited<ReturnType<typeof setupResult.network.publicClient.waitForTransactionReceipt>> | undefined;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          receipt = await setupResult.network.publicClient.waitForTransactionReceipt({
            hash: tx,
            pollingInterval: 250,
            timeout: 30_000,
          });
          break;
        } catch (e) {
          const isReceiptNotFound =
            e instanceof Error &&
            (e.message.includes('could not be found') || e.message.includes('timed out'));
          if (isReceiptNotFound && attempt < maxRetries - 1) {
            console.warn(
              `[TX][EMBEDDED] waitForTransaction retry ${attempt + 1}/${maxRetries} for ${tx}: ${(e as Error).message.slice(0, 100)}`,
            );
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }

      if (!receipt) {
        throw new Error(`Failed to get receipt for ${tx} after ${maxRetries} attempts`);
      }

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

    // Cache delegator address for fast-path on refresh
    setCachedDelegator(setupResult.network.worldContract.address, ownerAddress);
  }, [
    authMethod,
    embeddedSetup,
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
    if (!externalWalletClient || !setupResult.network) {
      console.warn('[MUD][checkDelegation] Missing wallet or network', {
        hasWallet: !!externalWalletClient,
        hasNetwork: !!setupResult.network,
      });
      return false;
    }

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

      console.info('[MUD][checkDelegation] Reading on-chain delegation', {
        delegator: externalWalletClient.account.address,
        delegatee: setupResult.network.walletClient.account.address,
        worldAddress: setupResult.network.worldContract.address,
      });

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

      const result = isDelegated({ delegationControlId } as { delegationControlId: Hex });
      console.info('[MUD][checkDelegation] Result', {
        delegationControlId,
        isDelegated: result,
      });
      return result;
    } catch (err) {
      console.error('[MUD][checkDelegation] Failed to read delegation from chain:', err);
      return false;
    }
  }, [externalWalletClient, setupResult.network]);

  // =============================================
  // Relayer registration for external (MetaMask) burners.
  // Retry on failure + periodic re-registration to survive relayer redeploys.
  // =============================================
  const RELAYER_URL = import.meta.env.VITE_RELAYER_URL;
  const FUND_API_KEY = import.meta.env.VITE_FUND_API_KEY;

  const callRelayerFund = useCallback(async (
    burnerAddress: string,
    delegatorAddress: string,
  ): Promise<boolean> => {
    if (!RELAYER_URL || !FUND_API_KEY) return false;
    try {
      const res = await fetch(`${RELAYER_URL}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': FUND_API_KEY },
        body: JSON.stringify({ address: burnerAddress, delegatorAddress }),
      });
      const data = await res.json();
      console.info('[Gas] MetaMask fund response:', data.status);
      return res.ok;
    } catch (err) {
      console.warn('[Gas] MetaMask funding failed:', err);
      return false;
    }
  }, [RELAYER_URL, FUND_API_KEY]);

  const registerBurnerWithRelayer = useCallback(async (
    burnerAddress: string,
    delegatorAddress: string,
  ) => {
    const delays = [0, 5_000, 10_000, 20_000];
    for (let i = 0; i < delays.length; i++) {
      if (i > 0) await new Promise<void>(r => setTimeout(r, delays[i]));
      const ok = await callRelayerFund(burnerAddress, delegatorAddress);
      if (ok) return;
    }
  }, [callRelayerFund]);

  const getBurner = useCallback(async (forceCreate?: boolean) => {
    if (!(externalWalletClient && setupResult.network)) {
      console.warn('[MUD][getBurner] Missing wallet or network');
      return;
    }

    if (burner) {
      console.info('[MUD][getBurner] Burner already exists, skipping creation');
      return;
    }

    // forceCreate skips the on-chain delegation check — used by DelegationButton
    // right after registerDelegation succeeds (the TX is already confirmed).
    let hasDelegation = forceCreate || false;
    if (!forceCreate) {
      console.info('[MUD][getBurner] Checking delegation on-chain...');
      hasDelegation = await checkDelegation();
      console.info('[MUD][getBurner] Delegation check result:', hasDelegation);
    } else {
      console.info('[MUD][getBurner] Force-creating burner (delegation just confirmed)');
    }

    if (hasDelegation) {
      console.info('[MUD][getBurner] Creating burner for delegator:', externalWalletClient.account.address);
      burnerCreated.current = true;
      const newBurner = createBurner(setupResult.network, externalWalletClient.account.address);
      setBurner(newBurner);

      // Cache delegator address for fast-path on refresh
      setCachedDelegator(setupResult.network.worldContract.address, externalWalletClient.account.address);

      // Register burner→delegator with relayer for gas monitoring.
      // Retry + periodic re-registration handled by a dedicated effect below.
      registerBurnerWithRelayer(
        newBurner.walletClient.account.address,
        externalWalletClient.account.address,
      );
    } else {
      console.warn('[MUD][getBurner] No delegation found — burner NOT created');
    }
    setIsSynced(true);
  }, [burner, checkDelegation, externalWalletClient, registerBurnerWithRelayer, setupResult]);

  // Auto-check delegation on mount for external path
  useEffect(() => {
    if (authMethod === 'embedded') return;
    if (isSynced) return;

    getBurner();
  }, [authMethod, getBurner, isSynced]);

  // Periodic re-registration for external burners (mirrors gauth's 10-min interval).
  // Survives relayer redeploys that wipe in-memory tracking state.
  useEffect(() => {
    if (authMethod !== 'external') return;
    if (!burner || !externalWalletClient) return;

    const burnerAddress = burner.walletClient.account.address;
    const delegatorAddress = externalWalletClient.account.address;

    const interval = setInterval(() => {
      callRelayerFund(burnerAddress, delegatorAddress);
    }, 600_000); // 10 minutes

    return () => clearInterval(interval);
  }, [authMethod, burner, callRelayerFund, externalWalletClient]);

  // Register embedded wallets with relayer for gas top-ups + periodic re-registration.
  // Embedded wallets send txs directly (no burner), so burner === delegator.
  // Fires on setup and every 10 min to survive relayer redeploys.
  useEffect(() => {
    if (authMethod !== 'embedded') return;
    if (!embeddedSetup) return;

    const addr = embeddedSetup.walletAddress;

    // Initial registration
    callRelayerFund(addr, addr);

    // Re-register every 10 minutes
    const interval = setInterval(() => {
      callRelayerFund(addr, addr);
    }, 600_000);

    return () => clearInterval(interval);
  }, [authMethod, callRelayerFund, embeddedSetup]);

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

    // Poll aggressively (2s) while balance is 0 (waiting for relayer funding),
    // then drop to normal interval (15s) once funded.
    const pollMs = burnerBalance === '0' ? 2000 : 15000;

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!interval) interval = setInterval(getBurnerBalance, pollMs); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const onVisibility = () => { if (document.hidden) stop(); else { getBurnerBalance(); start(); } };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [activeWalletAddress, burnerBalance, getBurnerBalance]);

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

    // Clear cached delegator for fast-path
    clearCachedDelegator(setupResult.network.worldContract.address);
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
        ready: true,
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
        ready: true,
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
      getBurnerBalance,
      handleLogoutRevoke,
      handleRevokeDelegation,
      isRevokingDelegation,
      isSynced,
      isWalletDetailsModalOpen,
      network: burner.network,
      onCloseWalletDetailsModal,
      onOpenWalletDetailsModal,
      ready: true,
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
