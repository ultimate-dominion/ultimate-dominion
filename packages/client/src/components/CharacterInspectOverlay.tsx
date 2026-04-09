/**
 * CharacterInspectOverlay — Full-screen WoW-style character inspection.
 *
 * Mobile: vertical stack with horizontal slot tray.
 * Desktop: three-column paper doll (slots | character | slots).
 * Slides up from bottom. Character auto-rotates on open.
 */

import {
  Box,
  Center,
  Grid,
  HStack,
  IconButton,
  Modal,
  ModalContent,
  ModalOverlay,
  Show,
  Text,
  VStack,
} from '@chakra-ui/react';
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { IoClose } from 'react-icons/io5';

import { EmptySlot, FilledSlot, type SlotItem } from './EquippedLoadout';
import { ItemEquipModal } from './ItemEquipModal';
import { ItemConsumeModal } from './ItemConsumeModal';
import { getRarityColor } from '../utils/rarityHelpers';
import {
  type Armor,
  type Character,
  type Consumable,
  ItemType,
  type Spell,
  type Weapon,
} from '../utils/types';
import type { EquippedItemSlot } from './pretext/game/CharacterViewer';

const CharacterViewer = lazy(() =>
  import('./pretext/game/CharacterViewer').then(m => ({ default: m.CharacterViewer })),
);

// ── Constants ─────────────────────────────────────────────────────────

const INSPECT_SLOT_SIZE = '64px';

// ── Props ─────────────────────────────────────────────────────────────

export interface CharacterInspectOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  equippedArmor: Armor[];
  equippedWeapons: Weapon[];
  equippedSpells: Spell[];
  equippedConsumables: Consumable[];
}

// ── Stats strip ────────────────────────────────────────────────────────

function StatChip({ label, base, bonus }: { label: string; base: number; bonus: number }) {
  return (
    <VStack spacing={0} minW="48px">
      <Text fontFamily="mono" fontSize="9px" fontWeight={700} color="#5A5040" textTransform="uppercase">
        {label}
      </Text>
      <HStack spacing={1}>
        <Text fontFamily="mono" fontSize="14px" fontWeight={600} color="#E8DCC8">
          {base}
        </Text>
        {bonus !== 0 && (
          <Text fontFamily="mono" fontSize="11px" fontWeight={600} color={bonus > 0 ? '#5A8A3E' : '#B83A2A'}>
            {bonus > 0 ? '+' : ''}{bonus}
          </Text>
        )}
      </HStack>
    </VStack>
  );
}

function StatsStrip({ character, equippedArmor, equippedWeapons, equippedSpells, equippedConsumables }: {
  character: Character;
  equippedArmor: Armor[];
  equippedWeapons: Weapon[];
  equippedSpells: Spell[];
  equippedConsumables: Consumable[];
}) {
  const baseStr = Number(character.baseStats?.strength ?? character.strength ?? 0);
  const baseAgi = Number(character.baseStats?.agility ?? character.agility ?? 0);
  const baseInt = Number(character.baseStats?.intelligence ?? character.intelligence ?? 0);
  const baseHp = Number(character.baseStats?.maxHp ?? character.maxHp ?? 0);

  // Sum equipment bonuses
  const allEquipped = [...equippedArmor, ...equippedWeapons, ...equippedSpells, ...equippedConsumables] as SlotItem[];
  let strBonus = 0, agiBonus = 0, intBonus = 0, hpBonus = 0, armBonus = 0;
  for (const item of allEquipped) {
    if ('strModifier' in item) strBonus += Number(item.strModifier ?? 0);
    if ('agiModifier' in item) agiBonus += Number(item.agiModifier ?? 0);
    if ('intModifier' in item) intBonus += Number(item.intModifier ?? 0);
    if ('hpModifier' in item) hpBonus += Number(item.hpModifier ?? 0);
    if ('armorModifier' in item) armBonus += Number(item.armorModifier ?? 0);
  }

  const combatRating = (baseStr + strBonus) + (baseAgi + agiBonus) + (baseInt + intBonus) + armBonus;

  return (
    <VStack spacing={2} w="100%" pt={4}>
      <HStack spacing={1}>
        <Text fontFamily="mono" fontSize="10px" fontWeight={700} color="#5A5040" textTransform="uppercase" letterSpacing="wider">
          Battle Readiness
        </Text>
        <Text fontFamily="heading" fontSize="18px" fontWeight={700} color="#D4A54A">
          {combatRating}
        </Text>
      </HStack>
      <HStack spacing={4} justify="center" flexWrap="wrap">
        <StatChip label="STR" base={baseStr} bonus={strBonus} />
        <StatChip label="AGI" base={baseAgi} bonus={agiBonus} />
        <StatChip label="INT" base={baseInt} bonus={intBonus} />
        <StatChip label="HP" base={baseHp} bonus={hpBonus} />
        <StatChip label="ARM" base={0} bonus={armBonus} />
      </HStack>
    </VStack>
  );
}

