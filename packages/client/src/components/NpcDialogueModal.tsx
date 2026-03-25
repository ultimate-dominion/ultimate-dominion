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
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { encodeBytes32Key, useGameValue } from '../lib/gameStore';

import { PolygonalCard } from './PolygonalCard';

interface NpcDialogueModalProps {
  isOpen: boolean;
  onClose: () => void;
  npcId: string;
  npcName: string;
}

export const NpcDialogueModal = ({
  isOpen,
  onClose,
  npcId,
  npcName,
}: NpcDialogueModalProps): JSX.Element => {
  const { character } = useCharacter();
  const {
    systemCalls: { talkToNpc },
  } = useMUD();
  const { renderError } = useToast();
  const talkTx = useTransaction({ actionName: 'talk to NPC', silent: true });

  const [lineIndex, setLineIndex] = useState(0);

  const key = encodeBytes32Key(npcId);
  const dialogueData = useGameValue('NpcDialogue', key);
  const rawDialogue = (dialogueData?.dialogue as string) ?? '';

  const lines = useMemo(() => {
    if (!rawDialogue) return [];
    return rawDialogue.split('|').filter(Boolean);
  }, [rawDialogue]);

  const isLastLine = lineIndex >= lines.length - 1;

  // Call talkToNpc system when modal opens
  useEffect(() => {
    if (!isOpen || !character) return;

    talkTx.execute(() => talkToNpc(character.characterId, npcId)).catch((err) => {
      renderError('Failed to start dialogue.');
      console.error('[NpcDialogue] talkToNpc error:', err);
    });
    // Only fire on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset line index when modal reopens
  useEffect(() => {
    if (isOpen) setLineIndex(0);
  }, [isOpen]);

  const handleNext = useCallback(() => {
    if (isLastLine) {
      onClose();
    } else {
      setLineIndex((prev) => prev + 1);
    }
  }, [isLastLine, onClose]);

  const currentLine = lines[lineIndex] ?? '...';

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent bg="#0C0A09" border="1px solid" borderColor="#3A3428" maxW="400px">
        <PolygonalCard isModal />
        <ModalHeader pb={1}>
          <Text color="#C8A96E" fontSize="md" fontWeight={700}>
            {npcName}
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
              &ldquo;{currentLine}&rdquo;
            </Text>
            <Button
              alignSelf="flex-end"
              colorScheme="yellow"
              onClick={handleNext}
              size="sm"
              variant="ghost"
              _hover={{ bg: '#1A1612' }}
            >
              {isLastLine ? 'Farewell' : 'Next'}
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
