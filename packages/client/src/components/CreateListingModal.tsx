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
  Spinner,
  Stack,
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
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { inventoryArmor, inventorySpells, inventoryWeapons } = useCharacter();

  const [itemListingFilter, setItemListingFilter] =
    useState<ItemListingFilterOptions>(ItemListingFilterOptions.AllItems);
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemFilterOptions>(
    ItemFilterOptions.All,
  );
  const [query, setQuery] = useState('');

  const filterAndSearchItems = useCallback(
    (items: (Armor | Spell | Weapon)[]) => {
      const filteredItems = items.filter(entry => {
        switch (itemTypeFilter) {
          case ItemFilterOptions.Armor:
            return entry.itemType == ItemType.Armor;
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
  }, [armorTemplates, filterAndSearchItems, spellTemplates, weaponTemplates]);

  const allInventoryItems = useMemo(() => {
    const unfilteredInventory = [
      ...inventoryArmor,
      ...inventorySpells,
      ...inventoryWeapons,
    ];
    return filterAndSearchItems(unfilteredInventory);
  }, [inventoryArmor, filterAndSearchItems, inventorySpells, inventoryWeapons]);

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
            <Stack
              alignItems="center"
              direction={{ base: 'column', md: 'row' }}
              spacing={{ base: 4, md: 8 }}
            >
              <Text size="xs">Filter by:</Text>
              <HStack>
                {Object.keys(ItemFilterOptions).map(k => {
                  return (
                    <Button
                      key={`item-type-filter-${k}`}
                      onClick={() =>
                        setItemTypeFilter(
                          ItemFilterOptions[
                            k as keyof typeof ItemFilterOptions
                          ],
                        )
                      }
                      size={{ base: 'xs', sm: 'sm' }}
                      variant={
                        itemTypeFilter ===
                        ItemFilterOptions[k as keyof typeof ItemFilterOptions]
                          ? 'solid'
                          : 'outline'
                      }
                    >
                      {ItemFilterOptions[k as keyof typeof ItemFilterOptions]}
                    </Button>
                  );
                })}
              </HStack>
            </Stack>
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