// ── Slot column (desktop) ──────────────────────────────────────────────

function SlotBox({
  item,
  label,
  onClickItem,
}: {
  item: SlotItem | null;
  label: string;
  onClickItem: (item: SlotItem) => void;
}) {
  return (
    <VStack spacing={1}>
      {item ? (
        <FilledSlot
          item={item}
          slotNumber={0}
          onClick={() => onClickItem(item)}
          isInBattle={false}
          size={INSPECT_SLOT_SIZE}
        />
      ) : (
        <EmptySlot label={label} size={INSPECT_SLOT_SIZE} />
      )}
      <Text fontFamily="mono" fontSize="8px" fontWeight={700} color="#5A5040" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
    </VStack>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export function CharacterInspectOverlay({
  isOpen,
  onClose,
  character,
  equippedArmor,
  equippedWeapons,
  equippedSpells,
  equippedConsumables,
}: CharacterInspectOverlayProps) {
  const [selectedItem, setSelectedItem] = useState<SlotItem | null>(null);

  const handleItemClick = useCallback((item: SlotItem) => {
    setSelectedItem(item);
  }, []);

  const handleCloseItemModal = useCallback(() => {
    setSelectedItem(null);
  }, []);

  // Build equipment items for CharacterViewer bone attachment
  const viewerEquipment: EquippedItemSlot[] = useMemo(() => {
    const items: EquippedItemSlot[] = [];
    if (equippedWeapons[0]) items.push({ name: equippedWeapons[0].name, socket: 'hand_R.socket' });
    if (equippedWeapons[1]) items.push({ name: equippedWeapons[1].name, socket: 'hand_L.socket' });
    if (equippedArmor[0]) items.push({ name: equippedArmor[0].name, socket: 'chest.socket' });
    return items;
  }, [equippedWeapons, equippedArmor]);

  // Action slots (weapons + spells + consumables)
  const actionSlots = useMemo(
    () => [...equippedWeapons, ...equippedSpells, ...equippedConsumables] as SlotItem[],
    [equippedWeapons, equippedSpells, equippedConsumables],
  );

  const isConsumable = selectedItem?.itemType === ItemType.Consumable;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="full" motionPreset="slideInBottom">
        <ModalOverlay bg="rgba(10,9,8,0.92)" backdropFilter="blur(4px)" />
        <ModalContent
          bg="#0A0908"
          borderRadius={0}
          clipPath="none"
          m={0}
          maxH="100dvh"
          maxW="100vw"
          overflow="auto"
          position="relative"
        >
          {/* Close button */}
          <IconButton
            aria-label="Close"
            icon={<IoClose />}
            position="absolute"
            top={4}
            right={4}
            zIndex={10}
            variant="dark"
            size="sm"
            onClick={onClose}
          />

          {/* Character name header */}
          <VStack spacing={0} pt={6} pb={2}>
            <Text fontFamily="heading" fontSize="22px" fontWeight={700} color="#D4A54A">
              {character.name}
            </Text>
            <Text fontFamily="mono" fontSize="11px" color="#8A7E6A">
              Level {Number(character.level)}
            </Text>
          </VStack>

          {/* Desktop: 3-column paper doll */}
          <Show above="lg">
            <Grid templateColumns="100px 1fr 100px" gap={6} px={8} py={4} maxW="800px" mx="auto" w="100%">
              {/* Left: Armor */}
              <VStack spacing={4} justify="center">
                <SlotBox
                  item={equippedArmor[0] ?? null}
                  label="Armor"
                  onClickItem={handleItemClick}
                />
              </VStack>

              {/* Center: Character */}
              <Suspense fallback={<Center h="380px"><Text color="#8A7E6A">Loading...</Text></Center>}>
                <CharacterViewer
                  race={character.race}
                  height={380}
                  cellSize={3}
                  autoReveal
                  equippedItems={viewerEquipment}
                />
              </Suspense>

              {/* Right: Weapons/Spells/Consumables */}
              <VStack spacing={4} justify="center">
                {[0, 1, 2, 3].map(i => (
                  <SlotBox
                    key={i}
                    item={actionSlots[i] ?? null}
                    label={i < 2 ? `Slot ${i + 1}` : i === 2 ? 'Spell' : 'Item'}
                    onClickItem={handleItemClick}
                  />
                ))}
              </VStack>
            </Grid>
          </Show>

          {/* Mobile: stacked layout */}
          <Show below="lg">
            <VStack spacing={3} px={4} py={2}>
              {/* Character viewer */}
              <Suspense fallback={<Center h="280px"><Text color="#8A7E6A">Loading...</Text></Center>}>
                <CharacterViewer
                  race={character.race}
                  height={280}
                  cellSize={3}
                  autoReveal
                  equippedItems={viewerEquipment}
                />
              </Suspense>

              {/* Horizontal slot tray */}
              <HStack
                spacing={2}
                overflowX="auto"
                w="100%"
                py={2}
                px={1}
                justify="center"
                css={{
                  '&::-webkit-scrollbar': { height: '4px' },
                  '&::-webkit-scrollbar-thumb': { background: '#3A3228', borderRadius: '2px' },
                }}
              >
                {/* Armor slot */}
                <VStack spacing={0} flexShrink={0}>
                  {equippedArmor[0] ? (
                    <FilledSlot
                      item={equippedArmor[0]}
                      slotNumber={0}
                      onClick={() => handleItemClick(equippedArmor[0])}
                      isInBattle={false}
                      size="52px"
                    />
                  ) : (
                    <EmptySlot label="Armor" size="52px" />
                  )}
                  <Text fontFamily="mono" fontSize="7px" fontWeight={700} color="#5A5040" mt={0.5}>ARM</Text>
                </VStack>

                {/* Divider */}
                <Box bg="#3A3428" h="40px" w="1px" flexShrink={0} />

                {/* Action slots */}
                {[0, 1, 2, 3].map(i => (
                  <VStack key={i} spacing={0} flexShrink={0}>
                    {actionSlots[i] ? (
                      <FilledSlot
                        item={actionSlots[i]}
                        slotNumber={i + 1}
                        onClick={() => handleItemClick(actionSlots[i])}
                        isInBattle={false}
                        size="52px"
                      />
                    ) : (
                      <EmptySlot label="Empty" size="52px" />
                    )}
                    <Text fontFamily="mono" fontSize="7px" fontWeight={700} color="#5A5040" mt={0.5}>{i + 1}</Text>
                  </VStack>
                ))}
              </HStack>
            </VStack>
          </Show>

          {/* Stats strip — shared between layouts */}
          <Box px={4} pb={8}>
            <StatsStrip
              character={character}
              equippedArmor={equippedArmor}
              equippedWeapons={equippedWeapons}
              equippedSpells={equippedSpells}
              equippedConsumables={equippedConsumables}
            />
          </Box>
        </ModalContent>
      </Modal>

      {/* Item modal — reuse existing equip/consume flows */}
      {selectedItem && !isConsumable && (
        <ItemEquipModal
          isOpen
          isEquipped
          onClose={handleCloseItemModal}
          {...(selectedItem as Armor | Spell | Weapon)}
        />
      )}
      {selectedItem && isConsumable && (
        <ItemConsumeModal
          isOpen
          isEquipped
          onClose={handleCloseItemModal}
          {...(selectedItem as Consumable)}
        />
      )}
    </>
  );
}
