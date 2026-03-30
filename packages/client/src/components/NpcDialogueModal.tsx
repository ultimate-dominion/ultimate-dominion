import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useNpcFlavor } from '../hooks/useNpcFlavor';

import { PolygonalCard } from './PolygonalCard';

interface NpcDialogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  npcId: string;
  npcName: string;
  metadataUri: string;
}

export const NpcDialogueModal = ({
  isOpen,
  onClose,
  npcId,
  npcName,
  metadataUri,
}: NpcDialogueModalProps): JSX.Element => {
  const { character } = useCharacter();
  const {
    systemCalls: { talkToNpc },
  } = useMUD();
  const { t } = useTranslation('ui');
  const { title, flavor } = useNpcFlavor(metadataUri);

  const [hasTalked, setHasTalked] = useState(false);

  // Fire talkToNpc for chain advancement (side-effect only — display uses client narratives)
  useEffect(() => {
    if (!isOpen || !character || hasTalked) return;

    talkToNpc(character.id, npcId)
      .then(() => setHasTalked(true))
      .catch((err) => {
        // Non-fatal — dialogue still shows even if chain call fails
        console.warn('[NpcDialogue] talkToNpc failed (chain may not advance):', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset state when modal reopens
  useEffect(() => {
    if (isOpen) setHasTalked(false);
  }, [isOpen]);

  const displayTitle = title || npcName;
  const displayText = flavor || '...';

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent bg="#0C0A09" border="1px solid" borderColor="#3A3428" maxW="400px">
        <PolygonalCard isModal />
        <ModalHeader pb={1}>
          <Text color="#C8A96E" fontSize="md" fontWeight={700}>
            {displayTitle}
          </Text>
        </ModalHeader>
        <ModalBody px={6} pb={5}>
          <VStack spacing={4} align="stretch">
            <Text
              color="#E8DCC8"
              fontSize="sm"
              fontStyle="italic"
              lineHeight="tall"
              minH="60px"
            >
              &ldquo;{displayText}&rdquo;
            </Text>
            <Button
              alignSelf="flex-end"
              colorScheme="yellow"
              onClick={onClose}
              size="sm"
              variant="ghost"
              _hover={{ bg: '#1A1612' }}
            >
              {t('npc.farewell')}
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
