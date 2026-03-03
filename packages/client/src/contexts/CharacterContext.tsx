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
    delegatorAddress,
    network: { publicClient, worldContract },
  } = useMUD();

  const { renderError } = useToast();
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isLoadingItemTemplates,
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
  const escrowData = useGameValue('AdventureEscrow', characterKeyBytes);
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

  const externalGoldBalance = toBigInt(goldData?.value);
  const escrowGoldBalance = toBigInt(escrowData?.balance);

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
      escrowGoldBalance,
      externalGoldBalance,
      id: keyBytes as any,
      inBattle,
      isSpawned: true,
      locked: Boolean(data.locked),
      owner: String(data.owner),
      position: { x: 0, y: 0 },
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
      entityClass: toNumber(statsData?.class),
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
      name: (metadataFetched && metadataName) ? metadataName : decodedName,
      description: metadataDescription,
      image: metadataImage,
    };
  }, [
    characterEntry,
    decodedBaseStats,
    escrowGoldBalance,
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
  // Items (inventory + equipped)
  // ============================================================

  // Subscribe to ItemsOwners table so item balance changes (drops, trades, consumes) trigger re-fetch
  const itemsOwnersTable = useGameTable('ItemsOwners');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [itemsRefreshCounter, setItemsRefreshCounter] = useState(0);
  const [inventoryArmor, setInventoryArmor] = useState<Armor[]>([]);
  const [inventoryConsumables, setInventoryConsumables] = useState<Consumable[]>([]);
  const [inventorySpells, setInventorySpells] = useState<Spell[]>([]);
  const [inventoryWeapons, setInventoryWeapons] = useState<Weapon[]>([]);
  const [equippedArmor, setEquippedArmor] = useState<Armor[]>([]);
  const [equippedConsumables, setEquippedConsumables] = useState<Consumable[]>([]);
  const [equippedSpells, setEquippedSpells] = useState<Spell[]>([]);
  const [equippedWeapons, setEquippedWeapons] = useState<Weapon[]>([]);

  const fetchCharacterItems = useCallback(
    (
      characterOwner: string,
      equippedArmorIds: bigint[],
      equippedSpellIds: bigint[],
      equippedWeaponIds: bigint[],
      equippedConsumableIds: bigint[],
    ) => {
      try {
        const _armor = armorTemplates
          .map(armor => {
            const itemOwnerKey = encodeCompositeKey(
              encodeAddressKey(characterOwner),
              encodeUint256Key(BigInt(armor.tokenId)),
            );
            const itemOwner = getTableValue('ItemsOwners', itemOwnerKey);
            return {
              ...armor,
              balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
              itemId: itemOwnerKey as any,
              owner: characterOwner,
            } as Armor;
          })
          .filter(a => a.balance !== BigInt(0));

        const _consumables = consumableTemplates
          .map(consumable => {
            const itemOwnerKey = encodeCompositeKey(
              encodeAddressKey(characterOwner),
              encodeUint256Key(BigInt(consumable.tokenId)),
            );
            const itemOwner = getTableValue('ItemsOwners', itemOwnerKey);
            return {
              ...consumable,
              balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
              itemId: itemOwnerKey as any,
              owner: characterOwner,
            } as Consumable;
          })
          .filter(c => c.balance !== BigInt(0));

        const _spells = spellTemplates
          .map(spell => {
            const itemOwnerKey = encodeCompositeKey(
              encodeAddressKey(characterOwner),
              encodeUint256Key(BigInt(spell.tokenId)),
            );
            const itemOwner = getTableValue('ItemsOwners', itemOwnerKey);
            return {
              ...spell,
              balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
              itemId: itemOwnerKey as any,
              owner: characterOwner,
            } as Spell;
          })
          .filter(s => s.balance !== BigInt(0));

        const _weapons = weaponTemplates
          .map(weapon => {
            const itemOwnerKey = encodeCompositeKey(
              encodeAddressKey(characterOwner),
              encodeUint256Key(BigInt(weapon.tokenId)),
            );
            const itemOwner = getTableValue('ItemsOwners', itemOwnerKey);
            return {
              ...weapon,
              balance: itemOwner ? toBigInt(itemOwner.balance) : BigInt(0),
              itemId: itemOwnerKey as any,
              owner: characterOwner,
            } as Weapon;
          })
          .filter(w => w.balance !== BigInt(0));

        const _equippedArmor = equippedArmorIds
          .map(id => _armor.find(a => a.tokenId === id.toString()))
          .filter(Boolean) as Armor[];
        const _equippedConsumablesList = equippedConsumableIds
          .map(id => _consumables.find(c => c.tokenId === id.toString()))
          .filter(Boolean) as Consumable[];
        const _equippedSpells = equippedSpellIds
          .map(id => _spells.find(s => s.tokenId === id.toString()))
          .filter(Boolean) as Spell[];
        const _equippedWeapons = equippedWeaponIds
          .map(id => _weapons.find(w => w.tokenId === id.toString()))
          .filter(Boolean) as Weapon[];

        setInventoryArmor(_armor);
        setInventoryConsumables(_consumables);
        setInventorySpells(_spells);
        setInventoryWeapons(_weapons);

        setEquippedArmor(_equippedArmor);
        setEquippedConsumables(_equippedConsumablesList);
        setEquippedSpells(_equippedSpells);
        setEquippedWeapons(_equippedWeapons);
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch character items.',
          e,
        );
      }
    },
    [
      armorTemplates,
      consumableTemplates,
      renderError,
      spellTemplates,
      weaponTemplates,
    ],
  );

  // Re-fetch items whenever character, equipment data, or item templates change
  useEffect(() => {
    if (!character || isLoadingItemTemplates) return;

    const equippedArmorRaw = Array.isArray(equipmentData?.equippedArmor)
      ? (equipmentData!.equippedArmor as unknown[]).map(toBigInt)
      : [];
    const equippedConsumablesRaw = Array.isArray(equipmentData?.equippedConsumables)
      ? (equipmentData!.equippedConsumables as unknown[]).map(toBigInt)
      : [];
    const equippedSpellsRaw = Array.isArray(equipmentData?.equippedSpells)
      ? (equipmentData!.equippedSpells as unknown[]).map(toBigInt)
      : [];
    const equippedWeaponsRaw = Array.isArray(equipmentData?.equippedWeapons)
      ? (equipmentData!.equippedWeapons as unknown[]).map(toBigInt)
      : [];

    fetchCharacterItems(
      character.owner,
      equippedArmorRaw,
      equippedSpellsRaw,
      equippedWeaponsRaw,
      equippedConsumablesRaw,
    );
  }, [
    character,
    equipmentData,
    fetchCharacterItems,
    isLoadingItemTemplates,
    itemsRefreshCounter,
    itemsOwnersTable,
  ]);

  // ============================================================
  // refreshCharacter: reactive data means no retry loop needed.
  // Just trigger a re-read of items.
  // ============================================================

  const refreshCharacter = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setItemsRefreshCounter(c => c + 1);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error refreshing character.', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [renderError]);

  // ============================================================
  // Optimistic equip/unequip (no clearRecsCache needed)
  // ============================================================

  const optimisticEquip = useCallback((item: Armor | Spell | Weapon) => {
    const { itemType, tokenId } = item;
    if (itemType === ItemType.Weapon) {
      setEquippedWeapons(prev => {
        if (prev.some(w => w.tokenId === tokenId)) return prev;
        return [...prev, item as Weapon];
      });
    } else if (itemType === ItemType.Armor) {
      setEquippedArmor(prev => {
        if (prev.some(a => a.tokenId === tokenId)) return prev;
        return [...prev, item as Armor];
      });
    } else if (itemType === ItemType.Spell) {
      setEquippedSpells(prev => {
        if (prev.some(s => s.tokenId === tokenId)) return prev;
        return [...prev, item as Spell];
      });
    }
  }, []);

  const optimisticUnequip = useCallback((tokenId: string, itemType: ItemType) => {
    if (itemType === ItemType.Weapon) {
      setEquippedWeapons(prev => prev.filter(w => w.tokenId !== tokenId));
    } else if (itemType === ItemType.Armor) {
      setEquippedArmor(prev => prev.filter(a => a.tokenId !== tokenId));
    } else if (itemType === ItemType.Spell) {
      setEquippedSpells(prev => prev.filter(s => s.tokenId !== tokenId));
    }
  }, []);

  const isMoveEquipped = useMemo(() => {
    return equippedSpells.length + equippedWeapons.length > 0;
  }, [equippedSpells, equippedWeapons]);

  // Suppress unused variable warnings for publicClient and worldContract
  void publicClient;
  void worldContract;

  return (
    <CharacterContext.Provider
      value={{
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
        isRefreshing,
        optimisticEquip,
        optimisticUnequip,
        refreshCharacter,
      }}
    >
      {children}
    </CharacterContext.Provider>
  );
};

export const useCharacter = (): CharacterContextType =>
  useContext(CharacterContext);
