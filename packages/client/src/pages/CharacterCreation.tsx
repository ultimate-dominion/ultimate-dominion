import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Center,
  FormControl,
  FormHelperText,
  Heading,
  HStack,
  Input,
  Link,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaLock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useWalletClient } from 'wagmi';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useUploadFile } from '../hooks/useUploadFile';
import { API_URL } from '../utils/constants';
import { shortenAddress } from '../utils/helpers';
import { CharacterClasses } from '../utils/types';

export const CharacterCreation = (): JSX.Element => {
  const navigate = useNavigate();
  const { renderSuccess, renderError } = useToast();
  const isSmallScreen = useBreakpointValue({ base: true, lg: false });
  const { data: externalWalletClient } = useWalletClient();
  const {
    burnerBalance,
    components: { UltimateDominionConfig },
    delegatorAddress,
    isSynced,
    systemCalls: { enterGame, mintCharacter, rollStats },
  } = useMUD();
  const { character, characterStats, isRefreshing, refreshCharacter } =
    useCharacter();
  const {
    file: avatar,
    setFile: setAvatar,
    onUpload,
    isUploading,
    isUploaded,
  } = useUploadFile({ fileName: 'characterAvatar' });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characterClass, setCharacterClass] = useState<CharacterClasses>(
    CharacterClasses.Warrior,
  );

  const [isCreating, setIsCreating] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isRollingStats, setIsRollingStats] = useState(false);
  const [isEnteringGame, setIsEnteringGame] = useState(false);

  const { characterToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { characterToken: null };

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

        if (!(avatar && description && name)) {
          setShowError(true);
          throw new Error('Missing required fields.');
        }

        const avatarCid = await onUpload();
        if (!avatarCid)
          throw new Error(
            'Something went wrong uploading your character avatar',
          );

        const image = `ipfs://${avatarCid}`;

        const characterMetadata = {
          name,
          description,
          image,
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

        const { cid: characterMetadataCid } = await res.json();
        if (!characterMetadataCid)
          throw new Error(
            'Something went wrong uploading your character metadata',
          );

        const success = await mintCharacter(
          delegatorAddress,
          name,
          characterMetadataCid,
        );

        if (!success) {
          throw new Error('Contract call failed');
        }

        refreshCharacter();
        renderSuccess('Character created!');
      } catch (e) {
        renderError(e, 'Failed to create character.');
      } finally {
        setIsCreating(false);
      }
    },
    [
      avatar,
      burnerBalance,
      delegatorAddress,
      description,
      mintCharacter,
      name,
      onUpload,
      refreshCharacter,
      renderError,
      renderSuccess,
    ],
  );

  const onRollStats = useCallback(async () => {
    try {
      setIsRollingStats(true);

      if (burnerBalance === '0') {
        throw new Error(
          'Insufficient funds. Please top off your session account.',
        );
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const success = await rollStats(character.characterId, characterClass);

      if (!success) {
        throw new Error('Contract call failed');
      }

      refreshCharacter();
      renderSuccess('Stats rolled!');
    } catch (e) {
      renderError(e, 'Failed to roll stats.');
    } finally {
      setIsRollingStats(false);
    }
  }, [
    burnerBalance,
    character,
    characterClass,
    delegatorAddress,
    refreshCharacter,
    renderError,
    renderSuccess,
    rollStats,
  ]);

  const rolledOnce = useMemo(() => {
    return characterStats.maxHitPoints !== '0';
  }, [characterStats]);

  const onEnterGame = useCallback(async () => {
    try {
      setIsEnteringGame(true);

      if (!rolledOnce) {
        setShowError(true);
        return;
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const success = await enterGame(character.characterId);

      if (!success) {
        throw new Error('Contract call failed');
      }

      renderSuccess('Your character has awakend!');
      navigate('/game-board');
    } catch (e) {
      renderError(e, 'Failed to enter game.');
    } finally {
      setIsEnteringGame(false);
    }
  }, [character, enterGame, navigate, renderError, renderSuccess, rolledOnce]);

  const isDisabled = useMemo(() => {
    return !character || isCreating || isEnteringGame || isRollingStats;
  }, [character, isCreating, isEnteringGame, isRollingStats]);

  useEffect(() => {
    if (character && rolledOnce) {
      setCharacterClass(character.characterClass);
    }

    if (character?.locked) {
      navigate('/game-board');
    }

    if (!externalWalletClient) {
      navigate('/');
    }

    if (!delegatorAddress && isSynced) {
      navigate('/');
    }
  }, [
    character,
    delegatorAddress,
    externalWalletClient,
    isSynced,
    navigate,
    rolledOnce,
  ]);

  const UploadedAvatar = useMemo(() => {
    return (
      <Center>
        <Avatar
          size={{ base: 'lg', sm: 'xl' }}
          src={avatar ? URL.createObjectURL(avatar) : undefined}
        />
      </Center>
    );
  }, [avatar]);

  return (
    <Stack
      direction={{ base: 'column', lg: 'row' }}
      gap={{ base: 4, sm: 6 }}
      justifyContent="center"
      mx="auto"
      my={4}
      w="100%"
    >
      {character && characterToken ? (
        <Box border="2px solid" p={8} w={{ base: '100%', lg: '50%' }}>
          <VStack h="100%" justifyContent="center" spacing={{ base: 4, md: 8 }}>
            <Center>
              <Avatar size={{ base: 'lg', sm: 'xl' }} src={character.image} />
            </Center>
            <HStack spacing={4}>
              <Text fontSize={{ base: 'xs', md: 'sm' }}>
                Address:{' '}
                <Text as="span" fontWeight={700}>
                  {shortenAddress(characterToken)}
                </Text>
              </Text>
              <Text>|</Text>
              <Text fontSize={{ base: 'xs', md: 'sm' }}>
                Token ID:{' '}
                <Text as="span" fontWeight={700}>
                  {character.tokenId}
                </Text>
              </Text>
            </HStack>
            <VStack>
              <Heading>{character.name}</Heading>
              <Text textAlign="center">{character.description}</Text>
            </VStack>
            <Text>
              Class:{' '}
              {rolledOnce ? CharacterClasses[character.characterClass] : 'None'}
            </Text>
          </VStack>
        </Box>
      ) : (
        <Box
          as="form"
          onSubmit={onCreateCharacter}
          w={{ base: '100%', lg: '50%' }}
        >
          <Box
            border="2px solid"
            h={{ base: 'auto', lg: '100%' }}
            p={{ base: 4, sm: 10 }}
            pos="relative"
          >
            <VStack spacing={8}>
              <Stack
                alignItems="start"
                direction={{ base: 'column-reverse', sm: 'row' }}
                gap={{ base: 4, sm: 8 }}
                w="100%"
              >
                {UploadedAvatar}
                <VStack w="100%">
                  <FormControl isInvalid={showError && !name}>
                    <Input
                      onChange={e => setName(e.target.value)}
                      placeholder="Name"
                      type="text"
                      value={name}
                    />
                    {showError && !name && (
                      <FormHelperText color="red">
                        Name is required
                      </FormHelperText>
                    )}
                  </FormControl>
                  <FormControl isInvalid={showError && !avatar}>
                    <Input
                      id="avatarInput"
                      onChange={e =>
                        e.target.files?.[0] && setAvatar(e.target.files?.[0])
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
                    {showError && !avatar && (
                      <FormHelperText color="red">
                        Avatar is required
                      </FormHelperText>
                    )}
                  </FormControl>
                </VStack>
              </Stack>
              <FormControl isInvalid={showError && !description}>
                <Textarea
                  height="200px"
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Bio"
                  value={description}
                />
                {showError && !description && (
                  <FormHelperText color="red">Bio is required</FormHelperText>
                )}
              </FormControl>
            </VStack>
            {!isSmallScreen && (
              <Box bottom={10} left={0} pos="absolute" px={10} right={0}>
                <Button
                  isLoading={isCreating}
                  loadingText="Creating..."
                  type="submit"
                  width="100%"
                >
                  Create Character
                </Button>
              </Box>
            )}
          </Box>
          {isSmallScreen && (
            <Button
              isLoading={isCreating || isRefreshing}
              loadingText="Creating..."
              mt={2}
              type="submit"
              width="100%"
            >
              Create Character
            </Button>
          )}
        </Box>
      )}
      <Box
        as="form"
        onSubmit={(e: React.FormEvent<HTMLDivElement>) => e.preventDefault()}
        w={{ base: '100%', lg: '50%' }}
      >
        <Box
          border="2px solid"
          h={{ base: 'auto', lg: '100%' }}
          p={{ base: 4, sm: 10 }}
          pos="relative"
        >
          <VStack alignItems="left" spacing={6}>
            <Heading size="sm" textAlign="left">
              Choose your Character
            </Heading>
            <ButtonGroup justifyContent="space-between">
              <Button
                onClick={() => setCharacterClass(CharacterClasses.Warrior)}
                size="sm"
                variant={characterClass === 0 ? 'solid' : 'outline'}
                w="150px"
              >
                Warrior
              </Button>
              <Button
                onClick={() => setCharacterClass(CharacterClasses.Rogue)}
                size="sm"
                variant={characterClass === 1 ? 'solid' : 'outline'}
                w="150px"
              >
                Rogue
              </Button>
              <Button
                onClick={() => setCharacterClass(CharacterClasses.Mage)}
                size="sm"
                variant={characterClass === 2 ? 'solid' : 'outline'}
                w="150px"
              >
                Mage
              </Button>
            </ButtonGroup>
          </VStack>
          {character &&
            rolledOnce &&
            characterClass !== character.characterClass && (
              <Text color="red" fontSize="sm" mt={2}>
                Your current class is{' '}
                <Text as="span" fontWeight={700}>
                  {CharacterClasses[character.characterClass]}
                </Text>
                . Re-roll stats to change class.
              </Text>
            )}
          <SimpleGrid
            columns={{ base: 1, xl: 2 }}
            mb={{ base: 0, lg: 24 }}
            mt={{ base: 12, sm: 20 }}
            spacing={{ base: 12, sm: 16 }}
          >
            <VStack spacing={8}>
              <HStack justify="space-between" w="100%">
                <Heading size="sm">Stats</Heading>
                <Button
                  isDisabled={isDisabled}
                  isLoading={isRollingStats}
                  loadingText="Rolling..."
                  onClick={onRollStats}
                  size="sm"
                >
                  {rolledOnce ? 'Re-roll' : 'Roll Stats'}
                </Button>
              </HStack>
              <VStack w="100%">
                <HStack justify="space-between" w="100%">
                  <Text>HP - Hit</Text>
                  <Text>{characterStats.maxHitPoints ?? '0'}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>STR - Strength</Text>
                  <Text>{characterStats.strength ?? '0'}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>AGI - Agility</Text>
                  <Text>{characterStats.agility ?? '0'}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>INT - Intelligence</Text>
                  <Text>{characterStats.intelligence ?? '0'}</Text>
                </HStack>
              </VStack>
            </VStack>
            <VStack spacing={5}>
              <HStack justify="space-between" w="100%">
                <Heading size="sm">$Gold</Heading>
                <Text>5</Text>
              </HStack>
              <HStack justify="space-between" w="100%">
                <Heading size="sm">Items</Heading>
                <Text>1</Text>
              </HStack>
              <HStack border="1px solid" borderColor="grey400" w="100%">
                <Box bgColor="grey400" h="50px" w="50px" />
                <Box>
                  <Text size="xs">Rusty Dagger</Text>
                  <Text size="xs">STR+1 AGI+3 INT+4</Text>
                </Box>
              </HStack>
              <Link
                alignSelf="end"
                color="grey500"
                fontSize="18px"
                fontWeight={700}
              >
                Auction House ▶
              </Link>
            </VStack>
          </SimpleGrid>
          {!isSmallScreen && (
            <Box bottom={10} left={0} mt={16} pos="absolute" px={10} right={0}>
              {showError && !rolledOnce && (
                <Text color="red" fontSize="sm" mb={2} textAlign="center">
                  You must roll stats at least once before entering the game.
                </Text>
              )}
              <Button
                isDisabled={isDisabled}
                isLoading={isEnteringGame}
                loadingText="Waking..."
                onClick={onEnterGame}
                type="button"
                width="100%"
              >
                Wake Up
              </Button>
            </Box>
          )}
          {!character && (
            <Box
              pos="absolute"
              bg="rgba(0, 0, 0, 0.5)"
              h="100%"
              w="100%"
              top={0}
              left={0}
            >
              <Center h="100%">
                <FaLock color="white" size="100px" />
              </Center>
            </Box>
          )}
        </Box>
        {isSmallScreen && (
          <>
            <Button
              isDisabled={isDisabled}
              isLoading={isEnteringGame}
              loadingText="Waking..."
              onClick={onEnterGame}
              mt={2}
              type="button"
              width="100%"
            >
              Wake Up
            </Button>
            {showError && !rolledOnce && (
              <Text color="red" fontSize="sm" mt={2} textAlign="center">
                You must roll stats at least once before entering the game.
              </Text>
            )}
          </>
        )}
      </Box>
    </Stack>
  );
};
