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
  useState,
} from 'react';
import {
  bytesToHex,
  formatEther,
  hexToBytes,
  hexToString,
  zeroHash,
} from 'viem';

import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import { type Character, type Monster } from '../utils/types';
import { useCharacter } from './CharacterContext';
import { useMUD } from './MUDContext';

type MapContextType = {
  aliveMonsters: Monster[];
  allMonsters: Monster[];
  allSpawnedCharacters: Character[];
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
      GoldBalances,
      EncounterEntity,
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
              EncounterEntity,
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
      EncounterEntity,
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
              EncounterEntity,
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

  return (
    <MapContext.Provider
      value={{
        aliveMonsters: monsters.filter(m => Number(m.currentHp) > 0),
        allMonsters: monsters,
        allSpawnedCharacters,
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
