import {
  getComponentValue,
  getComponentValueStrict,
  Has,
  runQuery,
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
          const statusEffectStats = consumableStats.effects
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
          }[];

          const statusEffectValidities = consumableStats.effects
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
          }[];

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

          const statRestrictions = getComponentValueStrict(
            StatRestrictions,
            itemIdEntity,
          );
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
      if (!isSynced) return;

      try {
        console.log('[DEBUG ItemsContext] isSynced:', isSynced);
        console.log('[DEBUG ItemsContext] Items component:', Items);

        const allItemEntities = Array.from(runQuery([Has(Items)]));
        console.log('[DEBUG ItemsContext] All item entities count:', allItemEntities.length);

        const allItemIds = allItemEntities.map(entity => {
          const itemTemplate = getComponentValueStrict(Items, entity);
          const { itemId } = decodeEntity({ itemId: 'uint256' }, entity);
          console.log('[DEBUG ItemsContext] Item:', { entity, itemId: itemId.toString(), itemType: itemTemplate.itemType });
          return {
            itemType: itemTemplate.itemType,
            itemId,
          };
        });

        console.log('[DEBUG ItemsContext] Total items found:', allItemIds.length);

        if (allItemIds.length > 0) {
          const allArmorIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Armor)
            .map(({ itemId }) => itemId);

          const _armor = await fetchAllArmor(allArmorIds);
          setArmorTemplates(_armor);

          const allConsumableIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Consumable)
            .map(({ itemId }) => itemId);

          const _consumables = await fetchAllConsumables(allConsumableIds);
          setConsumableTemplates(_consumables);

          const allSpellIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Spell)
            .map(({ itemId }) => itemId);

          const _spells = await fetchAllSpells(allSpellIds);
          setSpellTemplates(_spells);

          const allWeaponIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Weapon)
            .map(({ itemId }) => itemId);

          const _weapons = await fetchAllWeapons(allWeaponIds);
          setWeaponTemplates(_weapons);
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
