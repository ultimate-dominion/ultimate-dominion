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
import { loadZoneManifest } from '../utils/itemImages';
import { loadMonsterManifest } from '../utils/monsterImages';

import {
  encodeAddressKey,
  encodeUint256Key,
  getTableValue,
  toBigInt,
  toNumber,
  useGameStore,
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
  type Npc,
  type NpcInteraction,
  type Shop,
  type WorldBoss,
  MobType,
} from '../utils/types';

import { useCharacter } from './CharacterContext';
import { useMonsters } from './MonstersContext';
import { useMUD } from './MUDContext';

/** Map NPC metadataUri prefix to interaction type and display name */
const NPC_METADATA_MAP: Record<string, { name: string; interaction: NpcInteraction }> = {
  'npc:vel_morrow': { name: 'Vel Morrow', interaction: 'respec' },
  'npc:edric_thorne': { name: 'Edric Thorne', interaction: 'guild' },
};

const SHOP_MOB_ID_TO_NAME: Record<string, string> = {
  '1': `General Store`,
  '2': `Traveler's Armory`,
  '3': `Traveler's Spells`,
  '4': `Traveler's Wares`,
};

const SHOP_POSITION_TO_NAME: Record<string, string> = {
  '9,9': 'Tal',
};

// ── Zone coordinate system ──
// Each zone's Y-origin is spaced by ZONE_ORIGIN_SPACING.
// Zone 1: origin (0, 0), Zone 2: origin (0, 100), etc.
const ZONE_ORIGIN_SPACING = 100;

const ZONE_ORIGINS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: ZONE_ORIGIN_SPACING },
};

const ZONE_NAMES: Record<number, string> = {
  1: 'Dark Cave',
  2: 'Windy Peaks',
};

/** Convert raw on-chain position to display (0-9) coords for the current zone */
function toDisplayPosition(raw: { x: number; y: number }, zoneId: number): { x: number; y: number } {
  const origin = ZONE_ORIGINS[zoneId] ?? { x: 0, y: 0 };
  return { x: raw.x - origin.x, y: raw.y - origin.y };
}

/** Check if a raw position falls within a zone's coordinate bounds */
function isInZone(rawX: number, rawY: number, zoneId: number, gridSize = 10): boolean {
  const origin = ZONE_ORIGINS[zoneId] ?? { x: 0, y: 0 };
  return rawX >= origin.x && rawX < origin.x + gridSize
    && rawY >= origin.y && rawY < origin.y + gridSize;
}

/**
 * Check if an entity belongs to the given zone using PositionV2 zoneId.
 * PositionV2 stores zone-RELATIVE coords (0-9), so coordinate bounds alone
 * can't distinguish zones — we must check the zoneId field directly.
 * Falls back to coordinate bounds for legacy Position-only entities.
 */
function entityInZone(
  entityId: string,
  targetZone: number,
  posV2Table: Record<string, any>,
  posV1Table: Record<string, any>,
  toNum: (v: unknown) => number,
): boolean {
  const v2 = posV2Table[entityId];
  if (v2) {
    const zoneId = toNum(v2.zoneId);
    return zoneId === 0 ? targetZone === 1 : zoneId === targetZone;
  }
  const v1 = posV1Table[entityId];
  if (v1) {
    return isInZone(toNum(v1.x), toNum(v1.y), targetZone);
  }
  return false;
}

type MapContextType = {
  allCharacters: Character[];
  allMonsters: Monster[];
  allShops: Shop[];
  currentZone: number;
  currentZoneName: string;
  displayPosition: { x: number; y: number } | null;
  inSafetyZone: boolean;
  isFetchingEntities: boolean;
  isSpawned: boolean;
  isSpawning: boolean;
  monstersOnTile: Monster[];
  onSpawn: () => void;
  otherCharactersOnTile: Character[];
  position: { x: number; y: number } | null;
  allNpcs: Npc[];
  npcsOnTile: Npc[];
  refreshEntities: () => void;
  shopsOnTile: Shop[];
  visibleMonstersOnTile: Monster[];
  worldBosses: WorldBoss[];
};

const MapContext = createContext<MapContextType>({
  allCharacters: [],
  allMonsters: [],
  allShops: [],
  currentZone: 1,
  currentZoneName: 'Dark Cave',
  displayPosition: null,
  inSafetyZone: false,
  isFetchingEntities: false,
  isSpawned: false,
  isSpawning: false,
  monstersOnTile: [],
  onSpawn: () => {},
  otherCharactersOnTile: [],
  position: null,
  allNpcs: [],
  npcsOnTile: [],
  refreshEntities: () => {},
  shopsOnTile: [],
  visibleMonstersOnTile: [],
  worldBosses: [],
});

