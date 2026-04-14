import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePublicClient } from 'wagmi';

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
  type QuestItemTemplate,
  Rarity,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

/**
 * Client-side spell catalog — fallback display data for spells deployed as
 * ItemType.Weapon (0) before the contract was corrected to use ItemType.Spell (2).
 * Maps effectName (extracted from "spell:<effectName>" tokenURI) to display values.
 */
export const SPELL_CATALOG: Record<string, { name: string; minDamage: bigint; maxDamage: bigint; minLevel: bigint }> = {
  battle_cry:           { name: 'Battle Cry',       minDamage: 5n,  maxDamage: 10n, minLevel: 10n },
  divine_shield:        { name: 'Divine Shield',    minDamage: 0n,  maxDamage: 0n,  minLevel: 10n },
  hunters_mark:         { name: 'Marked Shot',      minDamage: 4n,  maxDamage: 8n,  minLevel: 10n },
  shadowstep:           { name: 'Expose Weakness',  minDamage: 4n,  maxDamage: 8n,  minLevel: 10n },
  entangle:             { name: 'Entangle',          minDamage: 3n,  maxDamage: 6n,  minLevel: 10n },
  soul_drain_curse:     { name: 'Soul Drain',        minDamage: 4n,  maxDamage: 8n,  minLevel: 10n },
  arcane_blast_damage:  { name: 'Arcane Blast',      minDamage: 5n,  maxDamage: 10n, minLevel: 10n },
  arcane_surge_damage:  { name: 'Arcane Infusion',   minDamage: 3n,  maxDamage: 6n,  minLevel: 10n },
  blessing:             { name: 'Blessing',           minDamage: 0n,  maxDamage: 0n,  minLevel: 10n },
};

/** Returns true when a tokenURI marks an item as a spell (e.g. "spell:arcane_surge_damage"). */
export const isSpellTokenURI = (tokenURI: string): boolean => tokenURI.startsWith('spell:');

/** Extracts the effectName from a spell tokenURI, or null for non-spell URIs. */
export const spellEffectNameFromURI = (tokenURI: string): string | null =>
  isSpellTokenURI(tokenURI) ? tokenURI.slice('spell:'.length) : null;

const erc1155UriAbi = [{
  name: 'uri',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [{ name: '', type: 'string' }],
}] as const;

type ItemsContextType = {
  armorTemplates: ArmorTemplate[];
  consumableTemplates: ConsumableTemplate[];
  isLoading: boolean;
  questItemTemplates: QuestItemTemplate[];
  spellTemplates: SpellTemplate[];
  weaponTemplates: WeaponTemplate[];
};

