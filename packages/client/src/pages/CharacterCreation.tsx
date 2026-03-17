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
import { useTransaction } from '../hooks/useTransaction';
import { useUploadFile } from '../hooks/useUploadFile';
import {
  decodeUint256FromKey,
  encodeBytes32Key,
  encodeUint256Key,
  toBigInt,
  toNumber,
  useGameConfig,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
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

/**
 * Determines whether character creation should be blocked pending wallet funding.
 * - External (MetaMask): user must manually deposit → show "Fund Your Session"
 * - Embedded (Google auth): relayer funds automatically → show loading spinner
 */
export function getFundingGate(
  authMethod: 'embedded' | 'external' | null,
  burnerBalanceFetched: boolean,
  burnerBalance: string,
): { needsFunding: boolean; awaitingFunding: boolean } {
  const zeroBalance = burnerBalanceFetched && burnerBalance === '0';
  return {
    needsFunding: authMethod === 'external' && zeroBalance,
    awaitingFunding: authMethod === 'embedded' && zeroBalance,
  };
}

// Must match MAX_STAT_ROLLS in contracts/constants.sol
const MAX_STAT_ROLLS = 4; // 1 initial roll + 3 re-rolls

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
    description: 'Something answers when you call. The gods are dead, but the channels they carved still carry power.',
    icon: '✨',
  },
  [PowerSource.Weave]: {
    name: 'Weave',
    description: 'The fabric of reality has threads. Most people can\'t see them. You can. Pull the right one and fire blooms.',
    icon: '🔮',
  },
  [PowerSource.Physical]: {
    name: 'Physical',
    description: 'No magic. No prayers. Just you \u2014 your body, your weapon, your will.',
    icon: '⚔️',
  },
};


