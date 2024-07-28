import { useComponentValue, useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
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
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  bytesToHex,
  formatEther,
  hexToBytes,
  hexToString,
  zeroHash,
} from 'viem';

import { useToast } from '../hooks/useToast';
import { GAME_BOARD_PATH } from '../Routes';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import type { Character, CombatDetails, Monster } from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type MapNavigationContextType = {
  currentBattle: CombatDetails | null;
  isRefreshing: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  monsterOponent: Monster | null;
  monsters: Monster[];
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSpawn: () => void;
  otherPlayers: Character[];
  position: { x: number; y: number } | null;
};

const MapNavigationContext = createContext<MapNavigationContextType>({
  currentBattle: null,
  isRefreshing: false,
  isSpawned: false,
  isSpawning: false,
  monsterOponent: null,
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
    components: {
      Characters,
      CharactersTokenURI,
      CombatEncounter,
      GoldBalances,
      MatchEntity,
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
  const [isFetchingEntities, setIsFetchingEntities] = useState(true);

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

            const encounterId = getComponentValue(
              MatchEntity,
              entity,
            )?.encounterId;
            const inBattle = !!encounterId && encounterId !== zeroHash;

            return {
              ...fetachedMetadata,
              agility: characterStats.agility.toString(),
              baseHp: characterStats.baseHp.toString(),
              characterId: entity,
              entityClass: characterStats.class,
              experience: characterStats.experience.toString(),
              goldBalance: formatEther(goldBalance as bigint).toString(),
              inBattle,
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
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch other players.',
          e,
        );
      }
    },
    [
      Characters,
      CharactersTokenURI,
      delegatorAddress,
      GoldBalances,
      MatchEntity,
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
            const encounterId = getComponentValue(
              MatchEntity,
              monsterId,
            )?.encounterId;
            const inBattle = !!encounterId && encounterId !== zeroHash;

            const { mobMetadata: metadataURI } = mobData;

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(metadataURI)[0],
            );

            return {
              agility: monsterStats.agility.toString(),
              baseHp: monsterStats.baseHp.toString(),
              currentHp: monsterStats.currentHp.toString(),
              entityClass: monsterStats.class,
              experience: monsterStats.experience.toString(),
              inBattle,
              intelligence: monsterStats.intelligence.toString(),
              level: monsterStats.level.toString(),
              mobId,
              monsterId,
              strength: monsterStats.strength.toString(),
              ...fetachedMetadata,
            };
          }),
        );

        setMonsters(_monsters.filter(m => Number(m.currentHp) > 0));
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch monsters.', e);
      }
    },
    [MatchEntity, Mobs, renderError, Stats],
  );

  useEffect(() => {
    (async (): Promise<void> => {
      if (!(allCharacterEntities && allMonsterEntities)) return;

      setIsFetchingEntities(true);
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

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const { error, success } = await spawn(character.characterId);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Spawned!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to spawn.', e);
    } finally {
      setIsSpawning(false);
    }
  }, [character, delegatorAddress, renderError, renderSuccess, spawn]);

  const currentBattle =
    Array.from(
      useEntityQuery([
        Has(CombatEncounter),
        HasValue(CombatEncounter, { end: BigInt(0) }),
      ]),
    )
      .map(entity => {
        const encounter = getComponentValue(CombatEncounter, entity);
        if (!encounter) return null;

        return {
          attackers: encounter.attackers as Entity[],
          currentTurn: encounter.currentTurn.toString(),
          defenders: encounter.defenders as Entity[],
          encounterId: entity,
          encounterType: encounter.encounterType,
          end: encounter.end.toString(),
          maxTurns: encounter.maxTurns.toString(),
          start: encounter.start.toString(),
        };
      })
      .filter(
        encounter =>
          character &&
          (encounter?.attackers.includes(character.characterId) ||
            encounter?.defenders.includes(character.characterId)),
      )[0] ?? null;

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      try {
        if (currentBattle) return;
        setIsMoving(true);

        if (!delegatorAddress) {
          throw new Error('Burner not found.');
        }

        if (!position) {
          throw new Error('Position not found.');
        }

        if (!character) {
          throw new Error('Character not found.');
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

        const { error, success } = await move(
          character.characterId,
          newX,
          newY,
        );

        if (error && !success) {
          throw new Error(error);
        }
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to move.', e);
      } finally {
        setIsMoving(false);
      }
    },
    [character, currentBattle, delegatorAddress, move, position, renderError],
  );

  const monsterOponent = useMemo(() => {
    if (!currentBattle) return null;

    return (
      monsters.find(monster =>
        currentBattle.defenders.includes(monster.monsterId),
      ) ?? null
    );
  }, [currentBattle, monsters]);

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
        currentBattle,
        isRefreshing: isFetchingEntities || isMoving,
        isSpawned,
        isSpawning,
        monsterOponent,
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
