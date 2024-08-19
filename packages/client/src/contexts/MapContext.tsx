import { useComponentValue, useEntityQuery } from '@latticexyz/react';
import {
  Entity,
  getComponentValue,
  getComponentValueStrict,
  Has,
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
  allCharacters: Character[];
  allMonsters: Monster[];
  inSafetyZone: boolean;
  isFetchingEntities: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  monstersOnTile: Monster[];
  onSpawn: () => void;
  otherCharactersOnTile: Character[];
  position: { x: number; y: number } | null;
};

const MapContext = createContext<MapContextType>({
  allCharacters: [],
  allMonsters: [],
  inSafetyZone: false,
  isFetchingEntities: false,
  isSpawned: false,
  isSpawning: false,
  monstersOnTile: [],
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

  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [otherCharactersOnTile, setOtherCharactersOnTile] = useState<
    Character[]
  >([]);
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [monstersOnTile, setMonstersOnTile] = useState<Monster[]>([]);

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
    Has(Position),
  ]);

  const allCharacterEntities = useEntityQuery([
    Has(Characters),
    Has(Spawned),
    Has(Stats),
    Has(Position),
  ]);

  const getAllCharacters = useCallback(
    async (
      entities: Entity[],
    ): Promise<
      (Character & { isSpawned: boolean; position: { x: number; y: number } })[]
    > => {
      if (!(delegatorAddress && publicClient && worldContract)) return [];

      try {
        const characters: (Character & {
          isSpawned: boolean;
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

            const isSpawned = getComponentValueStrict(Spawned, entity).spawned;
            const _position = getComponentValueStrict(Position, entity);

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
              isSpawned,
              level: characterStats.level.toString(),
              locked: characterData.locked,
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner,
              position: { x: _position.x, y: _position.y },
              strength: characterStats.strength.toString(),
              tokenId: tokenId.toString(),
            } as Character & {
              isSpawned: boolean;
              position: { x: number; y: number };
            };
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
      Spawned,
      Stats,
      worldContract,
    ],
  );

  const getMonsters = useCallback(
    async (
      entities: Entity[],
    ): Promise<
      (Monster & { isSpawned: boolean; position: { x: number; y: number } })[]
    > => {
      try {
        const _monsters: (Monster & {
          isSpawned: boolean;
          position: { x: number; y: number };
        })[] = await Promise.all(
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

            const isSpawned = getComponentValueStrict(Spawned, entity).spawned;
            const _position = getComponentValueStrict(Position, entity);

            return {
              agility: monsterStats.agility.toString(),
              baseHp: monsterStats.baseHp.toString(),
              currentHp: monsterStats.currentHp.toString(),
              entityClass: monsterStats.class,
              experience: monsterStats.experience.toString(),
              id: entity,
              inBattle,
              intelligence: monsterStats.intelligence.toString(),
              isSpawned,
              level: monsterStats.level.toString(),
              mobId,
              position: { x: _position.x, y: _position.y },
              strength: monsterStats.strength.toString(),
              ...fetachedMetadata,
            } as Monster & {
              isSpawned: boolean;
              position: { x: number; y: number };
            };
          }),
        );

        return _monsters;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch monsters.', e);
        return [];
      }
    },
    [EncounterEntity, Mobs, Position, renderError, Spawned, Stats],
  );

  useEffect(() => {
    (async (): Promise<void> => {
      if (!(allCharacterEntities && allMonsterEntities && isSynced)) return;
      if (!position || (position.x === 0 && position.y === 0)) {
        setOtherCharactersOnTile([]);
        setMonstersOnTile([]);
        return;
      }
      setIsFetchingEntities(true);

      const _allCharacters = await getAllCharacters(allCharacterEntities);
      setAllCharacters(_allCharacters as Character[]);

      const _monsters = await getMonsters(allMonsterEntities);
      setAllMonsters(_monsters);
      setMonstersOnTile(
        _monsters.filter(
          m =>
            Number(m.currentHp) > 0 &&
            m.position.x === position.x &&
            m.position.y === position.y,
        ),
      );
    })();
  }, [
    allCharacterEntities,
    allMonsterEntities,
    Characters,
    getAllCharacters,
    getMonsters,
    isSynced,
    position,
  ]);

  useEffect(() => {
    (async (): Promise<void> => {
      if (allCharacters.length > 0 && position) {
        const _otherPlayersOnTile = (
          allCharacters as (Character & {
            isSpawned: boolean;
            position: { x: number; y: number };
          })[]
        ).filter(
          (
            c: Character & {
              isSpawned: boolean;
              position: { x: number; y: number };
            },
          ) =>
            c.position.x === position.x &&
            c.position.y === position.y &&
            c.owner !== delegatorAddress &&
            c.isSpawned,
        );
        setOtherCharactersOnTile(_otherPlayersOnTile as Character[]);
      }

      setIsFetchingEntities(false);
    })();
  }, [allCharacters, character, delegatorAddress, position]);

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
        allMonsters,
        allCharacters,
        inSafetyZone,
        isFetchingEntities,
        isSpawned,
        isSpawning,
        monstersOnTile,
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
