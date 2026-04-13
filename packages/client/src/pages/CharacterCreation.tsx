import {
  Box,
  Button,
  Center,
  HStack,
  Input,
  keyframes,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';

import { ItemAsciiIcon } from '../components/ItemAsciiIcon';
import { PolygonalCard } from '../components/PolygonalCard';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { useUploadFile } from '../hooks/useUploadFile';
import {
  decodeUint256FromKey,
  encodeBytes32Key,
  toNumber,
  useGameConfig,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import { API_URL } from '../utils/constants';
import { debug } from '../utils/debug';
import { type Armor, PowerSource, Race, type Weapon } from '../utils/types';

import { getFundingGate } from './characterCreationFunding';

/** Race a promise against a timeout. Rejects with a user-friendly message. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error('This is taking longer than expected. Please try again.'),
          ),
        ms,
      ),
    ),
  ]);
}

const TX_TIMEOUT_MS = 25_000;

const torchGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 8px rgba(200,122,42,0.3), inset 0 0 8px rgba(200,122,42,0.1);
  }
  50% {
    box-shadow: 0 0 16px rgba(200,122,42,0.5), inset 0 0 12px rgba(200,122,42,0.15);
  }
`;

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

const STAT_COLORS: Record<string, string> = {
  STR: '#B85C3A',
  AGI: '#5A8A3E',
  INT: '#4A7AB5',
};

// Race stat bonuses and display info (names/descriptions resolved via i18n)
const RACE_INFO: Record<
  Race,
  {
    nameKey: string;
    descKey: string;
    icon: string;
    bonuses: { hp: number; str: number; agi: number; int: number };
  }
> = {
  [Race.Human]: {
    nameKey: 'characterCreation.race.human',
    descKey: 'characterCreation.race.humanDesc',
    icon: '🧑',
    bonuses: { hp: 0, str: 1, agi: 1, int: 1 },
  },
  [Race.Elf]: {
    nameKey: 'characterCreation.race.elf',
    descKey: 'characterCreation.race.elfDesc',
    icon: '🧝',
    bonuses: { hp: -1, str: -1, agi: 2, int: 1 },
  },
  [Race.Dwarf]: {
    nameKey: 'characterCreation.race.dwarf',
    descKey: 'characterCreation.race.dwarfDesc',
    icon: '🧔',
    bonuses: { hp: 1, str: 2, agi: -1, int: 0 },
  },
  [Race.None]: {
    nameKey: '',
    descKey: '',
    icon: '',
    bonuses: { hp: 0, str: 0, agi: 0, int: 0 },
  },
};

// Power source display info (names/descriptions resolved via i18n)
const POWER_SOURCE_INFO: Record<
  PowerSource,
  {
    nameKey: string;
    descKey: string;
    icon: string;
    playstyleKey: string;
  }
> = {
  [PowerSource.Divine]: {
    nameKey: 'characterCreation.powerSource.divine',
    descKey: 'characterCreation.powerSource.divineDesc',
    icon: '✨',
    playstyleKey: 'characterCreation.powerSource.divinePlay',
  },
  [PowerSource.Weave]: {
    nameKey: 'characterCreation.powerSource.weave',
    descKey: 'characterCreation.powerSource.weaveDesc',
    icon: '🔮',
    playstyleKey: 'characterCreation.powerSource.weavePlay',
  },
  [PowerSource.Physical]: {
    nameKey: 'characterCreation.powerSource.physical',
    descKey: 'characterCreation.powerSource.physicalDesc',
    icon: '⚔️',
    playstyleKey: 'characterCreation.powerSource.physicalPlay',
  },
  [PowerSource.None]: {
    nameKey: '',
    descKey: '',
    icon: '',
    playstyleKey: '',
  },
};

// Wrapper component that checks if store data is ready
export const CharacterCreation = (): JSX.Element => {
  const config = useGameConfig('UltimateDominionConfig');

  // If config data isn't ready, show loading
  if (!config) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return <CharacterCreationInner />;
};

type CreationPhase =
  | 'name'
  | 'stats'
  | 'race'
  | 'powerSource'
  | 'equipment'
  | 'celebration';

const isRaceSelected = (race?: Race | null): boolean =>
  race != null && Number(race) !== Number(Race.None);

const isPowerSourceSelected = (powerSource?: PowerSource | null): boolean =>
  powerSource != null && Number(powerSource) !== Number(PowerSource.None);

const CharacterCreationInner = (): JSX.Element => {
  const { t } = useTranslation('ui');
  const navigate = useNavigate();
  const { renderError, renderWarning } = useToast();
  const {
    authMethod,
    embeddedIdentityTokenReady,
    isAuthenticated: isConnected,
    isConnecting,
  } = useAuth();
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
  const { character } = useCharacter();
  // Ref tracks live character state for rollback checks after tx completes
  const characterRef = useRef(character);
  const phaseHeadingRef = useRef<HTMLParagraphElement | null>(null);
  characterRef.current = character;
  const { file: avatar, onUpload } = useUploadFile({
    fileName: 'characterAvatar',
  });

  const [name, setName] = useState('');
  // Reactive query: re-renders when StarterItemPool records arrive via store sync
  const starterItemPoolTable = useGameTable('StarterItemPool');

  // Track stat roll count (reactive — updates when StatRollCount table changes)
  const rollCountKey = character?.id
    ? encodeBytes32Key(character.id)
    : undefined;
  const rollCountRow = useGameValue('StatRollCount', rollCountKey);
  const rollCount = toNumber(rollCountRow?.rollCount);
  const rollsRemaining = MAX_STAT_ROLLS - rollCount;
  const rollsExhausted = rollsRemaining <= 0;

  // Implicit class system state
  const [selectedRace, setSelectedRace] = useState<Race>(Race.None);
  const [selectedPowerSource, setSelectedPowerSource] = useState<PowerSource>(
    PowerSource.None,
  );
  // Starter item selection state
  const [selectedStarterWeaponId, setSelectedStarterWeaponId] = useState<
    bigint | null
  >(null);
  const [selectedStarterArmorId, setSelectedStarterArmorId] = useState<
    bigint | null
  >(null);

  const [isCreating, setIsCreating] = useState(false);

  // Phase management
  const [phase, setPhase] = useState<CreationPhase>('name');
  // Track previous stats for comparison arrows on re-roll
  const [prevStats, setPrevStats] = useState<{
    hp: bigint;
    str: bigint;
    agi: bigint;
    int: bigint;
  } | null>(null);
  // Celebration screen
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    phaseHeadingRef.current?.focus();
  }, [phase]);

  const raceTx = useTransaction({
    actionName: 'choose race',
    maxAttempts: 3,
    showSuccessToast: false,
  });

  const powerSourceTx = useTransaction({
    actionName: 'choose power source',
    maxAttempts: 3,
    showSuccessToast: false,
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
    showSuccessToast: false,
  });

  // Derive starter items reactively from store query (re-computes when records arrive)
  const { availableStarterWeapons, availableStarterArmors } = useMemo(() => {
    const starterPoolEntries = Object.entries(starterItemPoolTable);
    if (starterPoolEntries.length === 0 || isLoadingItemTemplates) {
      return {
        availableStarterWeapons: [] as Weapon[],
        availableStarterArmors: [] as Armor[],
      };
    }

    const starterWeapons: Weapon[] = [];
    const starterArmors: Armor[] = [];

    starterPoolEntries.forEach(([keyBytes, poolData]) => {
      if (!poolData.isStarter) return;

      const itemId = decodeUint256FromKey(keyBytes);
      const itemIdStr = itemId.toString();

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

    return {
      availableStarterWeapons: starterWeapons,
      availableStarterArmors: starterArmors,
    };
  }, [
    armorTemplates,
    isLoadingItemTemplates,
    starterItemPoolTable,
    weaponTemplates,
  ]);

  const onCreateCharacter = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        setIsCreating(true);

        if (!delegatorAddress) {
          renderWarning(t('characterCreation.errors.walletInitializing'));
          setIsCreating(false);
          return;
        }

        if (!name) {
          renderWarning(t('characterCreation.errors.nameRequired'));
          return;
        }

        // Auto-generate description from name
        const description = `A mysterious figure known as ${name.trim()}.`;

        let image = `https://effigy.im/a/${delegatorAddress}.svg`;

        if (avatar) {
          const avatarCid = await onUpload();
          if (!avatarCid)
            throw new Error(t('characterCreation.errors.avatarUploadFailed'));

          image = `ipfs://${avatarCid}`;
        }

        const characterMetadata = {
          name: name.trim(),
          description,
          image,
        };

        const uploadUrl = `${API_URL}/api/uploadMetadata?name=characterMetadata.json`;

        try {
          const res = await withTimeout(
            fetch(uploadUrl, {
              method: 'POST',
              body: JSON.stringify(characterMetadata),
              headers: {
                'Content-Type': 'application/json',
              },
            }),
            15_000,
          );

          const responseText = await res.text();

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

          const { url } = responseData;
          if (!url) {
            throw new Error('No URL in response from server');
          }

          // Extract CID from the IPFS gateway URL
          const cid = url.split('/').pop();
          if (!cid) {
            throw new Error(t('characterCreation.errors.invalidMetadataUrl'));
          }

          const { error, success } = await withTimeout(
            mintCharacter(delegatorAddress, name, cid),
            TX_TIMEOUT_MS,
          );

          if (error && !success) {
            throw new Error(error);
          }

          // No success toast — we continue silently to the next step
          setPhase('stats');
        } catch (error) {
          debug.error('Error creating character', error);
          throw error;
        }
      } catch (e) {
        renderError(
          (e as Error)?.message ?? t('characterCreation.errors.creationFailed'),
          e,
        );
      } finally {
        setIsCreating(false);
      }
    },
    [
      avatar,
      delegatorAddress,
      mintCharacter,
      name,
      onUpload,
      renderError,
      renderWarning,
      t,
    ],
  );

  // === Implicit Class System Callbacks ===

  const onChooseRace = useCallback(
    async (race: Race) => {
      if (!delegatorAddress || !character) return;

      setSelectedRace(race);

      const result = await raceTx.execute(async () => {
        const r = await withTimeout(
          chooseRace(character.id, race),
          TX_TIMEOUT_MS,
        );
        if (!r.success) throw new Error(r.error || 'Race selection failed');
        return r;
      });

      // Only revert if on-chain state didn't change (tx truly failed).
      // If retry reported failure but tx actually succeeded, characterRef
      // already reflects the receipt — don't revert.
      if (!result?.success) {
        const current = characterRef.current;
        if (!isRaceSelected(current?.race)) {
          setSelectedRace(Race.None);
        }
        return;
      }

      setPhase('powerSource');
    },
    [character, chooseRace, delegatorAddress, raceTx],
  );

  const onChoosePowerSource = useCallback(
    async (powerSource: PowerSource) => {
      if (!delegatorAddress || !character) return;

      setSelectedPowerSource(powerSource);

      const result = await powerSourceTx.execute(async () => {
        const r = await withTimeout(
          choosePowerSource(character.id, powerSource),
          TX_TIMEOUT_MS,
        );
        if (!r.success)
          throw new Error(r.error || 'Power source selection failed');
        return r;
      });

      if (!result?.success) {
        const current = characterRef.current;
        if (!isPowerSourceSelected(current?.powerSource)) {
          setSelectedPowerSource(PowerSource.None);
        }
        return;
      }

      setPhase('equipment');
    },
    [character, choosePowerSource, delegatorAddress, powerSourceTx],
  );

  const onRollStats = useCallback(async () => {
    if (!delegatorAddress || !character) return;
    if (isRaceSelected(character.race)) {
      renderWarning(t('characterCreation.stats.raceLockedWarning'));
      return;
    }

    // Save current stats for comparison
    if (character.maxHp !== BigInt(0)) {
      setPrevStats({
        hp: character.maxHp,
        str: character.strength,
        agi: character.agility,
        int: character.intelligence,
      });
    }

    await rollStatsTx.execute(async () => {
      const r = await withTimeout(rollBaseStats(character.id), TX_TIMEOUT_MS);
      if (!r.success) throw new Error(r.error || 'Stat roll failed');
      return r;
    });
  }, [
    character,
    delegatorAddress,
    renderWarning,
    rollBaseStats,
    rollStatsTx,
    t,
  ]);

  const rolledOnce = useMemo(() => {
    if (!character) return false;
    return character.maxHp !== BigInt(0);
  }, [character]);

  const onEnterGame = useCallback(async () => {
    if (!character) return;

    if (!rolledOnce) {
      return;
    }

    if (!isRaceSelected(character.race)) {
      setPhase('race');
      return;
    }

    if (!isPowerSourceSelected(character.powerSource)) {
      setPhase('powerSource');
      return;
    }

    if (!selectedStarterWeaponId || !selectedStarterArmorId) {
      renderWarning(t('characterCreation.selectBothWarning'));
      return;
    }

    const result = await enterGameTx.execute(async () => {
      const r = await withTimeout(
        enterGame(
          character.id,
          selectedStarterWeaponId,
          selectedStarterArmorId,
        ),
        TX_TIMEOUT_MS,
      );
      if (!r.success) throw new Error(r.error || 'Enter game failed');
      return r;
    });

    if (result?.success) {
      setShowCelebration(true);
      const createdRace = character.race ?? selectedRace ?? Race.None;
      import('../utils/analytics').then(({ trackCharacterCreated }) =>
        trackCharacterCreated(
          t(RACE_INFO[createdRace]?.nameKey || '', 'Unknown'),
          character.name ?? name ?? '',
        ),
      );
      setTimeout(() => navigate(GAME_BOARD_PATH), 3000);
    }
  }, [
    character,
    enterGame,
    enterGameTx,
    name,
    navigate,
    renderWarning,
    rolledOnce,
    selectedRace,
    selectedStarterWeaponId,
    selectedStarterArmorId,
    t,
  ]);

  const baseDisabled = !character || !delegatorAddress || isCreating;
  const embeddedPreparing =
    authMethod === 'embedded' &&
    (!embeddedIdentityTokenReady ||
      !burnerBalanceFetched ||
      burnerBalance === '0');
  const isStatsDisabled =
    baseDisabled ||
    embeddedPreparing ||
    rollStatsTx.isLoading ||
    raceTx.isLoading ||
    powerSourceTx.isLoading;
  const isEnterGameDisabled =
    baseDisabled ||
    embeddedPreparing ||
    enterGameTx.isLoading ||
    rollStatsTx.isLoading;

  // Calculate dominant stat for display
  const dominantStat = useMemo(() => {
    if (!character || !rolledOnce) return null;
    return getDominantStat(
      character.strength,
      character.agility,
      character.intelligence,
    );
  }, [character, rolledOnce]);

  // Check if a weapon/armor "fits" the dominant stat
  const isRecommended = useCallback(
    (item: Weapon | Armor, dominant: string | null) => {
      if (!dominant) return false;
      if (dominant === 'STR' && item.strModifier > 0n) return true;
      if (dominant === 'AGI' && item.agiModifier > 0n) return true;
      if (dominant === 'INT' && item.intModifier > 0n) return true;
      return false;
    },
    [],
  );

  useEffect(() => {
    if (isConnecting) return;

    if (!isConnected) {
      navigate(HOME_PATH);
      return;
    }

    if (character?.locked) {
      navigate(GAME_BOARD_PATH);
      return;
    }

    if (character) {
      const hasStats = character.maxHp !== BigInt(0);
      const hasRace = isRaceSelected(character.race);
      const hasPowerSource = isPowerSourceSelected(character.powerSource);

      if (hasRace) setSelectedRace(character.race);
      if (hasPowerSource) setSelectedPowerSource(character.powerSource);

      if (phase === 'name') {
        if (!hasStats) setPhase('stats');
        else if (!hasRace) setPhase('race');
        else if (!hasPowerSource) setPhase('powerSource');
        else setPhase('equipment');
      }
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
    phase,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const { needsFunding, awaitingFunding } = getFundingGate(
    authMethod,
    burnerBalanceFetched,
    burnerBalance,
  );

  // Only block on sync — items load in background and are needed at the
  // equipment phase, not for identity/stats phases
  if (!isSynced) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (needsFunding) {
    return (
      <Center h="100vh" flexDirection="column" gap={4} px={4}>
        <Text
          color="#D4A54A"
          fontFamily="Cinzel, serif"
          fontSize="xl"
          fontWeight={600}
        >
          {t('characterCreation.funding.heading')}
        </Text>
        <Text color="#C4B89E" fontSize="sm" textAlign="center" maxW="400px">
          {t('characterCreation.funding.message')}
        </Text>
        <Button
          onClick={onOpenWalletDetailsModal}
          variant="amber"
          px={10}
          py={5}
        >
          {t('characterCreation.funding.depositButton')}
        </Button>
      </Center>
    );
  }

  if (phase !== 'name' && !character) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  // Celebration screen — full takeover after entering game
  if (showCelebration && character) {
    return (
      <VStack
        position="fixed"
        inset={0}
        bg="#12100E"
        zIndex={9999}
        justify="center"
        spacing={6}
      >
        <Box
          position="absolute"
          w="300px"
          h="300px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(200,122,42,0.15) 0%, transparent 70%)"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          animation={`${torchGlow} 3s ease-in-out infinite`}
        />
        <Text
          fontFamily="'Cinzel', serif"
          fontSize={{ base: '28px', sm: '36px' }}
          color="#D4A54A"
          fontWeight={700}
          textAlign="center"
          position="relative"
        >
          {character.name}
        </Text>
        <HStack spacing={3} position="relative">
          <Text fontSize="14px" color="#8A7E6A">
            {t(RACE_INFO[selectedRace]?.nameKey || '')}
          </Text>
          <Text fontSize="14px" color="#3A3228">
            &middot;
          </Text>
          <Text fontSize="14px" color="#8A7E6A">
            {t(POWER_SOURCE_INFO[selectedPowerSource]?.nameKey || '')}
          </Text>
        </HStack>
        <HStack spacing={4} position="relative">
          <Text fontFamily="mono" fontSize="14px" color="#B85C3A">
            STR {character.strength.toString()}
          </Text>
          <Text fontFamily="mono" fontSize="14px" color="#5A8A3E">
            AGI {character.agility.toString()}
          </Text>
          <Text fontFamily="mono" fontSize="14px" color="#4A7AB5">
            INT {character.intelligence.toString()}
          </Text>
        </HStack>
        <Text
          fontFamily="'Cinzel', serif"
          fontSize="16px"
          color="#8A7E6A"
          fontStyle="italic"
          letterSpacing="0.15em"
          mt={4}
          position="relative"
        >
          {t('characterCreation.celebration.journeyBegins')}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack
      minH="100vh"
      justify="center"
      py={{ base: 4, sm: 8 }}
      px={{ base: 2, sm: 4 }}
    >
      <Helmet>
        <title>{t('characterCreation.pageTitle')}</title>
      </Helmet>

      <PolygonalCard maxW="640px" mx="auto" w="100%" p={{ base: 4, sm: 8 }}>
        <VStack spacing={8} w="100%">
          {/* ── PHASE: NAME ── */}
          {phase === 'name' && (
            <>
              <VStack
                as="form"
                spacing={5}
                w="100%"
                onSubmit={onCreateCharacter}
              >
                <Text
                  ref={phaseHeadingRef}
                  tabIndex={-1}
                  fontFamily="'Cinzel', serif"
                  fontSize="22px"
                  color="#D4A54A"
                  fontWeight={700}
                >
                  {t('characterCreation.name.heading')}
                </Text>
                <Input
                  placeholder={t('characterCreation.identity.namePlaceholder')}
                  maxLength={15}
                  bg="#14120F"
                  border="2px solid #3A3228"
                  borderRadius="8px"
                  color="#E8DCC8"
                  fontSize="18px"
                  textAlign="center"
                  value={name}
                  onChange={e =>
                    setName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ''))
                  }
                  isDisabled={isCreating || embeddedPreparing}
                  _focus={{ borderColor: '#C87A2A' }}
                  _placeholder={{ color: '#8A7E6A' }}
                />
                <Button
                  type="submit"
                  variant="amber"
                  w="100%"
                  size="lg"
                  isDisabled={!name || awaitingFunding || embeddedPreparing}
                  isLoading={isCreating || embeddedPreparing}
                  loadingText={
                    embeddedPreparing
                      ? t('characterCreation.name.preparingAccount')
                      : t('characterCreation.identity.loadingText')
                  }
                >
                  {t('characterCreation.name.submitButton', {
                    name: name || '...',
                  })}
                </Button>
              </VStack>
            </>
          )}

          {/* ── PHASE: STATS ── */}
          {phase === 'stats' && character && (
            <>
              <VStack spacing={1}>
                <Text
                  ref={phaseHeadingRef}
                  tabIndex={-1}
                  fontFamily="'Cinzel', serif"
                  fontSize="22px"
                  color="#D4A54A"
                  fontWeight={700}
                >
                  {t('characterCreation.stats.heading')}
                </Text>
                <Text fontSize="13px" color="#8A7E6A">
                  {t('characterCreation.stats.rawHint')}
                </Text>
              </VStack>

              {/* Stats display */}
              <HStack spacing={6} justify="center">
                {[
                  {
                    label: 'HP',
                    value: character.maxHp,
                    color: '#D4A54A',
                    prev: prevStats?.hp,
                  },
                  {
                    label: 'STR',
                    value: character.strength,
                    color: '#B85C3A',
                    prev: prevStats?.str,
                  },
                  {
                    label: 'AGI',
                    value: character.agility,
                    color: '#5A8A3E',
                    prev: prevStats?.agi,
                  },
                  {
                    label: 'INT',
                    value: character.intelligence,
                    color: '#4A7AB5',
                    prev: prevStats?.int,
                  },
                ].map(({ label, value, color, prev }) => (
                  <VStack key={label} spacing={0}>
                    <Text
                      fontFamily="mono"
                      fontSize="28px"
                      color={color}
                      fontWeight={700}
                    >
                      {rolledOnce ? value.toString() : '\u2014'}
                    </Text>
                    <Text fontSize="12px" color={color} fontWeight={600}>
                      {label}
                    </Text>
                    {prev !== undefined && prev !== value && (
                      <Text
                        fontSize="11px"
                        color={value > prev ? '#5A8A3E' : '#B83A2A'}
                        fontFamily="mono"
                      >
                        {value > prev ? '\u25B2' : '\u25BC'}{' '}
                        {Math.abs(Number(value - prev))}
                      </Text>
                    )}
                  </VStack>
                ))}
              </HStack>

              {/* Build indicator */}
              {dominantStat && (
                <Text fontSize="13px" color="#8A7E6A" textAlign="center">
                  {t('characterCreation.stats.buildIndicator')}
                  <Text
                    as="span"
                    color={STAT_COLORS[dominantStat]}
                    fontWeight={600}
                  >
                    {t('characterCreation.stats.buildDominant', {
                      stat: dominantStat,
                    })}
                  </Text>
                </Text>
              )}

              {/* Roll button */}
              <VStack spacing={2} w="100%">
                <Button
                  variant="amber"
                  w="100%"
                  size="lg"
                  isDisabled={isStatsDisabled || rollsExhausted}
                  isLoading={rollStatsTx.isLoading}
                  loadingText={t('characterCreation.stats.rollingText')}
                  onClick={onRollStats}
                >
                  {rolledOnce
                    ? t('characterCreation.stats.rerollButton')
                    : t('characterCreation.stats.rollButton')}
                </Button>
                <Text fontSize="12px" color="#8A7E6A" textAlign="center">
                  {rollsExhausted
                    ? t('characterCreation.stats.noRerolls')
                    : rolledOnce
                      ? t('characterCreation.stats.rerollsRemaining', {
                          count: rollsRemaining,
                        })
                      : ''}
                </Text>
              </VStack>

              {/* Continue button — only after player has rolled at least once */}
              {rolledOnce && rollCount > 0 && (
                <Button
                  variant="white"
                  w="100%"
                  size="md"
                  onClick={() => setPhase('race')}
                >
                  {t('characterCreation.stats.continueButton')}
                </Button>
              )}
            </>
          )}

          {/* ── PHASE: RACE ── */}
          {phase === 'race' && character && (
            <>
              <VStack spacing={1}>
                <Text
                  ref={phaseHeadingRef}
                  tabIndex={-1}
                  fontFamily="'Cinzel', serif"
                  fontSize="22px"
                  color="#D4A54A"
                  fontWeight={700}
                >
                  {t('characterCreation.racePhase.heading')}
                </Text>
                <Text fontSize="13px" color="#8A7E6A" textAlign="center">
                  {t('characterCreation.racePhase.hint')}
                </Text>
              </VStack>
              <HStack
                role="radiogroup"
                aria-label={t('characterCreation.racePhase.heading')}
                spacing={3}
                w="100%"
                justify="center"
                align="stretch"
                flexDirection={{ base: 'column', sm: 'row' }}
              >
                {[Race.Human, Race.Elf, Race.Dwarf].map(race => {
                  const info = RACE_INFO[race];
                  const selected = selectedRace === race;
                  const preview = {
                    hp: character.maxHp + BigInt(info.bonuses.hp),
                    str: character.strength + BigInt(info.bonuses.str),
                    agi: character.agility + BigInt(info.bonuses.agi),
                    int: character.intelligence + BigInt(info.bonuses.int),
                  };
                  return (
                    <VStack
                      as="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${t(info.nameKey)}: ${t(info.descKey)}`}
                      aria-disabled={raceTx.isLoading || embeddedPreparing}
                      key={race}
                      type="button"
                      bg={selected ? '#2E2820' : 'transparent'}
                      border="2px solid"
                      borderColor={selected ? '#C87A2A' : '#3A3228'}
                      borderRadius="8px"
                      cursor={
                        raceTx.isLoading || embeddedPreparing
                          ? 'not-allowed'
                          : 'pointer'
                      }
                      p={4}
                      spacing={2}
                      flex={1}
                      minH="190px"
                      transition="all 0.3s"
                      onClick={() =>
                        !raceTx.isLoading &&
                        !embeddedPreparing &&
                        setSelectedRace(race)
                      }
                      opacity={raceTx.isLoading || embeddedPreparing ? 0.6 : 1}
                      _hover={
                        !raceTx.isLoading && !embeddedPreparing
                          ? {
                              bg: '#2E2820',
                              borderColor: 'rgba(200,122,42,0.5)',
                            }
                          : {}
                      }
                    >
                      <Text fontSize="28px">{info.icon}</Text>
                      <Text
                        fontFamily="'Cinzel', serif"
                        fontSize="14px"
                        color="#E8DCC8"
                        fontWeight={600}
                      >
                        {t(info.nameKey)}
                      </Text>
                      <Text fontSize="12px" color="#8A7E6A" textAlign="center">
                        {t(info.descKey)}
                      </Text>
                      <VStack spacing={0} pt={1}>
                        <Text fontFamily="mono" fontSize="11px" color="#D4A54A">
                          HP {preview.hp.toString()}
                        </Text>
                        <Text fontFamily="mono" fontSize="11px" color="#B85C3A">
                          STR {preview.str.toString()}
                        </Text>
                        <Text fontFamily="mono" fontSize="11px" color="#5A8A3E">
                          AGI {preview.agi.toString()}
                        </Text>
                        <Text fontFamily="mono" fontSize="11px" color="#4A7AB5">
                          INT {preview.int.toString()}
                        </Text>
                      </VStack>
                    </VStack>
                  );
                })}
              </HStack>
              <Button
                variant="amber"
                w="100%"
                size="lg"
                isDisabled={
                  selectedRace === Race.None ||
                  raceTx.isLoading ||
                  embeddedPreparing
                }
                isLoading={raceTx.isLoading || embeddedPreparing}
                loadingText={
                  embeddedPreparing
                    ? t('characterCreation.name.preparingAccount')
                    : t('characterCreation.racePhase.loadingText')
                }
                onClick={() => onChooseRace(selectedRace)}
              >
                {selectedRace === Race.None
                  ? t('characterCreation.racePhase.submitButtonDefault')
                  : t('characterCreation.racePhase.submitButton', {
                      race: t(RACE_INFO[selectedRace].nameKey),
                    })}
              </Button>
            </>
          )}

          {/* ── PHASE: POWER SOURCE ── */}
          {phase === 'powerSource' && character && (
            <>
              <VStack spacing={1}>
                <Text
                  ref={phaseHeadingRef}
                  tabIndex={-1}
                  fontFamily="'Cinzel', serif"
                  fontSize="22px"
                  color="#D4A54A"
                  fontWeight={700}
                >
                  {t('characterCreation.powerPhase.heading')}
                </Text>
                <Text fontSize="13px" color="#8A7E6A" textAlign="center">
                  {t('characterCreation.powerPhase.hint')}
                </Text>
              </VStack>
              <HStack
                role="radiogroup"
                aria-label={t('characterCreation.powerPhase.heading')}
                spacing={3}
                w="100%"
                justify="center"
                align="stretch"
                flexDirection={{ base: 'column', sm: 'row' }}
              >
                {[
                  PowerSource.Divine,
                  PowerSource.Weave,
                  PowerSource.Physical,
                ].map(ps => {
                  const info = POWER_SOURCE_INFO[ps];
                  const selected = selectedPowerSource === ps;
                  return (
                    <VStack
                      as="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${t(info.nameKey)}: ${t(info.descKey)}`}
                      aria-disabled={
                        powerSourceTx.isLoading || embeddedPreparing
                      }
                      key={ps}
                      type="button"
                      bg={selected ? '#2E2820' : 'transparent'}
                      border="2px solid"
                      borderColor={selected ? '#C87A2A' : '#3A3228'}
                      borderRadius="8px"
                      cursor={
                        powerSourceTx.isLoading || embeddedPreparing
                          ? 'not-allowed'
                          : 'pointer'
                      }
                      p={4}
                      spacing={2}
                      flex={1}
                      minH="170px"
                      transition="all 0.3s"
                      onClick={() =>
                        !powerSourceTx.isLoading &&
                        !embeddedPreparing &&
                        setSelectedPowerSource(ps)
                      }
                      opacity={
                        powerSourceTx.isLoading || embeddedPreparing ? 0.6 : 1
                      }
                      _hover={
                        !powerSourceTx.isLoading && !embeddedPreparing
                          ? {
                              bg: '#2E2820',
                              borderColor: 'rgba(200,122,42,0.5)',
                            }
                          : {}
                      }
                    >
                      <Text fontSize="28px">{info.icon}</Text>
                      <Text
                        fontFamily="'Cinzel', serif"
                        fontSize="14px"
                        color="#E8DCC8"
                        fontWeight={600}
                      >
                        {t(info.nameKey)}
                      </Text>
                      <Text
                        fontSize="11px"
                        color="#C87A2A"
                        fontWeight={600}
                        letterSpacing="0.1em"
                        textTransform="uppercase"
                      >
                        {t(info.playstyleKey)}
                      </Text>
                      <Text
                        fontSize="12px"
                        color="#8A7E6A"
                        fontStyle="italic"
                        textAlign="center"
                      >
                        {t(info.descKey)}
                      </Text>
                    </VStack>
                  );
                })}
              </HStack>
              <Button
                variant="amber"
                w="100%"
                size="lg"
                isDisabled={
                  selectedPowerSource === PowerSource.None ||
                  powerSourceTx.isLoading ||
                  embeddedPreparing
                }
                isLoading={powerSourceTx.isLoading || embeddedPreparing}
                loadingText={
                  embeddedPreparing
                    ? t('characterCreation.name.preparingAccount')
                    : t('characterCreation.powerPhase.loadingText')
                }
                onClick={() => onChoosePowerSource(selectedPowerSource)}
              >
                {selectedPowerSource === PowerSource.None
                  ? t('characterCreation.powerPhase.submitButtonDefault')
                  : t('characterCreation.powerPhase.submitButton', {
                      power: t(POWER_SOURCE_INFO[selectedPowerSource].nameKey),
                    })}
              </Button>
            </>
          )}

          {/* ── PHASE: EQUIPMENT ── */}
          {phase === 'equipment' && character && (
            <>
              <Text
                ref={phaseHeadingRef}
                tabIndex={-1}
                fontFamily="'Cinzel', serif"
                fontSize="22px"
                color="#D4A54A"
                fontWeight={700}
              >
                {t('characterCreation.equipment.heading')}
              </Text>

              {isLoadingItemTemplates ? (
                <VStack py={8} spacing={3}>
                  <Spinner color="#C4B89E" size="lg" />
                  <Text fontSize="md" color="#9A9080">
                    {t('characterCreation.equipment.loading')}
                  </Text>
                </VStack>
              ) : (
                <>
                  {/* Weapons */}
                  <VStack spacing={2} w="100%">
                    <Text
                      fontFamily="'Cinzel', serif"
                      fontSize="16px"
                      color="#8A7E6A"
                      letterSpacing="0.1em"
                    >
                      {t('characterCreation.equipment.weaponLabel')}
                    </Text>
                    {availableStarterWeapons.map(weapon => {
                      const selected =
                        selectedStarterWeaponId === BigInt(weapon.tokenId);
                      const recommended = isRecommended(weapon, dominantStat);
                      return (
                        <HStack
                          as="button"
                          type="button"
                          key={`starter-weapon-${weapon.tokenId}`}
                          bg={selected ? '#2E2820' : 'transparent'}
                          border="2px solid"
                          borderColor={selected ? '#C87A2A' : '#3A3228'}
                          borderLeft={
                            recommended ? '4px solid #5A8A3E' : undefined
                          }
                          borderRadius="8px"
                          p={3}
                          w="100%"
                          cursor="pointer"
                          transition="all 0.3s"
                          onClick={() =>
                            setSelectedStarterWeaponId(BigInt(weapon.tokenId))
                          }
                          _hover={{ bg: '#2E2820' }}
                        >
                          <ItemAsciiIcon
                            name={weapon.name}
                            itemType={weapon.itemType}
                            rarity={weapon.rarity}
                            size="32px"
                          />
                          <VStack align="start" spacing={0} flex={1}>
                            <Text
                              fontSize="14px"
                              color="#E8DCC8"
                              fontWeight={600}
                            >
                              {weapon.name}
                            </Text>
                            <HStack spacing={2}>
                              {weapon.strModifier > 0n && (
                                <Text
                                  fontFamily="mono"
                                  fontSize="11px"
                                  color="#B85C3A"
                                >
                                  STR +{weapon.strModifier.toString()}
                                </Text>
                              )}
                              {weapon.agiModifier > 0n && (
                                <Text
                                  fontFamily="mono"
                                  fontSize="11px"
                                  color="#5A8A3E"
                                >
                                  AGI +{weapon.agiModifier.toString()}
                                </Text>
                              )}
                              {weapon.intModifier > 0n && (
                                <Text
                                  fontFamily="mono"
                                  fontSize="11px"
                                  color="#4A7AB5"
                                >
                                  INT +{weapon.intModifier.toString()}
                                </Text>
                              )}
                            </HStack>
                          </VStack>
                          {recommended && (
                            <Text
                              fontSize="10px"
                              color="#5A8A3E"
                              fontWeight={600}
                              letterSpacing="0.05em"
                              textTransform="uppercase"
                            >
                              {t(
                                'characterCreation.equipment.recommendedBadge',
                              )}
                            </Text>
                          )}
                        </HStack>
                      );
                    })}
                  </VStack>

                  {/* Combat triangle hint */}
                  <Text
                    fontSize="11px"
                    color="#8A7E6A"
                    textAlign="center"
                    fontStyle="italic"
                  >
                    {t('characterCreation.equipment.combatTriangleHint')}
                  </Text>

                  {/* Armor */}
                  <VStack spacing={2} w="100%">
                    <Text
                      fontFamily="'Cinzel', serif"
                      fontSize="16px"
                      color="#8A7E6A"
                      letterSpacing="0.1em"
                    >
                      {t('characterCreation.equipment.armorLabel')}
                    </Text>
                    {availableStarterArmors.map(armor => {
                      const selected =
                        selectedStarterArmorId === BigInt(armor.tokenId);
                      return (
                        <HStack
                          as="button"
                          type="button"
                          key={`starter-armor-${armor.tokenId}`}
                          bg={selected ? '#2E2820' : 'transparent'}
                          border="2px solid"
                          borderColor={selected ? '#C87A2A' : '#3A3228'}
                          borderRadius="8px"
                          p={3}
                          w="100%"
                          cursor="pointer"
                          transition="all 0.3s"
                          onClick={() =>
                            setSelectedStarterArmorId(BigInt(armor.tokenId))
                          }
                          _hover={{ bg: '#2E2820' }}
                        >
                          <ItemAsciiIcon
                            name={armor.name}
                            itemType={armor.itemType}
                            rarity={armor.rarity}
                            size="32px"
                          />
                          <VStack align="start" spacing={0} flex={1}>
                            <Text
                              fontSize="14px"
                              color="#E8DCC8"
                              fontWeight={600}
                            >
                              {armor.name}
                            </Text>
                            <HStack spacing={2}>
                              {armor.armorModifier > 0n && (
                                <Text
                                  fontFamily="mono"
                                  fontSize="11px"
                                  color="#D4A54A"
                                >
                                  ARM +{armor.armorModifier.toString()}
                                </Text>
                              )}
                              {armor.strModifier > 0n && (
                                <Text
                                  fontFamily="mono"
                                  fontSize="11px"
                                  color="#B85C3A"
                                >
                                  STR +{armor.strModifier.toString()}
                                </Text>
                              )}
                              {armor.agiModifier > 0n && (
                                <Text
                                  fontFamily="mono"
                                  fontSize="11px"
                                  color="#5A8A3E"
                                >
                                  AGI +{armor.agiModifier.toString()}
                                </Text>
                              )}
                              {armor.intModifier > 0n && (
                                <Text
                                  fontFamily="mono"
                                  fontSize="11px"
                                  color="#4A7AB5"
                                >
                                  INT +{armor.intModifier.toString()}
                                </Text>
                              )}
                            </HStack>
                          </VStack>
                        </HStack>
                      );
                    })}
                  </VStack>

                  {/* Enter button */}
                  <Button
                    variant="amber"
                    w="100%"
                    size="lg"
                    isDisabled={
                      isEnterGameDisabled ||
                      !selectedStarterWeaponId ||
                      !selectedStarterArmorId
                    }
                    isLoading={enterGameTx.isLoading}
                    loadingText={t('characterCreation.equipment.wakingText')}
                    onClick={onEnterGame}
                  >
                    {t('characterCreation.equipment.submitButton')}
                  </Button>
                </>
              )}
            </>
          )}
        </VStack>
      </PolygonalCard>
    </VStack>
  );
};
