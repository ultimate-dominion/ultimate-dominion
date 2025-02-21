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
import { hexToString, zeroHash } from 'viem';

import { useToast } from '../hooks/useToast';
import { STATUS_EFFECT_NAME_MAPPING } from '../utils/constants';
import {
  decodeAppliedStatusEffectId,
  decodeBaseStats,
  decodeMobInstanceId,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
import {
  type Character,
  type Monster,
  type Shop,
  type WorldStatusEffect,
} from '../utils/types';

import { useCharacter } from './CharacterContext';
import { useMonsters } from './MonstersContext';
import { useMUD } from './MUDContext';

const SHOP_MOB_ID_TO_NAME: Record<string, string> = {
  '1': `General Store`,
  '2': `Traveler's Armory`,
  '3': `Traveler's Spells`,
  '4': `Traveler's Wares`,
};

type MapContextType = {
  allCharacters: Character[];
  allMonsters: Monster[];
  allShops: Shop[];
  inSafetyZone: boolean;
  isFetchingEntities: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  monstersOnTile: Monster[];
  onSpawn: () => void;
  otherCharactersOnTile: Character[];
  position: { x: number; y: number } | null;
  refreshEntities: () => void;
  shopsOnTile: Shop[];
};

const MapContext = createContext<MapContextType>({
  allCharacters: [],
  allMonsters: [],
  allShops: [],
  inSafetyZone: false,
  isFetchingEntities: false,
  isSpawned: false,
  isSpawning: false,
  monstersOnTile: [],
  onSpawn: () => {},
  otherCharactersOnTile: [],
  position: null,
  refreshEntities: () => {},
  shopsOnTile: [],
});

export type MapProviderProps = {
  children: ReactNode;
};

export const MapProvider = ({ children }: MapProviderProps): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    components: {
      AdventureEscrow,
      Characters,
      CharactersTokenURI,
      EncounterEntity,
      GoldBalances,
      Position,
      Shops,
      Spawned,
      Stats,
      StatusEffectStats,
      StatusEffectValidity,
      WorldEncounter,
      WorldStatusEffects,
    },
    delegatorAddress,
    isSynced,
    network: { publicClient, worldContract },
    systemCalls: { spawn },
  } = useMUD();
  const { monsterTemplates } = useMonsters();
  const { character, refreshCharacter } = useCharacter();

  const [isSpawning, setIsSpawning] = useState(false);
  const [isFetchingEntities, setIsFetchingEntities] = useState(true);

  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [otherCharactersOnTile, setOtherCharactersOnTile] = useState<
    Character[]
  >([]);
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [monstersOnTile, setMonstersOnTile] = useState<Monster[]>([]);

  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [shopsOnTile, setShopsOnTile] = useState<Shop[]>([]);

  const [refreshCounter, setRefreshCounter] = useState(0);

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

  const allShopEntities = useEntityQuery([
    Has(Position),
    Has(Spawned),
    Has(Shops),
  ]);

  const allMonsterEntities = useEntityQuery([
    Has(Spawned),
    Has(Stats),
    Not(Characters),
    Has(Position),
  ]);

  const allCharacterEntities = useEntityQuery([Has(Characters), Has(Stats)]);

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

            const externalGoldBalance =
              getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0);
            const escrowGoldBalance =
              getComponentValue(AdventureEscrow, entity)?.balance ?? BigInt(0);

            const metadataURI = getComponentValueStrict(
              CharactersTokenURI,
              tokenIdEntity,
            ).tokenURI;

            const fetachedMetadata = await fetchMetadataFromUri(
              uriToHttp(`ipfs://${metadataURI}`)[0],
            );

            const { encounterId, pvpTimer } = getComponentValue(
              EncounterEntity,
              entity,
            ) ?? { encounterId: zeroHash, pvpTimer: BigInt(0) };
            const inBattle = !!encounterId && encounterId !== zeroHash;

            const isSpawned =
              getComponentValue(Spawned, entity)?.spawned ?? false;
            const _position = getComponentValue(Position, entity) ?? {
              x: 0,
              y: 0,
            };

            let decodedBaseStats = {
              agility: BigInt(0),
              currentHp: BigInt(0),
              entityClass: 0,
              experience: BigInt(0),
              intelligence: BigInt(0),
              level: BigInt(0),
              maxHp: BigInt(0),
              strength: BigInt(0),
            };

            if (characterData.baseStats !== '0x') {
              decodedBaseStats = decodeBaseStats(characterData.baseStats);
            }

            const worldStatusEffectsComponent = getComponentValue(
              WorldStatusEffects,
              entity,
            );

            const { appliedStatusEffects } = worldStatusEffectsComponent ?? {
              appliedStatusEffects: [],
            };

            const decodedStatusEffects = appliedStatusEffects.map(
              decodeAppliedStatusEffectId,
            );

            const worldStatusEffects: WorldStatusEffect[] =
              decodedStatusEffects.map(effect => {
                const paddedEffectId = effect.effectId.padEnd(
                  66,
                  '0',
                ) as Entity;
                const effectStats = getComponentValueStrict(
                  StatusEffectStats,
                  paddedEffectId,
                );

                const validity = getComponentValueStrict(
                  StatusEffectValidity,
                  paddedEffectId,
                );

                const timestampEnd = effect.timestamp + validity.validTime;
                const isActive =
                  timestampEnd > BigInt(Date.now()) / BigInt(1000);

                const name =
                  STATUS_EFFECT_NAME_MAPPING[paddedEffectId] ?? 'unknown';

                return {
                  active: isActive,
                  agiModifier: effectStats.agiModifier,
                  effectId: paddedEffectId,
                  intModifier: effectStats.intModifier,
                  maxStacks: validity.maxStacks,
                  name,
                  strModifier: effectStats.strModifier,
                  timestampEnd,
                  timestampStart: effect.timestamp,
                };
              });

            const worldEncounter = Array.from(
              runQuery([
                Has(WorldEncounter),
                HasValue(WorldEncounter, { character: entity, end: BigInt(0) }),
              ]),
            ).map(worldEncounterEntity => ({
              encounterId: worldEncounterEntity,
              ...getComponentValueStrict(WorldEncounter, worldEncounterEntity),
            }))[0];

            return {
              ...fetachedMetadata,
              agility: characterStats.agility,
              baseStats: decodedBaseStats,
              currentHp: characterStats.currentHp,
              entityClass: characterStats.class,
              escrowGoldBalance,
              experience: characterStats.experience,
              externalGoldBalance,
              id: entity,
              inBattle,
              intelligence: characterStats.intelligence,
              isSpawned,
              level: characterStats.level,
              locked: characterData.locked,
              maxHp: characterStats.maxHp,
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner,
              position: { x: _position.x, y: _position.y },
              pvpCooldownTimer: pvpTimer,
              strength: characterStats.strength,
              tokenId: tokenId.toString(),
              worldEncounter: worldEncounter
                ? {
                    characterId: worldEncounter.character as Entity,
                    encounterId: worldEncounter.encounterId as Entity,
                    shopId: worldEncounter.entity as Entity,
                  }
                : undefined,
              worldStatusEffects,
            };
          }),
        );

        return characters.filter(c => c.locked);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch other players.',
          e,
        );
        return [];
      }
    },
    [
      AdventureEscrow,
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
      StatusEffectStats,
      StatusEffectValidity,
      worldContract,
      WorldEncounter,
      WorldStatusEffects,
    ],
  );

  const getMonsters = useCallback(
    (entities: Entity[]): Monster[] => {
      try {
        const _monsters: Monster[] = entities.map(entity => {
          const { mobId } = decodeMobInstanceId(entity as `0x${string}`);
          const encounterId = getComponentValue(
            EncounterEntity,
            entity,
          )?.encounterId;

          const currentHp = getComponentValueStrict(Stats, entity).currentHp;
          const inBattle = !!encounterId && encounterId !== zeroHash;
          const isSpawned = getComponentValueStrict(Spawned, entity).spawned;
          const _position = getComponentValueStrict(Position, entity);

          const monsterTemplate = monsterTemplates.find(
            m => m.mobId === mobId.toString(),
          );

          return {
            ...monsterTemplate,
            maxHp: monsterTemplate?.hitPoints ?? BigInt(0),
            currentHp,
            id: entity,
            inBattle,
            isSpawned,
            position: { x: _position.x, y: _position.y },
          } as Monster;
        });

        return _monsters;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch monsters.', e);
        return [];
      }
    },
    [EncounterEntity, monsterTemplates, Position, renderError, Spawned, Stats],
  );

  const getShops = useCallback(
    (entities: Entity[]): Shop[] => {
      try {
        const _shops: Shop[] = entities.map(entity => {
          const _position = getComponentValueStrict(Position, entity);
          const shopData = getComponentValueStrict(Shops, entity);

          const { mobId } = decodeMobInstanceId(entity as `0x${string}`);
          const name = SHOP_MOB_ID_TO_NAME[mobId.toString()];

          return {
            buyableItems: shopData.buyableItems.map(item => item.toString()),
            gold: shopData.gold,
            maxGold: shopData.maxGold,
            name: name ?? 'Unknown Shop',
            position: { x: _position.x, y: _position.y },
            priceMarkdown: shopData.priceMarkdown,
            priceMarkup: shopData.priceMarkup,
            restock: shopData.stock,
            sellableItems: shopData.sellableItems.map(item => item.toString()),
            shopId: entity,
            stock: shopData.stock,
          } as Shop;
        });

        return _shops;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch shops.', e);
        return [];
      }
    },
    [Position, Shops, renderError],
  );

  const refreshEntities = useCallback(() => {
    setRefreshCounter(prev => prev + 1);
  }, []);

  useEffect(() => {
    (async () => {
      if (!(allCharacterEntities && allMonsterEntities && isSynced)) return;

      const _allCharacters = await getAllCharacters(allCharacterEntities);
      setAllCharacters(_allCharacters as Character[]);

      const _monsters = getMonsters(allMonsterEntities);
      const _shops = getShops(allShopEntities);

      setAllMonsters(_monsters);
      setAllShops(_shops);
    })();
  }, [
    allCharacterEntities,
    allMonsterEntities,
    allShopEntities,
    getAllCharacters,
    getMonsters,
    getShops,
    isSynced,
    refreshCounter,
  ]);

  useEffect(() => {
    if (!position || (position.x === 0 && position.y === 0)) {
      setOtherCharactersOnTile([]);
      setMonstersOnTile([]);
      setShopsOnTile([]);
    }

    if (allMonsters.length > 0 && position) {
      setMonstersOnTile(
        (
          allMonsters as (Monster & {
            isSpawned: boolean;
            position: { x: number; y: number };
          })[]
        ).filter(
          m =>
            Number(m.currentHp) > 0 &&
            m.position.x === position.x &&
            m.position.y === position.y,
        ),
      );
    }
    if (allShops.length > 0 && position) {
      setShopsOnTile(
        (
          allShops as (Shop & {
            isSpawned: boolean;
            position: { x: number; y: number };
          })[]
        ).filter(
          m => m.position.x === position.x && m.position.y === position.y,
        ),
      );
    }

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
  }, [
    allCharacters,
    allMonsters,
    allShops,
    character,
    delegatorAddress,
    position,
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
        allCharacters,
        allMonsters,
        allShops,
        inSafetyZone,
        isFetchingEntities,
        isSpawned,
        isSpawning,
        monstersOnTile,
        onSpawn,
        otherCharactersOnTile,
        position: position ? { x: position.x, y: position.y } : null,
        refreshEntities,
        shopsOnTile,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => useContext(MapContext);
