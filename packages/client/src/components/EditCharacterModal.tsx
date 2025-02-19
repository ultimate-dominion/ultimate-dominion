import {
  Avatar,
  Box,
  Button,
  Center,
  FormControl,
  FormHelperText,
  HStack,
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

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useUploadFile } from '../hooks/useUploadFile';
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
  image,
  isOpen,
  name,
  onClose,
  tokenId,
}): JSX.Element => {
  const { renderError, renderSuccess, renderWarning } = useToast();

  const {
    delegatorAddress,
    systemCalls: { updateTokenUri },
  } = useMUD();
  const { refreshCharacter } = useCharacter();

  const [newName, setNewName] = useState(name);
  const [newDescription, setNewDescription] = useState(description);

  const [showError, setShowError] = useState(false);

  const {
    file: avatar,
    setFile: setAvatar,
    onUpload,
    isUploading,
  } = useUploadFile({ fileName: 'characterAvatar' });

  useEffect(() => {
    setAvatar(null);
    setNewDescription(description);
    setNewName(name);
  }, [description, isOpen, name, setAvatar]);

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [avatar, description, name]);

  const onUploadAvatar = useCallback(() => {
    const input = document.getElementById('avatarInput');

    if (input) {
      input.click();
    }
  }, []);

  const UploadedAvatar = useMemo(() => {
    return (
      <Center>
        <Avatar
          size={{ base: 'lg', sm: 'xl' }}
          src={avatar ? URL.createObjectURL(avatar) : image}
        />
      </Center>
    );
  }, [avatar, image]);

  const [isUpdating, setIsUpdating] = useState(false);

  const onEditCharacter = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        setIsUpdating(true);

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        if (!((avatar || image) && newDescription && newName)) {
          setShowError(true);
          renderWarning('Missing required fields.');
          return;
        }

        const avatarCid = await onUpload();
        if (!avatarCid && !image)
          throw new Error(
            'Something went wrong uploading your character avatar.',
          );
        const characterMetadata = {
          name: name,
          description: description,
          image: avatarCid ? `ipfs://${avatarCid}` : image,
        };
        characterMetadata.name = newName || characterMetadata.name;
        characterMetadata.description =
          newDescription || characterMetadata.description;
        characterMetadata.image = avatarCid
          ? `ipfs://${avatarCid}`
          : characterMetadata.image;

        const res = await fetch(
          `${API_URL}/api/upload?name=characterMetadata.json`,
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

        const { cid: characterMetadataCid } = await res.json();
        if (!characterMetadataCid)
          throw new Error(
            'Something went wrong uploading your character metadata',
          );

        const { error, success } = await updateTokenUri(
          id,
          characterMetadataCid,
          tokenId,
        );

        if (error && !success) {
          throw new Error(error);
        }

        await refreshCharacter();
        renderSuccess('Character updated!');
        onClose();
      } catch (e) {
        renderError('Failed to update character.', e);
      } finally {
        setIsUpdating(false);
      }
    },
    [
      avatar,
      delegatorAddress,
      description,
      id,
      image,
      name,
      newDescription,
      newName,
      onClose,
      onUpload,
      refreshCharacter,
      renderError,
      renderSuccess,
      renderWarning,
      tokenId,
      updateTokenUri,
    ],
  );

  const hasChanged = useMemo(() => {
    return name !== newName || description !== newDescription || avatar;
  }, [avatar, description, name, newDescription, newName]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          <Text>Edit Character</Text>
        </ModalHeader>
        <ModalCloseButton />
        <Box as="form" onSubmit={onEditCharacter}>
          <ModalBody px={{ base: 6, sm: 8 }}>
            <VStack gap={5}>
              <HStack w="100%" gap={5}>
                {UploadedAvatar}
                <VStack w="100%">
                  <FormControl isInvalid={showError && !newName}>
                    <Input
                      isDisabled={isUpdating}
                      onChange={e => setNewName(e.target.value)}
                      placeholder={'Name'}
                      type="text"
                      value={newName}
                      maxLength={15}
                    />
                    {showError && !newName && (
                      <FormHelperText color="red">
                        Name is required
                      </FormHelperText>
                    )}
                  </FormControl>
                  <FormControl isInvalid={showError && !(avatar || image)}>
                    <Input
                      accept=".png, .jpg, .jpeg, .webp, .svg"
                      id="avatarInput"
                      isDisabled={isUpdating}
                      onChange={e => setAvatar(e.target.files?.[0] ?? null)}
                      style={{ display: 'none' }}
                      type="file"
                    />
                    <Button
                      alignSelf="start"
                      isDisabled={isUpdating}
                      isLoading={isUploading}
                      loadingText="Uploading..."
                      onClick={onUploadAvatar}
                      size={{ base: 'xs', sm: 'sm' }}
                      type="button"
                    >
                      Upload Avatar Image
                    </Button>
                    {showError && !(avatar || image) && (
                      <FormHelperText color="red">
                        Avatar is required
                      </FormHelperText>
                    )}
                  </FormControl>
                </VStack>
              </HStack>
              <FormControl isInvalid={showError && !newDescription}>
                <Textarea
                  height="200px"
                  isDisabled={isUpdating}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Bio"
                  value={newDescription}
                />
                {showError && !newDescription && (
                  <FormHelperText color="red">Bio is required</FormHelperText>
                )}
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button
              isDisabled={!hasChanged}
              isLoading={isUpdating}
              loadingText="Updating..."
              type="submit"
            >
              Update
            </Button>
          </ModalFooter>
        </Box>
      </ModalContent>
    </Modal>
  );
};
