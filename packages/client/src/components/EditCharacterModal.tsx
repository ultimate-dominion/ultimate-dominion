import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { API_URL } from '../utils/constants';
import { type Character } from '../utils/types';

import { PolygonalCard } from './PolygonalCard';

type EditCharacterModalProps = Character & {
  isOpen: boolean;
  onClose: () => void;
};

export const EditCharacterModal: React.FC<EditCharacterModalProps> = ({
  description,
  id,
  isOpen,
  name,
  onClose,
}): JSX.Element => {
  const { t } = useTranslation('ui');
  const { renderError, renderWarning } = useToast();

  const {
    delegatorAddress,
    systemCalls: { updateTokenUri },
  } = useMUD();
  const { refreshCharacter } = useCharacter();

  const [newName, setNewName] = useState(name);
  const [newDescription, setNewDescription] = useState(description);

  const [showError, setShowError] = useState(false);

  useEffect(() => {
    setNewDescription(description);
    setNewName(name);
  }, [description, isOpen, name]);

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [newDescription, newName]);

  const updateTx = useTransaction({
    actionName: 'update character',
    showSuccessToast: true,
    successMessage: t('editCharacter.updated'),
  });

  const [isUpdating, setIsUpdating] = useState(false);

  const onEditCharacter = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        setIsUpdating(true);

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        if (!(newDescription && newName)) {
          setShowError(true);
          renderWarning(t('editCharacter.missingFields'));
          return;
        }

        const characterMetadata = {
          name: newName,
          description: newDescription,
        };

        const res = await fetch(
          `${API_URL}/api/uploadMetadata?name=characterMetadata.json`,
          {
            method: 'POST',
            body: JSON.stringify(characterMetadata),
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        if (!res.ok)
          throw new Error(
            'Something went wrong uploading your character metadata',
          );

        const { url: metadataUrl } = await res.json();
        if (!metadataUrl)
          throw new Error(
            'Something went wrong uploading your character metadata',
          );

        // Extract CID from the IPFS gateway URL
        const characterMetadataCid = metadataUrl.split('/').pop();
        if (!characterMetadataCid)
          throw new Error(
            'Something went wrong uploading your character metadata',
          );

        const result = await updateTx.execute(async () => {
          const { error, success } = await updateTokenUri(
            id,
            characterMetadataCid,
          );
          if (error && !success) throw new Error(error);
          return true;
        });

        if (result !== undefined) {
          await refreshCharacter();
          onClose();
        }
      } catch (e) {
        renderError(t('editCharacter.updateFailed'), e);
      } finally {
        setIsUpdating(false);
      }
    },
    [
      delegatorAddress,
      id,
      newDescription,
      newName,
      onClose,
      refreshCharacter,
      renderError,
      renderWarning,
      updateTokenUri,
      updateTx,
    ],
  );

  const hasChanged = useMemo(() => {
    return name !== newName || description !== newDescription;
  }, [description, name, newDescription, newName]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          <Text>{t('editCharacter.title')}</Text>
        </ModalHeader>
        <ModalCloseButton />
        <Box as="form" onSubmit={onEditCharacter}>
          <ModalBody px={{ base: 6, sm: 8 }}>
            <VStack gap={5}>
              <FormControl isInvalid={showError && !newName}>
                <Input
                  isDisabled={isUpdating}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={t('editCharacter.namePlaceholder')}
                  type="text"
                  value={newName}
                  maxLength={15}
                />
                {showError && !newName && (
                  <FormHelperText color="red">
                    {t('editCharacter.nameRequired')}
                  </FormHelperText>
                )}
              </FormControl>
              <FormControl isInvalid={showError && !newDescription}>
                <Textarea
                  height="200px"
                  isDisabled={isUpdating}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder={t('editCharacter.bioPlaceholder')}
                  value={newDescription}
                />
                {showError && !newDescription && (
                  <FormHelperText color="red">
                    {t('editCharacter.bioRequired')}
                  </FormHelperText>
                )}
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button onClick={onClose} variant="ghost">
              {t('common.cancel')}
            </Button>
            <Button
              isDisabled={!hasChanged}
              isLoading={isUpdating}
              loadingText={t('editCharacter.updating')}
              type="submit"
            >
              {t('editCharacter.update')}
            </Button>
          </ModalFooter>
        </Box>
      </ModalContent>
    </Modal>
  );
};
