import { Box, Center, HStack, Text, Tooltip, VStack, useDisclosure } from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { getStatSymbol, removeEmoji } from '../utils/helpers';
import { ItemAsciiIcon } from './ItemAsciiIcon';
import { getRarityColor } from '../utils/rarityHelpers';
import { type Consumable } from '../utils/types';

import { ItemConsumeModal } from './ItemConsumeModal';

const TILE_SIZE = '40px';

/** Only show items that actually work from the world map:
 *  - Health potions (hpRestoreAmount > 0)
 *  - Stat buffs with time-based effects (validTime > 0)
 *  Filters out: vendor trash, Smoke Bomb (combat-only), Antidote (broken) */
const isWorldUsable = (c: Consumable): boolean =>
  c.hpRestoreAmount > BigInt(0) || c.validTime > BigInt(0);

const getTooltipLabel = (c: Consumable): string => {
  const name = removeEmoji(c.name);
  if (c.hpRestoreAmount > BigInt(0)) return `${name} — HP +${c.hpRestoreAmount}`;
  const parts: string[] = [];
  if (c.strModifier !== BigInt(0)) parts.push(`STR ${getStatSymbol(c.strModifier.toString())}${c.strModifier}`);
  if (c.agiModifier !== BigInt(0)) parts.push(`AGI ${getStatSymbol(c.agiModifier.toString())}${c.agiModifier}`);
  if (c.intModifier !== BigInt(0)) parts.push(`INT ${getStatSymbol(c.intModifier.toString())}${c.intModifier}`);
  return parts.length > 0 ? `${name} — ${parts.join(' ')}` : `${name} — Buff`;
};

export const ConsumableQuickUse = (): JSX.Element | null => {
  const { t } = useTranslation('ui');
  const { character, inventoryConsumables, equippedConsumables } = useCharacter();
  const { isSpawned } = useMap();

  const {
    isOpen: isConsumeModalOpen,
    onOpen: onOpenConsumeModal,
    onClose: onCloseConsumeModal,
  } = useDisclosure();

  const [selectedConsumable, setSelectedConsumable] = useState<Consumable | null>(null);
  const [selectedIsEquipped, setSelectedIsEquipped] = useState(false);

  const usableConsumables = useMemo(() => {
    // Combine equipped + inventory, dedup by tokenId (equipped come first), filter out vendor trash
    const seen = new Set<string>();
    const result: { consumable: Consumable; isEquipped: boolean }[] = [];

    for (const c of equippedConsumables) {
      if (!seen.has(c.tokenId) && isWorldUsable(c)) {
        seen.add(c.tokenId);
        result.push({ consumable: c, isEquipped: true });
      }
    }
    for (const c of inventoryConsumables) {
      if (!seen.has(c.tokenId) && isWorldUsable(c)) {
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

  return (
    <VStack spacing={0} w="100%">
      {usableConsumables.length > 0 ? (
        <HStack spacing={1.5} rowGap={1.5} justify="center" flexWrap="wrap" w="100%">
          {usableConsumables.map(({ consumable, isEquipped }) => {
            const name = removeEmoji(consumable.name);
            const rarityColor = getRarityColor(consumable.rarity);

            return (
              <Tooltip key={consumable.tokenId} hasArrow label={getTooltipLabel(consumable)} placement="top">
                <Box
                  cursor="pointer"
                  onClick={() => onUse(consumable, isEquipped)}
                  position="relative"
                  _hover={{ transform: 'scale(1.1)' }}
                  transition="transform 0.15s"
                >
                  <Center
                    border="1.5px solid"
                    borderColor={rarityColor}
                    borderRadius="md"
                    h={TILE_SIZE}
                    w={TILE_SIZE}
                  >
                    <ItemAsciiIcon
                      name={consumable.name}
                      itemType={consumable.itemType}
                      rarity={consumable.rarity}
                      size="28px"
                    />
                  </Center>
                  {/* Quantity badge */}
                  <Center
                    bg="#1C1814"
                    border="1px solid"
                    borderColor="#3A3428"
                    borderRadius="full"
                    fontSize="9px"
                    fontFamily="mono"
                    fontWeight={700}
                    color="#8A7E6A"
                    h="14px"
                    minW="14px"
                    position="absolute"
                    right="-4px"
                    bottom="-4px"
                    px="2px"
                  >
                    {consumable.balance.toString()}
                  </Center>
                </Box>
              </Tooltip>
            );
          })}
        </HStack>
      ) : (
        <Text color="#5A5040" fontSize="xs" fontStyle="italic">
          {t('consumableQuickUse.noConsumables')}
        </Text>
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
