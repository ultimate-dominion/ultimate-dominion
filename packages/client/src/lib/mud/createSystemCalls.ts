/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

// import { getComponentValue } from '@latticexyz/recs';
// import { singletonEntity } from '@latticexyz/store-sync/recs';

import {
  Entity,
  getComponentValue,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { uuid } from '@latticexyz/utils';
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

const getContractError = (error: unknown): string => {
  console.error('[getContractError] Full error:', error);
  // Handle non-viem errors gracefully
  if (!error || typeof error !== 'object' || !('walk' in error)) {
    if (error instanceof Error) {
      console.error('[getContractError] Error message:', error.message);
      return error.message;
    }
    console.error('[getContractError] Unknown error type');
    return 'An error occurred calling the contract.';
  }

  const baseError = error as BaseError;
  const revertError = baseError.walk(
    e => e instanceof ContractFunctionRevertedError,
  );
  if (revertError instanceof ContractFunctionRevertedError) {
    const args = revertError.data?.args ?? [];
    return (args[0] as string) ?? 'An error occurred calling the contract.';
  }
  const insufficientFundsError = baseError.walk(
    e => e instanceof InsufficientFundsError,
  );
  if (insufficientFundsError instanceof InsufficientFundsError) {
    return INSUFFICIENT_FUNDS_MESSAGE;
  }
  return 'An error occurred calling the contract.';
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSystemCalls(
  {
    delegatorAddress,
    publicClient,
    waitForTransaction,
    worldContract,
  }: SetupNetworkResult & { delegatorAddress?: Address },
  {
    Characters,
    Orders,
    Position,
  }: ClientComponents,
  options?: { skipSimulation?: boolean },
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

      if (options?.skipSimulation) {
        // Fire-and-forget for embedded path
        waitForTransaction(tx).catch(() => {});
        return { success: true };
      }

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to complete purchase.',
        success: !!success,
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
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [orderHash as Hash],
          functionName: 'UD__cancelOrder',
        });
      }

      const tx = await worldContract.write.UD__cancelOrder([orderHash as Hash]);

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

  const createEncounter = async (
    encounterType: EncounterType,
    group1: string[],
    group2: string[],
  ): SystemCallReturn => {
    try {
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [
            encounterType,
            group1 as `0x${string}`[],
            group2 as `0x${string}`[],
          ],
          functionName: 'UD__createEncounter',
        });
      }

      const tx = await worldContract.write.UD__createEncounter([
        encounterType,
        group1 as `0x${string}`[],
        group2 as `0x${string}`[],
      ]);

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to create encounter.',
        success,
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
      let orderHash: Hash | undefined;
      if (!options?.skipSimulation) {
        const simulatedTx = await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [order],
          functionName: 'UD__createOrder',
        });
        orderHash = simulatedTx.result;
      }

      const tx = await worldContract.write.UD__createOrder([order]);
      const txResult = await waitForTransaction(tx);

      // When simulation was skipped, trust the receipt status
      const success = orderHash
        ? !!getComponentValue(
            Orders,
            encodeEntity({ orderHash: 'bytes32' }, { orderHash }),
          )
        : txResult.status === 'success';

      return {
        error: success ? undefined : 'Failed to create order.',
        success,
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

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId, BigInt(amount)],
          functionName: 'UD__depositToEscrow',
        });
      }

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

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to end shop encounter.',
        success,
      };
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

      if (options?.skipSimulation) {
        // Fire-and-forget for embedded path
        waitForTransaction(tx).catch(() => {});
        return { success: true };
      }

      const txResult = await waitForTransaction(tx);

      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to end turn.',
        success,
      };
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
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [
            characterEntity.toString() as `0x${string}`,
            starterWeaponId,
            starterArmorId,
          ],
          functionName: 'UD__enterGame',
        });
      }

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
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [
            characterEntity.toString() as `0x${string}`,
            itemIds.map(itemId => BigInt(itemId)),
          ],
          functionName: 'UD__equipItems',
        });
      }

      const tx = await worldContract.write.UD__equipItems([
        characterEntity.toString() as `0x${string}`,
        itemIds.map(itemId => BigInt(itemId)),
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

  const fleePvp = async (characterId: string): SystemCallReturn => {
    try {
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId as `0x${string}`],
          functionName: 'UD__fleePvp',
        });
      }

      const tx = await worldContract.write.UD__fleePvp([
        characterId as `0x${string}`,
      ]);

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to flee from PvP.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const fulfillOrder = async (orderHash: string): SystemCallReturn => {
    try {
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [orderHash as Hash],
          functionName: 'UD__fulfillOrder',
        });
      }

      const tx = await worldContract.write.UD__fulfillOrder([
        orderHash as Hash,
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

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId as `0x${string}`, formattedNewStats],
          functionName: 'UD__levelCharacter',
        });
      }

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

      let characterId: bigint | undefined;
      if (!options?.skipSimulation) {
        const simulatedTx = await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [account, nameHex, uri],
          functionName: 'UD__mintCharacter',
        });
        characterId = simulatedTx.result;
      }

      const tx = await worldContract.write.UD__mintCharacter([
        account,
        nameHex,
        uri,
      ]);

      const txResult = await waitForTransaction(tx);

      // When simulation was skipped, trust the receipt status
      const success = characterId
        ? !!getComponentValue(
            Characters,
            encodeEntity(
              { characterId: 'uint256' },
              { characterId: BigInt(characterId) },
            ),
          )
        : txResult.status === 'success';

      return {
        error: success ? undefined : 'Failed to mint character.',
        success,
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
    const positionId = uuid();
    Position.addOverride(positionId, {
      entity: characterEntity,
      value: { x, y },
    });

    try {
      const tx = await worldContract.write.UD__move(
        [characterEntity.toString() as `0x${string}`, x, y],
        {
          gas: BigInt('10000000'),
        },
      );

      if (options?.skipSimulation) {
        // Fire-and-forget for embedded path — confirm in background
        waitForTransaction(tx)
          .then(receipt => {
            if (receipt.status !== 'success') {
              Position.removeOverride(positionId);
            }
          })
          .catch(() => {
            Position.removeOverride(positionId);
          })
          .finally(() => {
            Position.removeOverride(positionId);
          });
        return { success: true };
      }

      await waitForTransaction(tx);

      return {
        error: undefined,
        success: true,
      };
    } catch (e) {
      Position.removeOverride(positionId);
      return {
        error: getContractError(e),
        success: false,
      };
    } finally {
      // For blocking path, clean up override after wait completes
      if (!options?.skipSimulation) {
        Position.removeOverride(positionId);
      }
    }
  };

  const removeEntityFromBoard = async (entity: Entity): SystemCallReturn => {
    try {
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [entity.toString() as `0x${string}`],
          functionName: 'UD__removeEntityFromBoard',
        });
      }

      const tx = await worldContract.write.UD__removeEntityFromBoard([
        entity.toString() as `0x${string}`,
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
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to restock.',
        success: !!success,
      };
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

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [
            userRandomNumber,
            characterEntity.toString() as `0x${string}`,
            characterClass,
          ],
          functionName: 'UD__rollStats',
        });
      }

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

      if (options?.skipSimulation) {
        // Fire-and-forget for embedded path
        waitForTransaction(tx).catch(() => {});
        return { success: true };
      }

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to complete sale.',
        success: !!success,
      };
    } catch (e) {
      return {
        error: getContractError(e),
        success: false,
      };
    }
  };

  const spawn = async (characterEntity: Entity): SystemCallReturn => {
    try {
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterEntity.toString() as `0x${string}`],
          functionName: 'UD__spawn',
        });
      }

      const tx = await worldContract.write.UD__spawn([
        characterEntity.toString() as `0x${string}`,
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

  const unequipItem = async (
    characterEntity: Entity,
    itemId: string,
  ): SystemCallReturn => {
    try {
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterEntity.toString() as `0x${string}`, BigInt(itemId)],
          functionName: 'UD__unequipItem',
        });
      }

      const tx = await worldContract.write.UD__unequipItem([
        characterEntity.toString() as `0x${string}`,
        BigInt(itemId),
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

  const updateTokenUri = async (
    characterId: string,
    characterMetadataCid: string,
    tokenId: string,
  ): SystemCallReturn => {
    try {
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId as `0x${string}`, characterMetadataCid],
          functionName: 'UD__updateTokenUri',
        });
      }

      const tx = await worldContract.write.UD__updateTokenUri([
        characterId as `0x${string}`,
        characterMetadataCid,
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

  const rest = async (entity: Entity): SystemCallReturn => {
    try {
      const characterId = entity.toString() as `0x${string}`;

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId],
          functionName: 'UD__rest',
        });
      }

      const tx = await worldContract.write.UD__rest([characterId]);
      const txResult = await waitForTransaction(tx);

      return {
        error: txResult.status === 'success' ? undefined : 'Failed to rest.',
        success: txResult.status === 'success',
      };
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

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId, characterId, BigInt(tokenId)],
          functionName: 'UD__useWorldConsumableItem',
        });
      }

      const tx = await worldContract.write.UD__useWorldConsumableItem([
        characterId,
        characterId,
        BigInt(tokenId),
      ]);

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to use consumable item.',
        success,
      };
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

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId, BigInt(tokenId)],
          functionName: 'UD__useCombatConsumableItem',
        });
      }

      const tx = await worldContract.write.UD__useCombatConsumableItem([
        characterId,
        BigInt(tokenId),
      ]);

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to use combat consumable.',
        success,
      };
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

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId, amount],
          functionName: 'UD__withdrawFromEscrow',
        });
      }

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
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterEntity.toString() as `0x${string}`, race],
          functionName: 'UD__chooseRace',
        });
      }

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
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterEntity.toString() as `0x${string}`, powerSource],
          functionName: 'UD__choosePowerSource',
        });
      }

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

      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [
            userRandomNumber,
            characterEntity.toString() as `0x${string}`,
          ],
          functionName: 'UD__rollBaseStats',
        });
      }

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
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterEntity.toString() as `0x${string}`, advancedClass],
          functionName: 'UD__selectAdvancedClass',
        });
      }

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
      const txResult = await waitForTransaction(tx);
      return {
        error: txResult.status === 'reverted' ? 'Fragment check reverted' : undefined,
        success: txResult.status === 'success',
      };
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

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      return {
        error: status === 'reverted' ? 'Transaction reverted' : undefined,
        success: status === 'success',
      };
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
      if (!options?.skipSimulation) {
        await publicClient.simulateContract({
          abi: worldContract.abi,
          account: delegatorAddress,
          address: worldContract.address,
          args: [characterId as `0x${string}`, fragmentType],
          functionName: 'UD__claimFragment',
        });
      }

      const tx = await worldContract.write.UD__claimFragment([
        characterId as `0x${string}`,
        fragmentType,
      ]);

      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to claim fragment.',
        success,
      };
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
      const txResult = await waitForTransaction(tx);
      const { status } = txResult;

      const success = status === 'success';

      return {
        error: success ? undefined : 'Failed to swap gold for gas.',
        success: !!success,
      };
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
