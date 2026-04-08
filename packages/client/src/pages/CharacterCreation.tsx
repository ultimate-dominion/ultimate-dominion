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
import { useAuth } from '../contexts/AuthContext';

import { PolygonalCard } from '../components/PolygonalCard';
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
import { ItemAsciiIcon } from '../components/ItemAsciiIcon';
import {
  type Armor,
  PowerSource,
  Race,
  type Weapon,
} from '../utils/types';

/** Race a promise against a timeout. Rejects with a user-friendly message. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('This is taking longer than expected. Please try again.')), ms),
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

const STAT_COLORS: Record<string, string> = {
  STR: '#B85C3A',
  AGI: '#5A8A3E',
  INT: '#4A7AB5',
};

// Race stat bonuses and display info (names/descriptions resolved via i18n)
const RACE_INFO: Record<Race, {
  nameKey: string;
  descKey: string;
  icon: string;
  bonuses: { hp: number; str: number; agi: number; int: number };
}> = {
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
const POWER_SOURCE_INFO: Record<PowerSource, {
  nameKey: string;
  descKey: string;
  icon: string;
  playstyleKey: string;
}> = {
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

// Title suffixes for the identity button (i18n keys)
const POWER_SOURCE_TITLE: Record<PowerSource, string> = {
  [PowerSource.Divine]: 'characterCreation.powerSource.divineTitle',
  [PowerSource.Weave]: 'characterCreation.powerSource.weaveTitle',
  [PowerSource.Physical]: 'characterCreation.powerSource.physicalTitle',
  [PowerSource.None]: '',
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

type CreationPhase = 'identity' | 'stats' | 'equipment' | 'celebration';

const CharacterCreationInner = (): JSX.Element => {
  const { t } = useTranslation('ui');
  useEffect(() => {
    console.info('[CharacterCreation] Inner component mounted');
  }, []);
  const navigate = useNavigate();
  const { renderError, renderWarning } = useToast();
  const { authMethod, isAuthenticated: isConnected, isConnecting } = useAuth();
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
  characterRef.current = character;
  const {
    file: avatar,
    onUpload,
  } = useUploadFile({ fileName: 'characterAvatar' });

  const [name, setName] = useState('');
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
  // Starter item selection state
  const [selectedStarterWeaponId, setSelectedStarterWeaponId] = useState<bigint | null>(null);
  const [selectedStarterArmorId, setSelectedStarterArmorId] = useState<bigint | null>(null);

  const [isCreating, setIsCreating] = useState(false);

  // Phase management
  const [phase, setPhase] = useState<CreationPhase>('identity');
  // Identity submission progress (3 dots: mint, race, powerSource)
  const [identityStep, setIdentityStep] = useState(0);
  // Track previous stats for comparison arrows on re-roll
  const [prevStats, setPrevStats] = useState<{ hp: bigint; str: bigint; agi: bigint; int: bigint } | null>(null);
  // Celebration screen
  const [showCelebration, setShowCelebration] = useState(false);

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
            throw new Error(
              t('characterCreation.errors.avatarUploadFailed'),
            );

          image = `ipfs://${avatarCid}`;
        }

        const characterMetadata = {
          name: name.trim(),
          description,
          image,
        };

        debug.log('=== VERCEL TEST 2025-02-21 12:37 ===');
        debug.log('Using API URL', API_URL);
        debug.log('Uploading character metadata', characterMetadata);

        const uploadUrl = `${API_URL}/api/uploadMetadata?name=characterMetadata.json`;
        debug.log('Full upload URL', uploadUrl);

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
          setIdentityStep(1);
        } catch (error) {
          debug.error('Error creating character', error);
          throw error;
        }
      } catch (e) {
        renderError((e as Error)?.message ?? t('characterCreation.errors.creationFailed'), e);
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

  const onChooseRace = useCallback(async (race: Race) => {
    if (!delegatorAddress || !character) return;

    setSelectedRace(race);

    const result = await raceTx.execute(async () => {
      const r = await withTimeout(chooseRace(character.id, race), TX_TIMEOUT_MS);
      if (!r.success) throw new Error(r.error || 'Race selection failed');
      return r;
    });

    // Only revert if on-chain state didn't change (tx truly failed).
    // If retry reported failure but tx actually succeeded, characterRef
    // already reflects the receipt — don't revert.
    if (!result?.success) {
      const current = characterRef.current;
      if (!current?.race || current.race === Race.None) {
        setSelectedRace(Race.None);
      }
    }
  }, [character, chooseRace, delegatorAddress, raceTx]);

  const onChoosePowerSource = useCallback(async (powerSource: PowerSource) => {
    if (!delegatorAddress || !character) return;

    setSelectedPowerSource(powerSource);

    const result = await powerSourceTx.execute(async () => {
      const r = await withTimeout(choosePowerSource(character.id, powerSource), TX_TIMEOUT_MS);
      if (!r.success) throw new Error(r.error || 'Power source selection failed');
      return r;
    });

    if (!result?.success) {
      const current = characterRef.current;
      if (!current?.powerSource || current.powerSource === PowerSource.None) {
        setSelectedPowerSource(PowerSource.None);
      }
    }
  }, [character, choosePowerSource, delegatorAddress, powerSourceTx]);

  const onRollStats = useCallback(async () => {
    if (!delegatorAddress || !character) return;

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
      renderWarning(t('characterCreation.selectBothWarning'));
      return;
    }

    const result = await enterGameTx.execute(async () => {
      const r = await withTimeout(enterGame(character.id, selectedStarterWeaponId, selectedStarterArmorId), TX_TIMEOUT_MS);
      if (!r.success) throw new Error(r.error || 'Enter game failed');
      return r;
    });

    if (result?.success) {
      setShowCelebration(true);
      import('../utils/analytics').then(({ trackCharacterCreated }) =>
        trackCharacterCreated(t(RACE_INFO[selectedRace]?.nameKey || '', 'Unknown'), name ?? ''),
      );
      setTimeout(() => navigate(GAME_BOARD_PATH), 3000);
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
    t,
  ]);

  // Orchestrate identity submission: mint → race → powerSource
  // Step 1→2: character appears in store after mint → fire race tx
  useEffect(() => {
    if (identityStep === 1 && character && selectedRace !== Race.None) {
      setIdentityStep(2);
      onChooseRace(selectedRace).then(() => {
        setIdentityStep(3);
      });
    }
  }, [identityStep, character]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 3→done: race confirmed → fire power source tx → move to stats phase
  useEffect(() => {
    if (identityStep === 3 && character && selectedPowerSource !== PowerSource.None) {
      onChoosePowerSource(selectedPowerSource).then(() => {
        setPhase('stats');
        setIdentityStep(0);
      });
    }
  }, [identityStep]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseDisabled = !character || !delegatorAddress || isCreating;
  const isStatsDisabled = baseDisabled || rollStatsTx.isLoading || raceTx.isLoading || powerSourceTx.isLoading;
  const isEnterGameDisabled = baseDisabled || enterGameTx.isLoading || rollStatsTx.isLoading;

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
  const isRecommended = useCallback((item: Weapon | Armor, dominant: string | null) => {
    if (!dominant) return false;
    if (dominant === 'STR' && item.strModifier > 0n) return true;
    if (dominant === 'AGI' && item.agiModifier > 0n) return true;
    if (dominant === 'INT' && item.intModifier > 0n) return true;
    return false;
  }, []);

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
          // If we have stats, move to stats phase; if locked, go to celebration
          if (character.maxHp !== BigInt(0)) {
            if (phase === 'identity') setPhase('stats');
          } else {
            if (phase === 'identity') setPhase('stats');
          }
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
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const { needsFunding, awaitingFunding } = getFundingGate(authMethod, burnerBalanceFetched, burnerBalance);

  // Only block on sync — items load in background and are needed at the
  // equipment phase, not for identity/stats phases
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
          {t('characterCreation.funding.heading')}
        </Text>
        <Text color="#C4B89E" fontSize="sm" textAlign="center" maxW="400px">
          {t('characterCreation.funding.message')}
        </Text>
        <Button onClick={onOpenWalletDetailsModal} variant="amber" px={10} py={5}>
          {t('characterCreation.funding.depositButton')}
        </Button>
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
          <Text fontSize="14px" color="#8A7E6A">{t(RACE_INFO[selectedRace]?.nameKey || '')}</Text>
          <Text fontSize="14px" color="#3A3228">&middot;</Text>
          <Text fontSize="14px" color="#8A7E6A">{t(POWER_SOURCE_INFO[selectedPowerSource]?.nameKey || '')}</Text>
        </HStack>
        <HStack spacing={4} position="relative">
          <Text fontFamily="mono" fontSize="14px" color="#B85C3A">STR {character.strength.toString()}</Text>
          <Text fontFamily="mono" fontSize="14px" color="#5A8A3E">AGI {character.agility.toString()}</Text>
          <Text fontFamily="mono" fontSize="14px" color="#4A7AB5">INT {character.intelligence.toString()}</Text>
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

  // Handle the identity submit: batched mint + race + powerSource
  const onSubmitIdentity = async (e: React.FormEvent) => {
    if (selectedRace === Race.None || selectedPowerSource === PowerSource.None) {
      renderWarning(t('characterCreation.identity.warning'));
      return;
    }

    // Character already minted (previous session interrupted) — resume from
    // wherever they left off. Contract reverts on duplicate race/powerSource
    // calls, so skip steps that are already done.
    if (character) {
      const hasRace = character.race != null && character.race !== Race.None;
      const hasPowerSource = character.powerSource != null && character.powerSource !== PowerSource.None;

      if (hasRace && hasPowerSource) {
        // Fully set — go straight to stats
        setPhase('stats');
        return;
      }
      if (hasRace) {
        // Race done, need powerSource — jump to step 3
        setIdentityStep(3);
        return;
      }
      // Need race (+ powerSource) — step 1 triggers the chain
      setIdentityStep(1);
      return;
    }

    // Step 1: mint character
    await onCreateCharacter(e);
    // Steps 2-3 are handled by useEffect watching identityStep + character
  };

  return (
    <VStack minH="100vh" justify="center" py={{ base: 4, sm: 8 }} px={{ base: 2, sm: 4 }}>
      <Helmet>
        <title>{t('characterCreation.pageTitle')}</title>
      </Helmet>

      <PolygonalCard maxW="640px" mx="auto" w="100%" p={{ base: 4, sm: 8 }}>
        <VStack spacing={8} w="100%">

          {/* ── PHASE: IDENTITY ── */}
          {phase === 'identity' && (
            <>
              {/* Name */}
              <VStack spacing={3} w="100%">
                <Text fontFamily="'Cinzel', serif" fontSize="22px" color="#D4A54A" fontWeight={700}>
                  {t('characterCreation.identity.heading')}
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
                  onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ''))}
                  isDisabled={isCreating || identityStep > 0}
                  _focus={{ borderColor: '#C87A2A' }}
                  _placeholder={{ color: '#8A7E6A' }}
                />
              </VStack>

              {/* Race */}
              <VStack spacing={3} w="100%">
                <Text fontFamily="'Cinzel', serif" fontSize="16px" color="#8A7E6A" letterSpacing="0.1em">
                  {t('characterCreation.identity.raceLabel')}
                </Text>
                <HStack spacing={3} w="100%" justify="center">
                  {[Race.Human, Race.Elf, Race.Dwarf].map((race) => {
                    const info = RACE_INFO[race];
                    const selected = selectedRace === race;
                    return (
                      <VStack
                        as="button"
                        key={race}
                        type="button"
                        bg={selected ? '#2E2820' : 'transparent'}
                        border="2px solid"
                        borderColor={selected ? '#C87A2A' : '#3A3228'}
                        borderRadius="8px"
                        cursor={isCreating ? 'not-allowed' : 'pointer'}
                        p={4}
                        spacing={1}
                        flex={1}
                        transition="all 0.3s"
                        onClick={() => !isCreating && setSelectedRace(race)}
                        opacity={isCreating ? 0.6 : 1}
                        _hover={!isCreating ? { bg: '#2E2820', borderColor: 'rgba(200,122,42,0.5)' } : {}}
                      >
                        <Text fontSize="28px">{info.icon}</Text>
                        <Text fontFamily="'Cinzel', serif" fontSize="14px" color="#E8DCC8" fontWeight={600}>
                          {t(info.nameKey)}
                        </Text>
                        <Text fontSize="12px" color="#8A7E6A">{t(info.descKey)}</Text>
                      </VStack>
                    );
                  })}
                </HStack>
                {/* Live stat preview */}
                {selectedRace !== Race.None && (
                  <HStack spacing={4} justify="center">
                    {(['str', 'agi', 'int'] as const).map(stat => {
                      const val = RACE_INFO[selectedRace].bonuses[stat];
                      const labels = { str: 'STR', agi: 'AGI', int: 'INT' };
                      const colors = { str: '#B85C3A', agi: '#5A8A3E', int: '#4A7AB5' };
                      return (
                        <Text key={stat} fontFamily="mono" fontSize="12px" color={colors[stat]}>
                          {labels[stat]} {val > 0 ? '+' : ''}{val}
                        </Text>
                      );
                    })}
                  </HStack>
                )}
              </VStack>

              {/* Power Source */}
              <VStack spacing={3} w="100%">
                <Text fontFamily="'Cinzel', serif" fontSize="16px" color="#8A7E6A" letterSpacing="0.1em">
                  {t('characterCreation.identity.powerLabel')}
                </Text>
                <HStack spacing={3} w="100%" justify="center">
                  {[PowerSource.Divine, PowerSource.Weave, PowerSource.Physical].map((ps) => {
                    const info = POWER_SOURCE_INFO[ps];
                    const selected = selectedPowerSource === ps;
                    return (
                      <VStack
                        as="button"
                        key={ps}
                        type="button"
                        bg={selected ? '#2E2820' : 'transparent'}
                        border="2px solid"
                        borderColor={selected ? '#C87A2A' : '#3A3228'}
                        borderRadius="8px"
                        cursor={isCreating ? 'not-allowed' : 'pointer'}
                        p={4}
                        spacing={1}
                        flex={1}
                        transition="all 0.3s"
                        onClick={() => !isCreating && setSelectedPowerSource(ps)}
                        opacity={isCreating ? 0.6 : 1}
                        _hover={!isCreating ? { bg: '#2E2820', borderColor: 'rgba(200,122,42,0.5)' } : {}}
                      >
                        <Text fontSize="28px">{info.icon}</Text>
                        <Text fontFamily="'Cinzel', serif" fontSize="14px" color="#E8DCC8" fontWeight={600}>
                          {t(info.nameKey)}
                        </Text>
                        <Text fontSize="11px" color="#C87A2A" fontWeight={600} letterSpacing="0.1em" textTransform="uppercase">
                          {t(info.playstyleKey)}
                        </Text>
                        <Text fontSize="12px" color="#8A7E6A" fontStyle="italic">{t(info.descKey)}</Text>
                      </VStack>
                    );
                  })}
                </HStack>
              </VStack>

              {/* Submit */}
              <VStack spacing={2} w="100%">
                <Button
                  variant="amber"
                  w="100%"
                  size="lg"
                  isDisabled={!name || selectedRace === Race.None || selectedPowerSource === PowerSource.None || awaitingFunding}
                  isLoading={isCreating || identityStep > 0}
                  loadingText={t('characterCreation.identity.loadingText')}
                  onClick={onSubmitIdentity}
                >
                  {name && selectedRace !== Race.None && selectedPowerSource !== PowerSource.None
                    ? t('characterCreation.identity.submitButton', { name, race: t(RACE_INFO[selectedRace].nameKey), power: t(POWER_SOURCE_TITLE[selectedPowerSource]) })
                    : t('characterCreation.identity.submitButtonDefault', { name: name || '...' })}
                </Button>
                {/* Progress dots */}
                {identityStep > 0 && (
                  <HStack spacing={3} justify="center" mt={2}>
                    <Box w="8px" h="8px" borderRadius="full" bg={identityStep >= 1 ? '#C87A2A' : '#3A3228'} transition="all 0.5s" />
                    <Box w="8px" h="8px" borderRadius="full" bg={identityStep >= 2 ? '#C87A2A' : '#3A3228'} transition="all 0.5s" />
                    <Box w="8px" h="8px" borderRadius="full" bg={identityStep >= 3 ? '#C87A2A' : '#3A3228'} transition="all 0.5s" />
                  </HStack>
                )}
              </VStack>
            </>
          )}

          {/* ── PHASE: STATS ── */}
          {phase === 'stats' && character && (
            <>
              <VStack spacing={1}>
                <Text fontFamily="'Cinzel', serif" fontSize="22px" color="#D4A54A" fontWeight={700}>
                  {t('characterCreation.stats.heading')}
                </Text>
                <HStack spacing={2}>
                  <Text fontSize="13px" color="#8A7E6A">{t('characterCreation.stats.racePrefix', { name: t(RACE_INFO[selectedRace]?.nameKey || '') })}</Text>
                  <Text fontSize="13px" color="#3A3228">|</Text>
                  <Text fontSize="13px" color="#8A7E6A">{t('characterCreation.stats.powerPrefix', { name: t(POWER_SOURCE_INFO[selectedPowerSource]?.nameKey || '') })}</Text>
                </HStack>
              </VStack>

              {/* Stats display */}
              <HStack spacing={6} justify="center">
                {[
                  { label: 'HP', value: character.maxHp, color: '#D4A54A', prev: prevStats?.hp },
                  { label: 'STR', value: character.strength, color: '#B85C3A', prev: prevStats?.str },
                  { label: 'AGI', value: character.agility, color: '#5A8A3E', prev: prevStats?.agi },
                  { label: 'INT', value: character.intelligence, color: '#4A7AB5', prev: prevStats?.int },
                ].map(({ label, value, color, prev }) => (
                  <VStack key={label} spacing={0}>
                    <Text fontFamily="mono" fontSize="28px" color={color} fontWeight={700}>
                      {rolledOnce ? value.toString() : '\u2014'}
                    </Text>
                    <Text fontSize="12px" color={color} fontWeight={600}>{label}</Text>
                    {prev !== undefined && prev !== value && (
                      <Text fontSize="11px" color={value > prev ? '#5A8A3E' : '#B83A2A'} fontFamily="mono">
                        {value > prev ? '\u25B2' : '\u25BC'} {Math.abs(Number(value - prev))}
                      </Text>
                    )}
                  </VStack>
                ))}
              </HStack>

              {/* Build indicator */}
              {dominantStat && (
                <Text fontSize="13px" color="#8A7E6A" textAlign="center">
                  {t('characterCreation.stats.buildIndicator')}<Text as="span" color={STAT_COLORS[dominantStat]} fontWeight={600}>{t('characterCreation.stats.buildDominant', { stat: dominantStat })}</Text>
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
                  {rolledOnce ? t('characterCreation.stats.rerollButton') : t('characterCreation.stats.rollButton')}
                </Button>
                <Text fontSize="12px" color="#8A7E6A" textAlign="center">
                  {rollsExhausted
                    ? t('characterCreation.stats.noRerolls')
                    : rolledOnce
                      ? t('characterCreation.stats.rerollsRemaining', { count: rollsRemaining })
                      : ''}
                </Text>
              </VStack>

              {/* Continue button — only after player has rolled at least once */}
              {rolledOnce && rollCount > 0 && (
                <Button
                  variant="white"
                  w="100%"
                  size="md"
                  onClick={() => setPhase('equipment')}
                >
                  {t('characterCreation.stats.continueButton')}
                </Button>
              )}
            </>
          )}

          {/* ── PHASE: EQUIPMENT ── */}
          {phase === 'equipment' && character && (
            <>
              <Text fontFamily="'Cinzel', serif" fontSize="22px" color="#D4A54A" fontWeight={700}>
                {t('characterCreation.equipment.heading')}
              </Text>

              {isLoadingItemTemplates ? (
                <VStack py={8} spacing={3}>
                  <Spinner color="#C4B89E" size="lg" />
                  <Text fontSize="md" color="#9A9080">{t('characterCreation.equipment.loading')}</Text>
                </VStack>
              ) : (
                <>
                  {/* Weapons */}
                  <VStack spacing={2} w="100%">
                    <Text fontFamily="'Cinzel', serif" fontSize="16px" color="#8A7E6A" letterSpacing="0.1em">
                      {t('characterCreation.equipment.weaponLabel')}
                    </Text>
                    {availableStarterWeapons.map(weapon => {
                      const selected = selectedStarterWeaponId === BigInt(weapon.tokenId);
                      const recommended = isRecommended(weapon, dominantStat);
                      return (
                        <HStack
                          as="button"
                          type="button"
                          key={`starter-weapon-${weapon.tokenId}`}
                          bg={selected ? '#2E2820' : 'transparent'}
                          border="2px solid"
                          borderColor={selected ? '#C87A2A' : '#3A3228'}
                          borderLeft={recommended ? '4px solid #5A8A3E' : undefined}
                          borderRadius="8px"
                          p={3}
                          w="100%"
                          cursor="pointer"
                          transition="all 0.3s"
                          onClick={() => setSelectedStarterWeaponId(BigInt(weapon.tokenId))}
                          _hover={{ bg: '#2E2820' }}
                        >
                          <ItemAsciiIcon name={weapon.name} itemType={weapon.itemType} rarity={weapon.rarity} size="32px" />
                          <VStack align="start" spacing={0} flex={1}>
                            <Text fontSize="14px" color="#E8DCC8" fontWeight={600}>{weapon.name}</Text>
                            <HStack spacing={2}>
                              {weapon.strModifier > 0n && <Text fontFamily="mono" fontSize="11px" color="#B85C3A">STR +{weapon.strModifier.toString()}</Text>}
                              {weapon.agiModifier > 0n && <Text fontFamily="mono" fontSize="11px" color="#5A8A3E">AGI +{weapon.agiModifier.toString()}</Text>}
                              {weapon.intModifier > 0n && <Text fontFamily="mono" fontSize="11px" color="#4A7AB5">INT +{weapon.intModifier.toString()}</Text>}
                            </HStack>
                          </VStack>
                          {recommended && (
                            <Text fontSize="10px" color="#5A8A3E" fontWeight={600} letterSpacing="0.05em" textTransform="uppercase">
                              {t('characterCreation.equipment.recommendedBadge')}
                            </Text>
                          )}
                        </HStack>
                      );
                    })}
                  </VStack>

                  {/* Combat triangle hint */}
                  <Text fontSize="11px" color="#8A7E6A" textAlign="center" fontStyle="italic">
                    {t('characterCreation.equipment.combatTriangleHint')}
                  </Text>

                  {/* Armor */}
                  <VStack spacing={2} w="100%">
                    <Text fontFamily="'Cinzel', serif" fontSize="16px" color="#8A7E6A" letterSpacing="0.1em">
                      {t('characterCreation.equipment.armorLabel')}
                    </Text>
                    {availableStarterArmors.map(armor => {
                      const selected = selectedStarterArmorId === BigInt(armor.tokenId);
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
                          onClick={() => setSelectedStarterArmorId(BigInt(armor.tokenId))}
                          _hover={{ bg: '#2E2820' }}
                        >
                          <ItemAsciiIcon name={armor.name} itemType={armor.itemType} rarity={armor.rarity} size="32px" />
                          <VStack align="start" spacing={0} flex={1}>
                            <Text fontSize="14px" color="#E8DCC8" fontWeight={600}>{armor.name}</Text>
                            <HStack spacing={2}>
                              {armor.armorModifier > 0n && <Text fontFamily="mono" fontSize="11px" color="#D4A54A">ARM +{armor.armorModifier.toString()}</Text>}
                              {armor.strModifier > 0n && <Text fontFamily="mono" fontSize="11px" color="#B85C3A">STR +{armor.strModifier.toString()}</Text>}
                              {armor.agiModifier > 0n && <Text fontFamily="mono" fontSize="11px" color="#5A8A3E">AGI +{armor.agiModifier.toString()}</Text>}
                              {armor.intModifier > 0n && <Text fontFamily="mono" fontSize="11px" color="#4A7AB5">INT +{armor.intModifier.toString()}</Text>}
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
                    isDisabled={isEnterGameDisabled || !selectedStarterWeaponId || !selectedStarterArmorId}
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
