import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useToast } from '../hooks/useToast';
import {
  encodeBytes32Key,
  encodeUint256Key,
  getTableEntries,
  toBigInt,
  toNumber,
  useGameConfig,
  useGameStore,
  useGameTable,
} from '../lib/gameStore';
import { fetchMetadataFromUri, isTextOnlyUri, uriToHttp } from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemType,
  Rarity,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

type ItemsContextType = {
  armorTemplates: ArmorTemplate[];
  consumableTemplates: ConsumableTemplate[];
  isLoading: boolean;
  spellTemplates: SpellTemplate[];
  weaponTemplates: WeaponTemplate[];
};

const ItemsContext = createContext<ItemsContextType>({
  armorTemplates: [],
  consumableTemplates: [],
  isLoading: false,
  spellTemplates: [],
  weaponTemplates: [],
});

export const ItemsProvider = ({
  children,
}: {
  children: ReactNode;
}): JSX.Element => {
  const { renderError } = useToast();

  const [armorTemplates, setArmorTemplates] = useState<ArmorTemplate[]>([]);
  const [consumableTemplates, setConsumableTemplates] = useState<ConsumableTemplate[]>([]);
  const [spellTemplates, setSpellTemplates] = useState<SpellTemplate[]>([]);
  const [weaponTemplates, setWeaponTemplates] = useState<WeaponTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reactive table subscriptions — re-runs the effect when item data arrives
  const itemsTable = useGameTable('Items');
  const hydrated = useGameStore((s) => s.hydrated);
  const baseURIRow = useGameConfig('ItemsMetadataURI');

  const fetchAllArmor = useCallback(
    async (armorIds: bigint[]): Promise<ArmorTemplate[]> => {
      const armorStatsTable = getTableEntries('ArmorStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      return Promise.all(
        armorIds.map(async (armorId) => {
          const keyBytes = encodeUint256Key(armorId);

          const armorRow = armorStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? '');

          let metadata = { name: `Armor #${armorId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`[ItemsContext] Failed to fetch metadata for armor ${armorId}:`, e);
          }

          return {
            ...metadata,
            agiModifier: toBigInt(armorRow?.agiModifier),
            armorModifier: toBigInt(armorRow?.armorModifier),
            hpModifier: toBigInt(armorRow?.hpModifier),
            intModifier: toBigInt(armorRow?.intModifier),
            itemType: toNumber(itemRow?.itemType) as ItemType,
            minLevel: toBigInt(armorRow?.minLevel),
            price: toBigInt(itemRow?.price),
            rarity: toNumber(itemRow?.rarity) as Rarity,
            statRestrictions: {
              minAgility: toBigInt(restrictionsRow?.minAgility),
              minIntelligence: toBigInt(restrictionsRow?.minIntelligence),
              minStrength: toBigInt(restrictionsRow?.minStrength),
            },
            strModifier: toBigInt(armorRow?.strModifier),
            tokenId: armorId.toString(),
          } as ArmorTemplate;
        }),
      );
    },
    [baseURIRow, itemsTable],
  );

  const fetchAllConsumables = useCallback(
    async (consumableIds: bigint[]): Promise<ConsumableTemplate[]> => {
      const consumableStatsTable = getTableEntries('ConsumableStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const statusEffectStatsTable = getTableEntries('StatusEffectStats');
      const statusEffectValidityTable = getTableEntries('StatusEffectValidity');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      return Promise.all(
        consumableIds.map(async (consumableId) => {
          const keyBytes = encodeUint256Key(consumableId);

          const consumableRow = consumableStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? '');

          // effects is a bytes32[] stored as string[]
          const effects = Array.isArray(consumableRow?.effects)
            ? (consumableRow.effects as string[])
            : [];

          const statusEffectStats = effects
            .map((effectId) => {
              const effectKey = encodeBytes32Key(effectId);
              return statusEffectStatsTable[effectKey];
            })
            .filter(Boolean);

          const statusEffectValidities = effects
            .map((effectId) => {
              const effectKey = encodeBytes32Key(effectId);
              return statusEffectValidityTable[effectKey];
            })
            .filter(Boolean);

          const hpRestoreAmount = toBigInt(consumableRow?.maxDamage) * -1n;

          let metadata = { name: `Consumable #${consumableId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`[ItemsContext] Failed to fetch metadata for consumable ${consumableId}:`, e);
          }

          return {
            ...metadata,
            agiModifier: statusEffectStats.reduce(
              (acc, row) => acc + toBigInt(row?.agiModifier),
              0n,
            ),
            cooldown: toBigInt(statusEffectValidities[0]?.cooldown),
            effects,
            hpModifier: statusEffectStats.reduce(
              (acc, row) => acc + toBigInt(row?.hpModifier),
              0n,
            ),
            hpRestoreAmount,
            intModifier: statusEffectStats.reduce(
              (acc, row) => acc + toBigInt(row?.intModifier),
              0n,
            ),
            itemType: toNumber(itemRow?.itemType) as ItemType,
            maxStacks: toBigInt(statusEffectValidities[0]?.maxStacks),
            minLevel: toBigInt(consumableRow?.minLevel),
            price: toBigInt(itemRow?.price),
            rarity: toNumber(itemRow?.rarity) as Rarity,
            statRestrictions: {
              minAgility: toBigInt(restrictionsRow?.minAgility),
              minIntelligence: toBigInt(restrictionsRow?.minIntelligence),
              minStrength: toBigInt(restrictionsRow?.minStrength),
            },
            strModifier: statusEffectStats.reduce(
              (acc, row) => acc + toBigInt(row?.strModifier),
              0n,
            ),
            tokenId: consumableId.toString(),
            validTime: toBigInt(statusEffectValidities[0]?.validTime),
            validTurns: toBigInt(statusEffectValidities[0]?.validTurns),
          } as ConsumableTemplate;
        }),
      );
    },
    [baseURIRow, itemsTable],
  );

  const fetchAllSpells = useCallback(
    async (spellIds: bigint[]): Promise<SpellTemplate[]> => {
      const spellStatsTable = getTableEntries('SpellStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      return Promise.all(
        spellIds.map(async (spellId) => {
          const keyBytes = encodeUint256Key(spellId);

          const spellRow = spellStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? '');

          const effects = Array.isArray(spellRow?.effects)
            ? (spellRow.effects as string[])
            : [];

          let metadata = { name: `Spell #${spellId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`[ItemsContext] Failed to fetch metadata for spell ${spellId}:`, e);
          }

          return {
            ...metadata,
            effects,
            itemId: spellId.toString(),
            itemType: toNumber(itemRow?.itemType) as ItemType,
            maxDamage: toBigInt(spellRow?.maxDamage),
            minDamage: toBigInt(spellRow?.minDamage),
            minLevel: toBigInt(spellRow?.minLevel),
            price: toBigInt(itemRow?.price),
            rarity: toNumber(itemRow?.rarity) as Rarity,
            statRestrictions: {
              minAgility: toBigInt(restrictionsRow?.minAgility),
              minIntelligence: toBigInt(restrictionsRow?.minIntelligence),
              minStrength: toBigInt(restrictionsRow?.minStrength),
            },
            tokenId: spellId.toString(),
          } as SpellTemplate;
        }),
      );
    },
    [baseURIRow, itemsTable],
  );

  const fetchAllWeapons = useCallback(
    async (weaponIds: bigint[]): Promise<WeaponTemplate[]> => {
      const weaponStatsTable = getTableEntries('WeaponStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      return Promise.all(
        weaponIds.map(async (weaponId) => {
          const keyBytes = encodeUint256Key(weaponId);

          const weaponRow = weaponStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? '');

          const effects = Array.isArray(weaponRow?.effects)
            ? (weaponRow.effects as string[])
            : [];

          let metadata = { name: `Weapon #${weaponId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`[ItemsContext] Failed to fetch metadata for weapon ${weaponId}:`, e);
          }

          return {
            ...metadata,
            agiModifier: toBigInt(weaponRow?.agiModifier),
            effects,
            hpModifier: toBigInt(weaponRow?.hpModifier),
            intModifier: toBigInt(weaponRow?.intModifier),
            itemType: toNumber(itemRow?.itemType) as ItemType,
            maxDamage: toBigInt(weaponRow?.maxDamage),
            minDamage: toBigInt(weaponRow?.minDamage),
            minLevel: toBigInt(weaponRow?.minLevel),
            price: toBigInt(itemRow?.price),
            rarity: toNumber(itemRow?.rarity) as Rarity,
            statRestrictions: {
              minAgility: toBigInt(restrictionsRow?.minAgility),
              minIntelligence: toBigInt(restrictionsRow?.minIntelligence),
              minStrength: toBigInt(restrictionsRow?.minStrength),
            },
            strModifier: toBigInt(weaponRow?.strModifier),
            tokenId: weaponId.toString(),
          } as WeaponTemplate;
        }),
      );
    },
    [baseURIRow, itemsTable],
  );

  useEffect(() => {
    const itemEntryCount = Object.keys(itemsTable).length;
    console.info('[ItemsContext] effect fired — hydrated:', hydrated, 'items:', itemEntryCount);

    (async () => {
      if (!hydrated) return;

      if (itemEntryCount === 0) {
        // No items in the world — stop loading so downstream components aren't
        // permanently blocked waiting for items that don't exist.
        setIsLoading(false);
        return;
      }

      try {
        const allItemIds = Object.entries(itemsTable).map(([keyBytes, itemRow]) => {
          // keyBytes is a 32-byte uint256 — decode back to bigint
          const clean = keyBytes.startsWith('0x') ? keyBytes.slice(2) : keyBytes;
          const itemId = BigInt('0x' + clean.slice(0, 64));
          return {
            itemType: toNumber(itemRow.itemType),
            itemId,
          };
        });

        const armorIds = allItemIds
          .filter(({ itemType }) => itemType === ItemType.Armor)
          .map(({ itemId }) => itemId);
        const weaponIds = allItemIds
          .filter(({ itemType }) => itemType === ItemType.Weapon)
          .map(({ itemId }) => itemId);
        const consumableIds = allItemIds
          .filter(({ itemType }) => itemType === ItemType.Consumable)
          .map(({ itemId }) => itemId);
        const spellIds = allItemIds
          .filter(({ itemType }) => itemType === ItemType.Spell)
          .map(({ itemId }) => itemId);

        const [armorResult, weaponResult, consumableResult, spellResult] =
          await Promise.allSettled([
            fetchAllArmor(armorIds),
            fetchAllWeapons(weaponIds),
            fetchAllConsumables(consumableIds),
            fetchAllSpells(spellIds),
          ]);

        if (armorResult.status === 'fulfilled') {
          setArmorTemplates(armorResult.value);
        } else {
          console.error('[ItemsContext] Error fetching armor:', armorResult.reason);
        }

        if (weaponResult.status === 'fulfilled') {
          setWeaponTemplates(weaponResult.value);
        } else {
          console.error('[ItemsContext] Error fetching weapons:', weaponResult.reason);
        }

        if (consumableResult.status === 'fulfilled') {
          setConsumableTemplates(consumableResult.value);
        } else {
          console.error('[ItemsContext] Error fetching consumables:', consumableResult.reason);
        }

        if (spellResult.status === 'fulfilled') {
          setSpellTemplates(spellResult.value);
        } else {
          console.error('[ItemsContext] Error fetching spells:', spellResult.reason);
        }
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Failed to fetch item templates.',
          e,
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [
    hydrated,
    itemsTable,
    fetchAllArmor,
    fetchAllConsumables,
    fetchAllSpells,
    fetchAllWeapons,
    renderError,
  ]);

  return (
    <ItemsContext.Provider
      value={{
        armorTemplates,
        consumableTemplates,
        isLoading,
        spellTemplates,
        weaponTemplates,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
};

export const useItems = (): ItemsContextType => useContext(ItemsContext);
