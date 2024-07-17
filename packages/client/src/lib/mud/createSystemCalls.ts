/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

// import { getComponentValue } from '@latticexyz/recs';
// import { singletonEntity } from '@latticexyz/store-sync/recs';

import {
  Entity,
  getComponentValue,
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
  getContract,
  keccak256,
  parseAbiItem,
  stringToHex,
  toBytes,
} from 'viem';

import { EncounterType, StatsClasses } from '../../utils/types';
import { ClientComponents } from './createClientComponents';
import { SetupNetworkResult } from './setupNetwork';

export type SystemCalls = ReturnType<typeof createSystemCalls>;

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
    CombatEncounter,
    Position,
    Spawned,
  }: ClientComponents,
) {
  const createMatch = async (
    encounterType: EncounterType,
    attackers: string[],
    defenders: string[],
  ) => {
    try {
      if (!delegatorAddress) {
        throw new Error('Delegator address not found');
      }

      await publicClient.simulateContract({
        address: worldContract.address,
        abi: worldContract.abi,
        functionName: 'UD__createMatch',
        args: [
          encounterType,
          attackers as `0x${string}`[],
          defenders as `0x${string}`[],
        ],
        account: delegatorAddress,
      });

      const tx = await worldContract.write.UD__createMatch([
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
        return (
          encounter &&
          encounter.attackers.some(attacker => attackers.includes(attacker)) &&
          encounter.defenders.some(defender => defenders.includes(defender))
        );
      })[0];

      return success;
    } catch (err) {
      if (err instanceof BaseError) {
        const revertError = err.walk(
          err => err instanceof ContractFunctionRevertedError,
        );
        if (revertError instanceof ContractFunctionRevertedError) {
          const args = revertError.data?.args ?? [];
          // eslint-disable-next-line no-console
          console.error(args);
        }
      }
      return false;
    }
  };

  const endTurn = async (
    encounterId: Entity,
    playerId: Entity,
    defenderId: Entity,
    actionId: Entity,
    weaponId: string,
  ) => {
    try {
      const actions = [
        {
          attackerEntityId: playerId.toString() as `0x${string}`,
          defenderEntityId: defenderId.toString() as `0x${string}`,
          actionId: actionId.toString() as `0x${string}`,
          weaponId: BigInt(weaponId),
        },
      ];

      const fee = await getFee();

      const tx = await worldContract.write.UD__endTurn(
        [
          encounterId.toString() as `0x${string}`,
          playerId.toString() as `0x${string}`,
          actions,
        ],
        {
          value: fee,
        },
      );

      await waitForTransaction(tx);

      return true;
    } catch (e) {
      return false;
    }
  };

  const enterGame = async (characterEntity: Entity) => {
    try {
      const tx = await worldContract.write.UD__enterGame([
        characterEntity.toString() as `0x${string}`,
      ]);

      await waitForTransaction(tx);

      const success = !!getComponentValue(Characters, characterEntity)?.locked;
      return success;
    } catch (e) {
      return false;
    }
  };

  const equipItems = async (characterEntity: Entity, itemIds: string[]) => {
    try {
      const tx = await worldContract.write.UD__equipItems([
        characterEntity.toString() as `0x${string}`,
        itemIds.map(itemId => BigInt(itemId)),
      ]);

      await waitForTransaction(tx);

      const characterEquipment = getComponentValue(
        CharacterEquipment,
        characterEntity,
      );

      if (!characterEquipment) return false;
      const { equippedArmor, equippedWeapons } = characterEquipment;

      const success =
        equippedArmor.some(id => itemIds.includes(id.toString())) ||
        equippedWeapons.some(id => itemIds.includes(id.toString()));

      return success;
    } catch (e) {
      return false;
    }
  };

  const mintCharacter = async (account: Address, name: string, uri: string) => {
    try {
      const nameHex = stringToHex(name, { size: 32 });
      const simulatedTx = await worldContract.simulate.UD__mintCharacter([
        account,
        nameHex,
        uri,
      ]);

      const characterId = simulatedTx.result;

      const tx = await worldContract.write.UD__mintCharacter([
        account,
        nameHex,
        uri,
      ]);

      await waitForTransaction(tx);

      const sucess = !!getComponentValue(
        Characters,
        encodeEntity(
          { characterId: 'uint256' },
          { characterId: BigInt(characterId) },
        ),
      );

      return sucess;
    } catch (e) {
      return false;
    }
  };

  const move = async (characterEntity: Entity, x: number, y: number) => {
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

      return getComponentValue(Position, characterEntity);
    } catch (e) {
      return null;
    } finally {
      Position.removeOverride(positionId);
    }
  };

  const rollStats = async (
    characterEntity: Entity,
    characterClass: StatsClasses,
  ) => {
    try {
      const fee = await getFee();

      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await worldContract.write.UD__rollStats(
        [
          userRandomNumber,
          characterEntity.toString() as `0x${string}`,
          characterClass,
        ],
        {
          value: fee,
        },
      );

      await waitForTransaction(tx);

      const success = !!getComponentValue(Characters, characterEntity);
      return success;
    } catch (e) {
      return false;
    }
  };

  const spawn = async (characterEntity: Entity) => {
    try {
      const tx = await worldContract.write.UD__spawn([
        characterEntity.toString() as `0x${string}`,
      ]);

      await waitForTransaction(tx);

      const success = !!getComponentValue(Spawned, characterEntity)?.spawned;

      return success;
    } catch (e) {
      return false;
    }
  };

  const unequipItem = async (characterEntity: Entity, itemId: string) => {
    try {
      const tx = await worldContract.write.UD__unequipItem([
        characterEntity.toString() as `0x${string}`,
        BigInt(itemId),
      ]);

      await waitForTransaction(tx);

      const characterEquipment = getComponentValue(
        CharacterEquipment,
        characterEntity,
      );

      if (!characterEquipment) return false;

      const { equippedArmor, equippedWeapons } = characterEquipment;

      const success = !(
        equippedArmor.includes(BigInt(itemId)) ||
        equippedWeapons.includes(BigInt(itemId))
      );

      return success;
    } catch (e) {
      return false;
    }
  };

  const getFee = async () => {
    const entropyAddress = await worldContract.read.UD__getEntropy();
    const providerAddress = await worldContract.read.UD__getPythProvider();

    const entropyContract = getContract({
      address: entropyAddress,
      abi: [
        parseAbiItem(
          'function getFee(address provider) view returns (uint256)',
        ),
      ],
      client: publicClient,
    });

    const fee = await entropyContract.read.getFee([providerAddress]);

    return fee;
  };

  return {
    createMatch,
    endTurn,
    enterGame,
    equipItems,
    mintCharacter,
    move,
    rollStats,
    spawn,
    unequipItem,
  };
}
