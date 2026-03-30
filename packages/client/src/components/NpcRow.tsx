import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaSearch } from 'react-icons/fa';

import { useNpcFlavor } from '../hooks/useNpcFlavor';
import type { NpcInteraction } from '../utils/types';

const ROW_HEIGHT = { base: 5, md: 8 };

const INTERACTION_LABEL_KEYS: Record<NpcInteraction, string> = {
  respec: 'npc.combatTrainer',
  guild: 'npc.guildFounder',
  dialogue: 'npc.talk',
  examine: 'npc.examine',
};

const INTERACTION_COLORS: Record<NpcInteraction, string> = {
  respec: '#e07c4f',
  guild: '#4fc3f7',
  dialogue: '#c4b89e',
  examine: '#9BAFBF',
};

const INTERACTION_ICONS: Record<NpcInteraction, typeof FaUser> = {
  respec: FaUser,
  guild: FaUser,
  dialogue: FaUser,
  examine: FaSearch,
};

const hasNarrative = (interaction: NpcInteraction): boolean =>
  interaction === 'dialogue' || interaction === 'examine';

export const NpcRow = ({
  npcName,
  interaction,
  entityId,
  metadataUri,
  onOpenDialogue,
}: {
  npcName: string;
  interaction: NpcInteraction;
  entityId: string;
  metadataUri: string;
  onOpenDialogue: (npcId: string, npcName: string, metadataUri: string) => void;
}): JSX.Element => {
  const { t } = useTranslation('ui');
  const navigate = useNavigate();
  const { title, flavor } = useNpcFlavor(metadataUri);
  const showNarrative = hasNarrative(interaction) && (title || flavor);

  const onInteract = useCallback(() => {
    if (interaction === 'respec') {
      navigate('/character?tab=respec');
    } else if (interaction === 'guild') {
      navigate('/guild');
    } else if (interaction === 'dialogue' || interaction === 'examine') {
      onOpenDialogue(entityId, npcName, metadataUri);
    }
  }, [interaction, navigate, onOpenDialogue, entityId, npcName, metadataUri]);

  const Icon = INTERACTION_ICONS[interaction];
  const color = INTERACTION_COLORS[interaction];

  if (showNarrative) {
    return (
      <Box
        as="button"
        borderBottom="2px solid transparent"
        onClick={onInteract}
        px={{ base: 2, sm: 4 }}
        py={{ base: 1.5, md: 2 }}
        transition="all 0.3s ease"
        w="100%"
        textAlign="left"
        _active={{
          bg: 'grey300',
          borderBottom: `2px solid ${color}`,
          cursor: 'pointer',
        }}
        _hover={{
          borderBottom: `2px solid ${color}`,
          cursor: 'pointer',
        }}
      >
        <HStack justifyContent="space-between" w="100%">
          <HStack spacing={3}>
            <Icon color={color} size={12} />
            <Text
              size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
              fontStyle={interaction === 'examine' ? 'italic' : undefined}
            >
              {npcName}
            </Text>
          </HStack>
          <Text color="grey500" fontSize="xs">
            {t(INTERACTION_LABEL_KEYS[interaction])}
          </Text>
        </HStack>
        <VStack align="start" spacing={0} pl={{ base: 7, sm: 8 }} mt={0.5}>
          {title && (
            <Text color="#8A7E6A" fontSize="2xs" fontStyle="italic">
              {title}
            </Text>
          )}
          {flavor && (
            <Text color="#E8DCC8" fontSize="xs" fontStyle="italic" noOfLines={2} mt={0.5}>
              &ldquo;{flavor}&rdquo;
            </Text>
          )}
        </VStack>
      </Box>
    );
  }

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
        borderBottom: `2px solid ${color}`,
        cursor: 'pointer',
      }}
      _hover={{
        borderBottom: `2px solid ${color}`,
        cursor: 'pointer',
      }}
    >
      <HStack justifyContent="start" spacing={4}>
        <Icon color={color} size={12} />
        <Text
          size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
          fontStyle={interaction === 'examine' ? 'italic' : undefined}
        >
          {npcName}
        </Text>
        <Text color="grey500" fontSize="xs">
          {t(INTERACTION_LABEL_KEYS[interaction])}
        </Text>
      </HStack>
    </HStack>
  );
};
