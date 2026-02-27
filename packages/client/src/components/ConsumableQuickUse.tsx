import { Box, Button, HStack, Text, VStack, useDisclosure } from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { DARK_INSET_SHADOW } from '../utils/theme';
import { getStatSymbol, removeEmoji } from '../utils/helpers';
import { type Consumable } from '../utils/types';

import { ItemConsumeModal } from './ItemConsumeModal';

const getEffectSummary = (c: Consumable): string => {
  if (c.hpRestoreAmount > BigInt(0)) return `HP +${c.hpRestoreAmount}`;
  const parts: string[] = [];
  if (c.strModifier !== BigInt(0)) parts.push(`STR ${getStatSymbol(c.strModifier.toString())}${c.strModifier}`);
  if (c.agiModifier !== BigInt(0)) parts.push(`AGI ${getStatSymbol(c.agiModifier.toString())}${c.agiModifier}`);
  if (c.intModifier !== BigInt(0)) parts.push(`INT ${getStatSymbol(c.intModifier.toString())}${c.intModifier}`);
  return parts.join(' ') || 'Buff';
};

export const ConsumableQuickUse = (): JSX.Element | null => {
  const { character, inventoryConsumables, equippedConsumables } = useCharacter();
  const { isSpawned } = useMap();

  const {
    isOpen: isConsumeModalOpen,
    onOpen: onOpenConsumeModal,
    onClose: onCloseConsumeModal,
  } = useDisclosure();

  const [selectedConsumable, setSelectedConsumable] = useState<Consumable | null>(null);
  const [selectedIsEquipped, setSelectedIsEquipped] = useState(false);

  const allConsumables = useMemo(() => {
    // Combine equipped + inventory, dedup by tokenId (equipped come first)
    const seen = new Set<string>();
    const result: { consumable: Consumable; isEquipped: boolean }[] = [];

    for (const c of equippedConsumables) {
      if (!seen.has(c.tokenId)) {
        seen.add(c.tokenId);
        result.push({ consumable: c, isEquipped: true });
      }
    }
    for (const c of inventoryConsumables) {
      if (!seen.has(c.tokenId)) {
        seen.add(c.tokenId);
        result.push({ consumable: c, isEquipped: false });
      }
    }
    return result;
  }, [equippedConsumables, inventoryConsumables]);

  const onUse = useCallback(
    (consumable: Consumable, isEquipped: boolean) => {
      setSelectedConsumable(consumable);
      setSelectedIsEquipped(isEquipped);
      onOpenConsumeModal();
    },
    [onOpenConsumeModal],
  );

  if (!character || !isSpawned) return null;

  const currentHp = character.currentHp < BigInt(0) ? BigInt(0) : character.currentHp;
  const hpPercent = (Number(currentHp) / Number(character.maxHp)) * 100;

  return (
    <VStack spacing={2} w="100%">
      <Text color="#5A5040" fontSize="2xs" fontWeight={700} letterSpacing="wider" textTransform="uppercase">
        Consumables
      </Text>

      {/* Compact HP bar */}
      <HStack w="100%" spacing={2}>
        <Text color="#8A7E6A" fontSize="2xs" fontWeight={700}>HP</Text>
        <Box
          bg="#14120F"
          borderRadius="sm"
          boxShadow={DARK_INSET_SHADOW}
          flex={1}
          h="6px"
          overflow="hidden"
        >
          <Box
            bg={hpPercent > 60 ? '#5A8A3E' : hpPercent > 30 ? '#C87A2A' : '#8B2020'}
            borderRadius="sm"
            h="100%"
            transition="width 0.5s ease"
            w={`${hpPercent}%`}
          />
        </Box>
        <Text color="#8A7E6A" fontFamily="mono" fontSize="2xs" fontWeight={700}>
          {currentHp.toString()}/{character.maxHp.toString()}
        </Text>
      </HStack>

      {allConsumables.length === 0 ? (
        <Text color="#5A5040" fontSize="xs" fontStyle="italic">
          No consumables. Visit a shop to stock up.
        </Text>
      ) : (
        <VStack spacing={1} w="100%">
          {allConsumables.map(({ consumable, isEquipped }) => (
            <HStack
              key={consumable.tokenId}
              justifyContent="space-between"
              w="100%"
              px={1}
            >
              <HStack spacing={2} flex={1} minW={0}>
                <Text color="#E8DCC8" fontSize="xs" fontWeight={600} isTruncated>
                  {removeEmoji(consumable.name)}
                </Text>
                <Text color="#5A5040" fontFamily="mono" fontSize="2xs">
                  x{consumable.balance.toString()}
                </Text>
                <Text color="#8A7E6A" fontSize="2xs">
                  {getEffectSummary(consumable)}
                </Text>
              </HStack>
              <Button
                onClick={() => onUse(consumable, isEquipped)}
                size="xs"
                variant="outline"
                flexShrink={0}
              >
                Use
              </Button>
            </HStack>
          ))}
        </VStack>
      )}

      {selectedConsumable && (
        <ItemConsumeModal
          {...selectedConsumable}
          isEquipped={selectedIsEquipped}
          isOpen={isConsumeModalOpen}
          onClose={onCloseConsumeModal}
        />
      )}
    </VStack>
  );
};
