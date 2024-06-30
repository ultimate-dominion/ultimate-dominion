/*
 * Create the system calls that the client can use to ask
 * for changes in the World state (using the System contracts).
 */

// import { getComponentValue } from '@latticexyz/recs';
// import { singletonEntity } from '@latticexyz/store-sync/recs';

import { getComponentValue } from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { uuid } from '@latticexyz/utils';
import {
  Address,
  getContract,
  keccak256,
  parseAbiItem,
  stringToHex,
  toBytes,
} from 'viem';

import { CharacterClasses } from '../../utils/types';
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
  { publicClient, waitForTransaction, worldContract }: SetupNetworkResult,
  { Characters, Position, Spawned }: ClientComponents,
) {
  const enterGame = async (characterId: bigint) => {
    try {
      const tx = await worldContract.write.UD__enterGame([characterId]);

      await waitForTransaction(tx);

      const success = !!getComponentValue(
        Characters,
        encodeEntity({ characterId: 'uint256' }, { characterId }),
      )?.locked;
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

  const move = async (characterId: bigint, x: number, y: number) => {
    const positionId = uuid();
    Position.addOverride(positionId, {
      entity: encodeEntity({ characterId: 'uint256' }, { characterId }),
      value: { x, y },
    });

    try {
      const tx = await worldContract.write.UD__move([characterId, x, y]);
      await waitForTransaction(tx);

      return getComponentValue(
        Position,
        encodeEntity({ characterId: 'uint256' }, { characterId }),
      );
    } catch (e) {
      return null;
    } finally {
      Position.removeOverride(positionId);
    }
  };

  const rollStats = async (
    characterId: bigint,
    characterClass: CharacterClasses,
  ) => {
    try {
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

      const randomString = 'UltimateDominion';
      const userRandomNumber = keccak256(toBytes(randomString));

      const tx = await worldContract.write.UD__rollStats(
        [userRandomNumber, characterId, characterClass],
        {
          value: fee,
        },
      );

      await waitForTransaction(tx);

      const success = !!getComponentValue(
        Characters,
        encodeEntity({ characterId: 'uint256' }, { characterId }),
      );
      return success;
    } catch (e) {
      return false;
    }
  };

  const spawn = async (characterId: bigint) => {
    try {
      const tx = await worldContract.write.UD__spawn([characterId]);

      await waitForTransaction(tx);

      const success = !!getComponentValue(
        Spawned,
        encodeEntity({ characterId: 'uint256' }, { characterId }),
      )?.spawned;

      return success;
    } catch (e) {
      return false;
    }
  };

  return {
    enterGame,
    mintCharacter,
    move,
    rollStats,
    spawn,
  };
}
