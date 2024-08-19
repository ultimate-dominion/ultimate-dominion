/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

// import { getComponentValue } from '@latticexyz/recs';
// import { singletonEntity } from '@latticexyz/store-sync/recs';

import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  HasValue,
  runQuery,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { uuid } from '@latticexyz/utils';
import {
  Address,
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  keccak256,
  stringToHex,
  toBytes,
} from 'viem';

import { INSUFFICIENT_FUNDS_MESSAGE } from '../../utils/errors';
import { EncounterType, EntityStats, StatsClasses } from '../../utils/types';
import { ClientComponents } from './createClientComponents';
import { SetupNetworkResult } from './setupNetwork';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

type SystemCallReturn = Promise<{
  success: boolean;
  error?: string;
}>;

const getContractError = (error: BaseError): string => {
  const revertError = error.walk(
    e => e instanceof ContractFunctionRevertedError,
  );
  if (revertError instanceof ContractFunctionRevertedError) {
    const args = revertError.data?.args ?? [];
    return args[0] as string;
  }
  const insufficientFundsError = error.walk(
    e => e instanceof InsufficientFundsError,
  );
  if (insufficientFundsError instanceof InsufficientFundsError) {
    return INSUFFICIENT_FUNDS_MESSAGE;
  }
  return 'An error occurred calling the contract.';
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSystemCalls(
  /*
   * The parameter list informs TypeScript that:
   *
   * - The first parameter is expected to be a
   *   SetupNetworkResult, as defined in setupNetwork.ts
   *
   *   Out of this parameter, we only care about two fields:
   *   - worldContract (which comes from getContract, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L63-L69).
   *
   *   - waitForTransaction (which comes from syncToRecs, see
   *     https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   *
   * - From the second parameter, which is a ClientComponent,
   *   we only care about Counter. This parameter comes to use
   *   through createClientComponents.ts, but it originates in
   *   syncToRecs
   *   (https://github.com/latticexyz/mud/blob/main/templates/react/packages/client/src/mud/setupNetwork.ts#L77-L83).
   */
  {
    delegatorAddress,
    publicClient,
    waitForTransaction,
    worldContract,
  }: SetupNetworkResult & { delegatorAddress?: Address },
  {
    CharacterEquipment,
    Characters,
    CharactersTokenURI,
    CombatEncounter,
    Position,
    Spawned,
    Stats,
  }: ClientComponents,
) {
  const createEncounter = async (
    encounterType: EncounterType,
    attackers: string[],
    defenders: string[],
  ): SystemCallReturn => {
    try {
      await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [
          encounterType,
          attackers as `0x${string}`[],
          defenders as `0x${string}`[],
        ],
        functionName: 'UD__createEncounter',
      });

      const tx = await worldContract.write.UD__createEncounter([
        encounterType,
        attackers as `0x${string}`[],
        defenders as `0x${string}`[],
      ]);

      await waitForTransaction(tx);

      const success = !!Array.from(
        runQuery([
          Has(CombatEncounter),
          HasValue(CombatEncounter, { encounterType }),
        ]),
      ).filter(entity => {
        const encounter = getComponentValue(CombatEncounter, entity);

        if (!encounter) return false;
        const encounterParticipants = encounter.attackers.concat(
          encounter.defenders,
        );
        return (
          encounterParticipants.some(attacker =>
            attackers.includes(attacker),
          ) &&
          encounterParticipants.some(defender => defenders.includes(defender))
        );
      })[0];

      return {
        error: success ? undefined : 'Failed to create encounter.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    }
  };

  const endTurn = async (
    encounterId: Entity,
    playerId: Entity,
    defenderId: Entity,
    actionId: Entity,
    weaponId: string,
    previousTurn: string,
  ): SystemCallReturn => {
    try {
      const actions = [
        {
          attackerEntityId: playerId.toString() as `0x${string}`,
          defenderEntityId: defenderId.toString() as `0x${string}`,
          actionId: actionId.toString() as `0x${string}`,
          weaponId: BigInt(weaponId),
        },
      ];

      await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [
          encounterId.toString() as `0x${string}`,
          playerId.toString() as `0x${string}`,
          actions,
        ],
        functionName: 'UD__endTurn',
      });

      const tx = await worldContract.write.UD__endTurn([
        encounterId.toString() as `0x${string}`,
        playerId.toString() as `0x${string}`,
        actions,
      ]);

      await waitForTransaction(tx);

      const { currentTurn, end } = getComponentValueStrict(
        CombatEncounter,
        encounterId,
      );

      let success = currentTurn === BigInt(previousTurn) + BigInt(1);

      if (!success) {
        success = end !== BigInt(0);
      }

      return {
        error: success ? undefined : 'Failed to end turn.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    }
  };

  const enterGame = async (characterEntity: Entity): SystemCallReturn => {
    try {
      await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [characterEntity.toString() as `0x${string}`],
        functionName: 'UD__enterGame',
      });

      const tx = await worldContract.write.UD__enterGame([
        characterEntity.toString() as `0x${string}`,
      ]);

      await waitForTransaction(tx);

      const success = !!getComponentValue(Characters, characterEntity)?.locked;
      return {
        error: success ? undefined : 'Failed to enter game.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    }
  };

  const equipItems = async (
    characterEntity: Entity,
    itemIds: string[],
  ): SystemCallReturn => {
    try {
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

      const tx = await worldContract.write.UD__equipItems([
        characterEntity.toString() as `0x${string}`,
        itemIds.map(itemId => BigInt(itemId)),
      ]);

      await waitForTransaction(tx);

      const characterEquipment = getComponentValueStrict(
        CharacterEquipment,
        characterEntity,
      );

      const { equippedArmor, equippedWeapons } = characterEquipment;

      const success =
        equippedArmor.some(id => itemIds.includes(id.toString())) ||
        equippedWeapons.some(id => itemIds.includes(id.toString()));

      return {
        error: success ? undefined : 'Failed to equip items.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
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
        agility: BigInt(entityStats.agility),
        baseHp: BigInt(entityStats.baseHp),
        class: entityStats.class,
        currentHp: BigInt(entityStats.currentHp),
        experience: BigInt(entityStats.experience),
        intelligence: BigInt(entityStats.intelligence),
        level: BigInt(entityStats.level) + BigInt(1),
        strength: BigInt(entityStats.strength),
      };

      await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [characterId as `0x${string}`, formattedNewStats],
        functionName: 'UD__levelCharacter',
      });

      const tx = await worldContract.write.UD__levelCharacter([
        characterId as `0x${string}`,
        formattedNewStats,
      ]);

      await waitForTransaction(tx);

      const newLevel = getComponentValueStrict(
        Stats,
        encodeEntity(
          { characterId: 'uint256' },
          { characterId: BigInt(characterId) },
        ),
      ).level;

      const success = newLevel === formattedNewStats.level;

      return {
        error: success ? undefined : 'Failed to level character.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
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

      const simulatedTx = await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [account, nameHex, uri],
        functionName: 'UD__mintCharacter',
      });

      const characterId = simulatedTx.result;

      const tx = await worldContract.write.UD__mintCharacter([
        account,
        nameHex,
        uri,
      ]);

      await waitForTransaction(tx);

      const success = !!getComponentValue(
        Characters,
        encodeEntity(
          { characterId: 'uint256' },
          { characterId: BigInt(characterId) },
        ),
      );

      return {
        error: success ? undefined : 'Failed to mint character.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    }
  };

  const move = async (
    characterEntity: Entity,
    x: number,
    y: number,
  ): SystemCallReturn => {
    await publicClient.simulateContract({
      abi: worldContract.abi,
      account: delegatorAddress,
      address: worldContract.address,
      args: [characterEntity.toString() as `0x${string}`, x, y],
      functionName: 'UD__move',
    });

    const positionId = uuid();
    Position.addOverride(positionId, {
      entity: characterEntity,
      value: { x, y },
    });

    try {
      const tx = await worldContract.write.UD__move([
        characterEntity.toString() as `0x${string}`,
        x,
        y,
      ]);
      await waitForTransaction(tx);

      const { x: newX, y: newY } = getComponentValueStrict(
        Position,
        characterEntity,
      );

      const success = x === newX && y === newY;

      return {
        error: success ? undefined : 'Failed to move.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    } finally {
      Position.removeOverride(positionId);
    }
  };

  const rollStats = async (
    characterEntity: Entity,
    characterClass: StatsClasses,
  ): SystemCallReturn => {
    try {
      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

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

      const tx = await worldContract.write.UD__rollStats([
        userRandomNumber,
        characterEntity.toString() as `0x${string}`,
        characterClass,
      ]);

      const { blockNumber } = await waitForTransaction(tx);

      const blockToWaitFor = blockNumber + BigInt(2);

      let currentBlockNumber = await publicClient.getBlockNumber();
      while (currentBlockNumber < blockToWaitFor) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        currentBlockNumber = await publicClient.getBlockNumber();
      }

      const success = !!getComponentValue(Stats, characterEntity);
      return {
        error: success ? undefined : 'Failed to roll stats.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    }
  };

  const spawn = async (characterEntity: Entity): SystemCallReturn => {
    try {
      await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [characterEntity.toString() as `0x${string}`],
        functionName: 'UD__spawn',
      });

      const tx = await worldContract.write.UD__spawn([
        characterEntity.toString() as `0x${string}`,
      ]);

      await waitForTransaction(tx);

      const success = !!getComponentValue(Spawned, characterEntity)?.spawned;

      return {
        error: success ? undefined : 'Failed to spawn.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    }
  };

  const unequipItem = async (
    characterEntity: Entity,
    itemId: string,
  ): SystemCallReturn => {
    try {
      await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [characterEntity.toString() as `0x${string}`, BigInt(itemId)],
        functionName: 'UD__unequipItem',
      });

      const tx = await worldContract.write.UD__unequipItem([
        characterEntity.toString() as `0x${string}`,
        BigInt(itemId),
      ]);

      await waitForTransaction(tx);

      const characterEquipment = getComponentValueStrict(
        CharacterEquipment,
        characterEntity,
      );

      const { equippedArmor, equippedWeapons } = characterEquipment;

      const success = !(
        equippedArmor.includes(BigInt(itemId)) ||
        equippedWeapons.includes(BigInt(itemId))
      );

      return {
        error: success ? undefined : 'Failed to unequip item.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
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
      await publicClient.simulateContract({
        abi: worldContract.abi,
        account: delegatorAddress,
        address: worldContract.address,
        args: [characterId as `0x${string}`, characterMetadataCid],
        functionName: 'UD__updateTokenUri',
      });

      const tx = await worldContract.write.UD__updateTokenUri([
        characterId as `0x${string}`,
        characterMetadataCid,
      ]);

      await waitForTransaction(tx);

      const tokenIdEntity = encodeEntity(
        { tokenId: 'uint256' },
        { tokenId: BigInt(tokenId) },
      );

      const newMetadataURI = getComponentValueStrict(
        CharactersTokenURI,
        tokenIdEntity,
      ).tokenURI;

      const success = newMetadataURI === `ipfs://${characterMetadataCid}`;

      return {
        error: success ? undefined : 'Failed to update token URI.',
        success,
      };
    } catch (e) {
      return {
        error: getContractError(e as BaseError),
        success: false,
      };
    }
  };

  // const estimateFee = async () => {
  //   const entropyAddress = await worldContract.read.UD__getEntropy();
  //   const providerAddress = await worldContract.read.UD__getPythProvider();

  //   const entropyContract = getContract({
  //     address: entropyAddress,
  //     abi: [
  //       parseAbiItem(
  //         'function estimateFee(address provider) view returns (uint256)',
  //       ),
  //     ],
  //     client: publicClient,
  //   });

  //   const fee = await entropyContract.read.estimateFee([providerAddress]);

  //   return fee;
  // };

  return {
    createEncounter,
    endTurn,
    enterGame,
    equipItems,
    levelCharacter,
    mintCharacter,
    move,
    rollStats,
    spawn,
    unequipItem,
    updateTokenUri,
  };
}
