import {
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { ITEM_PATH } from '../Routes';
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

  const allItems = useMemo(() => {
    const allItemTemplates = [
      ...armorTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ];
    return allItemTemplates.map(item => {
      return {
        ...item,
        balance: '0',
        itemId: zeroHash as Entity,
        owner: zeroAddress,
      };
    });
  }, [armorTemplates, spellTemplates, weaponTemplates]);

  const allInventoryItems = useMemo(
    () => [...inventoryArmor, ...inventorySpells, ...inventoryWeapons],
    [inventoryArmor, inventorySpells, inventoryWeapons],
  );

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
