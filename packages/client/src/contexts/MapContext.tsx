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
import { useTransaction } from '../hooks/useTransaction';
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
  setOptimisticPosition: (pos: { x: number; y: number } | null) => void;
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
  setOptimisticPosition: () => {},
  shopsOnTile: [],
});

export type MapProviderProps = {
  children: ReactNode;
};

export const MapProvider = ({ children }: MapProviderProps): JSX.Element => {
  const { renderError } = useToast();
  const {
    components: {
      AdventureEscrow,
      Characters,
      CharactersTokenURI,
      EncounterEntity,
      GoldBalances,
      MobStats: MobStatsComponent,
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

  const spawnTx = useTransaction({
    actionName: 'spawn',
  });
  const [isWaitingForSpawn, setIsWaitingForSpawn] = useState(false);
  const [isFetchingEntities, setIsFetchingEntities] = useState(true);

  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
  const [allShops, setAllShops] = useState<Shop[]>([]);

  const [refreshCounter, setRefreshCounter] = useState(0);
  const [optimisticPosition, setOptimisticPosition] = useState<{ x: number; y: number } | null>(null);

  const recsPosition = useComponentValue(
    Position,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.id ?? 0) },
    ),
  );

  // Clear optimistic position once RECS catches up
  useEffect(() => {
    if (
      optimisticPosition &&
      recsPosition &&
      recsPosition.x === optimisticPosition.x &&
      recsPosition.y === optimisticPosition.y
    ) {
      setOptimisticPosition(null);
    }
  }, [recsPosition, optimisticPosition]);

  // Use optimistic position if set, otherwise fall back to RECS
  const position = optimisticPosition ?? (recsPosition ? { x: recsPosition.x, y: recsPosition.y } : null);

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

            // These components may be undefined if tables are empty
            const externalGoldBalance = GoldBalances
              ? (getComponentValue(GoldBalances, ownerEntity)?.value ?? BigInt(0))
              : BigInt(0);
            const escrowGoldBalance = AdventureEscrow
              ? (getComponentValue(AdventureEscrow, entity)?.balance ?? BigInt(0))
              : BigInt(0);

            const metadataURI = getComponentValueStrict(
              CharactersTokenURI,
              tokenIdEntity,
            ).tokenURI;

            // Try to fetch metadata, but use defaults if it fails (e.g., test URIs)
            let fetachedMetadata = {
              name: '',
              description: '',
              image: '',
            };

            try {
              // Skip fetch for obvious test/placeholder URIs
              if (metadataURI && !metadataURI.startsWith('test') && metadataURI.length > 10) {
                fetachedMetadata = await fetchMetadataFromUri(
                  uriToHttp(`ipfs://${metadataURI}`)[0],
                );
              }
            } catch (error) {
              console.warn('Failed to fetch character metadata in MapContext, using defaults:', error);
            }

            const { encounterId, pvpTimer } = EncounterEntity
              ? (getComponentValue(EncounterEntity, entity) ?? { encounterId: zeroHash, pvpTimer: BigInt(0) })
              : { encounterId: zeroHash, pvpTimer: BigInt(0) };
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

            // WorldStatusEffects and related components may be undefined
            const worldStatusEffectsComponent = WorldStatusEffects
              ? getComponentValue(WorldStatusEffects, entity)
              : undefined;

            const { appliedStatusEffects } = worldStatusEffectsComponent ?? {
              appliedStatusEffects: [],
            };

            const decodedStatusEffects = appliedStatusEffects.map(
              decodeAppliedStatusEffectId,
            );

            // Only process status effects if the required components exist
            const worldStatusEffects: WorldStatusEffect[] =
              (StatusEffectStats && StatusEffectValidity)
                ? decodedStatusEffects.map(effect => {
                    const paddedEffectId = effect.effectId.padEnd(
                      66,
                      '0',
                    ) as Entity;
                    const effectStats = getComponentValue(
                      StatusEffectStats,
                      paddedEffectId,
                    );
                    const validity = getComponentValue(
                      StatusEffectValidity,
                      paddedEffectId,
                    );

                    if (!effectStats || !validity) return null;

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
                  }).filter((effect): effect is WorldStatusEffect => effect !== null)
                : [];

            // WorldEncounter may be undefined if table is empty
            const worldEncounter = WorldEncounter
              ? Array.from(
                  runQuery([
                    Has(WorldEncounter),
                    HasValue(WorldEncounter, { character: entity, end: BigInt(0) }),
                  ]),
                ).map(worldEncounterEntity => ({
                  encounterId: worldEncounterEntity,
                  ...getComponentValueStrict(WorldEncounter, worldEncounterEntity),
                }))[0]
              : undefined;

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
          const mobStatsData = getComponentValue(MobStatsComponent, entity);
          const isElite = mobStatsData?.isElite ?? false;

          const monsterTemplate = monsterTemplates.find(
            m => m.mobId === mobId.toString(),
          );

          return {
            ...monsterTemplate,
            maxHp: monsterTemplate?.hitPoints ?? BigInt(0),
            currentHp,
            id: entity,
            inBattle,
            isElite,
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
    [EncounterEntity, MobStatsComponent, monsterTemplates, Position, renderError, Spawned, Stats],
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

  // Sync effect: Monsters and shops update immediately (no async fetches)
  useEffect(() => {
    if (!(allMonsterEntities && isSynced)) return;

    const _monsters = getMonsters(allMonsterEntities);
    const _shops = getShops(allShopEntities);

    setAllMonsters(_monsters);
    setAllShops(_shops);
    setIsFetchingEntities(false);
  }, [allMonsterEntities, allShopEntities, getMonsters, getShops, isSynced, refreshCounter]);

  // Async effect: Characters load in background (IPFS metadata fetches can be slow)
  useEffect(() => {
    if (!(allCharacterEntities && isSynced)) return;

    let cancelled = false;
    (async () => {
      const _allCharacters = await getAllCharacters(allCharacterEntities);
      if (!cancelled) {
        setAllCharacters(_allCharacters as Character[]);
      }
    })();

    return () => { cancelled = true; };
  }, [allCharacterEntities, getAllCharacters, isSynced, refreshCounter]);

  const monstersOnTile = useMemo(() => {
    if (!position || (position.x === 0 && position.y === 0)) return [];
    return allMonsters.filter(
      m =>
        Number(m.currentHp) > 0 &&
        m.position.x === position.x &&
        m.position.y === position.y,
    );
  }, [allMonsters, position]);

  const shopsOnTile = useMemo(() => {
    if (!position || (position.x === 0 && position.y === 0)) return [];
    return allShops.filter(
      m => m.position.x === position.x && m.position.y === position.y,
    );
  }, [allShops, position]);

  const otherCharactersOnTile = useMemo(() => {
    if (!position || (position.x === 0 && position.y === 0)) return [];
    return allCharacters.filter(
      (c: any) =>
        c.position.x === position.x &&
        c.position.y === position.y &&
        c.owner !== delegatorAddress &&
        c.isSpawned,
    ) as Character[];
  }, [allCharacters, delegatorAddress, position]);

  // Clear spawn waiting state when Spawned component updates from RECS sync
  useEffect(() => {
    if (isSpawned && isWaitingForSpawn) {
      setIsWaitingForSpawn(false);
      refreshCharacter();
    }
  }, [isSpawned, isWaitingForSpawn, refreshCharacter]);

  // Safety timeout for spawn
  useEffect(() => {
    if (!isWaitingForSpawn) return;
    const timeout = setTimeout(() => setIsWaitingForSpawn(false), 15000);
    return () => clearTimeout(timeout);
  }, [isWaitingForSpawn]);

  const onSpawn = useCallback(async () => {
    if (!delegatorAddress || !character) return;

    setIsWaitingForSpawn(true);

    const result = await spawnTx.execute(() => spawn(character.id));

    if (!result) {
      // TX failed, clear immediately
      setIsWaitingForSpawn(false);
    }
    // Don't clear — effect clears when isSpawned becomes true
  }, [
    character,
    delegatorAddress,
    spawn,
    spawnTx,
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
        isSpawning: spawnTx.isLoading || isWaitingForSpawn,
        monstersOnTile,
        onSpawn,
        otherCharactersOnTile,
        position,
        refreshEntities,
        setOptimisticPosition,
        shopsOnTile,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => useContext(MapContext);