// Wrapper component that checks if store data is ready
export const CharacterCreation = (): JSX.Element => {
  const { isSynced } = useMUD();
  const config = useGameConfig('UltimateDominionConfig');

  // If config data isn't ready, show loading
  if (!config) {
    console.info('[CharacterCreation] Wrapper: config not ready, isSynced:', isSynced);
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return <CharacterCreationInner />;
};

const CharacterCreationInner = (): JSX.Element => {
  useEffect(() => {
    console.info('[CharacterCreation] Inner component mounted');
  }, []);
  const navigate = useNavigate();
  const { renderError, renderSuccess, renderWarning } = useToast();
  const isSmallScreen = useBreakpointValue({ base: true, lg: false });
  const { authMethod, isAuthenticated: isConnected, isConnecting } = useAuth();
  const chainId = DEFAULT_CHAIN_ID;
  const {
    burnerBalance,
    burnerBalanceFetched,
    delegatorAddress,
    isSynced,
    onOpenWalletDetailsModal,
    systemCalls: {
      chooseRace,
      choosePowerSource,
      enterGame,
      mintCharacter,
      rollBaseStats,
    },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    weaponTemplates,
  } = useItems();
  const { character, isRefreshing } = useCharacter();
  const {
    file: avatar,
    isUploading,
    onRemove,
    onUpload,
    setFile: setAvatar,
  } = useUploadFile({ fileName: 'characterAvatar' });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Reactive query: re-renders when StarterItemPool records arrive via store sync
  const starterItemPoolTable = useGameTable('StarterItemPool');

  // Track stat roll count (reactive — updates when StatRollCount table changes)
  const rollCountKey = character?.id ? encodeBytes32Key(character.id) : undefined;
  const rollCountRow = useGameValue('StatRollCount', rollCountKey);
  const rollCount = toNumber(rollCountRow?.rollCount);
  const rollsRemaining = MAX_STAT_ROLLS - rollCount;
  const rollsExhausted = rollsRemaining <= 0;

  // Implicit class system state
  const [selectedRace, setSelectedRace] = useState<Race>(Race.None);
  const [selectedPowerSource, setSelectedPowerSource] = useState<PowerSource>(PowerSource.None);
  const [creationStep, setCreationStep] = useState<'race' | 'powerSource' | 'stats' | 'starterItems'>('race');
  // Starter item selection state
  const [selectedStarterWeaponId, setSelectedStarterWeaponId] = useState<bigint | null>(null);
  const [selectedStarterArmorId, setSelectedStarterArmorId] = useState<bigint | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [showError, setShowError] = useState(false);

  const raceTx = useTransaction({
    actionName: 'choose race',
    maxAttempts: 3,
    showSuccessToast: true,
  });

  const powerSourceTx = useTransaction({
    actionName: 'choose power source',
    maxAttempts: 3,
    showSuccessToast: true,
  });

  const rollStatsTx = useTransaction({
    actionName: 'roll stats',
    maxAttempts: 3,
    showSuccessToast: true,
    successMessage: 'Stats rolled!',
  });

  const enterGameTx = useTransaction({
    actionName: 'enter game',
    maxAttempts: 3,
    showSuccessToast: true,
    successMessage: 'Your character has awakened!',
  });

  const configData = useGameConfig('UltimateDominionConfig');
  const characterToken = configData?.characterToken as string | undefined ?? null;

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [avatar, description, name]);

  // Derive starter items reactively from store query (re-computes when records arrive)
  const { availableStarterWeapons, availableStarterArmors } = useMemo(() => {
    const starterPoolEntries = Object.entries(starterItemPoolTable);
    console.info('[StarterItems] StarterItemPool entries:', starterPoolEntries.length, 'isLoadingTemplates:', isLoadingItemTemplates, 'weapons:', weaponTemplates.length, 'armors:', armorTemplates.length);
    if (starterPoolEntries.length === 0 || isLoadingItemTemplates) {
      return { availableStarterWeapons: [] as Weapon[], availableStarterArmors: [] as Armor[] };
    }

    const starterWeapons: Weapon[] = [];
    const starterArmors: Armor[] = [];

    starterPoolEntries.forEach(([keyBytes, poolData]) => {
      if (!poolData.isStarter) return;

      const itemId = decodeUint256FromKey(keyBytes);
      const itemIdStr = itemId.toString();
      console.info('[StarterItems] Checking itemId:', itemIdStr, 'weaponMatch:', weaponTemplates.some(w => w.tokenId === itemIdStr), 'armorMatch:', armorTemplates.some(a => a.tokenId === itemIdStr));

      const weapon = weaponTemplates.find(w => w.tokenId === itemIdStr);
      if (weapon) {
        starterWeapons.push({
          ...weapon,
          balance: BigInt(1),
          itemId: zeroHash,
          owner: zeroAddress,
        });
        return;
      }

      const armor = armorTemplates.find(a => a.tokenId === itemIdStr);
      if (armor) {
        starterArmors.push({
          ...armor,
          balance: BigInt(1),
          itemId: zeroHash,
          owner: zeroAddress,
        });
      }
    });

    return { availableStarterWeapons: starterWeapons, availableStarterArmors: starterArmors };
  }, [
    armorTemplates,
    isLoadingItemTemplates,
    starterItemPoolTable,
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
          renderWarning('Wallet still initializing — please wait a moment and try again.');
          setIsCreating(false);
          return;
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
      renderError,
      renderSuccess,
      renderWarning,
    ],
  );

  // === Implicit Class System Callbacks ===

  const onChooseRace = useCallback(async (race: Race) => {
    if (!delegatorAddress || !character) return;

    setSelectedRace(race);
    setCreationStep('powerSource');

    const result = await raceTx.execute(async () => {
      const r = await chooseRace(character.id, race);
      if (!r.success) throw new Error(r.error || 'Race selection failed');
      return r;
    });

    if (!result?.success) {
      setSelectedRace(Race.None);
      setCreationStep('race');
      renderError('Race selection failed. Please try again.');
    }
  }, [character, chooseRace, delegatorAddress, raceTx, renderError]);

  const onChoosePowerSource = useCallback(async (powerSource: PowerSource) => {
    if (!delegatorAddress || !character) return;

    setSelectedPowerSource(powerSource);
    setCreationStep('stats');

    const result = await powerSourceTx.execute(async () => {
      const r = await choosePowerSource(character.id, powerSource);
      if (!r.success) throw new Error(r.error || 'Power source selection failed');
      return r;
    });

    if (!result?.success) {
      setSelectedPowerSource(PowerSource.None);
      setCreationStep('powerSource');
      renderError('Power source selection failed. Please try again.');
    }
  }, [character, choosePowerSource, delegatorAddress, powerSourceTx, renderError]);

  const onRollStats = useCallback(async () => {
    if (!delegatorAddress || !character) return;

    await rollStatsTx.execute(async () => {
      const r = await rollBaseStats(character.id);
      if (!r.success) throw new Error(r.error || 'Stat roll failed');
      return r;
    });
  }, [character, delegatorAddress, rollBaseStats, rollStatsTx]);

  const rolledOnce = useMemo(() => {
    if (!character) return false;
    return character.maxHp !== BigInt(0);
  }, [character]);

  const onEnterGame = useCallback(async () => {
    if (!character) return;

    if (!rolledOnce) {
      return;
    }

    if (!selectedStarterWeaponId || !selectedStarterArmorId) {
      renderWarning('Please select both a starter weapon and armor.');
      return;
    }

    const result = await enterGameTx.execute(async () => {
      const r = await enterGame(character.id, selectedStarterWeaponId, selectedStarterArmorId);
      if (!r.success) throw new Error(r.error || 'Enter game failed');
      return r;
    });

    if (result?.success) {
      navigate(GAME_BOARD_PATH);
    }
  }, [
    character,
    enterGame,
    enterGameTx,
    navigate,
    renderWarning,
    rolledOnce,
    selectedStarterWeaponId,
    selectedStarterArmorId,
  ]);

  const isDisabled = useMemo(() => {
    return !character || !delegatorAddress || isCreating || enterGameTx.isLoading || rollStatsTx.isLoading || raceTx.isLoading || powerSourceTx.isLoading;
  }, [character, delegatorAddress, isCreating, enterGameTx.isLoading, rollStatsTx.isLoading, raceTx.isLoading, powerSourceTx.isLoading]);

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
    if (isConnecting) return;

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

    // External wallet users need delegation to play — redirect if missing.
    // Embedded users always own the wallet directly (no delegation needed).
    if (authMethod !== 'embedded' && !delegatorAddress && isSynced) {
      navigate(HOME_PATH);
      return;
    }
  }, [
    authMethod,
    character,
    delegatorAddress,
    isConnected,
    isConnecting,
    isSynced,
    navigate,
    rolledOnce,
  ]);

  const levelsRow = useGameValue('Levels', encodeUint256Key(BigInt(1)));
  const nextLevelXpRequirement = levelsRow ? toBigInt(levelsRow.experience) : BigInt(0);

  const UploadedAvatar = useMemo(() => {
    return (
      <Center
        border="4px solid"
        borderColor="grey300"
        borderRadius="50%"
        boxShadow="2px 2px 6px rgba(0,0,0,0.5) inset, -1px -1px 3px rgba(60,50,40,0.15) inset"
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

  const { needsFunding, awaitingFunding } = getFundingGate(authMethod, burnerBalanceFetched, burnerBalance);

  // Only block on sync — items load in background and are needed at the
  // starterItems step, not for race/powerSource/stats steps
  if (!isSynced) {
    console.info('[CharacterCreation] Blocked on sync');
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (needsFunding) {
    return (
      <Center h="100vh" flexDirection="column" gap={4} px={4}>
        <Text color="#D4A54A" fontFamily="Cinzel, serif" fontSize="xl" fontWeight={600}>
          Fund Your Session
        </Text>
        <Text color="#C4B89E" fontSize="sm" textAlign="center" maxW="400px">
          Your session account needs a small ETH deposit to cover gameplay fees on Base.
          Your funds stay in your session and can be withdrawn anytime.
        </Text>
        <Button onClick={onOpenWalletDetailsModal} variant="amber" px={10} py={5}>
          Deposit ETH
        </Button>
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
      {character ? (
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
            {!!characterToken && (
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
            )}
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
                      onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ''))}
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
                      accept=".png, .jpg, .jpeg, .webp, .svg, .gif"
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
                  isDisabled={awaitingFunding}
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
                isDisabled={awaitingFunding}
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
                      fontSize="xs"
                      fontWeight={isCurrent ? 700 : 400}
                      color={isCompleted ? 'green' : isCurrent ? 'blue400' : '#9A9080'}
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
              <Text px={{ base: 4, sm: 10 }} fontSize="md" color="#C4B89E">
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
                    bg="#14120F"
                    label={RACE_INFO[race].description}
                    placement="top"
                  >
                    <Button
                      leftIcon={<Text fontSize="xl">{RACE_INFO[race].icon}</Text>}
                      bgColor={selectedRace === race ? 'grey500' : undefined}
                      color={selectedRace === race ? 'white' : undefined}
                      isDisabled={isDisabled}
                      isLoading={raceTx.isLoading && selectedRace === race}
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
              <Text px={{ base: 4, sm: 10 }} fontSize="md" color="#C4B89E">
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
                    bg="#14120F"
                    label={POWER_SOURCE_INFO[ps].description}
                    placement="top"
                  >
                    <Button
                      leftIcon={<Text fontSize="xl">{POWER_SOURCE_INFO[ps].icon}</Text>}
                      bgColor={selectedPowerSource === ps ? 'grey500' : undefined}
                      color={selectedPowerSource === ps ? 'white' : undefined}
                      isDisabled={isDisabled}
                      isLoading={powerSourceTx.isLoading && selectedPowerSource === ps}
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
                <Text fontSize="md" color="#C4B89E">
                  Race: <Text as="span" fontWeight={700}>{RACE_INFO[selectedRace]?.name ?? 'None'}</Text>
                </Text>
                <Text fontSize="md" color="#C4B89E">
                  Power: <Text as="span" fontWeight={700}>{POWER_SOURCE_INFO[selectedPowerSource]?.name ?? 'None'}</Text>
                </Text>
              </VStack>
              {dominantStat && (
                <Box px={{ base: 4, sm: 10 }} py={2} bg="grey100" borderRadius="md">
                  <Text fontSize="md" fontWeight={700} color="#C4B89E">
                    At Level 10, you can choose any advanced class!
                  </Text>
                  <Text fontSize="sm" color="#9A9080">
                    Current build: {dominantStat}-dominant
                  </Text>
                </Box>
              )}
              <Box px={{ base: 4, sm: 10 }} w="100%">
                <Button
                  isDisabled={isDisabled || !hasCompletedChoices || rollsExhausted}
                  isLoading={rollStatsTx.isLoading}
                  loadingText="Rolling..."
                  onClick={onRollStats}
                  size="lg"
                  width="100%"
                >
                  {rolledOnce ? 'Re-Roll Stats' : 'Roll Stats'}
                </Button>
                {rolledOnce && !rollsExhausted && (
                  <Text fontSize="xs" color="#9A9080" textAlign="center" mt={2}>
                    {rollsRemaining} re-roll{rollsRemaining !== 1 ? 's' : ''} remaining — it's free.
                  </Text>
                )}
                {rollsExhausted && (
                  <Text fontSize="xs" color="#D4A54A" textAlign="center" mt={2}>
                    No re-rolls remaining. These are your final stats.
                  </Text>
                )}
              </Box>
            </VStack>
          )}

          {/* Step 4: Starter Items - shown after rolling stats */}
          {creationStep === 'starterItems' && (
            <VStack alignItems="left" spacing={4}>
              <Heading px={{ base: 4, sm: 10 }} size="sm" textAlign="left">
                Step 4: Choose Your Starter Equipment
              </Heading>
              {isLoadingItemTemplates ? (
                <VStack py={8} spacing={3}>
                  <Spinner color="#C4B89E" size="lg" />
                  <Text fontSize="md" color="#9A9080">Loading available equipment...</Text>
                </VStack>
              ) : (
                <Text px={{ base: 4, sm: 10 }} fontSize="md" color="#C4B89E">
                  Select one weapon and one armor to begin your adventure.
                </Text>
              )}
            </VStack>
          )}
          <VStack mt={{ base: 8, sm: 12 }} spacing={4}>
            <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
              <Heading size="sm" textAlign="left">
                Stats
              </Heading>
            </HStack>
            <VStack fontWeight={700} spacing={1.5} w="100%" opacity={rolledOnce ? 1 : 0.5}>
              <Box
                backgroundColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#D4A54A" fontSize="md">HP - Hit Points</Text>
                <Text color="#C4B89E" fontFamily="mono" fontSize="lg">
                  {rolledOnce ? character?.maxHp.toString() : '—'}
                </Text>
              </HStack>
              <Box
                backgroundColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#B85C3A" fontSize="md">STR - Strength</Text>
                <Text color="#C4B89E" fontFamily="mono" fontSize="lg">
                  {rolledOnce ? character?.strength.toString() : '—'}
                </Text>
              </HStack>
              <Box
                backgroundColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#5A8A3E" fontSize="md">AGI - Agility</Text>
                <Text color="#C4B89E" fontFamily="mono" fontSize="lg">
                  {rolledOnce ? character?.agility.toString() : '—'}
                </Text>
              </HStack>
              <Box
                backgroundColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="6px"
                w="100%"
              />
              <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
                <Text color="#4A7AB5" fontSize="md">INT - Intelligence</Text>
                <Text color="#C4B89E" fontFamily="mono" fontSize="lg">
                  {rolledOnce ? character?.intelligence.toString() : '—'}
                </Text>
              </HStack>
            </VStack>
          </VStack>
          <VStack mt={4} spacing={2}>
            <HStack justify="space-between" px={{ base: 4, sm: 10 }} w="100%">
              <Text color="yellow" fontFamily="mono" fontWeight={700} fontSize="lg">
                5 Gold
              </Text>
              <Text color="#C4B89E" fontFamily="mono" fontWeight={500} fontSize="lg">
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
                {availableStarterWeapons.length === 0 && (
                  <Text px={{ base: 4, sm: 10 }} fontSize="sm" color="#9A9080">
                    No starter weapons available. Zone data may need reloading.
                  </Text>
                )}
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
                {availableStarterArmors.length === 0 && (
                  <Text px={{ base: 4, sm: 10 }} fontSize="sm" color="#9A9080">
                    No starter armor available. Zone data may need reloading.
                  </Text>
                )}
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
            {creationStep === 'stats' && rolledOnce && (
              <Button
                isDisabled={isDisabled}
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
                isLoading={enterGameTx.isLoading}
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
