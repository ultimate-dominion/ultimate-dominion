/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 *
 * Reads game state from the Zustand store instead of RECS.
 */

import {
  Address,
  BaseError,
  ContractFunctionRevertedError,
  Hash,
  InsufficientFundsError,
  keccak256,
  stringToHex,
  toBytes,
} from 'viem';

import { INSUFFICIENT_FUNDS_MESSAGE } from '../../utils/errors';
import { reportError } from '../../utils/errorReporter';
import {
  AdvancedClass,
  ArmorType,
  type EntityStats,
  EncounterType,
  type NewOrder,
  PowerSource,
  Race,
  StatsClasses,
} from '../../utils/types';

import { getTableValue, useGameStore } from '../gameStore';
import { SetupNetworkResult } from './setupNetwork';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

type SystemCallReturn = Promise<{
  success: boolean;
  error?: string;
  severity?: 'error' | 'warning';
}>;

type ErrorCategory = 'REVERT' | 'FUNDS' | 'RPC' | 'GAS' | 'NONCE' | 'SPONSOR' | 'UNKNOWN';

// Map known custom error signatures to user-friendly messages.
const KNOWN_ERROR_SIGNATURES: Record<string, string> = {
  '0x9e4b2685': 'That name is already taken. Please choose a different name.',
  '0x6d187b28': 'Invalid account.',
  '0x442473f8': 'Invalid token URI.',
  '0x261fa6d6': 'Character is locked and cannot be modified.',
  '0x82b42900': 'You are not authorized to perform this action.',
  '0x8fa2ffa1': 'You need at least one weapon or spell equipped to enter combat.',
  '0x39f609e8': 'Action not found.',
  '0x54962c76': 'Item not equipped.',
  '0xbb1f5f1e': 'Action type not recognized.',
  '0x0f53fbcc': 'Invalid magic item type.',
  '0x4a7f394f': 'Invalid action.',
  '0xd7663649': 'Unrecognized resistance stat.',
  '0xecea39ab': 'Maximum mob types reached.',
  '0xdd94cf19': 'Mob array length mismatch.',
  '0x64b92770': 'Wrong mob type.',
  '0x326f4b4f': 'Moving too fast — wait a moment.',
  '0x5ffeddff': 'Maximum mob spawns reached.',
  '0x63754e43': 'In encounter — finish the battle first.',
  '0x72af8dba': 'Stats cannot be negative.',
  '0x03dee4c5': 'You don\'t have enough of this item to sell.',
  '0xadee4371': 'Invalid combat — monster may have moved or died. Try again.',
  '0xbd45e4f6': 'Character is not spawned.',
  '0xbd0f4934': 'Entity not at this position.',
  '0x1af235ec': 'This monster cannot be fought.',
  '0xa17bea2c': 'Auto adventure on cooldown — wait a moment.',
  '0x0769bef0': 'Already in an encounter.',
  '0xb4120f14': 'Out of bounds.',
  '0x87822d34': 'Invalid move.',
  '0xb8a03426': 'Only characters can do this.',
};