export type MapProviderProps = {
  children: ReactNode;
};

/** Idle timeout — despawn after 10 minutes of no user interaction */
const SESSION_IDLE_MS = 10 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;

export const MapProvider = ({ children }: MapProviderProps): JSX.Element => {
  const { renderError } = useToast();
  const {
    delegatorAddress,
    isSynced,
    systemCalls: { spawn, removeEntityFromBoard, validateTileMonsters },
  } = useMUD();
  const { monsterTemplates } = useMonsters();
  const { character, refreshCharacter } = useCharacter();
  const { reportSpawned } = useQueue();

  const spawnTx = useTransaction({
    actionName: 'spawn',
  });
  const [isWaitingForSpawn, setIsWaitingForSpawn] = useState(false);

  // Reactive table subscriptions for entity queries
  // Merge Position + PositionV2 — beta contract deploy leaked V2 tables to prod.
  // V2 entries override V1 so recently-moved entities resolve correctly.
  const positionTableV1 = useGameTable('Position');
  const positionTableV2 = useGameTable('PositionV2');
  const positionTable = useMemo(
    () => ({ ...positionTableV1, ...positionTableV2 }),
    [positionTableV1, positionTableV2],
  );
  const spawnedTable = useGameTable('Spawned');
  const statsTable = useGameTable('Stats');
  const charactersTable = useGameTable('Characters');
  const shopsTable = useGameTable('Shops');

  // Additional reactive tables for character building
  const goldBalancesTable = useGameTable('GoldBalances');
  const encounterEntityTable = useGameTable('EncounterEntity');
  const tokenURITable = useGameTable('CharactersTokenURI');
  const worldStatusEffectsTable = useGameTable('WorldStatusEffects');
  const mobStatsTable = useGameTable('MobStats');
  const worldBossTable = useGameTable('WorldBossV2');
  const mobsTable = useGameTable('Mobs');

  // Player's position from the store (canonical — no optimistic updates)
  // Try PositionV2 first (zone-relative coords deployed via beta contract leak),
  // fall back to legacy Position table for unaffected characters.
  const posDataV2 = useGameValue('PositionV2', character?.id);
  const posDataV1 = useGameValue('Position', character?.id);
  const posData = posDataV2 ?? posDataV1;
  const position = posData ? { x: toNumber(posData.x), y: toNumber(posData.y) } : null;

  // Zone awareness — read CharacterZone table (0 or unset = zone 1)
  const characterZoneData = useGameValue('CharacterZone', character?.id);
  const currentZone = useMemo(() => {
    const zoneId = characterZoneData ? toNumber(characterZoneData.zoneId) : 0;
    return zoneId === 0 ? 1 : zoneId;
  }, [characterZoneData]);
  const currentZoneName = ZONE_NAMES[currentZone] ?? `Zone ${currentZone}`;

  // Preload art manifests when zone changes (CDN fallback for missing local art)
  const ZONE_SLUGS: Record<number, string> = { 1: 'dark_cave', 2: 'windy_peaks' };
  useEffect(() => {
    const slug = ZONE_SLUGS[currentZone];
    if (slug) {
      loadZoneManifest(slug);
      loadMonsterManifest(slug);
    }
  }, [currentZone]);

  // Display position — raw coords converted to zone-relative (0-9)
  const displayPosition = useMemo(() => {
    if (!position) return null;
    return toDisplayPosition(position, currentZone);
  }, [position, currentZone]);

  const inSafetyZone = useMemo(() => {
    if (!displayPosition) return false;
    // Safety zone only exists in Zone 1 (Dark Cave)
    if (currentZone !== 1) return false;
    return displayPosition.x < 5 && displayPosition.y < 5;
  }, [displayPosition, currentZone]);

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
      spawnedTable[key]?.spawned &&
      statsTable[key] &&
      !charactersTable[key] &&
      positionTable[key] &&
      !encounterEntityTable[key]?.died
    );
  }, [spawnedTable, statsTable, charactersTable, positionTable, encounterEntityTable]);

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
    encounterEntityTable, positionTable, spawnedTable,
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

        // Use spawned stats (includes ±10% variance and 1.3x elite boost)
        // instead of template stats for accurate color coding and stat display
        const spawnedStrength = statsData?.strength != null
          ? toBigInt(statsData.strength)
          : monsterTemplate?.strength ?? BigInt(0);
        const spawnedAgility = statsData?.agility != null
          ? toBigInt(statsData.agility)
          : monsterTemplate?.agility ?? BigInt(0);
        const spawnedIntelligence = statsData?.intelligence != null
          ? toBigInt(statsData.intelligence)
          : monsterTemplate?.intelligence ?? BigInt(0);
        const spawnedMaxHp = statsData?.maxHp != null
          ? toBigInt(statsData.maxHp)
          : monsterTemplate?.hitPoints ?? BigInt(0);

        return {
          ...monsterTemplate,
          strength: spawnedStrength,
          agility: spawnedAgility,
          intelligence: spawnedIntelligence,
          maxHp: spawnedMaxHp,
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
        const positionEntityData = getTableValue('PositionV2', entity) ?? getTableValue('Position', entity);
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

  // Filter entities to current zone only.
  // Uses PositionV2 zoneId (not coordinate bounds) to correctly exclude
  // Zone 2 entities whose zone-relative coords overlap with Zone 1's range.
  const zonedMonsters = useMemo(() => {
    return allMonsters.filter(m =>
      entityInZone(m.id, currentZone, positionTableV2, positionTableV1, toNumber),
    );
  }, [allMonsters, currentZone, positionTableV2, positionTableV1]);

  const zonedShops = useMemo(() => {
    return allShops.filter(s =>
      entityInZone(s.shopId, currentZone, positionTableV2, positionTableV1, toNumber),
    );
  }, [allShops, currentZone, positionTableV2, positionTableV1]);

  const zonedCharacters = useMemo(() => {
    return allCharacters.filter((c: any) => {
      if (!c.position) return false;
      return entityInZone(c.id, currentZone, positionTableV2, positionTableV1, toNumber);
    });
  }, [allCharacters, currentZone, positionTableV2, positionTableV1]);

  const monstersOnTile = useMemo(() => {
    if (!position || (position.x === 0 && position.y === 0)) return [];
    const result = zonedMonsters.filter(
      m =>
        m.isSpawned &&
        Number(m.currentHp) > 0 &&
        m.position.x === position.x &&
        m.position.y === position.y,
    );
    return result;
  }, [zonedMonsters, position]);

  const playerLevel = character?.level ? Number(character.level) : 1;

  const visibleMonstersOnTile = useMemo(() => {
    if (playerLevel >= 3) return monstersOnTile;
    return monstersOnTile.filter(m => Number(m.level) <= playerLevel);
  }, [monstersOnTile, playerLevel]);

  const shopsOnTile = useMemo(() => {
    if (!position || (position.x === 0 && position.y === 0)) return [];
    return zonedShops.filter(
      m => m.position.x === position.x && m.position.y === position.y,
    );
  }, [zonedShops, position]);

  const otherCharactersOnTile = useMemo(() => {
    if (!position || (position.x === 0 && position.y === 0)) return [];
    return zonedCharacters.filter(
      (c: any) =>
        c.position.x === position.x &&
        c.position.y === position.y &&
        c.owner !== delegatorAddress &&
        c.isSpawned,
    ) as Character[];
  }, [zonedCharacters, delegatorAddress, position]);

  // World bosses for the current zone
  const worldBosses = useMemo((): WorldBoss[] => {
    return Object.entries(worldBossTable)
      .map(([key, row]) => ({
        bossId: key,
        mobId: toNumber(row.mobId),
        zoneId: toNumber(row.zoneId),
        spawnX: toNumber(row.spawnX),
        spawnY: toNumber(row.spawnY),
        entityId: (row.entityId as string) ?? '',
        isAlive: !!row.entityId && row.entityId !== zeroHash,
        respawnSeconds: toNumber(row.respawnSeconds),
        lastKilledAt: toNumber(row.lastKilledAt),
        spawnedAt: toNumber(row.spawnedAt),
        active: Boolean(row.active),
      }))
      .filter(b => b.active && b.zoneId === currentZone);
  }, [worldBossTable, currentZone]);

  // NPC entities: spawned + position, but not shops/characters/monsters
  // Detected by checking the Mobs template table for MobType.NPC
  const allNpcEntities = useMemo(() => {
    return Object.keys(positionTable).filter(key => {
      if (!spawnedTable[key]) return false;
      if (shopsTable[key] || charactersTable[key] || statsTable[key]) return false;
      try {
        const { mobId } = decodeMobInstanceId(key as `0x${string}`);
        const mobKey = `0x${BigInt(mobId).toString(16).padStart(64, '0')}`;
        const mobData = mobsTable[mobKey];
        return mobData && toNumber(mobData.mobType) === MobType.NPC;
      } catch {
        return false;
      }
    });
  }, [positionTable, spawnedTable, shopsTable, charactersTable, statsTable, mobsTable]);

  const allNpcs = useMemo((): Npc[] => {
    if (!isSynced) return [];
    try {
      return allNpcEntities.map(entity => {
        const posData = positionTable[entity];
        const x = toNumber(posData?.x ?? 0);
        const y = toNumber(posData?.y ?? 0);
        const { mobId } = decodeMobInstanceId(entity as `0x${string}`);
        const mobKey = `0x${BigInt(mobId).toString(16).padStart(64, '0')}`;
        const mobData = mobsTable[mobKey];
        const metadataUri = typeof mobData?.mobMetadata === 'string' ? mobData.mobMetadata : '';
        const npcMeta = NPC_METADATA_MAP[metadataUri] ?? { name: `NPC #${mobId}`, interaction: 'dialogue' as const };

        return {
          entityId: entity,
          mobId: mobId.toString(),
          name: npcMeta.name,
          interaction: npcMeta.interaction,
          position: { x, y },
          metadataUri,
        };
      });
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to fetch NPCs.', e);
      return [];
    }
  }, [allNpcEntities, positionTable, mobsTable, isSynced, renderError]);

  const zonedNpcs = useMemo(() => {
    return allNpcs.filter(n => isInZone(n.position.x, n.position.y, currentZone));
  }, [allNpcs, currentZone]);

  const npcsOnTile = useMemo(() => {
    if (!position || (position.x === 0 && position.y === 0)) return [];
    return zonedNpcs.filter(
      n => n.position.x === position.x && n.position.y === position.y,
    );
  }, [zonedNpcs, position]);

  // Proactive ghost validation — verify monsters on the current tile are alive
  // on-chain. Prevents "No enemies here" errors by evicting ghosts before the
  // player clicks Fight. Fires once per tile and once per snapshot hydration
  // (hydrateVersion changes after reconnect, ensuring stale data is rechecked).
  const storeHydrated = useGameStore((state) => state.hydrated);
  const hydrateVersion = useGameStore((state) => state.hydrateVersion);
  const prevTileRef = useRef<string>('');
  const validateInFlightRef = useRef(false);
  useEffect(() => {
    const tileKey = storeHydrated && position
      ? `${hydrateVersion}:${position.x},${position.y}`
      : '';
    if (!tileKey || tileKey === prevTileRef.current || monstersOnTile.length === 0) return;
    if (validateInFlightRef.current) return;
    prevTileRef.current = tileKey;
    validateInFlightRef.current = true;
    validateTileMonsters(monstersOnTile.map(m => m.id), position ?? undefined)
      .finally(() => { validateInFlightRef.current = false; });
  }, [storeHydrated, hydrateVersion, position, monstersOnTile, validateTileMonsters]);

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
  // Idle timeout — despawn character after 5 min of no user interaction
  // Matches on-chain SessionConfig (300s). Calls removeEntityFromBoard
  // to actually despawn on-chain, then reloads to re-sync state.
  // ============================================================
  useEffect(() => {
    if (!isSpawned || !character) return;

    let lastActivity = Date.now();
    let despawning = false;

    const resetActivity = () => {
      lastActivity = Date.now();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));

    const interval = setInterval(async () => {
      if (despawning) return;
      if (Date.now() - lastActivity >= SESSION_IDLE_MS) {
        despawning = true;
        console.log('[MapContext] Session idle timeout — despawning character');
        clearInterval(interval);
        events.forEach((e) => window.removeEventListener(e, resetActivity));
        try {
          await removeEntityFromBoard(character.id);
        } catch (e) {
          console.warn('[MapContext] Idle despawn failed:', e);
        }
        window.location.reload();
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
      clearInterval(interval);
    };
  }, [isSpawned, character, removeEntityFromBoard]);

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
        allCharacters: zonedCharacters,
        allMonsters: zonedMonsters,
        allShops: zonedShops,
        currentZone,
        currentZoneName,
        displayPosition,
        inSafetyZone,
        isFetchingEntities: false,
        isSpawned,
        isSpawning: spawnTx.isLoading || isWaitingForSpawn,
        monstersOnTile,
        onSpawn,
        otherCharactersOnTile,
        position,
        refreshEntities,
        allNpcs: zonedNpcs,
        npcsOnTile,
        shopsOnTile,
        visibleMonstersOnTile,
        worldBosses,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => useContext(MapContext);
