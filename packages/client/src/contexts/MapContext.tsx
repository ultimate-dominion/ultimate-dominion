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

import {
  encodeAddressKey,
  encodeUint256Key,
  getTableEntries,
  getTableValue,
  toBigInt,
  toNumber,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
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
  AdvancedClass,
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

const SHOP_POSITION_TO_NAME: Record<string, string> = {
  '9,9': 'Tal',
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
  const { renderError } = useToast();
  const {
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

  // Reactive table subscriptions for entity queries
  const positionTable = useGameTable('Position');
  const spawnedTable = useGameTable('Spawned');
  const statsTable = useGameTable('Stats');
  const charactersTable = useGameTable('Characters');
  const shopsTable = useGameTable('Shops');

  // Player's position from the store (canonical — no optimistic updates)
  const posData = useGameValue('Position', character?.id);
  const position = posData ? { x: toNumber(posData.x), y: toNumber(posData.y) } : null;

  const inSafetyZone = useMemo(() => {
    if (!position) return false;
    return position.x < 5 && position.y < 5;
  }, [position]);

  const spawnedData = useGameValue('Spawned', character?.id);
  const isSpawned = Boolean(spawnedData?.spawned);

  // Filtered entity lists computed from reactive tables
  const allShopEntities = useMemo(() => {
    return Object.keys(positionTable).filter(key =>
      spawnedTable[key] && shopsTable[key]
    );
  }, [positionTable, spawnedTable, shopsTable]);

  const allMonsterEntities = useMemo(() => {
    return Object.keys(spawnedTable).filter(key =>
      statsTable[key] && !charactersTable[key] && positionTable[key]
    );
  }, [spawnedTable, statsTable, charactersTable, positionTable]);

  const allCharacterEntities = useMemo(() => {
    return Object.keys(charactersTable).filter(key => statsTable[key]);
  }, [charactersTable, statsTable]);

  const getAllCharacters = useCallback(
    async (
      entities: string[],
    ): Promise<
      (Character & { isSpawned: boolean; position: { x: number; y: number } })[]
    > => {
      if (!(delegatorAddress && publicClient && worldContract)) return [];

      try {
        const characters: (Character & {
          isSpawned: boolean;
          position: { x: number; y: number };
        })[] = await Promise.all(
          entities.map(async (entity: string) => {
            const characterData = getTableValue('Characters', entity);
            const characterStats = getTableValue('Stats', entity);

            if (!characterData || !characterStats) {
              throw new Error(`Missing data for character entity ${entity}`);
            }

            const { tokenId } = characterData;

            const ownerKey = encodeAddressKey(characterData.owner as string);
            const tokenIdKey = encodeUint256Key(toBigInt(tokenId));

            const externalGoldBalanceData = getTableValue('GoldBalances', ownerKey);
            const externalGoldBalance = externalGoldBalanceData
              ? toBigInt(externalGoldBalanceData.value)
              : BigInt(0);

            const escrowData = getTableValue('AdventureEscrow', entity);
            const escrowGoldBalance = escrowData
              ? toBigInt(escrowData.balance)
              : BigInt(0);

            const tokenURIData = getTableValue('CharactersTokenURI', tokenIdKey);
            const metadataURI = tokenURIData?.tokenURI as string | undefined;

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

            const encounterData = getTableValue('EncounterEntity', entity);
            const encounterId = encounterData?.encounterId ?? zeroHash;
            const pvpTimer = encounterData?.pvpTimer ?? BigInt(0);
            const inBattle = !!encounterId && encounterId !== zeroHash;

            const isEntitySpawned =
              getTableValue('Spawned', entity)?.spawned ?? false;
            const positionData = getTableValue('Position', entity) ?? { x: 0, y: 0 };

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

            const baseStatsRaw = characterData.baseStats as string | undefined;
            if (baseStatsRaw && baseStatsRaw !== '0x') {
              decodedBaseStats = decodeBaseStats(baseStatsRaw);
            }

            const worldStatusEffectsData = getTableValue('WorldStatusEffects', entity);
            const { appliedStatusEffects } = worldStatusEffectsData ?? {
              appliedStatusEffects: [],
            };

            const rawEffects = Array.isArray(appliedStatusEffects)
              ? (appliedStatusEffects as string[])
              : [];
            const decodedStatusEffects = rawEffects.map(decodeAppliedStatusEffectId);

            const worldStatusEffects: WorldStatusEffect[] = decodedStatusEffects
              .map(effect => {
                const paddedEffectId = effect.effectId.padEnd(66, '0');
                const effectStats = getTableValue('StatusEffectStats', paddedEffectId);
                const validity = getTableValue('StatusEffectValidity', paddedEffectId);

                if (!effectStats || !validity) return null;

                const timestampEnd = toBigInt(effect.timestamp) + toBigInt(validity.validTime);
                const isActive =
                  timestampEnd > BigInt(Date.now()) / BigInt(1000);

                const name =
                  STATUS_EFFECT_NAME_MAPPING[paddedEffectId] ?? 'unknown';

                return {
                  active: isActive,
                  agiModifier: toBigInt(effectStats.agiModifier),
                  effectId: paddedEffectId,
                  intModifier: toBigInt(effectStats.intModifier),
                  maxStacks: toBigInt(validity.maxStacks),
                  name,
                  strModifier: toBigInt(effectStats.strModifier),
                  timestampEnd,
                  timestampStart: toBigInt(effect.timestamp),
                };
              })
              .filter((effect): effect is WorldStatusEffect => effect !== null);

            // Scan WorldEncounter entries for this character
            const worldEncounterEntries = getTableEntries('WorldEncounter');
            const worldEncounter = Object.entries(worldEncounterEntries)
              .map(([encKey, encData]) => ({
                encounterId: encKey,
                ...encData,
              }))
              .find(
                enc =>
                  enc.character === entity &&
                  toBigInt(enc.end) === BigInt(0),
              );

            return {
              ...fetachedMetadata,
              advancedClass: (toNumber(characterStats.advancedClass) as AdvancedClass) ?? AdvancedClass.None,
              agility: toBigInt(characterStats.agility),
              baseStats: decodedBaseStats,
              currentHp: toBigInt(characterStats.currentHp),
              entityClass: toNumber(characterStats.class),
              escrowGoldBalance,
              experience: toBigInt(characterStats.experience),
              hasSelectedAdvancedClass: Boolean(characterStats.hasSelectedAdvancedClass),
              externalGoldBalance,
              id: entity,
              inBattle,
              intelligence: toBigInt(characterStats.intelligence),
              isSpawned: Boolean(isEntitySpawned),
              level: toBigInt(characterStats.level),
              locked: Boolean(characterData.locked),
              maxHp: toBigInt(characterStats.maxHp),
              name: hexToString(characterData.name as `0x${string}`, {
                size: 32,
              }),
              owner: characterData.owner as string,
              position: {
                x: toNumber(positionData.x),
                y: toNumber(positionData.y),
              },
              pvpCooldownTimer: toBigInt(pvpTimer),
              strength: toBigInt(characterStats.strength),
              tokenId: tokenId?.toString() ?? '0',
              worldEncounter: worldEncounter
                ? {
                    characterId: worldEncounter.character as string,
                    encounterId: worldEncounter.encounterId as string,
                    shopId: worldEncounter.entity as string,
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
      delegatorAddress,
      publicClient,
      renderError,
      worldContract,
    ],
  );

  const getMonsters = useCallback(
    (entities: string[]): Monster[] => {
      try {
        const _monsters: Monster[] = entities.map(entity => {
          const { mobId } = decodeMobInstanceId(entity as `0x${string}`);

          const encounterData = getTableValue('EncounterEntity', entity);
          const encounterId = encounterData?.encounterId;

          const statsData = getTableValue('Stats', entity);
          const currentHp = toBigInt(statsData?.currentHp);
          const inBattle = !!encounterId && encounterId !== zeroHash;

          const spawnedEntityData = getTableValue('Spawned', entity);
          const isEntitySpawned = Boolean(spawnedEntityData?.spawned ?? false);

          const positionEntityData = getTableValue('Position', entity);
          const posX = toNumber(positionEntityData?.x ?? 0);
          const posY = toNumber(positionEntityData?.y ?? 0);

          const mobStatsData = getTableValue('MobStats', entity);
          const isElite = Boolean(mobStatsData?.isElite ?? false);

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
            isSpawned: isEntitySpawned,
            position: { x: posX, y: posY },
          } as Monster;
        });

        return _monsters;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch monsters.', e);
        return [];
      }
    },
    [monsterTemplates, renderError],
  );

  const getShops = useCallback(
    (entities: string[]): Shop[] => {
      try {
        const _shops: Shop[] = entities.map(entity => {
          const positionEntityData = getTableValue('Position', entity);
          const shopData = getTableValue('Shops', entity);

          if (!positionEntityData || !shopData) {
            throw new Error(`Missing data for shop entity ${entity}`);
          }

          const { mobId } = decodeMobInstanceId(entity as `0x${string}`);
          const x = toNumber(positionEntityData.x);
          const y = toNumber(positionEntityData.y);
          const name =
            SHOP_MOB_ID_TO_NAME[mobId.toString()] ??
            SHOP_POSITION_TO_NAME[`${x},${y}`] ??
            'Unknown Shop';

          const buyableItems = Array.isArray(shopData.buyableItems)
            ? (shopData.buyableItems as unknown[]).map(item => item?.toString() ?? '')
            : [];
          const sellableItems = Array.isArray(shopData.sellableItems)
            ? (shopData.sellableItems as unknown[]).map(item => item?.toString() ?? '')
            : [];
          const stock = Array.isArray(shopData.stock)
            ? (shopData.stock as unknown[]).map(v => toBigInt(v))
            : [];

          return {
            buyableItems,
            gold: toBigInt(shopData.gold),
            maxGold: toBigInt(shopData.maxGold),
            name,
            position: { x, y },
            priceMarkdown: toBigInt(shopData.priceMarkdown),
            priceMarkup: toBigInt(shopData.priceMarkup),
            sellableItems,
            shopId: entity,
            stock,
          } as Shop;
        });

        return _shops;
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to fetch shops.', e);
        return [];
      }
    },
    [renderError],
  );

  const refreshEntities = useCallback(() => {
    setRefreshCounter(prev => prev + 1);
  }, []);

  // Sync effect: Monsters and shops update immediately (no async fetches)
  useEffect(() => {
    if (!isSynced) return;

    const _monsters = getMonsters(allMonsterEntities);
    const _shops = getShops(allShopEntities);

    setAllMonsters(_monsters);
    setAllShops(_shops);
    setIsFetchingEntities(false);
  }, [allMonsterEntities, allShopEntities, getMonsters, getShops, isSynced, refreshCounter]);

  // Async effect: Characters load in background (IPFS metadata fetches can be slow)
  useEffect(() => {
    if (!isSynced) return;

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

  // Clear spawn waiting state when Spawned value updates from store sync
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
        shopsOnTile,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => useContext(MapContext);
