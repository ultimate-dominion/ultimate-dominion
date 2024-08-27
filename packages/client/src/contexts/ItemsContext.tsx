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
import {
  decodeArmorStats,
  decodeWeaponStats,
  fetchMetadataFromUri,
  uriToHttp,
} from '../utils/helpers';
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
    components: { Items, ItemsBaseURI, ItemsTokenURI },
    isSynced,
  } = useMUD();

  const [armorTemplates, setArmorTemplates] = useState<ArmorTemplate[]>([]);
  const [weaponTemplates, setWeaponTemplates] = useState<WeaponTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAllArmor = useCallback(
    async (allArmorIds: bigint[]) => {
      const fullArmor = await Promise.all(
        allArmorIds.map(async armorId => {
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: armorId },
          );

          const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);
          const decodedArmorStats = decodeArmorStats(itemTemplate.stats);

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
            agiModifier: decodedArmorStats.agiModifier,
            armorModifier: decodedArmorStats.armorModifier,
            hitPointModifier: decodedArmorStats.hitPointModifier,
            intModifier: decodedArmorStats.intModifier,
            minLevel: decodedArmorStats.minLevel,
            statRestrictions: {
              minAgility: decodedArmorStats.statRestrictions.minAgility,
              minIntelligence:
                decodedArmorStats.statRestrictions.minIntelligence,
              minStrength: decodedArmorStats.statRestrictions.minStrength,
            },
            strModifier: decodedArmorStats.strModifier,
            tokenId: armorId.toString(),
          } as ArmorTemplate;
        }),
      );

      return fullArmor;
    },
    [Items, ItemsBaseURI, ItemsTokenURI],
  );

  const fetchAllWeapons = useCallback(
    async (allWeaponIds: bigint[]) => {
      const fullWeapons = await Promise.all(
        allWeaponIds.map(async weaponId => {
          const tokenIdEntity = encodeEntity(
            { tokenId: 'uint256' },
            { tokenId: weaponId },
          );

          const itemTemplate = getComponentValueStrict(Items, tokenIdEntity);
          const decodedArmorStats = decodeWeaponStats(itemTemplate.stats);

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
            agiModifier: decodedArmorStats.agiModifier,
            hitPointModifier: decodedArmorStats.hitPointModifier,
            intModifier: decodedArmorStats.intModifier,
            maxDamage: decodedArmorStats.maxDamage,
            minDamage: decodedArmorStats.minDamage,
            minLevel: decodedArmorStats.minLevel,
            statRestrictions: {
              minAgility: decodedArmorStats.statRestrictions.minAgility,
              minIntelligence:
                decodedArmorStats.statRestrictions.minIntelligence,
              minStrength: decodedArmorStats.statRestrictions.minStrength,
            },
            strModifier: decodedArmorStats.strModifier,
            tokenId: weaponId.toString(),
          } as WeaponTemplate;
        }),
      );

      return fullWeapons;
    },
    [Items, ItemsBaseURI, ItemsTokenURI],
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
