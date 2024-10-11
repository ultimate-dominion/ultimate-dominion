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
import {
  Entity,
  getComponentValueStrict,
  Has,
  runQuery,
} from '@latticexyz/recs';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaLock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';
import { useAccount } from 'wagmi';

import { ItemCardSmall } from '../components/ItemCard';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useUploadFile } from '../hooks/useUploadFile';
import { EXPLORER_URLS } from '../lib/web3';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import { API_URL } from '../utils/constants';
import { shortenAddress } from '../utils/helpers';
import {
  type Armor,
  type Spell,
  StatsClasses,
  type Weapon,
} from '../utils/types';

export const CharacterCreation = (): JSX.Element => {
  const navigate = useNavigate();
  const { renderError, renderSuccess, renderWarning } = useToast();
  const isSmallScreen = useBreakpointValue({ base: true, lg: false });
  const { chainId, isConnected } = useAccount();
  const {
    components: { Items, StarterItems, UltimateDominionConfig },
    delegatorAddress,
    isSynced,
    systemCalls: { enterGame, mintCharacter, rollStats },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { character, isRefreshing, refreshCharacter } = useCharacter();
  const {
    file: avatar,
    isUploading,
    onRemove,
    onUpload,
    setFile: setAvatar,
  } = useUploadFile({ fileName: 'characterAvatar' });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [characterClass, setCharacterClass] = useState<StatsClasses>(
    StatsClasses.Warrior,
  );
  const [starterItems, setStarterItems] = useState<
    (Armor | Spell | Weapon)[][] | null
  >(null);

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

  useEffect(() => {
    if (isLoadingItemTemplates) return;

    const starterItemTokenIds = Array.from(runQuery([Has(StarterItems)])).map(
      entity => {
        const tokenIds = getComponentValueStrict(StarterItems, entity).itemIds;
        return tokenIds;
      },
    );

    const allTemplates = [
      ...armorTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ];

    const _starterItems = starterItemTokenIds.map(tokenId => {
      const _classSpecificItems = tokenId
        .map(id => {
          const item = allTemplates.find(item => BigInt(item.tokenId) === id);
          if (!item) return null;

          return {
            ...item,
            balance: BigInt(1),
            itemId: zeroHash as Entity,
            owner: zeroAddress,
          };
        })
        .filter(Boolean);

      return _classSpecificItems;
    }) as (Armor | Spell | Weapon)[][];

    setStarterItems(_starterItems);
  }, [
    armorTemplates,
    isLoadingItemTemplates,
    Items,
    spellTemplates,
    StarterItems,
    weaponTemplates,
  ]);

  const onUploadAvatar = useCallback(() => {
    const input = document.getElementById('avatarInput');

    if (input) {
      input.click();
    }
  }, []);

  const onRemoveAvatar = useCallback(() => {
    const input = document.getElementById('avatarInput');

    if (input) {
      (input as HTMLInputElement).value = '';
      onRemove();
    }
  }, [onRemove]);

  const onCreateCharacter = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        setIsCreating(true);

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        if (!(description && name)) {
          setShowError(true);
          renderWarning('Missing required fields.');
          return;
        }

        let image = `https://effigy.im/a/${delegatorAddress}.svg`;

        if (avatar) {
          const avatarCid = await onUpload();
          if (!avatarCid)
            throw new Error(
              'Something went wrong uploading your character avatar.',
            );

          image = `ipfs://${avatarCid}`;
        }

        const characterMetadata = {
          name: name.trim(),
          description: description.trim(),
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
            'Something went wrong uploading your character metadata.',
          );

        const { cid: characterMetadataCid } = await res.json();
        if (!characterMetadataCid)
          throw new Error(
            'Something went wrong uploading your character metadata.',
          );

        const { error, success } = await mintCharacter(
          delegatorAddress,
          name,
          characterMetadataCid,
        );

        if (error && !success) {
          throw new Error(error);
        }

        await refreshCharacter();
        renderSuccess('Character created!');
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to create character.', e);
      } finally {
        setIsCreating(false);
      }
    },
    [
      avatar,
      delegatorAddress,
      description,
      mintCharacter,
      name,
      onUpload,
      refreshCharacter,
      renderError,
      renderSuccess,
      renderWarning,
    ],
  );

  const onRollStats = useCallback(async () => {
    try {
      setIsRollingStats(true);

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const { error, success } = await rollStats(character.id, characterClass);

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      renderSuccess('Stats rolled!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to roll stats.', e);
    } finally {
      setIsRollingStats(false);
    }
  }, [
    character,
    characterClass,
    delegatorAddress,
    refreshCharacter,
    renderError,
    renderSuccess,
    rollStats,
  ]);

  const rolledOnce = useMemo(() => {
    if (!character) return false;
    return character.maxHp !== BigInt(0);
  }, [character]);

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

      const { error, success } = await enterGame(character.id);

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();

      renderSuccess('Your character has awakend!');
      navigate(GAME_BOARD_PATH);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to enter game.', e);
    } finally {
      setIsEnteringGame(false);
    }
  }, [
    character,
    enterGame,
    navigate,
    refreshCharacter,
    renderError,
    renderSuccess,
    rolledOnce,
  ]);

  const isDisabled = useMemo(() => {
    return !character || isCreating || isEnteringGame || isRollingStats;
  }, [character, isCreating, isEnteringGame, isRollingStats]);

  useEffect(() => {
    if (!isConnected) {
      navigate(HOME_PATH);
      window.location.reload();
      return;
    }

    if (character && rolledOnce) {
      setCharacterClass(character.entityClass);
    }

    if (character?.locked) {
      navigate(GAME_BOARD_PATH);
      return;
    }

    if (!delegatorAddress && isSynced) {
      navigate(HOME_PATH);
      return;
    }
  }, [
    character,
    delegatorAddress,
    isConnected,
    isSynced,
    navigate,
    rolledOnce,
  ]);

  const UploadedAvatar = useMemo(() => {
    return (
      <Center
        border="4px solid"
        borderColor="grey300"
        borderRadius="50%"
        boxShadow="-10px -10px 20px 0px #A2A9B0 inset, 10px 10px 20px 0px #54545440 inset, 5px 5px 10px 0px #88919980 inset, -5px -5px 10px 0px #54545440 inset"
        p={1.5}
      >
        <Avatar
          size={{ base: 'lg', sm: 'xl' }}
          src={
            avatar
              ? URL.createObjectURL(avatar)
              : `https://effigy.im/a/${delegatorAddress}.svg`
          }
        />
      </Center>
    );
  }, [avatar, delegatorAddress]);

  if (!starterItems) {
    return (
      <Center h="100vh">
        <Text>An error occurred.</Text>
      </Center>
    );
  }

  return (
    <Stack
      direction={{ base: 'column', lg: 'row' }}
      gap={{ base: 4, sm: 6 }}
      justifyContent="center"
      mx="auto"
      my={{ base: 4, lg: 12 }}
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
                {chainId && EXPLORER_URLS[chainId] ? (
                  <Link
                    color="blue"
                    fontWeight={700}
                    href={`${EXPLORER_URLS[chainId]}/token/${characterToken}`}
                    isExternal
                  >
                    {shortenAddress(characterToken)}
                  </Link>
                ) : (
                  <Text as="span" fontWeight={700}>
                    {shortenAddress(characterToken)}
                  </Text>
                )}
              </Text>
              <Text>|</Text>
              <Text fontSize={{ base: 'xs', md: 'sm' }}>
                Token ID:{' '}
                {chainId && EXPLORER_URLS[chainId] ? (
                  <Link
                    color="blue"
                    fontWeight={700}
                    href={`${EXPLORER_URLS[chainId]}/token/${characterToken}/instance/${character.tokenId}`}
                    isExternal
                  >
                    {character.tokenId.toString()}
                  </Link>
                ) : (
                  <Text as="span" fontWeight={700}>
                    {character.tokenId.toString()}
                  </Text>
                )}
              </Text>
            </HStack>
            <VStack>
              <Heading>{character.name}</Heading>
              <Text textAlign="center">{character.description}</Text>
            </VStack>
            <Text>
              Class: {rolledOnce ? StatsClasses[character.entityClass] : 'None'}
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
            <Heading mb={2} size="sm" textAlign="left">
              Who are you in this dark realm?
            </Heading>
            <Text fontSize="xs" mb={6}>
              Your name, avatar, and description should fit a character you
              might find in a fantasy world. Something like &quot;Sir
              Lancelot&quot; or &quot;A young wizard from the east.&quot;
            </Text>
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
                      isDisabled={isCreating}
                      maxLength={15}
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
                  <FormControl>
                    <Input
                      accept=".png, .jpg, .jpeg, .webp, .svg"
                      id="avatarInput"
                      isDisabled={isCreating}
                      onChange={e =>
                        e.target.files?.[0] && setAvatar(e.target.files?.[0])
                      }
                      style={{ display: 'none' }}
                      type="file"
                    />
                    <Button
                      alignSelf="start"
                      isDisabled={isCreating}
                      isLoading={isUploading}
                      loadingText="Uploading..."
                      onClick={avatar ? onRemoveAvatar : onUploadAvatar}
                      size="sm"
                      type="button"
                    >
                      {avatar ? 'Remove Avatar' : 'Upload Avatar Image'}
                    </Button>
                  </FormControl>
                </VStack>
              </Stack>
              <FormControl isInvalid={showError && !description}>
                <Textarea
                  height="150px"
                  isDisabled={isCreating}
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
          <VStack alignItems="left" spacing={4}>
            <Heading size="sm" textAlign="left">
              Choose Your Class
            </Heading>
            <ButtonGroup justifyContent="space-between">
              <Button
                isDisabled={isDisabled}
                onClick={() => setCharacterClass(StatsClasses.Warrior)}
                size="sm"
                variant={characterClass === 0 ? 'solid' : 'outline'}
                w="150px"
              >
                Warrior
              </Button>
              <Button
                isDisabled={isDisabled}
                onClick={() => setCharacterClass(StatsClasses.Rogue)}
                size="sm"
                variant={characterClass === 1 ? 'solid' : 'outline'}
                w="150px"
              >
                Rogue
              </Button>
              <Button
                isDisabled={isDisabled}
                onClick={() => setCharacterClass(StatsClasses.Mage)}
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
            characterClass !== character.entityClass && (
              <Text color="red" fontSize="sm" mt={2}>
                Your current class is{' '}
                <Text as="span" fontWeight={700}>
                  {StatsClasses[character.entityClass]}
                </Text>
                . Re-roll stats to change class.
              </Text>
            )}
          <SimpleGrid
            columns={{ base: 1, xl: 2 }}
            mb={{ base: 0, lg: 24 }}
            mt={{ base: 8, sm: 12 }}
            spacing={{ base: 12, sm: 16 }}
          >
            <VStack spacing={8}>
              <HStack justify="space-between" w="100%">
                <VStack alignItems="left" spacing={4}>
                  <Heading size="sm" textAlign="left">
                    Roll Stats
                  </Heading>
                  <Button
                    isDisabled={isDisabled}
                    isLoading={isRollingStats}
                    loadingText="Rolling..."
                    onClick={onRollStats}
                    size="sm"
                  >
                    {rolledOnce ? 'Re-roll' : 'Roll'}
                  </Button>
                </VStack>
              </HStack>
              <VStack w="100%">
                <HStack justify="space-between" w="100%">
                  <Text>HP - Hit Points</Text>
                  <Text>{character?.maxHp.toString() ?? '0'}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>STR - Strength</Text>
                  <Text>{character?.strength.toString() ?? '0'}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>AGI - Agility</Text>
                  <Text>{character?.agility.toString() ?? '0'}</Text>
                </HStack>
                <HStack justify="space-between" w="100%">
                  <Text>INT - Intelligence</Text>
                  <Text>{character?.intelligence.toString() ?? '0'}</Text>
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
                <Text>{starterItems[characterClass].length}</Text>
              </HStack>
              <VStack w="100%">
                {starterItems[characterClass].map(item => (
                  <ItemCardSmall
                    key={`starter-item-${StatsClasses[characterClass]}-${item.tokenId}`}
                    {...item}
                  />
                ))}
              </VStack>
            </VStack>
          </SimpleGrid>
          {!isSmallScreen && (
            <Box bottom={10} left={0} mt={16} pos="absolute" px={10} right={0}>
              {character && !rolledOnce && showError && (
                <Text color="red" fontSize="sm" mb={2} textAlign="center">
                  You must roll stats at least once before entering the game.
                </Text>
              )}
              <Button
                isDisabled={isDisabled}
                isLoading={isEnteringGame}
                loadingText="Entering..."
                onClick={onEnterGame}
                type="button"
                width="100%"
              >
                Enter Game
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
              loadingText="Entering..."
              onClick={onEnterGame}
              mt={2}
              type="button"
              width="100%"
            >
              Enter Game
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
