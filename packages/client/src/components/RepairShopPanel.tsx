import {
  Box,
  Button,
  HStack,
  Progress,
  Text,
  Tooltip,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import { formatEther } from 'viem';
import { GiAnvilImpact } from 'react-icons/gi';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import {
  encodeCompositeKey,
  encodeUint256Key,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
import { PolygonalCard } from './PolygonalCard';

/** Repair cost per durability point by rarity (in wei) — must match constants.sol */
const REPAIR_COST_PER_POINT: Record<number, bigint> = {
  0: 50000000000000000n,     // 0.05 gold (R0)
  1: 250000000000000000n,    // 0.25 gold (R1)
  2: 750000000000000000n,    // 0.75 gold (R2)
  3: 1500000000000000000n,   // 1.5 gold (R3)
  4: 2500000000000000000n,   // 2.5 gold (R4)
};

interface DamagedItem {
  itemId: bigint;
  name: string;
  rarity: number;
  currentDurability: number;
  maxDurability: number;
  repairCost: bigint;
}

export const RepairShopPanel = (): JSX.Element | null => {
  const { character, equippedArmor, equippedWeapons, equippedSpells } = useCharacter();
  const { systemCalls: { repairItem } } = useMUD();
  const toast = useToast();
  const { t } = useTranslation('ui');
  const [repairing, setRepairing] = useState<string | null>(null);

  const charDurTable = useGameTable('CharacterItemDurability');
  const itemDurTable = useGameTable('ItemDurability');

  const damagedItems: DamagedItem[] = useMemo(() => {
    if (!character) return [];
    const allEquipped = [...equippedArmor, ...equippedWeapons, ...equippedSpells];
    const items: DamagedItem[] = [];

    for (const item of allEquipped) {
      const durKey = encodeUint256Key(BigInt(item.tokenId));
      const itemDur = itemDurTable[durKey];
      const maxDur = Number(itemDur?.maxDurability ?? 0);
      if (maxDur === 0) continue; // Z1 item

      const charKey = encodeCompositeKey(character.id, durKey);
      const charDur = charDurTable[charKey];
      const currentDur = Number(charDur?.currentDurability ?? maxDur);
      if (currentDur >= maxDur) continue; // Already full

      const pointsToRepair = maxDur - currentDur;
      const costPerPoint = REPAIR_COST_PER_POINT[item.rarity ?? 0] ?? REPAIR_COST_PER_POINT[0];
      const repairCost = costPerPoint * BigInt(pointsToRepair);

      items.push({
        itemId: BigInt(item.tokenId),
        name: item.name,
        rarity: item.rarity ?? 0,
        currentDurability: currentDur,
        maxDurability: maxDur,
        repairCost,
      });
    }
    return items;
  }, [character, equippedArmor, equippedWeapons, equippedSpells, charDurTable, itemDurTable]);

  const handleRepair = useCallback(async (item: DamagedItem) => {
    if (!character) return;
    setRepairing(item.itemId.toString());
    const result = await repairItem(character.id as `0x${string}`, item.itemId);
    setRepairing(null);
    if (result.success) {
      toast({ title: t('repair.repaired', { name: item.name }), status: 'success', duration: 3000 });
    } else {
      toast({ title: result.error ?? t('repair.failed'), status: 'error', duration: 4000 });
    }
  }, [character, repairItem, toast]);

  if (damagedItems.length === 0) return null;

  return (
    <PolygonalCard clipPath="none" p={6} mt={4}>
      <HStack mb={4}>
        <GiAnvilImpact color="#C8A96E" size={20} />
        <Text color="#E8DCC8" fontFamily="Cinzel, serif" fontWeight={700}>
          {t('repair.title')}
        </Text>
      </HStack>
      <VStack spacing={3} align="stretch">
        {damagedItems.map(item => {
          const pct = (item.currentDurability / item.maxDurability) * 100;
          const color = pct > 50 ? 'green' : pct > 20 ? 'yellow' : 'red';
          const isRepairing = repairing === item.itemId.toString();

          return (
            <HStack
              key={item.itemId.toString()}
              border="1px solid #3A3428"
              borderRadius="md"
              p={3}
              spacing={4}
            >
              <VStack align="start" flex={1} spacing={1}>
                <Text fontSize="sm" fontWeight={600}>{item.name}</Text>
                <Tooltip label={`${item.currentDurability}/${item.maxDurability}`}>
                  <Box w="100%">
                    <Progress value={pct} colorScheme={color} size="xs" borderRadius="full" />
                  </Box>
                </Tooltip>
                <Text color="#8A7E6A" fontSize="xs">
                  {t('repair.durability', { current: item.currentDurability, max: item.maxDurability })}
                </Text>
              </VStack>
              <Button
                size="sm"
                variant="outline"
                borderColor="#C8A96E"
                color="#C8A96E"
                isLoading={isRepairing}
                onClick={() => handleRepair(item)}
                _hover={{ bg: 'rgba(200, 169, 110, 0.1)' }}
              >
                {t('repair.repairButton', { cost: formatEther(item.repairCost) })}
              </Button>
            </HStack>
          );
        })}
      </VStack>
    </PolygonalCard>
  );
};
