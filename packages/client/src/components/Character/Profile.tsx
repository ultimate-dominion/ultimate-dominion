import {
  Avatar,
  Box,
  Button,
  Center,
  FormControl,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spacer,
  Text,
  Textarea,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { FaStarAndCrescent } from 'react-icons/fa';
import { Address } from 'viem';

import { useMUD } from '../../contexts/MUDContext';
import { useToast } from '../../hooks/useToast';
import { useUploadFile } from '../../hooks/useUploadFile';
import { API_URL } from '../../utils/constants';

export const Profile = ({
  description,
  image,
  isOwner,
  name,
  characterId,
  fetchCharacter,
}: {
  description: string;
  image: string;
  isOwner: boolean;
  name: string;
  characterId: string;
  fetchCharacter: () => void;
}): JSX.Element => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { renderSuccess, renderError } = useToast();

  const {
    file: avatar,
    setFile: setAvatar,
    onUpload,
    isUploading,
    isUploaded,
  } = useUploadFile({ fileName: 'characterAvatar' });
  // const [setShowError] = useState(false);
  // Reset showError state when any of the form fields change
  // useEffect(() => {
  //   setShowError(false);
  // }, [avatar, description, name, setShowError]);
  const {
    burnerBalance,
    // components: { UltimateDominionConfig },
    delegatorAddress,
    network: { worldContract, publicClient },
  } = useMUD();
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
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

  const [isCreating, setIsCreating] = useState(false);

  const onCreateCharacter = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        setIsCreating(true);

        if (burnerBalance === '0') {
          throw new Error(
            'Insufficient funds. Please top off your session account.',
          );
        }

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        const avatarCid = await onUpload();
        if (!avatarCid && !image)
          throw new Error(
            'Something went wrong uploading your character avatar',
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

        const { cid: characterMetadataCid } = await res.json();
        if (!characterMetadataCid)
          throw new Error(
            'Something went wrong uploading your character metadata',
          );
        const tx = await worldContract.write.UD__updateTokenUri([
          characterId as Address,
          characterMetadataCid,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: tx });
        fetchCharacter();
        renderSuccess('Character updated!');
      } catch (e) {
        renderError(e, 'Failed to update character.');
      } finally {
        setIsCreating(false);
      }
    },
    [
      burnerBalance,
      characterId,
      delegatorAddress,
      description,
      fetchCharacter,
      image,
      name,
      newDescription,
      newName,
      onUpload,
      publicClient,
      renderError,
      renderSuccess,
      worldContract.write,
    ],
  );

  return (
    <Box h="100%" position="relative">
      <VStack>
        <HStack w="100%">
          <Center>
            <Avatar size="lg" src={image} />
            <Heading margin="0px 20px" size="lg">
              {name}
            </Heading>
          </Center>
          <Spacer />
          <Center>
            <FaStarAndCrescent size={40} />
          </Center>
        </HStack>
        <Spacer />
        <Box mt={3} w="100%">
          <Text overflow="hidden" size="sm" textAlign="left">
            {description}
          </Text>
          <br></br>
          {isOwner && (
            <Box>
              <Button
                bottom="0"
                position="absolute"
                right="0"
                size="sm"
                variant="ghost"
                onClick={onOpen}
              >
                Edit Character
              </Button>
              <Modal isOpen={isOpen} onClose={onClose}>
                <ModalOverlay />
                <Box as="form" onSubmit={onCreateCharacter}>
                  <ModalContent>
                    <ModalHeader>Edit Character</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                      <VStack gap={5}>
                        <HStack w="100%" gap={5}>
                          {UploadedAvatar}
                          <VStack w="100%">
                            <FormControl>
                              <Input
                                onChange={e => setNewName(e.target.value)}
                                placeholder={name}
                                type="text"
                                value={newName}
                                maxLength={15}
                              />
                              {/* {showError && !name && (
                                  <FormHelperText color="red">
                                    Name is required
                                  </FormHelperText>
                                )} */}
                            </FormControl>
                            <FormControl>
                              <Input
                                id="avatarInput"
                                onChange={e =>
                                  setAvatar(e.target.files?.[0] ?? null)
                                }
                                style={{ display: 'none' }}
                                type="file"
                              />
                              <Button
                                alignSelf="start"
                                isDisabled={isUploaded}
                                isLoading={isUploading}
                                loadingText="Uploading..."
                                onClick={onUploadAvatar}
                                size="sm"
                                type="button"
                              >
                                Upload Avatar
                              </Button>
                              {/* {showError && !avatar && (
                                  <FormHelperText color="red">
                                    Avatar is required
                                  </FormHelperText>
                                )} */}
                            </FormControl>
                          </VStack>
                        </HStack>
                        <FormControl>
                          <Textarea
                            height="200px"
                            onChange={e => setNewDescription(e.target.value)}
                            placeholder={description}
                            value={newDescription}
                          />
                          {/* {showError && !description && (
                              <FormHelperText color="red">
                                Bio is required
                              </FormHelperText>
                            )} */}
                        </FormControl>
                      </VStack>
                    </ModalBody>
                    <ModalFooter>
                      <Button
                        isLoading={isCreating}
                        loadingText="Creating..."
                        type="submit"
                      >
                        Update
                      </Button>
                      <Spacer></Spacer>
                      <Button onClick={onClose} variant="ghost">
                        Cancel
                      </Button>
                    </ModalFooter>
                  </ModalContent>
                </Box>
              </Modal>
            </Box>
          )}
        </Box>
      </VStack>
    </Box>
  );
};
