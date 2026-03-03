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

import { getTableValue } from '../gameStore';
import { SetupNetworkResult } from './setupNetwork';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

type SystemCallReturn = Promise<{
  success: boolean;
  error?: string;
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
  '0x5ffeddff': 'Maximum mob spawns reached.',
  '0x72af8dba': 'Stats cannot be negative.',
  '0x03dee4c5': 'You don\'t have enough of this item to sell.',
};

const classifyError = (error: unknown): { category: ErrorCategory; message: string } => {
  const raw = ((error as Error)?.message ?? '').toLowerCase();

  if (error && typeof error === 'object' && 'walk' in error) {
    const baseError = error as BaseError;

    const revertError = baseError.walk(
      e => e instanceof ContractFunctionRevertedError,
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const args = revertError.data?.args ?? [];
      const reason = (args[0] as string) ?? 'Unknown revert reason';
      return { category: 'REVERT', message: reason };
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

  const sigMatch = message.match(/signature\s+"(0x[0-9a-f]{8})"/i);
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

      waitForTransaction(tx).catch(() => {});
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

  // On-chain MOVE_COOLDOWN is 1s, Base blocks are 2s. We add 3s margin so the
  // next move lands in a block whose timestamp exceeds lastAction + 1.
  const MOVE_COOLDOWN_MARGIN_SEC = 3;

  // Local timestamp (ms) of the last confirmed move. The game store's
  // SessionTimer syncs via WebSocket and can lag several seconds behind the
  // chain — using it alone causes premature move submissions that revert with
  // MoveTooFast. Tracking locally ensures the cooldown is always respected.
  let lastMoveConfirmedMs = 0;

  const INVALID_MOVE_SELECTOR = '87822d34';

  /** Check if an error is an InvalidMove revert (position mismatch). */
  const isInvalidMoveError = (e: unknown): boolean => {
    const msg = String(e).toLowerCase();
    return msg.includes(INVALID_MOVE_SELECTOR) || msg.includes('invalid move') || msg.includes('invalidmove');
  };

  /**
   * Wait for the on-chain move cooldown to expire.
   * Uses the greater of the chain's SessionTimer and local tracking to avoid
   * relying on a stale game store that hasn't synced the latest block yet.
   */
  const waitForMoveCooldown = async (characterEntity: string) => {
    const session = getTableValue('SessionTimer', characterEntity);
    const chainLastAction = Number(session?.lastAction ?? 0);
    const localLastActionSec = Math.floor(lastMoveConfirmedMs / 1000);
    const lastAction = Math.max(chainLastAction, localLastActionSec);
    if (lastAction === 0) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const readyAt = lastAction + MOVE_COOLDOWN_MARGIN_SEC;
    if (nowSec < readyAt) {
      const delayMs = (readyAt - nowSec) * 1000;
      console.info(`[move] Cooldown: waiting ${delayMs}ms (chain=${chainLastAction}, local=${localLastActionSec})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  };

  const move = async (
    characterEntity: string,
    x: number,
    y: number,
  ): SystemCallReturn => {
    if (isMovePending) {
      console.warn('[move] Move already in progress, ignoring request');
      return { success: false, error: 'Move in progress.' };
    }

    const ownershipError = validateCharacterOwnership(characterEntity, 'move');
    if (ownershipError) return ownershipError;

    isMovePending = true;
    try {
      // Wait for on-chain cooldown before attempting the move.
      await waitForMoveCooldown(characterEntity);

      // No hard-coded gas — let the proxy's estimateContractGas run.
      // If the cooldown hasn't expired, estimation fails before hitting
      // the chain, saving gas.
      //
      // No retry loop: the Thirdweb relayer may submit the tx even when it
      // reports a simulation failure, so retrying the same move can result
      // in duplicate txs — the first succeeds (position changes) and the
      // retry reverts with InvalidMove.
      const tx = await worldContract.write.UD__move(
        [characterEntity as `0x${string}`, x, y],
      );

      const receipt = await waitForTransaction(tx);
      if (receipt.status === 'reverted') {
        // On-chain move reverts are almost always state-dependent
        // (InvalidMove, MoveTooFast, InEncounter). A previous tx may have
        // already moved the character. Update cooldown tracking and let
        // the user retry naturally.
        console.warn('[move] On-chain revert — state changed between estimation and mining');
        lastMoveConfirmedMs = Date.now();
        return { success: false, error: 'Position changed — tap again to continue.' };
      }
      lastMoveConfirmedMs = Date.now();
      return { success: true };
    } catch (e) {
      // InvalidMove at estimation time means position already changed
      // (a relayer-retried tx landed first). Treat as soft failure.
      if (isInvalidMoveError(e)) {
        console.warn('[move] InvalidMove at estimation — position already changed');
        lastMoveConfirmedMs = Date.now();
        return { success: false, error: 'Position changed — tap again to continue.' };
      }
      return {
        error: getContractError(e),
        success: false,
      };
    } finally {
      isMovePending = false;
    }
  };

  const removeEntityFromBoard = async (entity: string): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'removeEntityFromBoard');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__removeEntityFromBoard([
        entity as `0x${string}`,
      ]);

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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
    itemIndex: string,
    characterId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'sell');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__sell([
        amount,
        shopId as `0x${string}`,
        BigInt(itemIndex),
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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
    tokenId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'updateTokenUri');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__updateTokenUri([
        characterId as `0x${string}`,
        characterMetadataCid,
      ]);

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const useCombatConsumableItem = async (
    entity: string,
    tokenId: string,
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(entity, 'useCombatConsumableItem');
    if (ownershipError) return ownershipError;

    try {
      const characterId = entity as `0x${string}`;

      const tx = await worldContract.write.UD__useCombatConsumableItem([
        characterId,
        BigInt(tokenId),
      ]);

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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
  ): SystemCallReturn => {
    const ownershipError = validateCharacterOwnership(characterId, 'buyGas');
    if (ownershipError) return ownershipError;

    try {
      const tx = await worldContract.write.UD__buyGas([
        characterId as `0x${string}`,
        goldAmount,
      ]);

      waitForTransaction(tx).catch(() => {});
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  return {
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
    useCombatConsumableItem,
    useWorldConsumableItem,
    withdrawFromEscrow,
  };
}
