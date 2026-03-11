import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { zeroHash } from 'viem';

import {
  encodeAddressKey,
  encodeUint256Key,
  getTableValue,
  toBigInt,
  toNumber,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
import { getCachedMetadata } from '../hooks/useCharacterMetadata';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { useQueue } from './QueueContext';
import {
  decodeMobInstanceId,
} from '../utils/helpers';
import { buildCharacter } from '../utils/buildCharacter';
import {
  type Character,
  type Monster,
  type Shop,
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

/** Idle timeout — matches on-chain SessionConfig (5 minutes) */
const SESSION_IDLE_MS = 5 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;

export const MapProvider = ({ children }: MapProviderProps): JSX.Element => {
  const { renderError } = useToast();
  const {
    delegatorAddress,
    isSynced,
    systemCalls: { spawn },
  } = useMUD();
  const { monsterTemplates } = useMonsters();
  const { character, refreshCharacter } = useCharacter();
  const { reportSpawned } = useQueue();

  const spawnTx = useTransaction({
    actionName: 'spawn',
  });
  const [isWaitingForSpawn, setIsWaitingForSpawn] = useState(false);

  // Reactive table subscriptions for entity queries
  const positionTable = useGameTable('Position');
  const spawnedTable = useGameTable('Spawned');
  const statsTable = useGameTable('Stats');
  const charactersTable = useGameTable('Characters');
  const shopsTable = useGameTable('Shops');

  // Additional reactive tables for character building
  const goldBalancesTable = useGameTable('GoldBalances');
  const escrowTable = useGameTable('AdventureEscrow');
  const encounterEntityTable = useGameTable('EncounterEntity');
  const tokenURITable = useGameTable('CharactersTokenURI');
  const worldStatusEffectsTable = useGameTable('WorldStatusEffects');
  const mobStatsTable = useGameTable('MobStats');

  // Player's position from the store (canonical — no optimistic updates)
  const posData = useGameValue('Position', character?.id);
  const position = posData ? { x: toNumber(posData.x), y: toNumber(posData.y) } : null;

  const inSafetyZone = useMemo(() => {
    if (!position) return false;
    return position.x < 5 && position.y < 5;
  }, [position]);

  const spawnedData = useGameValue('Spawned', character?.id);
  const [spawnConfirmed, setSpawnConfirmed] = useState(false);
  const wasSpawnedRef = useRef(false);
  const isSpawned = Boolean(spawnedData?.spawned) || spawnConfirmed;

  // Track when store confirms spawn, and reset only on actual despawn
  useEffect(() => {
    if (spawnedData?.spawned) {
      wasSpawnedRef.current = true;
    } else if (wasSpawnedRef.current) {
      // Was spawned, now isn't — real despawn (death/logout)
      setSpawnConfirmed(false);
      wasSpawnedRef.current = false;
    }
  }, [spawnedData?.spawned]);

  // Filtered entity lists computed from reactive tables
  const allShopEntities = useMemo(() => {
    return Object.keys(positionTable).filter(key =>
      spawnedTable[key] && shopsTable[key] && !charactersTable[key]
    );
  }, [positionTable, spawnedTable, shopsTable, charactersTable]);

  const allMonsterEntities = useMemo(() => {
    return Object.keys(spawnedTable).filter(key =>
      statsTable[key] && !charactersTable[key] && positionTable[key]
    );
  }, [spawnedTable, statsTable, charactersTable, positionTable]);

  const allCharacterEntities = useMemo(() => {
    return Object.keys(charactersTable).filter(key => statsTable[key]);
  }, [charactersTable, statsTable]);

  // ============================================================
  // Synchronous allCharacters — no async, no IPFS blocking
  // ============================================================
  const allCharacters = useMemo(() => {
    if (!isSynced) return [];

    return allCharacterEntities
      .map(entity => {
        const characterData = charactersTable[entity];
        const statsData = statsTable[entity];
        if (!characterData || !statsData) return null;

        const ownerKey = encodeAddressKey(characterData.owner as string);
        const tokenIdKey = encodeUint256Key(toBigInt(characterData.tokenId));
        const goldData = goldBalancesTable[ownerKey];
        const escrowData = escrowTable[entity];
        const encounterData = encounterEntityTable[entity];
        const posData = positionTable[entity];
        const spawnedData = spawnedTable[entity];
        const effectsData = worldStatusEffectsTable[entity];

        // Metadata from module-level cache (sync, returns null if not yet fetched)
        const tokenURI = tokenURITable[tokenIdKey]?.tokenURI as string | undefined;
        const metadata = getCachedMetadata(tokenURI);

        return buildCharacter(
          entity,
          characterData as Record<string, unknown>,
          statsData as Record<string, unknown>,
          goldData as Record<string, unknown> | undefined,
          escrowData as Record<string, unknown> | undefined,
          encounterData as Record<string, unknown> | undefined,
          posData as Record<string, unknown> | undefined,
          spawnedData as Record<string, unknown> | undefined,
          metadata,
          effectsData as Record<string, unknown> | undefined,
        );
      })
      .filter((c): c is Character => c !== null && Boolean(c.locked));
  }, [
    allCharacterEntities, charactersTable, statsTable, goldBalancesTable,
    escrowTable, encounterEntityTable, positionTable, spawnedTable,
    tokenURITable, worldStatusEffectsTable, isSynced,
  ]);

  // Background metadata fetch — triggers IPFS fetches for uncached metadata
  useEffect(() => {
    if (!isSynced) return;
    allCharacterEntities.forEach(entity => {
      const characterData = charactersTable[entity];
      if (!characterData) return;
      const tokenIdKey = encodeUint256Key(toBigInt(characterData.tokenId));
      const tokenURI = tokenURITable[tokenIdKey]?.tokenURI as string | undefined;
      if (tokenURI) getCachedMetadata(tokenURI); // triggers fetch if not cached
    });
  }, [allCharacterEntities, charactersTable, tokenURITable, isSynced]);

  // ============================================================
  // Synchronous allMonsters — reads directly from reactive tables
  // ============================================================
  const allMonsters = useMemo(() => {
    if (!isSynced) return [];

    try {
      return allMonsterEntities.map(entity => {
        const { mobId } = decodeMobInstanceId(entity as `0x${string}`);

        const encounterData = encounterEntityTable[entity];
        const encounterId = encounterData?.encounterId;

        const statsData = statsTable[entity];
        const currentHp = toBigInt(statsData?.currentHp);
        const inBattle = !!encounterId && encounterId !== zeroHash;

        const spawnedEntityData = spawnedTable[entity];
        const isEntitySpawned = Boolean(spawnedEntityData?.spawned ?? false);

        const positionEntityData = positionTable[entity];
        const posX = toNumber(positionEntityData?.x ?? 0);
        const posY = toNumber(positionEntityData?.y ?? 0);

        const mobStatsData = mobStatsTable[entity];
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
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to fetch monsters.', e);
      return [];
    }
  }, [
    allMonsterEntities, encounterEntityTable, statsTable, spawnedTable,
    positionTable, mobStatsTable, monsterTemplates, isSynced, renderError,
  ]);

  // ============================================================
  // Shops — still use getTableValue (shop data rarely changes)
  // ============================================================
  const allShops = useMemo(() => {
    if (!isSynced) return [];

    try {
      const _shops: Shop[] = allShopEntities.map(entity => {
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

      // Deduplicate by position — re-seeding can create multiple shop entities
      // at the same coordinates. Keep the last one (most recently created).
      const seen = new Set<string>();
      const dedupedShops: Shop[] = [];
      for (let i = _shops.length - 1; i >= 0; i--) {
        const key = `${_shops[i].position.x},${_shops[i].position.y}`;
        if (!seen.has(key)) {
          seen.add(key);
          dedupedShops.push(_shops[i]);
        }
      }
      return dedupedShops;
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to fetch shops.', e);
      return [];
    }
  }, [allShopEntities, isSynced, renderError]);

  // Deprecated — reactivity handles updates. Kept for backward compatibility.
  const refreshEntities = useCallback(() => {}, []);

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

  // ============================================================
  // Idle timeout — reload page after 5 min of no user interaction
  // Matches on-chain SessionConfig (300s). Reloading re-syncs all
  // state from the indexer, handles stale WS, and shows the spawn
  // button if the character was despawned while idle.
  // ============================================================
  useEffect(() => {
    if (!isSpawned) return;

    let lastActivity = Date.now();

    const resetActivity = () => {
      lastActivity = Date.now();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivity >= SESSION_IDLE_MS) {
        console.log('[MapContext] Session idle timeout — reloading');
        window.location.reload();
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
      clearInterval(interval);
    };
  }, [isSpawned]);

  const onSpawn = useCallback(async () => {
    if (!delegatorAddress || !character) return;

    setIsWaitingForSpawn(true);

    const result = await spawnTx.execute(() => spawn(character.id));

    if (result?.success) {
      // TX receipt confirmed on-chain success — update UI immediately.
      // The store's reactive path (useGameValue → Spawned) will also
      // fire once the splice resolves, but don't wait for it.
      setSpawnConfirmed(true);
      setIsWaitingForSpawn(false);
      refreshCharacter();
      reportSpawned().catch(() => {});
    } else {
      setIsWaitingForSpawn(false);
    }
  }, [
    character,
    delegatorAddress,
    refreshCharacter,
    reportSpawned,
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
        isFetchingEntities: false,
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
