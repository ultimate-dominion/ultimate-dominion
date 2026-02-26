import { useEntityQuery } from '@latticexyz/react';
import {
  getComponentValue,
  getComponentValueStrict,
  Has,
} from '@latticexyz/recs';
import {
  decodeEntity,
  encodeEntity,
  singletonEntity,
} from '@latticexyz/store-sync/recs';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { useToast } from '../hooks/useToast';
import { fetchMetadataFromUri, isTextOnlyUri, uriToHttp } from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemType,
  Rarity,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

import { useMUD } from './MUDContext';

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
  const {
    components: {
      ArmorStats,
      ConsumableStats,
      Items,
      ItemsBaseURI,
      ItemsTokenURI,
      SpellStats,
      StatRestrictions,
      StatusEffectStats,
      StatusEffectValidity,
      WeaponStats,
    },
    isSynced,
  } = useMUD();

  const [armorTemplates, setArmorTemplates] = useState<ArmorTemplate[]>([]);
  const [consumableTemplates, setConsumableTemplates] = useState<
    ConsumableTemplate[]
  >([]);
  const [spellTemplates, setSpellTemplates] = useState<SpellTemplate[]>([]);
  const [weaponTemplates, setWeaponTemplates] = useState<WeaponTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Reactive query: re-triggers when background sync adds Items records
  // (fixes stale cache issue where LIVE fires before items arrive)
  const allItemEntities = useEntityQuery(Items ? [Has(Items)] : []);

  const fetchAllArmor = useCallback(
    async (allArmorIds: bigint[]) => {
      const allArmorTemplates = await Promise.all(
        allArmorIds.map(async armorId => {
          const itemIdEntity = encodeEntity(
            { itemId: 'uint256' },
            { itemId: armorId },
          );

          const statRestrictions = getComponentValueStrict(
            StatRestrictions,
            itemIdEntity,
          );
          const itemTemplate = getComponentValueStrict(Items, itemIdEntity);
          const armorStats = getComponentValueStrict(ArmorStats, itemIdEntity);

          const baseURI = getComponentValueStrict(
            ItemsBaseURI,
            singletonEntity,
          ).uri;

          // ERC1155 tables use tokenId as key (same numeric value, different key name)
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: armorId },
          );
          const tokenURI = getComponentValueStrict(
            ItemsTokenURI,
            tokenIdEntity,
          ).uri;

          // Try to fetch metadata, but don't fail if it's unavailable
          let metadata = { name: `Armor #${armorId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`Failed to fetch metadata for armor ${armorId}:`, e);
          }

          return {
            ...metadata,
            agiModifier: armorStats.agiModifier,
            armorModifier: armorStats.armorModifier,
            hpModifier: armorStats.hpModifier,
            intModifier: armorStats.intModifier,
            itemType: itemTemplate.itemType,
            minLevel: armorStats.minLevel,
            price: itemTemplate.price,
            rarity: Number(itemTemplate.rarity) as Rarity,
            statRestrictions: {
              minAgility: statRestrictions.minAgility,
              minIntelligence: statRestrictions.minIntelligence,
              minStrength: statRestrictions.minStrength,
            },
            strModifier: armorStats.strModifier,
            tokenId: armorId.toString(),
          } as ArmorTemplate;
        }),
      );

      return allArmorTemplates;
    },
    [ArmorStats, Items, ItemsBaseURI, ItemsTokenURI, StatRestrictions],
  );

  const fetchAllConsumables = useCallback(
    async (allConsumableIds: bigint[]) => {
      const allConsumableTemplates = await Promise.all(
        allConsumableIds.map(async consumableId => {
          const itemIdEntity = encodeEntity(
            { itemId: 'uint256' },
            { itemId: consumableId },
          );

          const statRestrictions = getComponentValueStrict(
            StatRestrictions,
            itemIdEntity,
          );
          const itemTemplate = getComponentValueStrict(Items, itemIdEntity);
          const consumableStats = getComponentValueStrict(
            ConsumableStats,
            itemIdEntity,
          );
          const statusEffectStats = StatusEffectStats ? consumableStats.effects
            .map(effect => {
              const effectEntity = encodeEntity(
                { effectId: 'bytes32' },
                { effectId: effect as `0x${string}` },
              );
              return getComponentValue(StatusEffectStats, effectEntity);
            })
            .filter(Boolean) as {
            agiModifier: bigint;
            hpModifier: bigint;
            intModifier: bigint;
            strModifier: bigint;
          }[] : [];

          const statusEffectValidities = StatusEffectValidity ? consumableStats.effects
            .map(effect => {
              const effectEntity = encodeEntity(
                { effectId: 'bytes32' },
                { effectId: effect as `0x${string}` },
              );
              return getComponentValue(StatusEffectValidity, effectEntity);
            })
            .filter(Boolean) as {
            cooldown: bigint;
            maxStacks: bigint;
            validTime: bigint;
            validTurns: bigint;
          }[] : [];

          const hpRestoreAmount = BigInt(consumableStats.maxDamage) * -1n;

          const baseURI = getComponentValueStrict(
            ItemsBaseURI,
            singletonEntity,
          ).uri;

          // ERC1155 tables use tokenId as key (same numeric value, different key name)
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: consumableId },
          );
          const tokenURI = getComponentValueStrict(
            ItemsTokenURI,
            tokenIdEntity,
          ).uri;

          // Try to fetch metadata, but don't fail if it's unavailable
          let metadata = { name: `Consumable #${consumableId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`Failed to fetch metadata for consumable ${consumableId}:`, e);
          }

          return {
            ...metadata,
            agiModifier: statusEffectStats.reduce(
              (acc, curr) => acc + BigInt(curr.agiModifier),
              0n,
            ),
            cooldown: statusEffectValidities[0]?.cooldown ?? 0n,
            effects: consumableStats.effects,
            hpModifier: statusEffectStats.reduce(
              (acc, curr) => acc + BigInt(curr.hpModifier),
              0n,
            ),
            hpRestoreAmount: hpRestoreAmount,
            intModifier: statusEffectStats.reduce(
              (acc, curr) => acc + BigInt(curr.intModifier),
              0n,
            ),
            itemType: itemTemplate.itemType,
            maxStacks: statusEffectValidities[0]?.maxStacks ?? 0n,
            minLevel: consumableStats.minLevel,
            price: itemTemplate.price,
            rarity: Number(itemTemplate.rarity) as Rarity,
            tokenId: consumableId.toString(),
            statRestrictions: {
              minAgility: statRestrictions.minAgility,
              minIntelligence: statRestrictions.minIntelligence,
              minStrength: statRestrictions.minStrength,
            },
            strModifier: statusEffectStats.reduce(
              (acc, curr) => acc + BigInt(curr.strModifier),
              0n,
            ),
            validTime: statusEffectValidities[0]?.validTime ?? 0n,
            validTurns: statusEffectValidities[0]?.validTurns ?? 0n,
          } as ConsumableTemplate;
        }),
      );

      return allConsumableTemplates;
    },
    [
      ConsumableStats,
      Items,
      ItemsBaseURI,
      ItemsTokenURI,
      StatRestrictions,
      StatusEffectStats,
      StatusEffectValidity,
    ],
  );

  const fetchAllSpells = useCallback(
    async (allSpellIds: bigint[]) => {
      const allSpellTemplates = await Promise.all(
        allSpellIds.map(async spellId => {
          const itemIdEntity = encodeEntity(
            { itemId: 'uint256' },
            { itemId: spellId },
          );

          const statRestrictions = getComponentValue(
            StatRestrictions,
            itemIdEntity,
          ) ?? { minAgility: 0, minIntelligence: 0, minStrength: 0 };
          const itemTemplate = getComponentValueStrict(Items, itemIdEntity);

          const spellStats = getComponentValueStrict(SpellStats, itemIdEntity);

          const baseURI = getComponentValueStrict(
            ItemsBaseURI,
            singletonEntity,
          ).uri;

          // ERC1155 tables use tokenId as key (same numeric value, different key name)
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: spellId },
          );
          const tokenURI = getComponentValueStrict(
            ItemsTokenURI,
            tokenIdEntity,
          ).uri;

          // Try to fetch metadata, but don't fail if it's unavailable
          let metadata = { name: `Spell #${spellId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`Failed to fetch metadata for spell ${spellId}:`, e);
          }

          return {
            ...metadata,
            effects: spellStats.effects,
            itemType: itemTemplate.itemType,
            maxDamage: spellStats.maxDamage,
            minDamage: spellStats.minDamage,
            minLevel: spellStats.minLevel,
            price: itemTemplate.price,
            rarity: Number(itemTemplate.rarity) as Rarity,
            tokenId: spellId.toString(),
            statRestrictions: {
              minAgility: statRestrictions.minAgility,
              minIntelligence: statRestrictions.minIntelligence,
              minStrength: statRestrictions.minStrength,
            },
          } as SpellTemplate;
        }),
      );

      return allSpellTemplates;
    },
    [Items, ItemsBaseURI, ItemsTokenURI, SpellStats, StatRestrictions],
  );

  const fetchAllWeapons = useCallback(
    async (allWeaponIds: bigint[]) => {
      const allWeaponTemplates = await Promise.all(
        allWeaponIds.map(async weaponId => {
          const itemIdEntity = encodeEntity(
            { itemId: 'uint256' },
            { itemId: weaponId },
          );

          const statRestrictions = getComponentValueStrict(
            StatRestrictions,
            itemIdEntity,
          );
          const itemTemplate = getComponentValueStrict(Items, itemIdEntity);
          const weaponStats = getComponentValueStrict(
            WeaponStats,
            itemIdEntity,
          );

          const baseURI = getComponentValueStrict(
            ItemsBaseURI,
            singletonEntity,
          ).uri;

          // ERC1155 tables use tokenId as key (same numeric value, different key name)
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: weaponId },
          );
          const tokenURI = getComponentValueStrict(
            ItemsTokenURI,
            tokenIdEntity,
          ).uri;

          // Try to fetch metadata, but don't fail if it's unavailable
          let metadata = { name: `Weapon #${weaponId}`, description: '', image: '' };
          try {
            const fullUri = `${baseURI}${tokenURI}`;
            if (isTextOnlyUri(tokenURI) || isTextOnlyUri(fullUri)) {
              metadata = await fetchMetadataFromUri(tokenURI || fullUri);
            } else {
              metadata = await fetchMetadataFromUri(uriToHttp(fullUri)[0]);
            }
          } catch (e) {
            console.warn(`Failed to fetch metadata for weapon ${weaponId}:`, e);
          }

          return {
            ...metadata,
            agiModifier: weaponStats.agiModifier,
            effects: weaponStats.effects,
            hpModifier: weaponStats.hpModifier,
            itemType: itemTemplate.itemType,
            intModifier: weaponStats.intModifier,
            maxDamage: weaponStats.maxDamage,
            minDamage: weaponStats.minDamage,
            minLevel: weaponStats.minLevel,
            price: itemTemplate.price,
            rarity: Number(itemTemplate.rarity) as Rarity,
            statRestrictions: {
              minAgility: statRestrictions.minAgility,
              minIntelligence: statRestrictions.minIntelligence,
              minStrength: statRestrictions.minStrength,
            },
            strModifier: weaponStats.strModifier,
            tokenId: weaponId.toString(),
          } as WeaponTemplate;
        }),
      );

      return allWeaponTemplates;
    },
    [Items, ItemsBaseURI, ItemsTokenURI, StatRestrictions, WeaponStats],
  );

  useEffect(() => {
    (async () => {
      if (!isSynced || allItemEntities.length === 0) return;

      try {
        const allItemIds = allItemEntities
          .map(entity => {
            const itemTemplate = getComponentValue(Items, entity);
            if (!itemTemplate) return null;
            const { itemId } = decodeEntity({ itemId: 'uint256' }, entity);
            const itemTypeNum = Number(itemTemplate.itemType);
            return {
              itemType: itemTypeNum,
              itemId,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (allItemIds.length > 0) {
          const allArmorIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Armor)
            .map(({ itemId }) => itemId);
          const allWeaponIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Weapon)
            .map(({ itemId }) => itemId);
          const allConsumableIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Consumable)
            .map(({ itemId }) => itemId);
          const allSpellIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Spell)
            .map(({ itemId }) => itemId);

          const [armorResult, weaponResult, consumableResult, spellResult] =
            await Promise.allSettled([
              fetchAllArmor(allArmorIds),
              fetchAllWeapons(allWeaponIds),
              fetchAllConsumables(allConsumableIds),
              fetchAllSpells(allSpellIds),
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
    allItemEntities,
    fetchAllArmor,
    fetchAllConsumables,
    fetchAllSpells,
    fetchAllWeapons,
    isSynced,
    Items,
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
