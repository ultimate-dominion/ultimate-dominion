import { useComponentValue, useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
  HasValue,
  Not,
  runQuery,
} from '@latticexyz/recs';
import { decodeEntity, encodeEntity } from '@latticexyz/store-sync/recs';
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
  formatUnits,
  hexToBytes,
  hexToString,
  zeroHash,
} from 'viem';

import { useToast } from '../hooks/useToast';
import { GAME_BOARD_PATH } from '../Routes';
import {
  CURRENT_BATTLE_MONSTER_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import {
  type ActionOutcomeType,
  ActionType,
  type Character,
  type CombatDetails,
  type CombatOutcomeType,
  type Monster,
} from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type MapNavigationContextType = {
  actionOutcomes: ActionOutcomeType[];
  aliveMonsters: Monster[];
  allMonsters: Monster[];
  allSpawnedCharacters: Character[];
  currentBattle: CombatDetails | null;
  isAttacking: boolean;
  isRefreshing: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  lastestBattleOutcome: CombatOutcomeType | null;
  monsterOponent: Monster | null;
  onAttack: (itemId: string) => void;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSpawn: () => void;
  otherCharactersOnTile: Character[];
  position: { x: number; y: number } | null;
};

const MapNavigationContext = createContext<MapNavigationContextType>({
  actionOutcomes: [],
  aliveMonsters: [],
  allMonsters: [],
  allSpawnedCharacters: [],
  currentBattle: null,
  isAttacking: false,
  isRefreshing: false,
  isSpawned: false,
  isSpawning: false,
  lastestBattleOutcome: null,
  monsterOponent: null,
  onAttack: () => {},
  onMove: () => {},
  onSpawn: () => {},
  otherCharactersOnTile: [],
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
      ActionOutcome,
      Actions,
      Characters,
      CharactersTokenURI,
      CombatEncounter,
      CombatOutcome,
      GoldBalances,
      MatchEntity,
      Mobs,
      Position,
      Spawned,
      Stats,
    },
    delegatorAddress,
    isSynced,
    network: { publicClient, worldContract },
    systemCalls: { endTurn, move, spawn },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const [isSpawning, setIsSpawning] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isFetchingEntities, setIsFetchingEntities] = useState(true);

  const [allSpawnedCharacters, setAllSpawnedCharacters] = useState<Character[]>(
    [],
  );
  const [otherCharactersOnTile, setOtherCharactersOnTile] = useState<
    Character[]
  >([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);

  const [isAttacking, setIsAttacking] = useState(false);

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
    HasValue(Spawned, { spawned: true }),
    Has(Stats),
    Has(Position),
  ]);

  const getAllSpawnedCharacters = useCallback(
    async (
      entities: Entity[],
    ): Promise<(Character & { position: { x: number; y: number } })[]> => {
      if (!(delegatorAddress && publicClient && worldContract)) return [];

      try {
        const characters: (Character & {
          position: { x: number; y: number };
        })[] = await Promise.all(
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

            const position = getComponentValueStrict(Position, entity);

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
              position: { x: position.x, y: position.y },
              strength: characterStats.strength.toString(),
              tokenId: tokenId.toString(),
            } as Character & { position: { x: number; y: number } };
          }),
        );

        return characters;
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch other players.',
          e,
        );
        return [];
      }
    },
    [
      Characters,
      CharactersTokenURI,
      delegatorAddress,
      GoldBalances,
      MatchEntity,
      Position,
      publicClient,
      renderError,
      Stats,
      worldContract,
    ],
  );

  const getMonsters = useCallback(
    async (entities: Entity[]): Promise<Monster[]> => {
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

        return _monsters;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch monsters.', e);
        return [];
      }
    },
    [MatchEntity, Mobs, renderError, Stats],
  );

  useEffect(() => {
    (async (): Promise<void> => {
      if (!(allCharacterEntities && allMonsterEntities && isSynced)) return;
      if (!position || (position.x === 0 && position.y === 0)) {
        setOtherCharactersOnTile([]);
        setMonsters([]);
        return;
      }
      setIsFetchingEntities(true);

      const _allCharacters =
        await getAllSpawnedCharacters(allCharacterEntities);
      setAllSpawnedCharacters(_allCharacters as Character[]);

      const _monsters = await getMonsters(allMonsterEntities);
      setMonsters(_monsters);
    })();
  }, [
    allCharacterEntities,
    allMonsterEntities,
    Characters,
    getAllSpawnedCharacters,
    getMonsters,
    isSynced,
    position,
  ]);

  useEffect(() => {
    (async (): Promise<void> => {
      if (allSpawnedCharacters.length > 0 && position) {
        const _otherPlayersOnTile = (
          allSpawnedCharacters as (Character & {
            position: { x: number; y: number };
          })[]
        ).filter(
          (c: Character & { position: { x: number; y: number } }) =>
            c.position.x === position.x &&
            c.position.y === position.y &&
            c.owner !== delegatorAddress,
        );
        setOtherCharactersOnTile(_otherPlayersOnTile as Character[]);
      }

      setIsFetchingEntities(false);
    })();
  }, [allSpawnedCharacters, delegatorAddress, position]);

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
      await refreshCharacter();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to spawn.', e);
    } finally {
      setIsSpawning(false);
    }
  }, [
    character,
    delegatorAddress,
    refreshCharacter,
    renderError,
    renderSuccess,
    spawn,
  ]);

  const allBattles = useEntityQuery([Has(CombatEncounter)])
    .map(entity => {
      const encounter = getComponentValueStrict(CombatEncounter, entity);

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
    );

  const currentBattle = useMemo(() => {
    const latestBattle = allBattles[allBattles.length - 1];
    if (!latestBattle) return null;
    if (latestBattle.end !== '0') return null;
    return latestBattle;
  }, [allBattles]);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      try {
        if (!isSpawned) return;
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
    [
      character,
      currentBattle,
      delegatorAddress,
      isSpawned,
      move,
      position,
      renderError,
    ],
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

  const onAttack = useCallback(
    async (itemId: string) => {
      try {
        setIsAttacking(true);

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        if (!character) {
          throw new Error('Character not found.');
        }

        if (!currentBattle) {
          throw new Error('Battle not found.');
        }

        if (!monsterOponent) {
          throw new Error('Monster not found.');
        }

        const basicAttackId = Array.from(
          runQuery([
            Has(Actions),
            HasValue(Actions, { actionType: ActionType.PhysicalAttack }),
          ]),
        )[0];

        if (!basicAttackId) {
          throw new Error('Basic attack not found.');
        }

        const { error, success } = await endTurn(
          currentBattle.encounterId,
          character.characterId,
          monsterOponent.monsterId,
          basicAttackId,
          itemId,
          currentBattle.currentTurn,
        );

        if (error && !success) {
          throw new Error(error);
        }

        localStorage.removeItem(CURRENT_BATTLE_MONSTER_TURN_KEY);
        localStorage.removeItem(CURRENT_BATTLE_USER_TURN_KEY);

        await refreshCharacter();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to attack.', e);
      } finally {
        setIsAttacking(false);
      }
    },
    [
      Actions,
      character,
      currentBattle,
      delegatorAddress,
      endTurn,
      monsterOponent,
      refreshCharacter,
      renderError,
    ],
  );

  const allActionOutcomes = useEntityQuery([Has(ActionOutcome)])
    .map(entity => {
      const _actionOutcome = getComponentValueStrict(ActionOutcome, entity);

      const { encounterId, currentTurn, actionNumber } = decodeEntity(
        {
          encounterId: 'bytes32',
          currentTurn: 'uint256',
          actionNumber: 'uint256',
        },
        entity,
      );

      return {
        attackerDamageDelt: formatUnits(
          _actionOutcome.attackerDamageDelt,
          5,
        ).toString(),
        attackerDied: _actionOutcome.attackerDied,
        attackerId: _actionOutcome.attackerId.toString(),
        actionId: _actionOutcome.actionId.toString(),
        actionNumber: actionNumber.toString(),
        blockNumber: _actionOutcome.blockNumber.toString(),
        crit: _actionOutcome.crit,
        currentTurn: currentTurn.toString(),
        defenderDamageDelt: _actionOutcome.defenderDamageDelt.toString(),
        defenderDied: _actionOutcome.defenderDied,
        defenderId: _actionOutcome.defenderId.toString(),
        encounterId: encounterId.toString(),
        hit: _actionOutcome.hit,
        miss: _actionOutcome.miss,
        timestamp: _actionOutcome.timestamp.toString(),
        weaponId: _actionOutcome.weaponId.toString(),
      } as ActionOutcomeType;
    })
    .filter(
      action =>
        action.attackerId === character?.characterId ||
        action.defenderId === character?.characterId,
    );

  const currentBattleActionOutcomes = useMemo(
    () =>
      allActionOutcomes.filter(
        action => action.encounterId === currentBattle?.encounterId,
      ),
    [allActionOutcomes, currentBattle],
  );

  const lastestBattleOutcome = useMemo(() => {
    const latestCompletedBattle = allBattles.filter(b => b.end !== '0').pop();
    if (!latestCompletedBattle) return null;

    const combatOutcome = getComponentValue(
      CombatOutcome,
      latestCompletedBattle.encounterId,
    );
    if (!combatOutcome) return null;

    const winner = combatOutcome.attackersWin
      ? latestCompletedBattle.attackers[0]
      : latestCompletedBattle.defenders[0];
    if (!winner) return null;

    return {
      attackers: latestCompletedBattle.attackers,
      defenders: latestCompletedBattle.defenders,
      encounterId: latestCompletedBattle.encounterId,
      endTime: combatOutcome.endTime.toString(),
      expDropped: combatOutcome.expDropped.toString(),
      goldDropped: formatEther(combatOutcome.goldDropped).toString(),
      itemsDropped: combatOutcome.itemsDropped.map(i => i.toString()),
      winner,
    };
  }, [allBattles, CombatOutcome]);

  return (
    <MapNavigationContext.Provider
      value={{
        actionOutcomes: currentBattleActionOutcomes,
        aliveMonsters: monsters.filter(m => Number(m.currentHp) > 0),
        allMonsters: monsters,
        allSpawnedCharacters,
        currentBattle,
        isAttacking,
        isRefreshing: isFetchingEntities || isMoving,
        isSpawned,
        isSpawning,
        lastestBattleOutcome,
        monsterOponent,
        onAttack,
        onMove,
        onSpawn,
        otherCharactersOnTile,
        position: position ? { x: position.x, y: position.y } : null,
      }}
    >
      {children}
    </MapNavigationContext.Provider>
  );
};

export const useMapNavigation = (): MapNavigationContextType =>
  useContext(MapNavigationContext);
