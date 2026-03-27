import { HStack, Text } from '@chakra-ui/react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser } from 'react-icons/fa';

import type { NpcInteraction } from '../utils/types';

const ROW_HEIGHT = { base: 5, md: 8 };

const INTERACTION_LABELS: Record<NpcInteraction, string> = {
  respec: 'Combat Trainer',
  guild: 'Guild Founder',
  dialogue: 'Talk',
};

const INTERACTION_COLORS: Record<NpcInteraction, string> = {
  respec: '#e07c4f',
  guild: '#4fc3f7',
  dialogue: '#c4b89e',
};

export const NpcRow = ({
  npcName,
  interaction,
}: {
  npcName: string;
  interaction: NpcInteraction;
}): JSX.Element => {
  const navigate = useNavigate();

  const onInteract = useCallback(() => {
    if (interaction === 'respec') {
      navigate('/character?tab=respec');
    } else if (interaction === 'guild') {
      navigate('/guild');
    }
  }, [interaction, navigate]);

  return (
    <HStack
      as="button"
      borderBottom="2px solid transparent"
      h={ROW_HEIGHT}
      justifyContent="space-between"
      onClick={onInteract}
      px={{ base: 1, sm: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={{
        bg: 'grey300',
        borderBottom: `2px solid ${INTERACTION_COLORS[interaction]}`,
        cursor: 'pointer',
      }}
      _hover={{
        borderBottom: `2px solid ${INTERACTION_COLORS[interaction]}`,
        cursor: 'pointer',
      }}
    >
      <HStack justifyContent="start" spacing={4}>
        <FaUser color={INTERACTION_COLORS[interaction]} size={12} />
        <Text size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>
          {npcName}
        </Text>
        <Text color="grey500" fontSize="xs">
          {INTERACTION_LABELS[interaction]}
        </Text>
      </HStack>
    </HStack>
  );
};
