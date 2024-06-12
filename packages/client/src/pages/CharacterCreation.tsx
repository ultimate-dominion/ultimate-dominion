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
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { CharacterClasses } from '../utils/types';

export const CharacterCreation = (): JSX.Element => {
  const navigate = useNavigate();
  const { renderSuccess, renderError } = useToast();
  const isSmallScreen = useBreakpointValue({ base: true, md: false });
  const { burnerBalance, delegatorAddress } = useMUD();

  const [name, setName] = useState('');
  const [background, setBackground] = useState('');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [characterClass, setCharacterClass] = useState<CharacterClasses>(
    CharacterClasses.Warrior,
  );

  const [isCreating, setIsCreating] = useState(false);
  const [showError, setShowError] = useState(false);

  const [health, setHealth] = useState(0);
  const [strength, setStrength] = useState(0);
  const [agility, setAgility] = useState(0);
  const [intelligence, setIntelligence] = useState(0);

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [name, background, avatar, characterClass]);

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
          throw new Error('Burner not found.');
        }

        if (!(name && background && avatar)) {
          setShowError(true);
          throw new Error('Missing required fields.');
        }

        // const character = await mintCharacter(
        //   delegatorAddress,
        //   characterClass,
        //   name,
        // );

        // if (!character) {
        //   throw new Error('Contract call failed');
        // }

        // Temporarily add a 2 second timeout to simulate the contract call
        await new Promise(resolve => setTimeout(resolve, 2000));

        renderSuccess('Character created!');
        navigate('/game-board');
      } catch (e) {
        renderError(e, 'Failed to create character.');
      } finally {
        setIsCreating(false);
      }
    },
    [
      avatar,
      background,
      burnerBalance,
      delegatorAddress,
      name,
      navigate,
      renderError,
      renderSuccess,
    ],
  );

  const onRollStats = useCallback(() => {
    // Temporarily set random values between 1 and 10
    setHealth(Math.floor(Math.random() * 10) + 1);
    setStrength(Math.floor(Math.random() * 10) + 1);
    setAgility(Math.floor(Math.random() * 10) + 1);
    setIntelligence(Math.floor(Math.random() * 10) + 1);
  }, []);

  return (
    <Box>
      <Stack
        as="form"
        direction={{ base: 'column', lg: 'row' }}
        gap={{ base: 4, sm: 6 }}
        justifyContent="center"
        mx="auto"
        my={4}
        onSubmit={onCreateCharacter}
        w="100%"
      >
        <Box
          border="2px solid"
          p={{ base: 4, sm: 10 }}
          width={{ base: '100%', lg: '50%' }}
        >
          <VStack spacing={8}>
            <Stack
              alignItems="start"
              direction={{ base: 'column-reverse', sm: 'row' }}
              gap={{ base: 4, sm: 8 }}
              w="100%"
            >
              <Center>
                <Avatar
                  size={{ base: 'lg', sm: 'xl' }}
                  src={avatar ? URL.createObjectURL(avatar) : undefined}
                />
              </Center>
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
                    onChange={e => setAvatar(e.target.files?.[0] ?? null)}
                    style={{ display: 'none' }}
                    type="file"
                  />
                  <Button
                    alignSelf="start"
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
            <FormControl isInvalid={showError && !background}>
              <Textarea
                height={{ base: '200px', sm: '350px' }}
                onChange={e => setBackground(e.target.value)}
                placeholder="Bio"
                value={background}
              />
              {showError && !background && (
                <FormHelperText color="red">Bio is required</FormHelperText>
              )}
            </FormControl>
          </VStack>
        </Box>
        <Box
          border="2px solid"
          p={{ base: 4, sm: 10 }}
          width={{ base: '100%', lg: '50%' }}
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
                onClick={() => setCharacterClass(CharacterClasses.Mage)}
                size="sm"
                variant={characterClass === 1 ? 'solid' : 'outline'}
                w="150px"
              >
                Mage
              </Button>
              <Button
                onClick={() => setCharacterClass(CharacterClasses.Rogue)}
                size="sm"
                variant={characterClass === 2 ? 'solid' : 'outline'}
                w="150px"
              >
                Rogue
              </Button>
            </ButtonGroup>
          </VStack>
          <SimpleGrid
            columns={{ base: 1, xl: 2 }}
            mt={{ base: 12, sm: 20 }}
            spacing={{ base: 12, sm: 16 }}
          >
            <VStack spacing={8}>
              <HStack justify="space-between" w="100%">
                <Heading size="sm">Stats</Heading>
                <Button onClick={onRollStats} size="sm">
                  Roll Stats
                </Button>
              </HStack>
              <VStack w="100%">
                <HStack justify="space-between" w="100%">
                  <Text>HP - Hit</Text>
                  <Text>{health}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>STR - Strength</Text>
                  <Text>{strength}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>AGI - Agility</Text>
                  <Text>{agility}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>INT - Intelligence</Text>
                  <Text>{intelligence}</Text>
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
            <Button
              isLoading={isCreating}
              loadingText="Creating..."
              mt={16}
              type="submit"
              width="100%"
            >
              Wake Up
            </Button>
          )}
        </Box>
        {isSmallScreen && (
          <Button
            isLoading={isCreating}
            loadingText="Creating..."
            type="submit"
            width="100%"
          >
            Wake Up
          </Button>
        )}
      </Stack>
    </Box>
  );
};
