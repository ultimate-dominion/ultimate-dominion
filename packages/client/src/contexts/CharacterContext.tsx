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
import { type Address, hexToString, zeroHash } from 'viem';

import { getCachedDelegator } from '../lib/delegatorCache';
import {
  encodeAddressKey,
  encodeCompositeKey,
  encodeUint256Key,
  getTableValue,
  toBigInt,
  toNumber,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
import { STATUS_EFFECT_NAME_MAPPING } from '../utils/constants';
import {
  decodeAppliedStatusEffectId,
  decodeBaseStats,
  fetchMetadataFromUri,
  isTextOnlyUri,
  uriToHttp,
} from '../utils/helpers';
import {
  AdvancedClass,
  ArmorType,
  getDominantStatClass,
  ItemType,
  PowerSource,
  Race,
} from '../utils/types';
import type {
  Armor,
  Character,
  Consumable,
  Spell,
  Weapon,
  WorldStatusEffect,
} from '../utils/types';

import { preloadItemImages } from '../utils/itemImages';
import { useItems } from './ItemsContext';
import { useMUD } from './MUDContext';

type CharacterContextType = {
  character: Character | null;
  equippedArmor: Armor[];
  equippedConsumables: Consumable[];
  equippedSpells: Spell[];
  equippedWeapons: Weapon[];
  inventoryArmor: Armor[];
  inventoryConsumables: Consumable[];
  inventorySpells: Spell[];
  inventoryWeapons: Weapon[];
  isMoveEquipped: boolean;
  isRefreshing: boolean;
  optimisticEquip: (item: Armor | Spell | Weapon) => void;
  optimisticUnequip: (tokenId: string, itemType: ItemType) => void;
  refreshCharacter: () => Promise<void>;
};

const CharacterContext = createContext<CharacterContextType>({
  character: null,
  equippedArmor: [],
  equippedConsumables: [],
  equippedSpells: [],
  equippedWeapons: [],
  inventoryArmor: [],
  inventoryConsumables: [],
  inventorySpells: [],
  inventoryWeapons: [],
  isMoveEquipped: false,
  isRefreshing: false,
  optimisticEquip: () => {},
  optimisticUnequip: () => {},
  refreshCharacter: async () => {},
});

export type CharacterProviderProps = {
  children: ReactNode;
};

export const CharacterProvider = ({
  children,
}: CharacterProviderProps): JSX.Element => {
  return <CharacterProviderInner>{children}</CharacterProviderInner>;
};

const CharacterProviderInner = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const {
    delegatorAddress: liveDelegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();

  // Fast-path: use cached delegator address from localStorage so character
  // resolves immediately from snapshot cache, before auth chain completes.
  const cachedDelegatorAddress = useMemo(() => {
    if (liveDelegatorAddress) return null;
    return getCachedDelegator(import.meta.env.VITE_WORLD_ADDRESS || '') as Address | null;
  }, [liveDelegatorAddress]);

  const delegatorAddress = liveDelegatorAddress ?? cachedDelegatorAddress;

  const {
    armorTemplates,
    consumableTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  // ============================================================
  // Reactive table reads
  // ============================================================

  const charactersTable = useGameTable('Characters');
  const worldEncounterTable = useGameTable('WorldEncounter');

  // Find the character owned by the current delegator
  const characterEntry = useMemo(() => {
    if (!delegatorAddress) return null;
    const ownerLower = delegatorAddress.toLowerCase();
    for (const [keyBytes, data] of Object.entries(charactersTable)) {
      if (String(data.owner).toLowerCase() === ownerLower) {
        return { keyBytes, data };
      }
    }
    return null;
  }, [charactersTable, delegatorAddress]);

  const characterKeyBytes = characterEntry?.keyBytes;

  // Per-character reactive reads
  const statsData = useGameValue('Stats', characterKeyBytes);
  const encounterData = useGameValue('EncounterEntity', characterKeyBytes);
  const effectsData = useGameValue('WorldStatusEffects', characterKeyBytes);
  const equipmentData = useGameValue('CharacterEquipment', characterKeyBytes);

  // GoldBalances is keyed by owner address
  const ownerAddressKey = characterEntry
    ? encodeAddressKey(String(characterEntry.data.owner))
    : undefined;
  const goldData = useGameValue('GoldBalances', ownerAddressKey);

  // CharactersTokenURI is keyed by tokenId (uint256)
  const tokenIdStr = characterEntry ? String(characterEntry.data.tokenId) : undefined;
  const tokenIdKey = tokenIdStr ? encodeUint256Key(BigInt(tokenIdStr)) : undefined;
  const tokenURIData = useGameValue('CharactersTokenURI', tokenIdKey);

  // ============================================================
  // Derive character stats and encounter
  // ============================================================

  const encounterId: string = String(encounterData?.encounterId ?? zeroHash);
  const inBattle = !!encounterId && encounterId !== zeroHash;
  const pvpCooldownTimer = toBigInt(encounterData?.pvpTimer);

  // Diagnostic: log encounter state changes
  const prevInBattle = useRef(inBattle);
  if (prevInBattle.current !== inBattle) {
    console.log(`[CharCtx] inBattle: ${prevInBattle.current} → ${inBattle} (encounterId: ${encounterId.slice(0, 10)}...)`);
    prevInBattle.current = inBattle;
  }

  const externalGoldBalance = toBigInt(goldData?.value);

  // Decode base stats from the Characters table bytes field
  const decodedBaseStats = useMemo(() => {
    if (!characterEntry) {
      return {
        agility: BigInt(0),
        currentHp: BigInt(0),
        entityClass: 0,
        experience: BigInt(0),
        intelligence: BigInt(0),
        level: BigInt(0),
        maxHp: BigInt(0),
        strength: BigInt(0),
        race: Race.None,
        powerSource: PowerSource.None,
        startingArmor: ArmorType.None,
        advancedClass: AdvancedClass.None,
        hasSelectedAdvancedClass: false,
      };
    }
    const baseStatsRaw = String(characterEntry.data.baseStats ?? '0x');
    if (baseStatsRaw === '0x' || baseStatsRaw === '') {
      return {
        agility: BigInt(0),
        currentHp: BigInt(0),
        entityClass: 0,
        experience: BigInt(0),
        intelligence: BigInt(0),
        level: BigInt(0),
        maxHp: BigInt(0),
        strength: BigInt(0),
        race: Race.None,
        powerSource: PowerSource.None,
        startingArmor: ArmorType.None,
        advancedClass: AdvancedClass.None,
        hasSelectedAdvancedClass: false,
      };
    }
    return decodeBaseStats(baseStatsRaw);
  }, [characterEntry]);

  // Decode status effects
  const worldStatusEffects = useMemo((): WorldStatusEffect[] => {
    const appliedRaw = effectsData?.appliedStatusEffects;
    const appliedStatusEffects = Array.isArray(appliedRaw)
      ? (appliedRaw as string[])
      : [];

    const decodedEffects = appliedStatusEffects.map(decodeAppliedStatusEffectId);

    return decodedEffects
      .map(effect => {
        // Pad effectId to full 32-byte hex (64 hex chars + 0x prefix = 66 chars)
        const paddedEffectId = effect.effectId.padEnd(66, '0');

        const effectStats = getTableValue('StatusEffectStats', paddedEffectId);
        const validity = getTableValue('StatusEffectValidity', paddedEffectId);

        if (!effectStats || !validity) {
          return null;
        }

        const validTime = toBigInt(validity.validTime);
        const timestampEnd = effect.timestamp + validTime;
        const isActive = timestampEnd > BigInt(Date.now()) / BigInt(1000);

        const name = STATUS_EFFECT_NAME_MAPPING[paddedEffectId] ?? 'unknown';

        return {
          active: isActive,
          agiModifier: toBigInt(effectStats.agiModifier),
          effectId: paddedEffectId,
          intModifier: toBigInt(effectStats.intModifier),
          maxStacks: toBigInt(validity.maxStacks),
          name,
          strModifier: toBigInt(effectStats.strModifier),
          timestampEnd,
          timestampStart: effect.timestamp,
        } as WorldStatusEffect;
      })
      .filter((e): e is WorldStatusEffect => e !== null);
  }, [effectsData]);

  // Find the active WorldEncounter for this character
  const worldEncounterEntry = useMemo(() => {
    if (!characterKeyBytes) return undefined;
    for (const [key, data] of Object.entries(worldEncounterTable)) {
      if (
        String(data.character).toLowerCase() === characterKeyBytes.toLowerCase() &&
        toBigInt(data.end) === BigInt(0)
      ) {
        return { encounterId: key, ...data };
      }
    }
    return undefined;
  }, [worldEncounterTable, characterKeyBytes]);

  // ============================================================
  // Character metadata (async: fetched from tokenURI)
  // ============================================================

  const [metadataName, setMetadataName] = useState('');
  const [metadataDescription, setMetadataDescription] = useState('');
  const [metadataImage, setMetadataImage] = useState('');
  const [metadataFetched, setMetadataFetched] = useState(false);

  // Fetch character metadata whenever the tokenURI changes
  useEffect(() => {
    const metadataURI = String(tokenURIData?.tokenURI ?? '');
    if (!metadataURI) return;

    let cancelled = false;

    (async () => {
      try {
        let fetched = { name: '', description: '', image: '' };
        if (isTextOnlyUri(metadataURI)) {
          fetched = await fetchMetadataFromUri(metadataURI);
        } else if (!metadataURI.startsWith('test') && metadataURI.length > 10) {
          const urls = metadataURI.startsWith('ipfs://')
            ? uriToHttp(metadataURI)
            : uriToHttp(`ipfs://${metadataURI}`);
          if (urls.length > 0) {
            fetched = await fetchMetadataFromUri(urls[0]);
          }
        }
        if (!cancelled) {
          setMetadataName(fetched.name);
          setMetadataDescription(fetched.description);
          setMetadataImage(fetched.image);
          setMetadataFetched(true);
        }
      } catch (error) {
        console.warn('[CharacterProvider] Failed to fetch character metadata:', error);
        if (!cancelled) {
          setMetadataFetched(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [tokenURIData]);

  // ============================================================
  // Build the Character object reactively
  // ============================================================

  const character = useMemo((): Character | null => {
    if (!characterEntry) return null;

    const { keyBytes, data } = characterEntry;

    const rawName = String(data.name ?? '0x');
    const decodedName = hexToString(rawName as `0x${string}`, { size: 32 });

    return {
      // CharacterData fields
      baseStats: decodedBaseStats,
      externalGoldBalance,
      id: keyBytes as any,
      inBattle,
      isSpawned: true,
      locked: Boolean(data.locked),
      owner: String(data.owner),
      position: { zoneId: 0, x: 0, y: 0 },
      pvpCooldownTimer,
      tokenId: String(data.tokenId),
      worldEncounter: worldEncounterEntry
        ? {
            characterId: String(worldEncounterEntry.character) as any,
            encounterId: worldEncounterEntry.encounterId as any,
            shopId: String(worldEncounterEntry.entity) as any,
          }
        : undefined,
      worldStatusEffects,

      // EntityStats fields
      agility: toBigInt(statsData?.agility),
      currentHp: toBigInt(statsData?.currentHp),
      entityClass: getDominantStatClass(
        toBigInt(statsData?.strength),
        toBigInt(statsData?.agility),
        toBigInt(statsData?.intelligence),
      ),
      experience: toBigInt(statsData?.experience),
      intelligence: toBigInt(statsData?.intelligence),
      level: toBigInt(statsData?.level),
      maxHp: toBigInt(statsData?.maxHp),
      strength: toBigInt(statsData?.strength),
      race: (toNumber(statsData?.race) as Race) ?? Race.None,
      powerSource: (toNumber(statsData?.powerSource) as PowerSource) ?? PowerSource.None,
      startingArmor: (toNumber(statsData?.startingArmor) as ArmorType) ?? ArmorType.None,
      advancedClass: (toNumber(statsData?.advancedClass) as AdvancedClass) ?? AdvancedClass.None,
      hasSelectedAdvancedClass: Boolean(statsData?.hasSelectedAdvancedClass),

      // Metadata fields
      name: decodedName || metadataName,
      description: metadataDescription,
      image: metadataImage,
    };
  }, [
    characterEntry,
    decodedBaseStats,
    externalGoldBalance,
    inBattle,
    pvpCooldownTimer,
    worldEncounterEntry,
    worldStatusEffects,
    statsData,
    metadataFetched,
    metadataName,
    metadataDescription,
    metadataImage,
  ]);

  // ============================================================
  // Items (inventory + equipped) — synchronous useMemo from reactive tables
  // ============================================================

  const itemsOwnersTable = useGameTable('ItemsOwners');

  const characterOwnerKey = useMemo(
    () => character ? encodeAddressKey(character.owner) : undefined,
    [character],
  );

  const inventoryArmor = useMemo(() => {
    if (!character || !characterOwnerKey) return [];
    return armorTemplates
      .map(armor => {
        const compositeKey = encodeCompositeKey(characterOwnerKey, encodeUint256Key(BigInt(armor.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return { ...armor, balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0), itemId: compositeKey as any, owner: character.owner } as Armor;
      })
      .filter(a => a.balance !== BigInt(0));
  }, [armorTemplates, itemsOwnersTable, characterOwnerKey, character]);

  const inventoryConsumables = useMemo(() => {
    if (!character || !characterOwnerKey) return [];
    return consumableTemplates
      .map(consumable => {
        const compositeKey = encodeCompositeKey(characterOwnerKey, encodeUint256Key(BigInt(consumable.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return { ...consumable, balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0), itemId: compositeKey as any, owner: character.owner } as Consumable;
      })
      .filter(c => c.balance !== BigInt(0));
  }, [consumableTemplates, itemsOwnersTable, characterOwnerKey, character]);

  const inventorySpells = useMemo(() => {
    if (!character || !characterOwnerKey) return [];
    return spellTemplates
      .map(spell => {
        const compositeKey = encodeCompositeKey(characterOwnerKey, encodeUint256Key(BigInt(spell.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return { ...spell, balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0), itemId: compositeKey as any, owner: character.owner } as Spell;
      })
      .filter(s => s.balance !== BigInt(0));
  }, [spellTemplates, itemsOwnersTable, characterOwnerKey, character]);

  const inventoryWeapons = useMemo(() => {
    if (!character || !characterOwnerKey) return [];
    return weaponTemplates
      .map(weapon => {
        const compositeKey = encodeCompositeKey(characterOwnerKey, encodeUint256Key(BigInt(weapon.tokenId)));
        const itemOwner = itemsOwnersTable[compositeKey];
        return { ...weapon, balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0), itemId: compositeKey as any, owner: character.owner } as Weapon;
      })
      .filter(w => w.balance !== BigInt(0));
  }, [weaponTemplates, itemsOwnersTable, characterOwnerKey, character]);

  // Equipment IDs from reactive store — synchronous
  const equippedArmorIds = useMemo(() => {
    const ids = (equipmentData?.equippedArmor ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedArmor]);

  const equippedConsumableIds = useMemo(() => {
    const ids = (equipmentData?.equippedConsumables ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedConsumables]);

  const equippedSpellIds = useMemo(() => {
    const ids = (equipmentData?.equippedSpells ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedSpells]);

  const equippedWeaponIds = useMemo(() => {
    const ids = (equipmentData?.equippedWeapons ?? []) as unknown[];
    return ids.map(toBigInt);
  }, [equipmentData?.equippedWeapons]);

  // Equipped items derived from inventory + equipment IDs
  const equippedArmor = useMemo(() =>
    equippedArmorIds.map(id => inventoryArmor.find(a => a.tokenId === id.toString())).filter(Boolean) as Armor[],
    [equippedArmorIds, inventoryArmor]);

  const equippedConsumables = useMemo(() =>
    equippedConsumableIds.map(id => inventoryConsumables.find(c => c.tokenId === id.toString())).filter(Boolean) as Consumable[],
    [equippedConsumableIds, inventoryConsumables]);

  const equippedSpells = useMemo(() =>
    equippedSpellIds.map(id => inventorySpells.find(s => s.tokenId === id.toString())).filter(Boolean) as Spell[],
    [equippedSpellIds, inventorySpells]);

  const equippedWeapons = useMemo(() =>
    equippedWeaponIds.map(id => inventoryWeapons.find(w => w.tokenId === id.toString())).filter(Boolean) as Weapon[],
    [equippedWeaponIds, inventoryWeapons]);

  // Preload item images as soon as inventory is known
  useEffect(() => {
    const names = [
      ...inventoryArmor, ...inventoryWeapons,
      ...inventorySpells, ...inventoryConsumables,
    ].map(i => i.name);
    if (names.length > 0) preloadItemImages(names);
  }, [inventoryArmor, inventoryWeapons, inventorySpells, inventoryConsumables]);

  // ============================================================
  // refreshCharacter: no-op — all data is now reactive via useMemo
  // ============================================================

  const refreshCharacter = useCallback(async () => {}, []);

  // ============================================================
  // Optimistic equip/unequip — no longer needed since useMemo
  // rebuilds from store synchronously. Kept as no-ops for backward compat.
  // ============================================================

  const optimisticEquip = useCallback((_item: Armor | Spell | Weapon) => {}, []);

  const optimisticUnequip = useCallback((_tokenId: string, _itemType: ItemType) => {}, []);

  const isMoveEquipped = useMemo(() => {
    // Equipment data hasn't loaded from store yet — assume equipped
    // (all characters are minted with starter weapons)
    if (!equipmentData) return true;
    // Check on-chain equipment IDs directly — these are available from the store
    // immediately, independent of template loading.
    return equippedSpellIds.length + equippedWeaponIds.length > 0;
  }, [equipmentData, equippedSpellIds, equippedWeaponIds]);

  // Suppress unused variable warnings for publicClient and worldContract
  void publicClient;
  void worldContract;

  const contextValue = useMemo(() => ({
    character,
    equippedArmor,
    equippedConsumables,
    equippedSpells,
    equippedWeapons,
    inventoryArmor,
    inventoryConsumables,
    inventorySpells,
    inventoryWeapons,
    isMoveEquipped,
    isRefreshing: false,
    optimisticEquip,
    optimisticUnequip,
    refreshCharacter,
  }), [
    character,
    equippedArmor,
    equippedConsumables,
    equippedSpells,
    equippedWeapons,
    inventoryArmor,
    inventoryConsumables,
    inventorySpells,
    inventoryWeapons,
    isMoveEquipped,
    optimisticEquip,
    optimisticUnequip,
    refreshCharacter,
  ]);

  return (
    <CharacterContext.Provider value={contextValue}>
      {children}
    </CharacterContext.Provider>
  );
};

export const useCharacter = (): CharacterContextType =>
  useContext(CharacterContext);
