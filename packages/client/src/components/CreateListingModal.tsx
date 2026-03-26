import {
  Button,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import FuzzySearch from 'fuzzy-search';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { ITEM_PATH } from '../Routes';
import {
  type Armor,
  type Consumable,
  ItemFilterOptions,
  ItemType,
  type Spell,
  type Weapon,
} from '../utils/types';

import { ItemCard } from './ItemCard';
import { PolygonalCard } from './PolygonalCard';

enum ItemListingFilterOptions {
  AllItems = 'All Items',
  Inventory = 'Inventory',
}

type CreateListingModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const CreateListingModal: React.FC<CreateListingModalProps> = ({
  isOpen,
  onClose,
}): JSX.Element => {
  const { t } = useTranslation('ui');
  const navigate = useNavigate();
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const {
    inventoryArmor,
    inventoryConsumables,
    inventorySpells,
    inventoryWeapons,
  } = useCharacter();

  const [itemListingFilter, setItemListingFilter] =
    useState<ItemListingFilterOptions>(ItemListingFilterOptions.Inventory);
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemFilterOptions>(
    ItemFilterOptions.All,
  );
  const [query, setQuery] = useState('');

  const filterAndSearchItems = useCallback(
    (items: (Armor | Consumable | Spell | Weapon)[]) => {
      const filteredItems = items.filter(entry => {
        switch (itemTypeFilter) {
          case ItemFilterOptions.Armor:
            return entry.itemType == ItemType.Armor;
          case ItemFilterOptions.Consumable:
            return entry.itemType == ItemType.Consumable;
          case ItemFilterOptions.Spell:
            return entry.itemType == ItemType.Spell;
          case ItemFilterOptions.Weapon:
            return entry.itemType == ItemType.Weapon;
          default:
            return true;
        }
      });

      const searcher = new FuzzySearch(filteredItems, ['name']);
      return searcher.search(query);
    },
    [itemTypeFilter, query],
  );

  const allItems = useMemo(() => {
    const allItemTemplates = [
      ...armorTemplates,
      ...consumableTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ];

    const unfilteredTemplates = allItemTemplates.map(item => {
      return {
        ...item,
        balance: BigInt(0),
        itemId: zeroHash as string,
        owner: zeroAddress,
      };
    });

    return filterAndSearchItems(unfilteredTemplates);
  }, [
    armorTemplates,
    consumableTemplates,
    filterAndSearchItems,
    spellTemplates,
    weaponTemplates,
  ]);

  const allInventoryItems = useMemo(() => {
    const unfilteredInventory = [
      ...inventoryArmor,
      ...inventoryConsumables,
      ...inventorySpells,
      ...inventoryWeapons,
    ];
    const filtered = filterAndSearchItems(unfilteredInventory);
    // Sort by rarity (highest first) so best items are prominent
    return filtered.sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));
  }, [
    inventoryArmor,
    inventoryConsumables,
    filterAndSearchItems,
    inventorySpells,
    inventoryWeapons,
  ]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader px={8}>
          <Text>{t('createListing.title')}</Text>
          <HStack justifyContent="center" mt={4} w="100%">
            {Object.keys(ItemListingFilterOptions).map(k => {
              return (
                <Button
                  bgColor={
                    itemListingFilter ===
                    ItemListingFilterOptions[
                      k as keyof typeof ItemListingFilterOptions
                    ]
                      ? 'grey500'
                      : undefined
                  }
                  color={
                    itemListingFilter ===
                    ItemListingFilterOptions[
                      k as keyof typeof ItemListingFilterOptions
                    ]
                      ? 'white'
                      : undefined
                  }
                  key={`item-listing-filter-${k}`}
                  onClick={() =>
                    setItemListingFilter(
                      ItemListingFilterOptions[
                        k as keyof typeof ItemListingFilterOptions
                      ],
                    )
                  }
                  size={{ base: 'xs', sm: 'sm' }}
                  variant="white"
                >
                  {k === 'AllItems' ? t('createListing.allItems') : t('createListing.inventory')}
                </Button>
              );
            })}
          </HStack>
          <Text mt={2} size="xs">
            {t('createListing.numItems')}{' '}
            {itemListingFilter === ItemListingFilterOptions.AllItems
              ? allItems.length
              : allInventoryItems.length}
          </Text>
          <InputGroup mt={4} w="100%">
            <InputLeftElement h="100%" pointerEvents="none">
              <FaSearch />
            </InputLeftElement>
            <Input
              onChange={e => setQuery(e.target.value)}
              placeholder={t('shop.search')}
              value={query}
            />
          </InputGroup>
          <HStack
            alignItems="center"
            alignSelf="start"
            justifyContent="space-between"
            mt={4}
            w="100%"
          >
            <Text size="xs" w="40%">
              {t('createListing.filterBy')}
            </Text>
            <Select
              onChange={e =>
                setItemTypeFilter(e.target.value as ItemFilterOptions)
              }
              size="sm"
              value={itemTypeFilter}
            >
              {Object.keys(ItemFilterOptions).map(k => {
                return (
                  <option key={`item-type-filter-${k}`} value={k}>
                    {ItemFilterOptions[k as keyof typeof ItemFilterOptions]}
                  </option>
                );
              })}
            </Select>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={0} px={{ base: 3, sm: 8 }}>
          <VStack pb={{ base: 3, sm: 8 }} spacing={0}>
            {isLoadingItemTemplates ? (
              <Spinner my={12} size="lg" />
            ) : (
              <VStack alignItems="flex-start" w="100%">
                {itemListingFilter === ItemListingFilterOptions.AllItems &&
                  allItems.map(item => (
                    <ItemCard
                      key={`item-${item.tokenId}`}
                      onClick={() => navigate(`${ITEM_PATH}/${item.tokenId}`)}
                      showBalance={false}
                      {...item}
                    />
                  ))}

                {itemListingFilter === ItemListingFilterOptions.Inventory &&
                  allInventoryItems.map(item => (
                    <ItemCard
                      key={`item-${item.tokenId}`}
                      onClick={() => navigate(`${ITEM_PATH}/${item.tokenId}`)}
                      {...item}
                    />
                  ))}
              </VStack>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} variant="ghost">
            {t('common.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
