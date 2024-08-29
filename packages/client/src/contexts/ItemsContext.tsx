import { getComponentValueStrict, Has, runQuery } from '@latticexyz/recs';
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
import { fetchMetadataFromUri, uriToHttp } from '../utils/helpers';
import {
  type ArmorTemplate,
  ItemType,
  type WeaponTemplate,
} from '../utils/types';
import { useMUD } from './MUDContext';

type ItemsContextType = {
  armorTemplates: ArmorTemplate[];
  weaponTemplates: WeaponTemplate[];
  isLoading: boolean;
};

const ItemsContext = createContext<ItemsContextType>({
  armorTemplates: [],
  weaponTemplates: [],
  isLoading: false,
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
      Items,
      ItemsBaseURI,
      ItemsTokenURI,
      StatRestrictions,
      WeaponStats,
    },
    isSynced,
  } = useMUD();

  const [armorTemplates, setArmorTemplates] = useState<ArmorTemplate[]>([]);
  const [weaponTemplates, setWeaponTemplates] = useState<WeaponTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAllArmor = useCallback(
    async (allArmorIds: bigint[]) => {
      const allArmorTemplates = await Promise.all(
        allArmorIds.map(async armorId => {
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: armorId },
          );

          const statRestrictions = getComponentValueStrict(
            StatRestrictions,
            tokenIdEntity,
          );
          const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);
          const armorStats = getComponentValueStrict(ArmorStats, tokenIdEntity);

          const baseURI = getComponentValueStrict(
            ItemsBaseURI,
            singletonEntity,
          ).uri;

          const tokenURI = getComponentValueStrict(
            ItemsTokenURI,
            tokenIdEntity,
          ).uri;

          const metadata = await fetchMetadataFromUri(
            uriToHttp(`${baseURI}${tokenURI}`)[0],
          );

          return {
            ...metadata,
            agiModifier: armorStats.agiModifier.toString(),
            armorModifier: armorStats.armorModifier.toString(),
            hpModifier: armorStats.hpModifier.toString(),
            intModifier: armorStats.intModifier.toString(),
            itemType: itemTemplate.itemType,
            minLevel: armorStats.minLevel.toString(),
            statRestrictions: {
              minAgility: statRestrictions.minAgility.toString(),
              minIntelligence: statRestrictions.minIntelligence.toString(),
              minStrength: statRestrictions.minStrength.toString(),
            },
            strModifier: armorStats.strModifier.toString(),
            tokenId: armorId.toString(),
          } as ArmorTemplate;
        }),
      );

      return allArmorTemplates;
    },
    [ArmorStats, Items, ItemsBaseURI, ItemsTokenURI, StatRestrictions],
  );

  const fetchAllWeapons = useCallback(
    async (allWeaponIds: bigint[]) => {
      const allWeaponTemplates = await Promise.all(
        allWeaponIds.map(async weaponId => {
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: weaponId },
          );

          const statRestrictions = getComponentValueStrict(
            StatRestrictions,
            tokenIdEntity,
          );
          const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);
          const weaponStats = getComponentValueStrict(
            WeaponStats,
            tokenIdEntity,
          );

          const baseURI = getComponentValueStrict(
            ItemsBaseURI,
            singletonEntity,
          ).uri;

          const tokenURI = getComponentValueStrict(
            ItemsTokenURI,
            tokenIdEntity,
          ).uri;

          const metadata = await fetchMetadataFromUri(
            uriToHttp(`${baseURI}${tokenURI}`)[0],
          );

          return {
            ...metadata,
            agiModifier: weaponStats.agiModifier.toString(),
            effects: weaponStats.effects,
            hpModifier: weaponStats.hpModifier.toString(),
            itemType: itemTemplate.itemType,
            intModifier: weaponStats.intModifier.toString(),
            maxDamage: weaponStats.maxDamage.toString(),
            minDamage: weaponStats.minDamage.toString(),
            minLevel: weaponStats.minLevel.toString(),
            statRestrictions: {
              minAgility: statRestrictions.minAgility.toString(),
              minIntelligence: statRestrictions.minIntelligence.toString(),
              minStrength: statRestrictions.minStrength.toString(),
            },
            strModifier: weaponStats.strModifier.toString(),
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
        const allItemIds = Array.from(runQuery([Has(Items)])).map(entity => {
          const itemTemplate = getComponentValueStrict(Items, entity);
          const { tokenId } = decodeEntity({ tokenId: 'uint256' }, entity);
          return {
            itemType: itemTemplate.itemType,
            tokenId,
          };
        });

        if (allItemIds.length > 0) {
          const allArmorIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Armor)
            .map(({ tokenId }) => tokenId);

          const _armor = await fetchAllArmor(allArmorIds);
          setArmorTemplates(_armor);

          const allWeaponIds = allItemIds
            .filter(({ itemType }) => itemType === ItemType.Weapon)
            .map(({ tokenId }) => tokenId);

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
  }, [fetchAllArmor, fetchAllWeapons, isSynced, Items, renderError]);

  return (
    <ItemsContext.Provider
      value={{
        armorTemplates,
        weaponTemplates,
        isLoading,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
};

export const useItems = (): ItemsContextType => useContext(ItemsContext);
