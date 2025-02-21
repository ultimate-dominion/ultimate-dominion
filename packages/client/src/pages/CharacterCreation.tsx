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
  Stack,
  Text,
  Textarea,
  Tooltip,
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
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaLock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';
import { useAccount } from 'wagmi';

import { ItemCardSmall } from '../components/ItemCard';
import { PolygonalCard } from '../components/PolygonalCard';
import { MageSvg, RogueSvg, WarriorSvg } from '../components/SVGs';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useUploadFile } from '../hooks/useUploadFile';
import { EXPLORER_URLS } from '../lib/web3';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import { API_URL } from '../utils/constants';
import { debug } from '../utils/debug';
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
    components: { Items, Levels, StarterItems, UltimateDominionConfig },
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

        debug.log('Using API URL', API_URL);
        debug.log('Uploading character metadata', characterMetadata);

        const uploadUrl = `${API_URL}/api/upload?name=characterMetadata.json`;
        debug.log('Full upload URL', uploadUrl);

        try {
          const res = await fetch(uploadUrl, {
            method: 'POST',
            body: JSON.stringify(characterMetadata),
            headers: {
              'Content-Type': 'application/json',
            },
          });

          debug.log('Response status', res.status);
          debug.log('Response ok', res.ok);

          const contentType = res.headers.get('content-type');
          debug.log('Response content type', contentType);

          const responseText = await res.text();
          debug.log('Raw response', responseText);

          if (!res.ok) {
            debug.error('Error response', responseText);
            throw new Error(
              `Failed to upload metadata: ${res.status} ${res.statusText} - ${responseText}`,
            );
          }

          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (parseError) {
            debug.error('Failed to parse response as JSON', parseError);
            throw new Error('Invalid JSON response from server');
          }

          debug.log('Response data', responseData);

          const { url } = responseData;
          if (!url) {
            throw new Error('No URL in response from server');
          }

          // Extract CID from the IPFS gateway URL
          const cid = url.split('/').pop();
          if (!cid) {
            throw new Error('Invalid metadata URL returned from the server.');
          }

          const { error, success } = await mintCharacter(
            delegatorAddress,
            name,
            cid,
          );

          if (error && !success) {
            throw new Error(error);
          }

          await refreshCharacter();
          renderSuccess('Character created!');
        } catch (error) {
          debug.error('Error creating character', error);
          throw error;
        }
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

  const nextLevelXpRequirement =
    useComponentValue(
      Levels,
      encodeEntity({ level: 'uint256' }, { level: BigInt('1') }),
    )?.experience ?? BigInt(0);

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
      w="100%"
    >
      {character && characterToken ? (
        <PolygonalCard
          clipPath="none"
          h="initial"
          p={{ base: 4, sm: 6 }}
          w={{ base: '100%', lg: '50%' }}
        >
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
        </PolygonalCard>
      ) : (
        <PolygonalCard
          as="form"
          clipPath="none"
          h="initial"
          onSubmit={onCreateCharacter}
          w={{ base: '100%', lg: '50%' }}
        >
          <Box
            h={{ base: 'auto', lg: '100%' }}
            position="relative"
            px={{ base: 4, sm: 10 }}
            py={{ base: 4, sm: 6 }}
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
              <Box bottom={6} left={0} position="absolute" px={10} right={0}>
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
            <Box px={4}>
              <Button
                isLoading={isCreating || isRefreshing}
                loadingText="Creating..."
                mb={4}
                mt={2}
                type="submit"
                width="100%"
              >
                Create Character
              </Button>
            </Box>
          )}
        </PolygonalCard>
      )}
      <PolygonalCard
        as="form"
        clipPath="none"
        h="initial"
        onSubmit={(e: React.FormEvent<HTMLDivElement>) => e.preventDefault()}
        w={{ base: '100%', lg: '50%' }}
      >
        <Box position="relative" py={{ base: 4, sm: 6 }}>
          <VStack alignItems="left" spacing={4}>
            <Heading px={{ base: 4, sm: 10 }} size="sm" textAlign="left">
              Choose Your Class
            </Heading>
            <ButtonGroup
              px={{ base: 0, sm: 10 }}
              justifyContent="space-between"
            >
              <Tooltip
                bg="#070D2A"
                label="The Warrior class grants your character 1 additional STR Ability Point per level."
                placement="top"
              >
                <Button
                  leftIcon={
                    <WarriorSvg
                      theme={
                        characterClass === StatsClasses.Warrior
                          ? 'light'
                          : 'dark'
                      }
                    />
                  }
                  bgColor={
                    characterClass === StatsClasses.Warrior
                      ? 'grey500'
                      : undefined
                  }
                  color={
                    characterClass === StatsClasses.Warrior
                      ? 'white'
                      : undefined
                  }
                  isDisabled={isDisabled}
                  onClick={() => setCharacterClass(StatsClasses.Warrior)}
                  size="sm"
                  variant="white"
                  w="150px"
                >
                  Warrior
                </Button>
              </Tooltip>
              <Tooltip
                bg="#070D2A"
                label="The Rogue class grants your character 1 additional AGI Ability Point per level."
                placement="top"
              >
                <Button
                  leftIcon={
                    <RogueSvg
                      theme={
                        characterClass === StatsClasses.Rogue ? 'light' : 'dark'
                      }
                    />
                  }
                  bgColor={
                    characterClass === StatsClasses.Rogue
                      ? 'grey500'
                      : undefined
                  }
                  color={
                    characterClass === StatsClasses.Rogue ? 'white' : undefined
                  }
                  isDisabled={isDisabled}
                  onClick={() => setCharacterClass(StatsClasses.Rogue)}
                  size="sm"
                  variant="white"
                  w="150px"
                >
                  Rogue
                </Button>
              </Tooltip>
              <Tooltip
                bg="#070D2A"
                label="The Mage class grants your character 1 additional INT Ability Point per level."
                placement="top"
              >
                <Button
                  leftIcon={
                    <MageSvg
                      theme={
                        characterClass === StatsClasses.Mage ? 'light' : 'dark'
                      }
                    />
                  }
                  bgColor={
                    characterClass === StatsClasses.Mage ? 'grey500' : undefined
                  }
                  color={
                    characterClass === StatsClasses.Mage ? 'white' : undefined
                  }
                  isDisabled={isDisabled}
                  onClick={() => setCharacterClass(StatsClasses.Mage)}
                  size="sm"
                  variant="white"
                  w="150px"
                >
                  Mage
                </Button>
              </Tooltip>
            </ButtonGroup>
          </VStack>
          {character &&
            rolledOnce &&
            characterClass !== character.entityClass && (
              <Text color="red" fontSize="sm" mt={2} px={{ base: 4, sm: 10 }}>
                Your current class is{' '}
                <Text as="span" fontWeight={700}>
                  {StatsClasses[character.entityClass]}
                </Text>
                . Re-roll stats to change class.
              </Text>
            )}
          <VStack mt={{ base: 8, sm: 12 }} spacing={4}>
            <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
              <Heading size="sm" textAlign="left">
                Stats
              </Heading>
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
            <VStack fontWeight={700} spacing={1.5} w="100%">
              <Box
                backgroundColor="#F5F5FA1F"
                boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#121B45">HP - Hit Points</Text>
                <Text color="grey500" size="lg">
                  {character?.maxHp.toString() ?? '0'}
                </Text>
              </HStack>
              <Box
                backgroundColor="#F5F5FA1F"
                boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#121B45">STR - Strength</Text>
                <Text color="grey500" size="lg">
                  {character?.strength.toString() ?? '0'}
                </Text>
              </HStack>
              <Box
                backgroundColor="#F5F5FA1F"
                boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#121B45">AGI - Agility</Text>
                <Text color="grey500" size="lg">
                  {character?.agility.toString() ?? '0'}
                </Text>
              </HStack>
              <Box
                backgroundColor="#F5F5FA1F"
                boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#121B45">INT - Intelligence</Text>
                <Text color="grey500" size="lg">
                  {character?.intelligence.toString() ?? '0'}
                </Text>
              </HStack>
            </VStack>
          </VStack>
          <VStack mt={4} spacing={2}>
            <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
              <Text color="yellow" fontWeight={700} size="lg">
                5 $GOLD
              </Text>
              <Text color="grey500" fontWeight={500} size="lg">
                0 / {nextLevelXpRequirement.toString()} XP
              </Text>
            </HStack>
            <HStack
              mt={4}
              justify="space-between"
              px={{ base: 4, sm: 10 }}
              w="100%"
            >
              <Heading size="sm">Items</Heading>
              <Text color="grey500" fontWeight={700} size="lg">
                {starterItems[characterClass].length}
              </Text>
            </HStack>
            <VStack spacing={0} w="100%">
              {starterItems[characterClass].map(item => (
                <ItemCardSmall
                  key={`starter-item-${StatsClasses[characterClass]}-${item.tokenId}`}
                  {...item}
                />
              ))}
            </VStack>
          </VStack>
          <Box mt={4} px={{ base: 4, sm: 10 }}>
            {character && !rolledOnce && showError && (
              <Text color="red" fontSize="sm" mb={2} textAlign="center">
                You must roll stats at least once before entering the game.
              </Text>
            )}
            <Button
              isDisabled={isDisabled}
              isLoading={isEnteringGame}
              loadingText="Waking..."
              onClick={onEnterGame}
              size="sm"
              type="button"
              width="100%"
            >
              Wake Up to the Dark Cave
            </Button>
          </Box>
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
      </PolygonalCard>
    </Stack>
  );
};
