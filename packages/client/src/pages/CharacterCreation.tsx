import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
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
  Spinner,
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
import { decodeEntity, encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FaLock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';
import { useAuth } from '../contexts/AuthContext';

import { ItemCardSmall } from '../components/ItemCard';
import { PolygonalCard } from '../components/PolygonalCard';
import { MageSvg, RogueSvg, WarriorSvg } from '../components/SVGs';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useUploadFile } from '../hooks/useUploadFile';
import { DEFAULT_CHAIN_ID, EXPLORER_URLS } from '../lib/web3';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import { API_URL } from '../utils/constants';
import { debug } from '../utils/debug';
import { shortenAddress } from '../utils/helpers';
import {
  type Armor,
  ArmorType,
  PowerSource,
  Race,
  type Weapon,
} from '../utils/types';

// Helper to determine dominant stat for display purposes
const getDominantStat = (
  strength: bigint,
  agility: bigint,
  intelligence: bigint,
): string => {
  if (agility > strength && agility >= intelligence) {
    return 'AGI';
  } else if (intelligence > strength && intelligence > agility) {
    return 'INT';
  }
  return 'STR';
};

// Race descriptions and stat bonuses
const RACE_INFO = {
  [Race.Human]: {
    name: 'Human',
    description: 'Balanced and versatile. +1 STR, +1 AGI, +1 INT',
    icon: '🧑',
  },
  [Race.Elf]: {
    name: 'Elf',
    description: 'Graceful and wise. +2 AGI, +1 INT, -1 STR, -1 HP',
    icon: '🧝',
  },
  [Race.Dwarf]: {
    name: 'Dwarf',
    description: 'Sturdy and strong. +2 STR, +1 HP, -1 AGI',
    icon: '🧔',
  },
};

// Power source descriptions
const POWER_SOURCE_INFO = {
  [PowerSource.Divine]: {
    name: 'Divine',
    description: 'Channel holy or natural power. Healing and protection.',
    icon: '✨',
  },
  [PowerSource.Weave]: {
    name: 'Weave',
    description: 'Tap into arcane magic. Raw magical power.',
    icon: '🔮',
  },
  [PowerSource.Physical]: {
    name: 'Physical',
    description: 'Master of martial skills. Weapon mastery.',
    icon: '⚔️',
  },
};


// Wrapper component that checks if MUD components are ready
export const CharacterCreation = (): JSX.Element => {
  const { components, isSynced } = useMUD();

  // If components aren't ready, show loading
  if (!components?.UltimateDominion) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return <CharacterCreationInner />;
};

