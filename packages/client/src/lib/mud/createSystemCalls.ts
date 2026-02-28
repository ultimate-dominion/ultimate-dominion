/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

// import { getComponentValue } from '@latticexyz/recs';
// import { singletonEntity } from '@latticexyz/store-sync/recs';

import {
  Entity,
} from '@latticexyz/recs';
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
import { reportError } from '../utils/errorReporter';
import {
  AdvancedClass,
  ArmorType,
  EncounterType,
  type EntityStats,
  type NewOrder,
  PowerSource,
  Race,
  StatsClasses,
} from '../../utils/types';

import { ClientComponents } from './createClientComponents';
import { SetupNetworkResult } from './setupNetwork';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

type SystemCallReturn = Promise<{
  success: boolean;
  error?: string;
}>;

type ErrorCategory = 'REVERT' | 'FUNDS' | 'RPC' | 'GAS' | 'NONCE' | 'SPONSOR' | 'UNKNOWN';

// Map known custom error signatures to user-friendly messages.
// When viem can't decode a revert (error not on ABI), it reports the raw
// selector. We match these to provide clear feedback.
const KNOWN_ERROR_SIGNATURES: Record<string, string> = {
  '0x9e4b2685': 'That name is already taken. Please choose a different name.',
  '0x6d187b28': 'Invalid account.',
  '0x442473f8': 'Invalid token URI.',
  '0x261fa6d6': 'Character is locked and cannot be modified.',
  '0x82b42900': 'You are not authorized to perform this action.',
  '0x8fa2ffa1': 'You need at least one weapon or spell equipped to enter combat.',
};

const classifyError = (error: unknown): { category: ErrorCategory; message: string } => {
  const raw = ((error as Error)?.message ?? '').toLowerCase();

  // Viem structured errors — walk the chain for specific types
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

  // Pattern-based classification for non-viem or wrapped errors
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

  // Structured diagnostic log — scan browser console for [TX_ERROR] to filter
  console.error(
    `[TX_ERROR][${category}] ${message}`,
    category === 'UNKNOWN' ? error : '',
  );

  if (category === 'FUNDS') return INSUFFICIENT_FUNDS_MESSAGE;

  // Check for known error signatures that viem couldn't decode
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
    waitForTransaction,
    worldContract,
  }: SetupNetworkResult & { delegatorAddress?: Address },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _clientComponents: ClientComponents,
) {
  const buy = async (
    amount: bigint,
    shopId: string,
    itemIndex: string,
    characterId: string,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__buy([
        amount,
        shopId as `0x${string}`,
        BigInt(itemIndex),
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

  const cancelOrder = async (orderHash: string): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__cancelOrder([orderHash as Hash]);

      waitForTransaction(tx).catch(() => {});
      return { success: true };
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
    characterEntity: Entity,
    previousAmount: bigint,
    amount: bigint,
  ): SystemCallReturn => {
    try {
      const characterId = characterEntity.toString() as `0x${string}`;

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

  const endShopEncounter = async (encounterId: Entity): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__endShopEncounter([
        encounterId.toString() as `0x${string}`,
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

  const endTurn = async (
    encounterId: Entity,
    playerId: Entity,
    defenderId: Entity,
    itemId: string,
  ): SystemCallReturn => {
    try {
      const actions = [
        {
          attackerEntityId: playerId.toString() as `0x${string}`,
          defenderEntityId: defenderId.toString() as `0x${string}`,
          itemId: BigInt(itemId),
        },
      ];

      const tx = await worldContract.write.UD__endTurn(
        [
          encounterId.toString() as `0x${string}`,
          playerId.toString() as `0x${string}`,
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
    characterEntity: Entity,
    starterWeaponId: bigint,
    starterArmorId: bigint,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__enterGame([
        characterEntity.toString() as `0x${string}`,
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
    characterEntity: Entity,
    itemIds: string[],
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__equipItems([
        characterEntity.toString() as `0x${string}`,
        itemIds.map(itemId => BigInt(itemId)),
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

  const fleePvp = async (characterId: string): SystemCallReturn => {
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const levelCharacter = async (
    characterId: Entity,
    entityStats: Omit<EntityStats, 'entityClass'> & {
      class: StatsClasses;
    },
  ): SystemCallReturn => {
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
        // Implicit class system fields - preserve existing values
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

  const move = async (
    characterEntity: Entity,
    x: number,
    y: number,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__move(
        [characterEntity.toString() as `0x${string}`, x, y],
        {
          gas: BigInt('10000000'),
        },
      );

      await waitForTransaction(tx);
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const removeEntityFromBoard = async (entity: Entity): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__removeEntityFromBoard([
        entity.toString() as `0x${string}`,
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

      waitForTransaction(tx).catch(() => {});
      return { success: true };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const rollStats = async (
    characterEntity: Entity,
    characterClass: StatsClasses,
  ): SystemCallReturn => {
    try {
      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await worldContract.write.UD__rollStats([
        userRandomNumber,
        characterEntity.toString() as `0x${string}`,
        characterClass,
      ]);

      const { blockNumber } = await waitForTransaction(tx);

      // On real networks, wait for additional blocks for finality
      // On local Anvil (chainId 31337), skip this as blocks only mine on transactions
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
    try {
      const tx = await worldContract.write.UD__sell([
        amount,
        shopId as `0x${string}`,
        BigInt(itemIndex),
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

  const spawn = async (characterEntity: Entity): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__spawn([
        characterEntity.toString() as `0x${string}`,
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
    characterEntity: Entity,
    itemId: string,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__unequipItem([
        characterEntity.toString() as `0x${string}`,
        BigInt(itemId),
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

  const updateTokenUri = async (
    characterId: string,
    characterMetadataCid: string,
    tokenId: string,
  ): SystemCallReturn => {
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

  const rest = async (entity: Entity): SystemCallReturn => {
    try {
      const characterId = entity.toString() as `0x${string}`;

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
    entity: Entity,
    tokenId: string,
  ): SystemCallReturn => {
    try {
      const characterId = entity.toString() as `0x${string}`;

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
    entity: Entity,
    tokenId: string,
  ): SystemCallReturn => {
    try {
      const characterId = entity.toString() as `0x${string}`;

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
    characterEntity: Entity,
    previousAmount: bigint,
    amount: bigint,
  ): SystemCallReturn => {
    try {
      const characterId = characterEntity.toString() as `0x${string}`;

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
    characterEntity: Entity,
    race: Race,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__chooseRace([
        characterEntity.toString() as `0x${string}`,
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
    characterEntity: Entity,
    powerSource: PowerSource,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__choosePowerSource([
        characterEntity.toString() as `0x${string}`,
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
    characterEntity: Entity,
  ): SystemCallReturn => {
    try {
      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await worldContract.write.UD__rollBaseStats([
        userRandomNumber,
        characterEntity.toString() as `0x${string}`,
      ]);

      const { blockNumber } = await waitForTransaction(tx);

      // On real networks, wait for additional blocks for finality
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
    characterEntity: Entity,
    advancedClass: AdvancedClass,
  ): SystemCallReturn => {
    try {
      const tx = await worldContract.write.UD__selectAdvancedClass([
        characterEntity.toString() as `0x${string}`,
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

  // Manual trigger for testing - normally called by contract systems
  const triggerFragment = async (
    characterId: string,
    fragmentType: number,
    tileX: number,
    tileY: number,
  ): SystemCallReturn => {
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