const ItemsContext = createContext<ItemsContextType>({
  armorTemplates: [],
  consumableTemplates: [],
  isLoading: false,
  questItemTemplates: [],
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
  const [questItemTemplates, setQuestItemTemplates] = useState<QuestItemTemplate[]>([]);
  const [spellTemplates, setSpellTemplates] = useState<SpellTemplate[]>([]);
  const [weaponTemplates, setWeaponTemplates] = useState<WeaponTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reactive table subscriptions — re-runs the effect when item data arrives
  const itemsTable = useGameTable('Items');
  const hydrated = useGameStore((s) => s.hydrated);
  const baseURIRow = useGameConfig('ItemsMetadataURI');
  const configRow = useGameConfig('UltimateDominionConfig');
  const publicClient = usePublicClient();

  const fetchAllArmor = useCallback(
    async (armorIds: bigint[], uriOverrides?: Record<string, string>): Promise<ArmorTemplate[]> => {
      const armorStatsTable = getTableEntries('ArmorStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      const results = await Promise.allSettled(
        armorIds.map(async (armorId) => {
          const keyBytes = encodeUint256Key(armorId);

          const armorRow = armorStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? uriOverrides?.[keyBytes] ?? '');

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
      return results
        .filter((r): r is PromiseFulfilledResult<ArmorTemplate> => r.status === 'fulfilled')
        .map(r => r.value);
    },
    [baseURIRow, itemsTable],
  );

  const fetchAllConsumables = useCallback(
    async (consumableIds: bigint[], uriOverrides?: Record<string, string>): Promise<ConsumableTemplate[]> => {
      const consumableStatsTable = getTableEntries('ConsumableStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const statusEffectStatsTable = getTableEntries('StatusEffectStats');
      const statusEffectValidityTable = getTableEntries('StatusEffectValidity');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      const results = await Promise.allSettled(
        consumableIds.map(async (consumableId) => {
          const keyBytes = encodeUint256Key(consumableId);

          const consumableRow = consumableStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? uriOverrides?.[keyBytes] ?? '');

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
      return results
        .filter((r): r is PromiseFulfilledResult<ConsumableTemplate> => r.status === 'fulfilled')
        .map(r => r.value);
    },
    [baseURIRow, itemsTable],
  );

  const fetchAllSpells = useCallback(
    async (spellIds: bigint[], uriOverrides?: Record<string, string>): Promise<SpellTemplate[]> => {
      const spellStatsTable = getTableEntries('SpellStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      const results = await Promise.allSettled(
        spellIds.map(async (spellId) => {
          const keyBytes = encodeUint256Key(spellId);

          const spellRow = spellStatsTable[keyBytes];
          const weaponStatsTable = getTableEntries('WeaponStats');
          const weaponRow = weaponStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? uriOverrides?.[keyBytes] ?? '');

          // Extract effectName from "spell:<effectName>" tokenURI for catalog lookup
          const effectName = tokenURI.startsWith('spell:') ? tokenURI.slice('spell:'.length) : null;
          const catalog = effectName ? SPELL_CATALOG[effectName] : null;

          // Effects: prefer SpellStats, fall back to WeaponStats (spells deployed as weapons)
          const effects = Array.isArray(spellRow?.effects)
            ? (spellRow.effects as string[])
            : Array.isArray(weaponRow?.effects)
              ? (weaponRow.effects as string[])
              : [];

          let metadata = { name: catalog?.name ?? `Spell #${spellId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              const fetched = await fetchMetadataFromUri(tokenURI || fullUri);
              // Prefer catalog name over effect-name-parsed display name
              metadata = { ...fetched, name: catalog?.name ?? fetched.name };
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`[ItemsContext] Failed to fetch metadata for spell ${spellId}:`, e);
          }

          // Damage: prefer SpellStats, fall back to catalog (spells deployed pre-fix)
          const minDamage = spellRow?.minDamage != null ? toBigInt(spellRow.minDamage) : (catalog?.minDamage ?? 0n);
          const maxDamage = spellRow?.maxDamage != null ? toBigInt(spellRow.maxDamage) : (catalog?.maxDamage ?? 0n);
          const minLevel = spellRow?.minLevel != null ? toBigInt(spellRow.minLevel) : (catalog?.minLevel ?? 10n);

          return {
            ...metadata,
            effects,
            itemId: spellId.toString(),
            itemType: ItemType.Spell,
            maxDamage,
            minDamage,
            minLevel,
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
      return results
        .filter((r): r is PromiseFulfilledResult<SpellTemplate> => r.status === 'fulfilled')
        .map(r => r.value);
    },
    [baseURIRow, itemsTable],
  );

  const fetchAllWeapons = useCallback(
    async (weaponIds: bigint[], uriOverrides?: Record<string, string>): Promise<WeaponTemplate[]> => {
      const weaponStatsTable = getTableEntries('WeaponStats');
      const statRestrictionsTable = getTableEntries('StatRestrictions');
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      const results = await Promise.allSettled(
        weaponIds.map(async (weaponId) => {
          const keyBytes = encodeUint256Key(weaponId);

          const weaponRow = weaponStatsTable[keyBytes];
          const restrictionsRow = statRestrictionsTable[keyBytes];
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? uriOverrides?.[keyBytes] ?? '');

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
      return results
        .filter((r): r is PromiseFulfilledResult<WeaponTemplate> => r.status === 'fulfilled')
        .map(r => r.value);
    },
    [baseURIRow, itemsTable],
  );

  const fetchAllQuestItems = useCallback(
    async (questItemIds: bigint[], uriOverrides?: Record<string, string>): Promise<QuestItemTemplate[]> => {
      const tokenURITable = getTableEntries('ItemsURIStorage');
      const baseURI = String(baseURIRow?.uri ?? '');

      const results = await Promise.allSettled(
        questItemIds.map(async (itemId) => {
          const keyBytes = encodeUint256Key(itemId);
          const itemRow = itemsTable[keyBytes];
          const tokenURIRow = tokenURITable[keyBytes];
          const tokenURI = String(tokenURIRow?.uri ?? uriOverrides?.[keyBytes] ?? '');

          let metadata = { name: `Quest Item #${itemId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch { /* use fallback name */ }

          return {
            ...metadata,
            itemType: toNumber(itemRow?.itemType) as ItemType,
            rarity: toNumber(itemRow?.rarity) as Rarity,
            tokenId: itemId.toString(),
          } as QuestItemTemplate;
        }),
      );
      return results
        .filter((r): r is PromiseFulfilledResult<QuestItemTemplate> => r.status === 'fulfilled')
        .map(r => r.value);
    },
    [baseURIRow, itemsTable],
  );

  useEffect(() => {
    let cancelled = false;
    const itemEntryCount = Object.keys(itemsTable).length;
    console.info('[ItemsContext] effect fired — hydrated:', hydrated, 'items:', itemEntryCount);

    (async () => {
      if (!hydrated) return;

      if (itemEntryCount === 0) {
        if (!cancelled) setIsLoading(false);
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

        // Fallback: read URIs directly from chain if ItemsURIStorage is empty
        // (MUD's syncToPostgres doesn't sync tables with only dynamic fields)
        let uriOverrides: Record<string, string> | undefined;
        const tokenURITableSize = Object.keys(getTableEntries('ItemsURIStorage')).length;
        if (tokenURITableSize === 0 && publicClient && configRow?.items) {
          try {
            console.info('[ItemsContext] ItemsURIStorage empty, reading URIs from chain...');
            const itemsAddress = configRow.items as `0x${string}`;
            const baseURI = String(baseURIRow?.uri ?? '');
            const results = await publicClient.multicall({
              contracts: allItemIds.map(({ itemId }) => ({
                address: itemsAddress,
                abi: erc1155UriAbi,
                functionName: 'uri' as const,
                args: [itemId],
              })),
            });
            uriOverrides = {};
            for (let i = 0; i < results.length; i++) {
              if (results[i].status === 'success') {
                let uri = results[i].result as string;
                // Strip baseURI prefix to get raw tokenURI (e.g. "armor:tattered_cloth")
                if (baseURI && uri.startsWith(baseURI)) {
                  uri = uri.slice(baseURI.length);
                }
                const keyBytes = encodeUint256Key(allItemIds[i].itemId);
                uriOverrides[keyBytes] = uri;
              }
            }
            console.info(`[ItemsContext] Read ${Object.keys(uriOverrides).length} URIs from chain`);
          } catch (e) {
            console.warn('[ItemsContext] Failed to read URIs from chain:', e);
          }
        }

        // Identify spell items by tokenURI "spell:" prefix, even when deployed as
        // ItemType.Weapon (a deploy-spell-items.ts bug pre-2026-04-14).
        const tokenURITableForCategorization = getTableEntries('ItemsURIStorage');
        const isSpellItemId = (itemId: bigint): boolean => {
          const key = encodeUint256Key(itemId);
          const uri = String(tokenURITableForCategorization[key]?.uri ?? uriOverrides?.[key] ?? '');
          return uri.startsWith('spell:');
        };

        const armorIds = allItemIds
          .filter(({ itemType }) => itemType === ItemType.Armor)
          .map(({ itemId }) => itemId);
        const weaponIds = allItemIds
          .filter(({ itemType, itemId }) => itemType === ItemType.Weapon && !isSpellItemId(itemId))
          .map(({ itemId }) => itemId);
        const consumableIds = allItemIds
          .filter(({ itemType }) => itemType === ItemType.Consumable)
          .map(({ itemId }) => itemId);
        const spellIds = allItemIds
          .filter(({ itemType, itemId }) => itemType === ItemType.Spell || (itemType === ItemType.Weapon && isSpellItemId(itemId)))
          .map(({ itemId }) => itemId);
        const questItemIds = allItemIds
          .filter(({ itemType }) => itemType === ItemType.QuestItem)
          .map(({ itemId }) => itemId);

        // Each category loads independently — fast categories aren't blocked by slow ones.
        // This prevents one slow IPFS fetch from leaving ALL template arrays empty.
        await Promise.allSettled([
          fetchAllArmor(armorIds, uriOverrides)
            .then(result => { if (!cancelled) setArmorTemplates(result); })
            .catch(e => console.error('[ItemsContext] Error fetching armor:', e)),
          fetchAllWeapons(weaponIds, uriOverrides)
            .then(result => { if (!cancelled) setWeaponTemplates(result); })
            .catch(e => console.error('[ItemsContext] Error fetching weapons:', e)),
          fetchAllConsumables(consumableIds, uriOverrides)
            .then(result => { if (!cancelled) setConsumableTemplates(result); })
            .catch(e => console.error('[ItemsContext] Error fetching consumables:', e)),
          fetchAllSpells(spellIds, uriOverrides)
            .then(result => { if (!cancelled) setSpellTemplates(result); })
            .catch(e => console.error('[ItemsContext] Error fetching spells:', e)),
          ...(questItemIds.length > 0 ? [
            fetchAllQuestItems(questItemIds, uriOverrides)
              .then(result => { if (!cancelled) setQuestItemTemplates(result); })
              .catch(e => console.error('[ItemsContext] Error fetching quest items:', e)),
          ] : []),
        ]);
      } catch (e) {
        if (!cancelled) {
          renderError(
            (e as Error)?.message ?? 'Failed to fetch item templates.',
            e,
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [
    baseURIRow,
    configRow,
    hydrated,
    itemsTable,
    fetchAllArmor,
    fetchAllConsumables,
    fetchAllQuestItems,
    fetchAllSpells,
    fetchAllWeapons,
    publicClient,
    renderError,
  ]);

  const contextValue = useMemo(() => ({
    armorTemplates,
    consumableTemplates,
    isLoading,
    questItemTemplates,
    spellTemplates,
    weaponTemplates,
  }), [armorTemplates, consumableTemplates, isLoading, questItemTemplates, spellTemplates, weaponTemplates]);

  return (
    <ItemsContext.Provider value={contextValue}>
      {children}
    </ItemsContext.Provider>
  );
};

export const useItems = (): ItemsContextType => useContext(ItemsContext);