const CharacterCreationInner = (): JSX.Element => {
  const navigate = useNavigate();
  const { renderError, renderSuccess, renderWarning } = useToast();
  const isSmallScreen = useBreakpointValue({ base: true, lg: false });
  const { isAuthenticated: isConnected } = useAuth();
  const chainId = DEFAULT_CHAIN_ID;
  const {
    components,
    delegatorAddress,
    isSynced,
    systemCalls: {
      chooseRace,
      choosePowerSource,
      enterGame,
      mintCharacter,
      rollBaseStats,
    },
  } = useMUD();
  const Levels = components?.Levels;
  const StarterItemPool = components?.StarterItemPool;
  const UltimateDominion = components?.UltimateDominion;
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
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
  // Available starter items (weapons and armors in the starter pool)
  const [availableStarterWeapons, setAvailableStarterWeapons] = useState<Weapon[]>([]);
  const [availableStarterArmors, setAvailableStarterArmors] = useState<Armor[]>([]);

  // Implicit class system state
  const [selectedRace, setSelectedRace] = useState<Race>(Race.None);
  const [selectedPowerSource, setSelectedPowerSource] = useState<PowerSource>(PowerSource.None);
  const [creationStep, setCreationStep] = useState<'race' | 'powerSource' | 'stats' | 'starterItems'>('race');
  const [isChoosingRace, setIsChoosingRace] = useState(false);
  const [isChoosingPowerSource, setIsChoosingPowerSource] = useState(false);

  // Starter item selection state
  const [selectedStarterWeaponId, setSelectedStarterWeaponId] = useState<bigint | null>(null);
  const [selectedStarterArmorId, setSelectedStarterArmorId] = useState<bigint | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isRollingStats, setIsRollingStats] = useState(false);
  const [isEnteringGame, setIsEnteringGame] = useState(false);

  const { characterToken } = useComponentValue(
    UltimateDominion,
    singletonEntity,
  ) ?? { characterToken: null };

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [avatar, description, name]);

  // Load available starter items from StarterItemPool
  useEffect(() => {
    if (!isSynced || isLoadingItemTemplates || !StarterItemPool) {
      return;
    }

    // Query StarterItemPool for items that are starters
    const starterPoolEntities = Array.from(runQuery([Has(StarterItemPool)]));

    const starterWeapons: Weapon[] = [];
    const starterArmors: Armor[] = [];

    starterPoolEntities.forEach(entity => {
      const poolData = getComponentValueStrict(StarterItemPool, entity);
      if (!poolData.isStarter) return;

      // The itemId is encoded in the entity (it's the table key)
      const { itemId } = decodeEntity({ itemId: 'uint256' }, entity);
      const itemIdStr = itemId.toString();

      // Check if it's a weapon
      const weapon = weaponTemplates.find(w => w.tokenId === itemIdStr);
      if (weapon) {
        starterWeapons.push({
          ...weapon,
          balance: BigInt(1),
          itemId: zeroHash as Entity,
          owner: zeroAddress,
        });
        return;
      }

      // Check if it's an armor
      const armor = armorTemplates.find(a => a.tokenId === itemIdStr);
      if (armor) {
        starterArmors.push({
          ...armor,
          balance: BigInt(1),
          itemId: zeroHash as Entity,
          owner: zeroAddress,
        });
      }
    });

    setAvailableStarterWeapons(starterWeapons);
    setAvailableStarterArmors(starterArmors);
  }, [
    armorTemplates,
    isLoadingItemTemplates,
    isSynced,
    StarterItemPool,
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

        debug.log('=== VERCEL TEST 2025-02-21 12:37 ===');
        debug.log('Using API URL', API_URL);
        debug.log('Uploading character metadata', characterMetadata);

        const uploadUrl = `${API_URL}/api/uploadMetadata?name=characterMetadata.json`;
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

  // === Implicit Class System Callbacks ===

  const onChooseRace = useCallback(async (race: Race) => {
    try {
      setIsChoosingRace(true);
      setSelectedRace(race);

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const { error, success } = await chooseRace(character.id, race);

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      setCreationStep('powerSource');
      renderSuccess(`Race selected: ${RACE_INFO[race].name}`);
    } catch (e) {
      setSelectedRace(Race.None);
      renderError((e as Error)?.message ?? 'Failed to choose race.', e);
    } finally {
      setIsChoosingRace(false);
    }
  }, [character, chooseRace, delegatorAddress, refreshCharacter, renderError, renderSuccess]);

  const onChoosePowerSource = useCallback(async (powerSource: PowerSource) => {
    try {
      setIsChoosingPowerSource(true);
      setSelectedPowerSource(powerSource);

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const { error, success } = await choosePowerSource(character.id, powerSource);

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      setCreationStep('stats');
      renderSuccess(`Power source selected: ${POWER_SOURCE_INFO[powerSource].name}`);
    } catch (e) {
      setSelectedPowerSource(PowerSource.None);
      renderError((e as Error)?.message ?? 'Failed to choose power source.', e);
    } finally {
      setIsChoosingPowerSource(false);
    }
  }, [character, choosePowerSource, delegatorAddress, refreshCharacter, renderError, renderSuccess]);

  const onRollStats = useCallback(async () => {
    try {
      setIsRollingStats(true);

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      // Use the new rollBaseStats for the implicit class system
      const { error, success } = await rollBaseStats(character.id);

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
    delegatorAddress,
    refreshCharacter,
    renderError,
    renderSuccess,
    rollBaseStats,
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

      if (!selectedStarterWeaponId || !selectedStarterArmorId) {
        throw new Error('Please select both a starter weapon and armor.');
      }

      const { error, success } = await enterGame(
        character.id,
        selectedStarterWeaponId,
        selectedStarterArmorId
      );

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();

      renderSuccess('Your character has awakened!');
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
    selectedStarterWeaponId,
    selectedStarterArmorId,
  ]);

  const isDisabled = useMemo(() => {
    return !character || isCreating || isEnteringGame || isRollingStats || isChoosingRace || isChoosingPowerSource;
  }, [character, isCreating, isEnteringGame, isRollingStats, isChoosingRace, isChoosingPowerSource]);

  // Check if race and power source have been chosen (armor is chosen via starter item selection)
  const hasCompletedChoices = useMemo(() => {
    if (!character) return false;
    return selectedRace !== Race.None && selectedPowerSource !== PowerSource.None;
  }, [character, selectedRace, selectedPowerSource]);

  // Calculate dominant stat for display
  const dominantStat = useMemo(() => {
    if (!character || !rolledOnce) return null;
    return getDominantStat(
      character.strength,
      character.agility,
      character.intelligence,
    );
  }, [character, rolledOnce]);

  useEffect(() => {
    if (!isConnected) {
      navigate(HOME_PATH);
      return;
    }

    // Sync implicit class state from character
    if (character) {
      if (character.race && character.race !== Race.None) {
        setSelectedRace(character.race);
        if (character.powerSource && character.powerSource !== PowerSource.None) {
          setSelectedPowerSource(character.powerSource);
          setCreationStep('stats');
        } else {
          setCreationStep('powerSource');
        }
      }
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

  // Show loading state while syncing or loading item templates
  if (!isSynced || isLoadingItemTemplates) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
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
      <Helmet>
        <title>Create Character | Ultimate Dominion</title>
      </Helmet>
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
            <Accordion allowToggle w="100%">
              <AccordionItem border="none">
                <AccordionButton justifyContent="center" px={0}>
                  <Text fontSize="xs" color="grey400">Advanced Details</Text>
                  <AccordionIcon ml={1} />
                </AccordionButton>
                <AccordionPanel pb={2}>
                  <HStack spacing={4} justifyContent="center">
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
                      Character ID:{' '}
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
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
            <VStack>
              <Heading>{character.name}</Heading>
              <Text textAlign="center">{character.description}</Text>
            </VStack>
            <VStack spacing={1}>
              {selectedRace !== Race.None && (
                <Text fontSize="sm">Race: {RACE_INFO[selectedRace]?.name ?? 'None'}</Text>
              )}
              {selectedPowerSource !== PowerSource.None && (
                <Text fontSize="sm">Power: {POWER_SOURCE_INFO[selectedPowerSource]?.name ?? 'None'}</Text>
              )}
              {dominantStat && (
                <Text fontSize="sm" fontWeight={700} color="blue.500">
                  Dominant Stat: {dominantStat}
                </Text>
              )}
            </VStack>
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
                      <FormHelperText color="red" role="alert">
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
                  <FormHelperText color="red" role="alert">Bio is required</FormHelperText>
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
          <HStack px={{ base: 4, sm: 10 }} mb={4} justifyContent="center" spacing={0} w="100%">
            {['Race', 'Power', 'Stats', 'Equip'].map((label, index) => {
              const steps = ['race', 'powerSource', 'stats', 'starterItems'];
              const currentIndex = steps.indexOf(creationStep);
              const isCompleted = index < currentIndex;
              const isCurrent = index === currentIndex;
              return (
                <HStack key={label} spacing={0} flex={1}>
                  <VStack spacing={0} flex={0}>
                    <Box
                      w={6}
                      h={6}
                      borderRadius="50%"
                      bg={isCompleted ? 'green' : isCurrent ? 'blue400' : 'grey200'}
                      color="white"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="xs"
                      fontWeight={700}
                    >
                      {isCompleted ? '\u2713' : index + 1}
                    </Box>
                    <Text
                      fontSize="2xs"
                      fontWeight={isCurrent ? 700 : 400}
                      color={isCompleted ? 'green' : isCurrent ? 'blue400' : 'grey500'}
                      mt={0.5}
                    >
                      {label}
                    </Text>
                  </VStack>
                  {index < 3 && (
                    <Box
                      flex={1}
                      h="2px"
                      bg={isCompleted ? 'green' : 'grey200'}
                      mb={4}
                    />
                  )}
                </HStack>
              );
            })}
          </HStack>
          {/* Step 1: Race Selection */}
          {creationStep === 'race' && (
            <VStack alignItems="left" spacing={4}>
              <Heading px={{ base: 4, sm: 10 }} size="sm" textAlign="left">
                Step 1: Choose Your Race
              </Heading>
              <Text px={{ base: 4, sm: 10 }} fontSize="sm" color="grey500">
                Your race determines your innate abilities and stat bonuses.
              </Text>
              <ButtonGroup
                px={{ base: 4, sm: 10 }}
                flexDirection="column"
                spacing={2}
                w="100%"
              >
                {[Race.Human, Race.Elf, Race.Dwarf].map((race) => (
                  <Tooltip
                    key={race}
                    bg="#070D2A"
                    label={RACE_INFO[race].description}
                    placement="top"
                  >
                    <Button
                      leftIcon={<Text fontSize="xl">{RACE_INFO[race].icon}</Text>}
                      bgColor={selectedRace === race ? 'grey500' : undefined}
                      color={selectedRace === race ? 'white' : undefined}
                      isDisabled={isDisabled}
                      isLoading={isChoosingRace && selectedRace === race}
                      onClick={() => onChooseRace(race)}
                      size="sm"
                      variant="white"
                      w="100%"
                      justifyContent="flex-start"
                    >
                      {RACE_INFO[race].name}
                    </Button>
                  </Tooltip>
                ))}
              </ButtonGroup>
            </VStack>
          )}

          {/* Step 2: Power Source Selection */}
          {creationStep === 'powerSource' && (
            <VStack alignItems="left" spacing={4}>
              <Heading px={{ base: 4, sm: 10 }} size="sm" textAlign="left">
                Step 2: Choose Your Power Source
              </Heading>
              <Text px={{ base: 4, sm: 10 }} fontSize="sm" color="grey500">
                Your power source shapes how you channel your abilities.
              </Text>
              <ButtonGroup
                px={{ base: 4, sm: 10 }}
                flexDirection="column"
                spacing={2}
                w="100%"
              >
                {[PowerSource.Divine, PowerSource.Weave, PowerSource.Physical].map((ps) => (
                  <Tooltip
                    key={ps}
                    bg="#070D2A"
                    label={POWER_SOURCE_INFO[ps].description}
                    placement="top"
                  >
                    <Button
                      leftIcon={<Text fontSize="xl">{POWER_SOURCE_INFO[ps].icon}</Text>}
                      bgColor={selectedPowerSource === ps ? 'grey500' : undefined}
                      color={selectedPowerSource === ps ? 'white' : undefined}
                      isDisabled={isDisabled}
                      isLoading={isChoosingPowerSource && selectedPowerSource === ps}
                      onClick={() => onChoosePowerSource(ps)}
                      size="sm"
                      variant="white"
                      w="100%"
                      justifyContent="flex-start"
                    >
                      {POWER_SOURCE_INFO[ps].name}
                    </Button>
                  </Tooltip>
                ))}
              </ButtonGroup>
            </VStack>
          )}

          {/* Step 3: Stats - shown after race and power source chosen */}
          {creationStep === 'stats' && (
            <VStack alignItems="left" spacing={4}>
              <Heading px={{ base: 4, sm: 10 }} size="sm" textAlign="left">
                Step 3: Roll Your Stats
              </Heading>
              <VStack px={{ base: 4, sm: 10 }} spacing={1} alignItems="flex-start">
                <Text fontSize="sm" color="grey500">
                  Race: <Text as="span" fontWeight={700}>{RACE_INFO[selectedRace]?.name ?? 'None'}</Text>
                </Text>
                <Text fontSize="sm" color="grey500">
                  Power: <Text as="span" fontWeight={700}>{POWER_SOURCE_INFO[selectedPowerSource]?.name ?? 'None'}</Text>
                </Text>
              </VStack>
              {dominantStat && (
                <Box px={{ base: 4, sm: 10 }} py={2} bg="grey100" borderRadius="md">
                  <Text fontSize="sm" fontWeight={700} color="grey600">
                    At Level 10, you can choose any advanced class!
                  </Text>
                  <Text fontSize="xs" color="grey500">
                    Current build: {dominantStat}-dominant
                  </Text>
                </Box>
              )}
            </VStack>
          )}

          {/* Step 4: Starter Items - shown after rolling stats */}
          {creationStep === 'starterItems' && (
            <VStack alignItems="left" spacing={4}>
              <Heading px={{ base: 4, sm: 10 }} size="sm" textAlign="left">
                Step 4: Choose Your Starter Equipment
              </Heading>
              <Text px={{ base: 4, sm: 10 }} fontSize="sm" color="grey500">
                Select one weapon and one armor to begin your adventure.
              </Text>
            </VStack>
          )}
          <VStack mt={{ base: 8, sm: 12 }} spacing={4}>
            <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
              <Heading size="sm" textAlign="left">
                Stats
              </Heading>
              {creationStep === 'stats' && (
                <Button
                  isDisabled={isDisabled || !hasCompletedChoices}
                  isLoading={isRollingStats}
                  loadingText="Rolling..."
                  onClick={onRollStats}
                  size="sm"
                >
                  {rolledOnce ? 'Re-roll' : 'Roll Stats'}
                </Button>
              )}
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
                <Text color="grey500" fontFamily="mono" size="lg">
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
                <Text color="grey500" fontFamily="mono" size="lg">
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
                <Text color="grey500" fontFamily="mono" size="lg">
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
                <Text color="grey500" fontFamily="mono" size="lg">
                  {character?.intelligence.toString() ?? '0'}
                </Text>
              </HStack>
            </VStack>
          </VStack>
          <VStack mt={4} spacing={2}>
            <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
              <Text color="yellow" fontFamily="mono" fontWeight={700} size="lg">
                5 Gold
              </Text>
              <Text color="grey500" fontFamily="mono" fontWeight={500} size="lg">
                0 / {nextLevelXpRequirement.toString()} XP
              </Text>
            </HStack>
            {/* Starter Equipment Selection - only shown in starterItems step */}
            {creationStep === 'starterItems' && (
              <>
                <HStack
                  mt={4}
                  justify="space-between"
                  px={{ base: 4, sm: 10 }}
                  w="100%"
                >
                  <Heading size="sm">Select Weapon</Heading>
                </HStack>
                <VStack spacing={0} w="100%">
                  {availableStarterWeapons.map(weapon => {
                    const restrictions = weapon.statRestrictions;
                    const meetsRequirements = character &&
                      BigInt(character.strength) >= BigInt(restrictions?.minStrength ?? 0) &&
                      BigInt(character.agility) >= BigInt(restrictions?.minAgility ?? 0) &&
                      BigInt(character.intelligence) >= BigInt(restrictions?.minIntelligence ?? 0);
                    return (
                      <Box
                        key={`starter-weapon-${weapon.tokenId}`}
                        w="100%"
                        cursor={meetsRequirements ? "pointer" : "not-allowed"}
                        opacity={meetsRequirements ? 1 : 0.5}
                        onClick={() => meetsRequirements && setSelectedStarterWeaponId(BigInt(weapon.tokenId))}
                        bg={selectedStarterWeaponId === BigInt(weapon.tokenId) ? 'blue.100' : undefined}
                        borderLeft={selectedStarterWeaponId === BigInt(weapon.tokenId) ? '4px solid' : undefined}
                        borderColor="blue.500"
                      >
                        <ItemCardSmall {...weapon} />
                        {!meetsRequirements && (
                          <Text fontSize="xs" color="red.500" px={4} pb={2}>
                            Requires: {restrictions?.minStrength ? `${restrictions.minStrength} STR ` : ''}
                            {restrictions?.minAgility ? `${restrictions.minAgility} AGI ` : ''}
                            {restrictions?.minIntelligence ? `${restrictions.minIntelligence} INT` : ''}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </VStack>

                <HStack
                  mt={4}
                  justify="space-between"
                  px={{ base: 4, sm: 10 }}
                  w="100%"
                >
                  <Heading size="sm">Select Armor</Heading>
                </HStack>
                <VStack spacing={0} w="100%">
                  {availableStarterArmors.map(armor => {
                    const restrictions = armor.statRestrictions;
                    const meetsRequirements = character &&
                      BigInt(character.strength) >= BigInt(restrictions?.minStrength ?? 0) &&
                      BigInt(character.agility) >= BigInt(restrictions?.minAgility ?? 0) &&
                      BigInt(character.intelligence) >= BigInt(restrictions?.minIntelligence ?? 0);
                    return (
                      <Box
                        key={`starter-armor-${armor.tokenId}`}
                        w="100%"
                        cursor={meetsRequirements ? "pointer" : "not-allowed"}
                        opacity={meetsRequirements ? 1 : 0.5}
                        onClick={() => meetsRequirements && setSelectedStarterArmorId(BigInt(armor.tokenId))}
                        bg={selectedStarterArmorId === BigInt(armor.tokenId) ? 'blue.100' : undefined}
                        borderLeft={selectedStarterArmorId === BigInt(armor.tokenId) ? '4px solid' : undefined}
                        borderColor="blue.500"
                      >
                        <ItemCardSmall {...armor} />
                        {!meetsRequirements && (
                          <Text fontSize="xs" color="red.500" px={4} pb={2}>
                            Requires: {restrictions?.minStrength ? `${restrictions.minStrength} STR ` : ''}
                            {restrictions?.minAgility ? `${restrictions.minAgility} AGI ` : ''}
                            {restrictions?.minIntelligence ? `${restrictions.minIntelligence} INT` : ''}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </VStack>
              </>
            )}
          </VStack>
          <Box mt={4} px={{ base: 4, sm: 10 }}>
            {character && !rolledOnce && showError && creationStep === 'stats' && (
              <Text color="red" fontSize="sm" mb={2} role="alert" textAlign="center">
                You must roll stats at least once before continuing.
              </Text>
            )}
            {creationStep === 'stats' && (
              <Button
                isDisabled={isDisabled || !rolledOnce}
                onClick={() => setCreationStep('starterItems')}
                size="sm"
                type="button"
                width="100%"
              >
                Continue to Starter Items
              </Button>
            )}
            {creationStep === 'starterItems' && (
              <Button
                isDisabled={isDisabled || !selectedStarterWeaponId || !selectedStarterArmorId}
                isLoading={isEnteringGame}
                loadingText="Waking..."
                onClick={onEnterGame}
                size="sm"
                type="button"
                width="100%"
              >
                Wake Up to the Dark Cave
              </Button>
            )}
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
