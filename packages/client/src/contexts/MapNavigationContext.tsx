import { useComponentValue, useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValueStrict,
  Has,
  HasValue,
  Not,
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
import { useLocation } from 'react-router-dom';
import { bytesToHex, formatEther, hexToBytes, hexToString } from 'viem';

import { useToast } from '../hooks/useToast';
import { GAME_BOARD_PATH } from '../Routes';
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
  const { pathname } = useLocation();
  const { renderError, renderSuccess } = useToast();
  const {
    burnerBalance,
    components: {
      Characters,
      CharactersTokenURI,
      GoldBalances,
      Mobs,
      Position,
      Spawned,
      Stats,
    },
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

  const allMonsterEntities = useEntityQuery([
    Has(Spawned),
    Has(Stats),
    Not(Characters),
    HasValue(Position, {
      x: position?.x,
      y: position?.y,
    }),
  ]);

  const allCharacterEntities = useEntityQuery([
    Has(Characters),
    Has(Spawned),
    Has(Stats),
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
            const { tokenId } = characterData;

            const ownerEntity = encodeEntity(
              { address: 'address' },
              { address: characterData.owner as `0x${string}` },
            );
            const tokenIdEntity = encodeEntity(
              { tokenId: 'uint256' },
              { tokenId: BigInt(tokenId) },
            );

            const goldBalance =
              getComponentValueStrict(GoldBalances, ownerEntity)?.value ??
              BigInt(0);
            const metadataURI = getComponentValueStrict(
              CharactersTokenURI,
              tokenIdEntity,
            ).tokenURI;

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(`ipfs://${metadataURI}`)[0],
            );

            return {
              ...fetachedMetadata,
              agility: characterStats.agility.toString(),
              baseHitPoints: characterStats.baseHitPoints.toString(),
              characterClass: characterStats.class,
              characterId: entity,
              experience: characterStats.experience.toString(),
              goldBalance: formatEther(goldBalance as bigint).toString(),
              intelligence: characterStats.intelligence.toString(),
              level: characterStats.level.toString(),
              locked: characterData.locked,
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner,
              strength: characterStats.strength.toString(),
              tokenId: tokenId.toString(),
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
      CharactersTokenURI,
      delegatorAddress,
      GoldBalances,
      publicClient,
      renderError,
      Stats,
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
      if (!(allCharacterEntities && allMonsterEntities)) return;

      await getOtherCharacters(allCharacterEntities);
      await getMonsters(allMonsterEntities);

      setIsFetchingEntities(false);
    })();
  }, [
    allCharacterEntities,
    allMonsterEntities,
    Characters,
    getMonsters,
    getOtherCharacters,
  ]);

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

  useEffect(() => {
    if (pathname !== GAME_BOARD_PATH) return;

    const listener = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          onMove('up');
          break;
        case 'ArrowDown':
          onMove('down');
          break;
        case 'ArrowLeft':
          onMove('left');
          break;
        case 'ArrowRight':
          onMove('right');
          break;
        case 'w':
          onMove('up');
          break;
        case 's':
          onMove('down');
          break;
        case 'a':
          onMove('left');
          break;
        case 'd':
          onMove('right');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', listener);
    // eslint-disable-next-line consistent-return
    return () => window.removeEventListener('keydown', listener);
  }, [onMove, pathname]);

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
