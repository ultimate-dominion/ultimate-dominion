import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';
import { useCallback, useState } from 'react';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { EncounterType, type Monster } from '../utils/types';

type InitiateCombatModalProps = Monster & {
  isOpen: boolean;
  onClose: () => void;
};

export const InitiateCombatModal: React.FC<InitiateCombatModalProps> = ({
  isOpen,
  onClose,
  ...monster
}): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    burnerBalance,
    delegatorAddress,
    systemCalls: { createMatch },
  } = useMUD();
  const { character } = useCharacter();

  const [isInitiating, setIsInitiating] = useState(false);

  const onInitiateCombat = useCallback(async () => {
    try {
      setIsInitiating(true);

      if (!character) {
        throw new Error('Character not found.');
      }

      if (burnerBalance === '0') {
        throw new Error(
          'Insufficient funds. Please top off your session account.',
        );
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      const { error, success } = await createMatch(
        EncounterType.PvE,
        [character.characterId],
        [monster.monsterId],
      );

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess(`Battle has begun!`);
      onClose();
    } catch (e) {
      renderError('Failed to initiate battle.', e);
    } finally {
      setIsInitiating(false);
    }
  }, [
    burnerBalance,
    character,
    createMatch,
    delegatorAddress,
    monster,
    onClose,
    renderError,
    renderSuccess,
  ]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Initiate Battle</ModalHeader>
        <ModalCloseButton />
        <ModalBody padding={4}>
          Are you sure you want to initiate a battle with {monster.name}?
        </ModalBody>
        <ModalFooter>
          <Button
            isLoading={isInitiating}
            loadingText="Initiating..."
            mr={3}
            onClick={onInitiateCombat}
          >
            Yes
          </Button>
          <Button isDisabled={isInitiating} onClick={onClose} variant="ghost">
            No
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
