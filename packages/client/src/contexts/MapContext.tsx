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
import { formatEther, hexToString, zeroHash } from 'viem';

import { useToast } from '../hooks/useToast';
import {
  decodeMonsterId,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import { type Character, type Monster } from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type MapContextType = {
  aliveMonsters: Monster[];
  allMonsters: Monster[];
  allSpawnedCharacters: Character[];
  inSafetyZone: boolean;
  isFetchingEntities: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  onSpawn: () => void;
  otherCharactersOnTile: Character[];
  position: { x: number; y: number } | null;
};

const MapContext = createContext<MapContextType>({
  aliveMonsters: [],
  allMonsters: [],
  allSpawnedCharacters: [],
  inSafetyZone: false,
  isFetchingEntities: false,
  isSpawned: false,
  isSpawning: false,
  onSpawn: () => {},
  otherCharactersOnTile: [],
  position: null,
});

export type MapProviderProps = {
  children: ReactNode;
};

export const MapProvider = ({ children }: MapProviderProps): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    components: {
      Characters,
      CharactersTokenURI,
      EncounterEntity,
      GoldBalances,
      Mobs,
      Position,
      Spawned,
      Stats,
    },
    delegatorAddress,
    isSynced,
    network: { publicClient, worldContract },
    systemCalls: { spawn },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();

  const [isSpawning, setIsSpawning] = useState(false);
  const [isFetchingEntities, setIsFetchingEntities] = useState(true);

  const [allSpawnedCharacters, setAllSpawnedCharacters] = useState<Character[]>(
    [],
  );
  const [otherCharactersOnTile, setOtherCharactersOnTile] = useState<
    Character[]
  >([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);

  const position = useComponentValue(
    Position,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.id ?? 0) },
    ),
  );

  const inSafetyZone = useMemo(() => {
    if (!position) return false;
    return position.x < 5 && position.y < 5;
  }, [position]);

  const isSpawned = !!useComponentValue(
    Spawned,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.id ?? 0) },
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
              EncounterEntity,
              entity,
            )?.encounterId;
            const inBattle = !!encounterId && encounterId !== zeroHash;

            const position = getComponentValueStrict(Position, entity);

            return {
              ...fetachedMetadata,
              agility: characterStats.agility.toString(),
              baseHp: characterStats.baseHp.toString(),
              currentHp: characterStats.currentHp.toString(),
              entityClass: characterStats.class,
              experience: characterStats.experience.toString(),
              goldBalance: formatEther(goldBalance as bigint).toString(),
              id: entity,
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
      EncounterEntity,
      GoldBalances,
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
        const _monsters: Monster[] = await Promise.all(
          entities.map(async entity => {
            const { mobId } = decodeMonsterId(entity as `0x${string}`);
            const mobData = getComponentValueStrict(
              Mobs,
              encodeEntity({ mobId: 'uint256' }, { mobId: BigInt(mobId) }),
            );
            const monsterStats = getComponentValueStrict(Stats, entity);
            const encounterId = getComponentValue(
              EncounterEntity,
              entity,
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
              id: entity,
              inBattle,
              intelligence: monsterStats.intelligence.toString(),
              level: monsterStats.level.toString(),
              mobId,
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
    [EncounterEntity, Mobs, renderError, Stats],
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

      const { error, success } = await spawn(character.id);

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

  return (
    <MapContext.Provider
      value={{
        aliveMonsters: monsters.filter(m => Number(m.currentHp) > 0),
        allMonsters: monsters,
        allSpawnedCharacters,
        inSafetyZone,
        isFetchingEntities,
        isSpawned,
        isSpawning,
        onSpawn,
        otherCharactersOnTile,
        position: position ? { x: position.x, y: position.y } : null,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => useContext(MapContext);
