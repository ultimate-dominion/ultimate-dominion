import { useComponentValue, useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  HasValue,
} from '@latticexyz/recs';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  bytesToHex,
  formatEther,
  getContract,
  hexToBytes,
  hexToString,
} from 'viem';

import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { Character, Monster } from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type MapNavigationContextType = {
  isRefreshing: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  monsters: Monster[];
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSpawn: () => void;
  otherPlayers: Character[];
  position: { x: number; y: number } | null;
};

const MapNavigationContext = createContext<MapNavigationContextType>({
  isRefreshing: false,
  isSpawned: false,
  isSpawning: false,
  monsters: [],
  onMove: () => {},
  onSpawn: () => {},
  otherPlayers: [],
  position: null,
});

export type NavigationProviderProps = {
  children: ReactNode;
};

export const MapNavigationProvider = ({
  children,
}: NavigationProviderProps): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    burnerBalance,
    components: { Characters, Mobs, Position, Spawned, Stats },
    delegatorAddress,
    network: { publicClient, worldContract },
    systemCalls: { move, spawn },
  } = useMUD();
  const { character } = useCharacter();

  const [otherPlayers, setOtherPlayers] = useState<Character[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);

  const [isSpawning, setIsSpawning] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isFetchingEntities, setIsFetchingEntities] = useState(false);

  const position = useComponentValue(
    Position,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.characterId ?? 0) },
    ),
  );

  const isSpawned = !!useComponentValue(
    Spawned,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.characterId ?? 0) },
    ),
  )?.spawned;

  const allEntities = useEntityQuery([
    Has(Spawned),
    HasValue(Position, {
      x: position?.x,
      y: position?.y,
    }),
  ]);

  const getOtherCharacters = useCallback(
    async (entities: Entity[]): Promise<void> => {
      if (!(delegatorAddress && publicClient && worldContract)) return;

      try {
        const characters: Character[] = await Promise.all(
          entities.map(async (entity: Entity) => {
            const characterData = getComponentValueStrict(Characters, entity);
            const characterStats = getComponentValueStrict(Stats, entity);

            const entityBytes = hexToBytes(entity.toString() as `0x${string}`);
            const tokenBytes = entityBytes.slice(20);
            const tokenId = BigInt(bytesToHex(tokenBytes)).toString();

            const characterTokenAddress =
              await worldContract.read.UD__getCharacterToken();

            const characterToken = getContract({
              address: characterTokenAddress,
              abi: [
                {
                  type: 'function',
                  name: 'tokenURI',
                  inputs: [
                    {
                      name: 'tokenId',
                      type: 'uint256',
                      internalType: 'uint256',
                    },
                  ],
                  outputs: [
                    {
                      name: '',
                      type: 'string',
                      internalType: 'string',
                    },
                  ],
                  stateMutability: 'view',
                },
              ],
              client: publicClient,
            });

            const metadataURI = await characterToken.read.tokenURI([
              BigInt(tokenId),
            ]);

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(metadataURI)[0],
            );

            const goldTokenAddress =
              await worldContract.read.UD__getGoldToken();

            const goldToken = getContract({
              address: goldTokenAddress,
              abi: [
                {
                  type: 'function',
                  name: 'balanceOf',
                  inputs: [
                    {
                      name: 'account',
                      type: 'address',
                      internalType: 'address',
                    },
                  ],
                  outputs: [
                    {
                      name: '',
                      type: 'uint256',
                      internalType: 'uint256',
                    },
                  ],
                  stateMutability: 'view',
                },
              ],
              client: publicClient,
            });

            const goldBalance = await goldToken.read.balanceOf([
              delegatorAddress,
            ]);

            return {
              ...fetachedMetadata,
              agility: characterStats?.agility.toString() ?? '0',
              characterClass: characterData.class,
              characterId: entity,
              goldBalance: formatEther(BigInt(goldBalance)).toString(),
              experience: characterStats?.experience.toString() ?? '0',
              intelligence: characterStats?.intelligence.toString() ?? '0',
              maxHitPoints: characterStats?.maxHitPoints.toString() ?? '0',
              level: characterStats?.level.toString() ?? '0',
              locked: characterData.locked,
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner,
              strength: characterStats?.strength.toString() ?? '0',
              tokenId,
            } as Character;
          }),
        );

        setOtherPlayers(characters.filter(c => c.owner !== delegatorAddress));
      } catch (error) {
        renderError(error, 'Failed to fetch other players');
      }
    },
    [
      Characters,
      Stats,
      delegatorAddress,
      publicClient,
      renderError,
      worldContract,
    ],
  );

  const getMonsters = useCallback(
    async (entities: Entity[]): Promise<void> => {
      try {
        const monsterAndMobIds = entities.map(entity => {
          const entityBytes = hexToBytes(entity.toString() as `0x${string}`);
          const mobIdBytes = entityBytes.slice(0, 4);
          return {
            mobId: BigInt(bytesToHex(mobIdBytes)).toString(),
            monsterId: entity,
          };
        });

        const _monsters: Monster[] = await Promise.all(
          monsterAndMobIds.map(async monsterAndMobId => {
            const { monsterId, mobId } = monsterAndMobId;
            const mobData = getComponentValueStrict(
              Mobs,
              encodeEntity({ mobId: 'uint256' }, { mobId: BigInt(mobId) }),
            );
            const monsterStats = getComponentValueStrict(Stats, monsterId);

            const { mobMetadata: metadataURI } = mobData;

            const monsterTemplateStats =
              (await worldContract.read.UD__getMonsterStats([
                monsterId as `0x${string}`,
              ])) as { class: number };

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(metadataURI)[0],
            );

            return {
              class: monsterTemplateStats.class,
              level: monsterStats.level.toString(),
              mobId,
              monsterId,
              ...fetachedMetadata,
            };
          }),
        );

        setMonsters(_monsters);
      } catch (error) {
        renderError(error, 'Failed to fetch monsters');
      }
    },
    [Mobs, renderError, Stats, worldContract],
  );

  useEffect(() => {
    (async (): Promise<void> => {
      if (!allEntities) return;

      setIsFetchingEntities(true);

      const characterEntities: Entity[] = [];
      const monsterEntities: Entity[] = [];

      await Promise.all(
        allEntities.map(async entity => {
          const characterData = getComponentValue(Characters, entity);

          if (characterData) {
            characterEntities.push(entity);
          } else {
            monsterEntities.push(entity);
          }
        }),
      );

      await getOtherCharacters(characterEntities);
      await getMonsters(monsterEntities);

      setIsFetchingEntities(false);
    })();
  }, [allEntities, Characters, getMonsters, getOtherCharacters]);

  const onSpawn = useCallback(async () => {
    try {
      setIsSpawning(true);

      if (burnerBalance === '0') {
        throw new Error(
          'Insufficient funds. Please top off your session account.',
        );
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const success = await spawn(character.characterId);

      if (!success) {
        throw new Error('Contract call failed');
      }

      renderSuccess('Spawned!');
    } catch (e) {
      renderError(e, 'Failed to roll stats.');
    } finally {
      setIsSpawning(false);
    }
  }, [
    burnerBalance,
    character,
    delegatorAddress,
    renderError,
    renderSuccess,
    spawn,
  ]);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      try {
        setIsMoving(true);

        if (!delegatorAddress) {
          throw new Error('Burner not found');
        }

        if (!position) {
          throw new Error('Position not found');
        }

        if (!character) {
          throw new Error('Character not found');
        }

        const { x, y } = position;

        if (
          (direction === 'up' && position.y === 9) ||
          (direction === 'down' && position.y === 0) ||
          (direction === 'left' && position.x === 0) ||
          (direction === 'right' && position.x === 9)
        ) {
          return;
        }

        let newX = x;
        let newY = y;

        switch (direction) {
          case 'up':
            newY = y + 1;
            break;
          case 'down':
            newY = y - 1;
            break;
          case 'left':
            newX = x - 1;
            break;
          case 'right':
            newX = x + 1;
            break;
          default:
            break;
        }

        const success = await move(character.characterId, newX, newY);

        if (!success) {
          throw new Error('Contract call failed');
        }
      } catch (e) {
        renderError(e, 'Failed to move.');
      } finally {
        setIsMoving(false);
      }
    },
    [character, delegatorAddress, move, position, renderError],
  );

  return (
    <MapNavigationContext.Provider
      value={{
        isRefreshing: isFetchingEntities || isMoving,
        isSpawned,
        isSpawning,
        monsters,
        onMove,
        onSpawn,
        otherPlayers,
        position: position ? { x: position.x, y: position.y } : null,
      }}
    >
      {children}
    </MapNavigationContext.Provider>
  );
};

export const useMapNavigation = (): MapNavigationContextType =>
  useContext(MapNavigationContext);
