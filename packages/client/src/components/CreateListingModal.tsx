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
import { Entity } from '@latticexyz/recs';
import FuzzySearch from 'fuzzy-search';
import { useCallback, useMemo, useState } from 'react';
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
    useState<ItemListingFilterOptions>(ItemListingFilterOptions.AllItems);
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

      const searcher = new FuzzySearch(filteredItems, ['name', 'description']);
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
        balance: '0',
        itemId: zeroHash as Entity,
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
    return filterAndSearchItems(unfilteredInventory);
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
        <ModalHeader>
          <Text>Create Listing</Text>
          <HStack alignItems="flex-start" mt={4} w="100%">
            {Object.keys(ItemListingFilterOptions).map(k => {
              return (
                <Button
                  key={`item-type-filter-${k}`}
                  onClick={() =>
                    setItemListingFilter(
                      ItemListingFilterOptions[
                        k as keyof typeof ItemListingFilterOptions
                      ],
                    )
                  }
                  size={{ base: 'xs', sm: 'sm' }}
                  variant={
                    itemListingFilter ===
                    ItemListingFilterOptions[
                      k as keyof typeof ItemListingFilterOptions
                    ]
                      ? 'solid'
                      : 'outline'
                  }
                >
                  {
                    ItemListingFilterOptions[
                      k as keyof typeof ItemListingFilterOptions
                    ]
                  }
                </Button>
              );
            })}
          </HStack>
          <Text mt={2} size="xs">
            # of items:{' '}
            {itemListingFilter === ItemListingFilterOptions.AllItems
              ? allItems.length
              : allInventoryItems.length}
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={4}>
          <VStack gap={5}>
            <InputGroup w="100%">
              <InputLeftElement h="100%" pointerEvents="none">
                <FaSearch />
              </InputLeftElement>
              <Input
                onChange={e => setQuery(e.target.value)}
                placeholder="Search"
                value={query}
              />
            </InputGroup>
            <HStack
              alignItems="center"
              alignSelf="start"
              justifyContent="space-between"
              w="100%"
            >
              <Text size="xs" w="40%">
                Filter by:
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
            {isLoadingItemTemplates ? (
              <Spinner my={12} size="lg" />
            ) : (
              <VStack alignItems="flex-start" w="100%">
                {itemListingFilter === ItemListingFilterOptions.AllItems &&
                  allItems.map(item => (
                    <ItemCard
                      key={`item-${item.tokenId}`}
                      onClick={() => navigate(`${ITEM_PATH}${item.tokenId}`)}
                      showBalance={false}
                      {...item}
                    />
                  ))}

                {itemListingFilter === ItemListingFilterOptions.Inventory &&
                  allInventoryItems.map(item => (
                    <ItemCard
                      key={`item-${item.tokenId}`}
                      onClick={() => navigate(`${ITEM_PATH}${item.tokenId}`)}
                      {...item}
                    />
                  ))}
              </VStack>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