// Extract the raw 4-byte error selector from a viem error chain.
const extractRevertSelector = (error: unknown): string | null => {
  const str = String(error);
  // viem includes the selector in various formats: signature "0x...", data: "0x..."
  const match = str.match(/(?:signature|data)[:\s]+"?(0x[0-9a-f]{8})/i);
  return match ? match[1].toLowerCase() : null;
};

const classifyError = (error: unknown): { category: ErrorCategory; message: string; selector?: string } => {
  const raw = ((error as Error)?.message ?? '').toLowerCase();

  if (error && typeof error === 'object' && 'walk' in error) {
    const baseError = error as BaseError;

    const revertError = baseError.walk(
      e => e instanceof ContractFunctionRevertedError,
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName;
      const args = revertError.data?.args ?? [];
      // If ABI couldn't decode, try matching the raw selector against known errors
      const selector = extractRevertSelector(error);
      const knownMsg = selector ? KNOWN_ERROR_SIGNATURES[selector] : undefined;
      // "Error" is the generic ABI type for require(condition, "message") — prefer args[0] which has the actual message
      const requireMessage = errorName === 'Error' && args[0] ? (args[0] as string) : undefined;
      const reason = requireMessage ?? knownMsg ?? (errorName && errorName !== 'Error' ? errorName : undefined) ?? (args[0] as string) ?? `Unknown revert (${selector ?? 'no selector'})`;
      return { category: 'REVERT', message: reason, selector: selector ?? undefined };
    }

    const insufficientFundsError = baseError.walk(
      e => e instanceof InsufficientFundsError,
    );
    if (insufficientFundsError instanceof InsufficientFundsError) {
      return { category: 'FUNDS', message: INSUFFICIENT_FUNDS_MESSAGE };
    }
  }

  if (/gas required exceeds|out of gas|gas estimation/i.test(raw)) {
    return { category: 'GAS', message: raw };
  }
  if (/nonce/i.test(raw)) {
    return { category: 'NONCE', message: raw };
  }
  if (/sponsor|paymaster|entrypoint/i.test(raw)) {
    return { category: 'SPONSOR', message: raw };
  }
  if (/timeout|network|econnrefused|econnreset|socket hang up|fetch failed|failed to fetch|rate limit|429|502|503|504/i.test(raw)) {
    return { category: 'RPC', message: raw };
  }
  if (/execution reverted|revert/i.test(raw)) {
    return { category: 'REVERT', message: raw };
  }

  if (error instanceof Error) {
    return { category: 'UNKNOWN', message: error.message };
  }
  return { category: 'UNKNOWN', message: 'An error occurred calling the contract.' };
};

const getContractError = (error: unknown): string => {
  const { category, message } = classifyError(error);

  console.error(
    `[TX_ERROR][${category}] ${message}`,
    category === 'UNKNOWN' ? error : '',
  );

  if (category === 'FUNDS') return INSUFFICIENT_FUNDS_MESSAGE;

  // Match error selectors in various viem error formats:
  // - ContractFunctionRevertedError: signature "0x9e4b2685"
  // - EstimateGasExecutionError:     data: "0x9e4b2685"
  const sigMatch = message.match(/(?:signature|data)[:\s]+"?(0x[0-9a-f]{8})/i);
  if (sigMatch) {
    const friendly = KNOWN_ERROR_SIGNATURES[sigMatch[1].toLowerCase()];
    if (friendly) return friendly;
  }

  reportError("contract", error, { category: category, systemCall: "unknown" });

  return message || 'An error occurred calling the contract.';
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSystemCalls(
  {
    publicClient,
    walletClient,
    waitForTransaction,
    worldContract,
    delegatorAddress,
  }: SetupNetworkResult & { delegatorAddress?: Address },
) {
  // Validates character ownership by reading from the Zustand game store.
  const validateCharacterOwnership = (
    characterEntity: string,
    fnName: string,
  ): { success: false; error: string } | null => {
    const entity = characterEntity.toString();

    // Read from Zustand store instead of RECS
    const character = getTableValue('Characters', entity) as
      | { owner: string } | undefined;
    if (!character) {
      const msg = `${fnName}: entity is not a valid character`;
      console.warn(`[OWNERSHIP] ${msg}`);
      return { success: false, error: msg };
    }

    const expectedOwner = delegatorAddress ?? walletClient?.account?.address;
    if (expectedOwner && character.owner.toLowerCase() !== expectedOwner.toLowerCase()) {
      const msg = `${fnName}: not character owner`;
      console.warn(`[OWNERSHIP] ${msg}`);
      return { success: false, error: msg };
    }

    return null;
  };

  const buy = async (
    amount: bigint,
    shopId: string,
    itemIndex: string,
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'buy');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__buy([
        amount,
        shopId as `0x${string}`,
        BigInt(itemIndex),
        characterId as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to buy item.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const cancelOrder = async (orderHash: string): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__cancelOrder([orderHash as Hash]);
      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to cancel order.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const createEncounter = async (
    encounterType: EncounterType,
    group1: string[],
    group2: string[],
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__createEncounter([
        encounterType,
        group1 as `0x${string}`[],
        group2 as `0x${string}`[],
      ]);

      const receipt = await waitForTransaction(tx);
      return {
        error: receipt.status === 'reverted' ? 'Failed to create encounter.' : undefined,
        success: receipt.status !== 'reverted',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const createOrder = async (order: NewOrder): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__createOrder([order]);
      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to create order.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const depositToEscrow = async (
    characterEntity: string,
    previousAmount: bigint,
    amount: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'depositToEscrow');
    if (ownershipError) return ownershipError;

    try {
      const characterId = characterEntity as `0x${string}`;

      const tx = await worldContract.write.UD__depositToEscrow([
        characterId,
        BigInt(amount),
      ]);

      await waitForTransaction(tx);

      const newBalance = await worldContract.read.UD__getEscrowBalance([
        characterId,
      ]);

      const success = newBalance === previousAmount + amount;

      return {
        error: success ? undefined : 'Failed to deposit to escrow.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const endShopEncounter = async (encounterId: string): SystemCallReturn => {
    // Check the store first — if the encounter is already ended (e.g. by moving
    // away), skip the chain call entirely to avoid noisy relayer errors.
    const encounter = getTableValue('WorldEncounter', encounterId);
    if (!encounter || BigInt(encounter.end as string | number) !== BigInt(0)) {
      return { success: true };
    }

    try {
      const tx = await worldContract.write.UD__endShopEncounter([
        encounterId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return {
        error: receipt.status === 'reverted' ? 'Failed to end shop encounter.' : undefined,
        success: receipt.status !== 'reverted',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const endWorldEncounter = async (encounterId: string): SystemCallReturn => {
    // Check the store first — if already ended, skip the chain call.
    const encounter = getTableValue('WorldEncounter', encounterId);
    if (!encounter || BigInt(encounter.end as string | number) !== BigInt(0)) {
      return { success: true };
    }

    try {
      const tx = await worldContract.write.UD__endEncounter([
        encounterId as `0x${string}`,
        BigInt(0),
        false,
      ]);
      await waitForTransaction(tx);
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const endTurn = async (
    encounterId: string,
    playerId: string,
    defenderId: string,
    itemId: string,
  ): SystemCallReturn => {
    // Check the store first — if the encounter already ended (defender died on
    // previous turn), skip the chain call to avoid a revert.
    const combatEncounter = getTableValue('CombatEncounter', encounterId);
    if (!combatEncounter || BigInt(combatEncounter.end as string | number) !== BigInt(0)) {
      return { success: true };
    }

    const ownershipError = validateCharacterOwnership(playerId, 'endTurn');
    if (ownershipError) return ownershipError;

    try {
      const actions = [
        {
          attackerEntityId: playerId as `0x${string}`,
          defenderEntityId: defenderId as `0x${string}`,
          itemId: BigInt(itemId),
        },
      ];

      const tx = await worldContract.write.UD__endTurn(
        [
          encounterId as `0x${string}`,
          playerId as `0x${string}`,
          actions,
        ],
        {
          gas: BigInt('10000000'),
        },
      );

      const receipt = await waitForTransaction(tx);
      if (receipt.status !== 'success') {
        // TX reverted on-chain — simulate to extract revert reason
        console.error(`[TX_ERROR][ON_CHAIN_REVERT] endTurn reverted, tx=${tx}`);
        try {
          await publicClient.simulateContract({
            address: worldContract.address,
            abi: worldContract.abi,
            functionName: 'UD__endTurn',
            args: [
              encounterId as `0x${string}`,
              playerId as `0x${string}`,
              actions,
            ],
            account: walletClient?.account,
          });
        } catch (simErr) {
          const revertMsg = getContractError(simErr);
          return { error: revertMsg, success: false };
        }
        return { error: 'Attack reverted on-chain (unknown reason)', success: false };
      }
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const enterGame = async (
    characterEntity: string,
    starterWeaponId: bigint,
    starterArmorId: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'enterGame');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__enterGame([
        characterEntity as `0x${string}`,
        starterWeaponId,
        starterArmorId,
      ]);

      await waitForTransaction(tx);

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const equipItems = async (
    characterEntity: string,
    itemIds: string[],
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'equipItems');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__equipItems([
        characterEntity as `0x${string}`,
        itemIds.map(itemId => BigInt(itemId)),
      ]);

      await waitForTransaction(tx);
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const fleePvp = async (characterId: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'fleePvp');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__fleePvp([
        characterId as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const fulfillOrder = async (orderHash: string): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__fulfillOrder([
        orderHash as Hash,
      ]);
      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to fulfill order.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const levelCharacter = async (
    characterId: string,
    entityStats: Omit<EntityStats, 'entityClass'> & {
      class: StatsClasses;
    },
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'levelCharacter');
    if (ownershipError) return ownershipError;

    try {
      const formattedNewStats = {
        strength: BigInt(entityStats.strength),
        agility: BigInt(entityStats.agility),
        class: entityStats.class,
        intelligence: BigInt(entityStats.intelligence),
        maxHp: BigInt(entityStats.maxHp),
        currentHp: BigInt(entityStats.currentHp),
        experience: BigInt(entityStats.experience),
        level: BigInt(entityStats.level) + BigInt(1),
        powerSource: entityStats.powerSource ?? PowerSource.None,
        race: entityStats.race ?? Race.None,
        startingArmor: entityStats.startingArmor ?? ArmorType.None,
        advancedClass: entityStats.advancedClass ?? AdvancedClass.None,
        hasSelectedAdvancedClass: entityStats.hasSelectedAdvancedClass ?? false,
      };

      const tx = await worldContract.write.UD__levelCharacter([
        characterId as `0x${string}`,
        formattedNewStats,
      ]);

      await waitForTransaction(tx);

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const mintCharacter = async (
    account: Address,
    name: string,
    uri: string,
  ): SystemCallReturn => {
    try {
      const nameHex = stringToHex(name, { size: 32 });

      const tx = await worldContract.write.UD__mintCharacter([
        account,
        nameHex,
        uri,
      ]);

      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to mint character.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  let isMovePending = false;

  // Adaptive move throttle: starts at BASE_MOVE_GAP_MS, widens to
  // BACKPRESSURE_MOVE_GAP_MS after a revert (state was stale — give the
  // RPC time to catch up), then decays back after DECAY_AFTER_SUCCESSES
  // consecutive successful moves. Prevents burning relayer gas on repeated
  // reverts while keeping movement snappy when healthy.
  const BASE_MOVE_GAP_MS = 200;
  const BACKPRESSURE_MOVE_GAP_MS = 500;
  const DECAY_AFTER_SUCCESSES = 3;
  let currentMoveGapMs = BASE_MOVE_GAP_MS;
  let consecutiveSuccesses = 0;

  // Local timestamp (ms) of the last move completion (success or revert).
  let lastMoveCompletedMs = 0;

  const INVALID_MOVE_SELECTOR = '87822d34';
  const NOT_SPAWNED_SELECTOR = 'bd45e4f6';

  const isInvalidMoveError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(INVALID_MOVE_SELECTOR) || msg.includes('invalid move') || msg.includes('invalidmove');
  };

  const isNotSpawnedError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(NOT_SPAWNED_SELECTOR) || msg.includes('not spawned') || msg.includes('notspawned');
  };

  /**
   * Adaptive debounce between consecutive moves.
   * On-chain cooldown is 0 — this prevents queueing moves faster than the
   * pipeline can process them. Widens after reverts, decays after successes.
   */
  const waitForMoveCooldown = async () => {
    if (lastMoveCompletedMs > 0) {
      const elapsedMs = Date.now() - lastMoveCompletedMs;
      if (elapsedMs < currentMoveGapMs) {
        const delayMs = currentMoveGapMs - elapsedMs;
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  };

  const onMoveSuccess = () => {
    lastMoveCompletedMs = Date.now();
    consecutiveSuccesses++;
    if (consecutiveSuccesses >= DECAY_AFTER_SUCCESSES && currentMoveGapMs > BASE_MOVE_GAP_MS) {
      currentMoveGapMs = BASE_MOVE_GAP_MS;
      console.info(`[move] Throttle decayed to ${BASE_MOVE_GAP_MS}ms after ${consecutiveSuccesses} successes`);
    }
  };

  const onMoveRevert = () => {
    lastMoveCompletedMs = Date.now();
    consecutiveSuccesses = 0;
    if (currentMoveGapMs < BACKPRESSURE_MOVE_GAP_MS) {
      currentMoveGapMs = BACKPRESSURE_MOVE_GAP_MS;
      console.warn(`[move] Throttle widened to ${BACKPRESSURE_MOVE_GAP_MS}ms after revert`);
    }
  };

  // MoveTooFast selector — on-chain MOVE_COOLDOWN is 0 so this error can only
  // come from stale RPC state during eth_call simulation (Base L2 edge case
  // where state propagates faster than block headers). Safe to skip simulation.
  const MOVE_TOO_FAST_SELECTOR = '326f4b4f';

  const isMoveTooFastError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(MOVE_TOO_FAST_SELECTOR) || msg.includes('movetoofast');
  };

  // Transient RPC/network errors — not the player's fault, just stale state.
  const isTransientRpcError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return /failed to fetch|timeout|network|econnrefused|econnreset|socket hang up|rate limit|429|502|503|504/.test(msg);
  };

  const MOVE_STALE_STATE_WARNING = "You're moving too fast! Take a moment and try again.";

  // Gas limit for moves that skip simulation (covers spawnOnTileEnter worst case).
  // Tiles accumulate mobs across sessions; spawning into a dense tile requires
  // significantly more gas due to EntitiesAtPosition reads + multiple mob writes.
  const MOVE_GAS_LIMIT = BigInt(8_000_000);

  // On-chain retry: if the receipt reverts, diagnose then retry once.
  // Transient reverts (stale RPC, same-block timing) are common during rapid
  // movement — the diagnostic simulation confirms the move is now valid.
  const ON_CHAIN_RETRY_DELAY_MS = 500;
  const MAX_ON_CHAIN_RETRIES = 1;

  type Direction = 'up' | 'down' | 'left' | 'right';

  const move = async (
    characterEntity: string,
    direction: Direction,
  ): SystemCallReturn => {
    if (isMovePending) {
      console.warn('[move] Move already in progress, ignoring request');
      return { success: false, error: 'Move in progress.' };
    }

    const ownershipError = validateCharacterOwnership(characterEntity, 'move');
    if (ownershipError) return ownershipError;

    // Check store for active encounter — prevents sending a doomed tx when
    // the previous move triggered a mob spawn (receipt already applied to store
    // but React hasn't re-rendered currentBattle yet).
    const encounterState = getTableValue('EncounterEntity', characterEntity) as
      | { encounterId: string } | undefined;
    if (encounterState?.encounterId && encounterState.encounterId !== ('0x' + '0'.repeat(64))) {
      return { success: false, error: 'In encounter.' };
    }

    // Read position from the Zustand store (updated synchronously from receipts)
    // instead of relying on React state or optimistic refs which can be stale.
    const pos = getTableValue('Position', characterEntity) as
      | { x: number; y: number } | undefined;
    if (!pos) {
      return { success: false, error: 'Position not found.' };
    }

    let x = Number(pos.x);
    let y = Number(pos.y);
    switch (direction) {
      case 'up': y += 1; break;
      case 'down': y -= 1; break;
      case 'left': x -= 1; break;
      case 'right': x += 1; break;
    }

    isMovePending = true;
    try {
      await waitForMoveCooldown();

      let args: readonly [`0x${string}`, number, number] = [characterEntity as `0x${string}`, x, y];
      let onChainRetries = 0;

      // Always skip simulation for moves. MOVE_COOLDOWN is 0 on-chain, but
      // Base flashblocks propagate state faster than block headers — eth_call
      // simulation sees a new SessionTimer but an old block.timestamp, causing
      // MoveTooFast 100% of the time during rapid play. Client-side already
      // validates boundaries, spawned state, and encounters. Sending with a
      // generous gas limit; real errors are caught via receipt + diagnostic.
      for (let attempt = 0; attempt < 1 + MAX_ON_CHAIN_RETRIES; attempt++) {
        try {
          let tx: `0x${string}`;

          if (onChainRetries > 0) {
            console.warn(`[move] Retry ${onChainRetries} — sending with gas ${MOVE_GAS_LIMIT} (target: ${x},${y})`);
          }
          tx = await worldContract.write.UD__move(args, { gas: MOVE_GAS_LIMIT });

          const receipt = await waitForTransaction(tx);
          if (receipt.status === 'reverted') {
            console.error(`[move] TX REVERTED — hash: ${tx}, gasUsed: ${receipt.gasUsed}, block: ${receipt.blockNumber} (target: ${x},${y})`);

            // Fast diagnostic: race the simulation against a 1.5s timeout.
            // The full RPC fallback chain can take 10-30s if endpoints are
            // returning 400/429 — we'd rather return a warning quickly and
            // let the player retry than lock them out.
            const DIAG_TIMEOUT_MS = 1500;
            let diagResult: 'pass' | 'not_spawned' | 'invalid_move' | 'transient' | 'timeout' | 'error' = 'error';
            let diagError: unknown;

            try {
              await Promise.race([
                worldContract.simulate.UD__move(args).then(() => { diagResult = 'pass'; }),
                new Promise<void>((_, reject) => setTimeout(() => {
                  diagResult = 'timeout';
                  reject(new Error('diag timeout'));
                }, DIAG_TIMEOUT_MS)),
              ]);
            } catch (e) {
              if (diagResult !== 'timeout') {
                diagError = e;
                if (isNotSpawnedError(e)) diagResult = 'not_spawned';
                else if (isInvalidMoveError(e)) diagResult = 'invalid_move';
                else if (isMoveTooFastError(e) || isTransientRpcError(e)) diagResult = 'transient';
                else diagResult = 'error';
              }
            }

            if (diagResult === 'not_spawned') {
              console.warn('[move] Character is not spawned — updating store');
              useGameStore.getState().setRow('Spawned', characterEntity, { spawned: false });
              onMoveRevert();
              return { success: false, error: 'Session expired — respawn to continue.' };
            }

            if (diagResult === 'invalid_move' && onChainRetries < MAX_ON_CHAIN_RETRIES) {
              console.warn(`[move] Position stale after revert — refreshing from chain`);
              try {
                const [cx, cy] = await worldContract.read.UD__getEntityPosition([
                  characterEntity as `0x${string}`,
                ]);
                x = Number(cx);
                y = Number(cy);
                useGameStore.getState().setRow('Position', characterEntity, { x, y });
                switch (direction) {
                  case 'up': y += 1; break;
                  case 'down': y -= 1; break;
                  case 'left': x -= 1; break;
                  case 'right': x += 1; break;
                }
                args = [characterEntity as `0x${string}`, x, y] as const;
                onChainRetries++;
                continue;
              } catch {
                // Chain read failed — fall through
              }
            }

            if (diagResult === 'pass' && onChainRetries < MAX_ON_CHAIN_RETRIES) {
              onChainRetries++;
              console.warn(`[move] Simulation now passes — retrying (${onChainRetries}/${MAX_ON_CHAIN_RETRIES})`);
              await new Promise(r => setTimeout(r, ON_CHAIN_RETRY_DELAY_MS));
              continue;
            }

            // Timeout, transient, MoveTooFast, or retries exhausted — warn and let player retry
            if (diagResult === 'error' && diagError) {
              console.error(`[move] Diagnostic error:`, diagError);
              onMoveRevert();
              return { success: false, error: getContractError(diagError) };
            }
            console.warn(`[move] On-chain revert — ${diagResult} (target: ${x},${y})`);
            onMoveRevert();
            return { success: false, error: MOVE_STALE_STATE_WARNING, severity: 'warning' };
          }
          onMoveSuccess();
          return { success: true };
        } catch (e) {
          // Stale-state / transient errors → yellow warning, not red error
          if (isMoveTooFastError(e) || isTransientRpcError(e)) {
            return { success: false, error: MOVE_STALE_STATE_WARNING, severity: 'warning' };
          }
          return {
            error: getContractError(e),
            success: false,
          };
        }
      }
      return { success: false, error: MOVE_STALE_STATE_WARNING, severity: 'warning' };
    } finally {
      isMovePending = false;
    }
  };

  // --- Auto Adventure (move + auto-fight first mob, deprecated) ---
  // Gas limit for autoAdventure — covers move + spawn + full combat loop + rewards.
  // Higher than MOVE_GAS_LIMIT because combat resolution is included in the same tx.
  const AUTO_ADVENTURE_GAS_LIMIT = BigInt(50_000_000);

  const autoAdventure = async (
    characterEntity: string,
    direction: Direction,
  ): SystemCallReturn => {
    if (isMovePending) {
      return { success: false, error: 'Action in progress.' };
    }

    const ownershipError = validateCharacterOwnership(characterEntity, 'autoAdventure');
    if (ownershipError) return ownershipError;

    // Same store-based position read as move — uses Zustand (updated from receipts)
    const pos = getTableValue('Position', characterEntity) as
      | { x: number; y: number } | undefined;
    if (!pos) {
      return { success: false, error: 'Position not found.' };
    }

    let x = Number(pos.x);
    let y = Number(pos.y);
    switch (direction) {
      case 'up': y += 1; break;
      case 'down': y -= 1; break;
      case 'left': x -= 1; break;
      case 'right': x += 1; break;
    }

    isMovePending = true;
    try {
      await waitForMoveCooldown();

      // Skip simulation — send with hardcoded gas limit (same pattern as move retries).
      // AutoAdventure is always a bigger tx than move, so we skip sim to avoid
      // the extra RPC round-trip (~100-200ms latency saved per action).
      const tx = await worldContract.write.UD__autoAdventure(
        [characterEntity as `0x${string}`, x, y],
        { gas: AUTO_ADVENTURE_GAS_LIMIT },
      );

      const receipt = await waitForTransaction(tx);
      lastMoveCompletedMs = Date.now();

      if (receipt.status === 'reverted') {
        // Diagnose: check for NotSpawned (idle timeout)
        try {
          await worldContract.simulate.UD__autoAdventure(
            [characterEntity as `0x${string}`, x, y],
          );
        } catch (diagError) {
          if (isNotSpawnedError(diagError)) {
            useGameStore.getState().setRow('Spawned', characterEntity, { spawned: false });
            return { success: false, error: 'Session expired — respawn to continue.' };
          }
          return { success: false, error: getContractError(diagError) };
        }
        return { success: false, error: 'Auto adventure failed — try again.' };
      }

      // Receipt is decoded by applyReceiptToStore automatically — same tables
      // (Position, CombatEncounter, ActionOutcome, CombatOutcome, Stats, etc.)
      // are written by AutoAdventureSystem, so the existing receipt log decoding
      // pipeline updates the Zustand store at ~0ms. No special handling needed.
      return { success: true };
    } catch (e) {
      lastMoveCompletedMs = Date.now();
      return {
        error: getContractError(e),
        success: false,
      };
    } finally {
      isMovePending = false;
    }
  };

  // --- Auto Fight (single-tx targeted combat for auto adventure mode) ---
  // Gas limit covers full combat loop + rewards. Weapons with multiple effects
  // (e.g. Phasefang: PhysDmg + poison_dot + blind) need ~1.6M gas/round × 15
  // rounds = ~24M. 50M gives comfortable headroom within Base's 60M block limit.
  const AUTO_FIGHT_GAS_LIMIT = BigInt(50_000_000);

  const autoFight = async (
    characterEntity: string,
    monsterId: string,
    weaponId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'autoFight');
    if (ownershipError) return ownershipError;

    try {
      console.info(`[autoFight] Sending TX — char=${characterEntity.slice(0, 10)} monster=${monsterId.slice(0, 10)} weapon=${weaponId} gas=${AUTO_FIGHT_GAS_LIMIT}`);
      const tx = await worldContract.write.UD__autoFight(
        [characterEntity as `0x${string}`, monsterId as `0x${string}`, BigInt(weaponId)],
        { gas: AUTO_FIGHT_GAS_LIMIT },
      );
      console.info(`[autoFight] TX sent: ${tx}`);

      const receipt = await waitForTransaction(tx);
      console.info(`[autoFight] Receipt: status=${receipt.status} gasUsed=${receipt.gasUsed} block=${receipt.blockNumber}`);

      if (receipt.status === 'reverted') {
        console.error(`[autoFight] ON-CHAIN REVERT — gasUsed=${receipt.gasUsed}/${AUTO_FIGHT_GAS_LIMIT} (${Number(receipt.gasUsed) * 100 / Number(AUTO_FIGHT_GAS_LIMIT)}%)`);
        try {
          await worldContract.simulate.UD__autoFight(
            [characterEntity as `0x${string}`, monsterId as `0x${string}`, BigInt(weaponId)],
          );
          console.warn('[autoFight] Diagnostic simulation PASSED — was transient');
        } catch (diagError) {
          console.error('[autoFight] Diagnostic simulation FAILED:', diagError);
          if (isNotSpawnedError(diagError)) {
            useGameStore.getState().setRow('Spawned', characterEntity, { spawned: false });
            return { success: false, error: 'Session expired — respawn to continue.' };
          }
          return { success: false, error: getContractError(diagError) };
        }
        return { success: false, error: 'Auto fight failed — try again.' };
      }

      return { success: true };
    } catch (e) {
      console.error('[autoFight] WRITE THREW (pre-send or submission error):', e);
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const removeEntityFromBoard = async (entity: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'removeEntityFromBoard');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__removeEntityFromBoard([
        entity as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const restock = async (shopId: string): SystemCallReturn => {
    try {
      const canRestock = await worldContract.read.UD__canRestock([
        shopId as `0x${string}`,
      ]);
      if (!canRestock) {
        return {
          error: undefined,
          success: true,
        };
      }
      const tx = await worldContract.write.UD__restock([
        shopId as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to restock shop.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const rollStats = async (
    characterEntity: string,
    characterClass: StatsClasses,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'rollStats');
    if (ownershipError) return ownershipError;

    try {
      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await worldContract.write.UD__rollStats([
        userRandomNumber,
        characterEntity as `0x${string}`,
        characterClass,
      ]);

      const receipt = await waitForTransaction(tx);
      const blockNumber = receipt.blockNumber;

      const chainId = await publicClient.getChainId();
      if (chainId !== 31337) {
        const blockToWaitFor = blockNumber + BigInt(2);

        let currentBlockNumber = await publicClient.getBlockNumber();
        while (currentBlockNumber < blockToWaitFor) {
          await new Promise(resolve => setTimeout(resolve, 250));
          currentBlockNumber = await publicClient.getBlockNumber();
        }
      }

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const sell = async (
    amount: bigint,
    shopId: string,
    itemId: string,
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'sell');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__sellAny([
        amount,
        shopId as `0x${string}`,
        BigInt(itemId),
        characterId as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to sell item.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const spawn = async (characterEntity: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'spawn');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__spawn([
        characterEntity as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'success' ? undefined : 'Failed to spawn.',
        success: txResult.status === 'success',
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const unequipItem = async (
    characterEntity: string,
    itemId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'unequipItem');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__unequipItem([
        characterEntity as `0x${string}`,
        BigInt(itemId),
      ]);

      await waitForTransaction(tx);
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const updateTokenUri = async (
    characterId: string,
    characterMetadataCid: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'updateTokenUri');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__updateTokenUri([
        characterId as `0x${string}`,
        characterMetadataCid,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const rest = async (entity: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'rest');
    if (ownershipError) return ownershipError;

    try {
      const characterId = entity as `0x${string}`;

      const tx = await worldContract.write.UD__rest([characterId]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const useWorldConsumableItem = async (
    entity: string,
    tokenId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'useWorldConsumableItem');
    if (ownershipError) return ownershipError;

    try {
      const characterId = entity as `0x${string}`;

      const tx = await worldContract.write.UD__useWorldConsumableItem([
        characterId,
        characterId,
        BigInt(tokenId),
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const withdrawFromEscrow = async (
    characterEntity: string,
    previousAmount: bigint,
    amount: bigint,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'withdrawFromEscrow');
    if (ownershipError) return ownershipError;

    try {
      const characterId = characterEntity as `0x${string}`;

      const tx = await worldContract.write.UD__withdrawFromEscrow([
        characterId,
        amount,
      ]);

      await waitForTransaction(tx);

      const newBalance = await worldContract.read.UD__getEscrowBalance([
        characterId,
      ]);

      const success = newBalance === previousAmount - amount;

      return {
        error: success ? undefined : 'Failed to withdraw from escrow.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  // === Implicit Class System Functions ===

  const chooseRace = async (
    characterEntity: string,
    race: Race,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'chooseRace');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__chooseRace([
        characterEntity as `0x${string}`,
        race,
      ]);

      await waitForTransaction(tx);

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const choosePowerSource = async (
    characterEntity: string,
    powerSource: PowerSource,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'choosePowerSource');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__choosePowerSource([
        characterEntity as `0x${string}`,
        powerSource,
      ]);

      await waitForTransaction(tx);

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const rollBaseStats = async (
    characterEntity: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'rollBaseStats');
    if (ownershipError) return ownershipError;

    try {
      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await worldContract.write.UD__rollBaseStats([
        userRandomNumber,
        characterEntity as `0x${string}`,
      ]);

      const receipt = await waitForTransaction(tx);
      const blockNumber = receipt.blockNumber;

      const chainId = await publicClient.getChainId();
      if (chainId !== 31337) {
        const blockToWaitFor = blockNumber + BigInt(2);

        let currentBlockNumber = await publicClient.getBlockNumber();
        while (currentBlockNumber < blockToWaitFor) {
          await new Promise(resolve => setTimeout(resolve, 250));
          currentBlockNumber = await publicClient.getBlockNumber();
        }
      }

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const selectAdvancedClass = async (
    characterEntity: string,
    advancedClass: AdvancedClass,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterEntity, 'selectAdvancedClass');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__selectAdvancedClass([
        characterEntity as `0x${string}`,
        advancedClass,
      ]);

      await waitForTransaction(tx);

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const checkCombatFragmentTriggers = async (
    winners: string[],
    defeated: string[],
    tileX: number,
    tileY: number,
    defeatedAreMobs: boolean,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__checkCombatFragmentTriggersForGroup([
        winners as `0x${string}`[],
        defeated as `0x${string}`[],
        tileX,
        tileY,
        defeatedAreMobs,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return { error: getContractError(e), success: false };
    }
  };

  const triggerFragment = async (
    characterId: string,
    fragmentType: number,
    tileX: number,
    tileY: number,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'triggerFragment');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__triggerFragment([
        characterId as `0x${string}`,
        fragmentType,
        tileX,
        tileY,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const claimFragment = async (
    characterId: string,
    fragmentType: number,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'claimFragment');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__claimFragment([
        characterId as `0x${string}`,
        fragmentType,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const buyGas = async (
    characterId: string,
    goldAmount: bigint,
    minEthOutput: bigint = 1n,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'buyGas');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__buyGas([
        characterId as `0x${string}`,
        goldAmount,
        minEthOutput,
      ]);

      const receipt = await waitForTransaction(tx);
      return { success: receipt.status === 'success' };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  return {
    autoAdventure,
    buy,
    buyGas,
    cancelOrder,
    checkCombatFragmentTriggers,
    chooseRace,
    choosePowerSource,
    claimFragment,
    triggerFragment,
    createEncounter,
    createOrder,
    depositToEscrow,
    endShopEncounter,
    endWorldEncounter,
    endTurn,
    enterGame,
    equipItems,
    fleePvp,
    fulfillOrder,
    autoFight,
    levelCharacter,
    mintCharacter,
    move,
    removeEntityFromBoard,
    rest,
    restock,
    rollBaseStats,
    rollStats,
    selectAdvancedClass,
    sell,
    spawn,
    unequipItem,
    updateTokenUri,
    useWorldConsumableItem,
    withdrawFromEscrow,
  };
}
