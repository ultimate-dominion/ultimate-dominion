import { Box, Progress, Tooltip } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import { encodeCompositeKey, encodeUint256Key, useGameValue } from '../lib/gameStore';

interface DurabilityBarProps {
  characterId: string;
  itemId: bigint;
}

export const DurabilityBar = ({
  characterId,
  itemId,
}: DurabilityBarProps): JSX.Element | null => {
  const { t } = useTranslation('ui');
  const durKey = encodeUint256Key(itemId);
  const itemDur = useGameValue('ItemDurability', durKey);
  const maxDurability = Number(itemDur?.maxDurability ?? 0);

  if (maxDurability === 0) return null;

  const charKey = encodeCompositeKey(characterId, durKey);
  const charDur = useGameValue('CharacterItemDurability', charKey);
  const current = Number(charDur?.currentDurability ?? maxDurability);
  const pct = (current / maxDurability) * 100;
  const color = pct > 50 ? 'green' : pct > 20 ? 'yellow' : 'red';

  return (
    <Tooltip hasArrow label={t('durability.label', { current, max: maxDurability })} placement="bottom">
      <Box w="100%" mt="2px">
        <Progress
          borderRadius="full"
          colorScheme={color}
          size="xs"
          value={pct}
          bg="#1A1714"
        />
      </Box>
    </Tooltip>
  );
};
