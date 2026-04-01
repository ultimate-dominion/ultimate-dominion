import {
  Avatar,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  keyframes,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spinner,
  Stack,
  Text,
  Tooltip,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { IoIosWarning, IoMdInformationCircleOutline } from 'react-icons/io';
import { Link, useNavigate } from 'react-router-dom';

import { getTableValue, toBigInt } from '../lib/gameStore';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useFragments } from '../contexts/FragmentContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useBattleHpAnimation } from '../hooks/useBattleHpAnimation';
import { useCombatPacing } from '../hooks/useCombatPacing';
import { OnboardingStage, useOnboardingStage } from '../hooks/useOnboardingStage';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import {
  CURRENT_BATTLE_OPPONENT_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
import { etherToFixedNumber, getEmoji, removeEmoji } from '../utils/helpers';
import { getMonsterImage } from '../utils/monsterImages';
import { BattleMonsterAscii } from './pretext/game/BattleMonsterAscii';
import {
  ADVANCED_CLASS_COLORS,
  ADVANCED_CLASS_I18N_KEYS,
  ADVANCED_CLASS_NAMES,
  AdvancedClass,
  type Character,
  EncounterType,
  type Monster,
  StatsClasses,
  type WeaponTemplate,
} from '../utils/types';

import { getRomanNumeral } from '../utils/fragmentNarratives';
import { getThreatColor } from '../utils/threatAssessment';

import { ClassSymbol } from './ClassSymbol';
import { FragmentClaimModal } from './FragmentClaimModal';
import { HealthBar } from './HealthBar';
import { InfoModal } from './InfoModal';
import { NpcDialogueModal } from './NpcDialogueModal';
import { NpcRow } from './NpcRow';
import { ShopRow } from './ShopRow';

const ROW_HEIGHT = { base: 10, md: 8 };

/**
 * Pick the best weapon for a monster based on the combat triangle.
 * STR > AGI > INT > STR — so use INT weapons vs Warriors, STR vs Rogues, AGI vs Mages.
 * Weapon type is determined by its highest stat modifier.
 * Returns undefined if no matching weapon found.
 */
const pickWeaponForMonster = (
  monsterClass: StatsClasses,
  weapons: WeaponTemplate[],
): WeaponTemplate | undefined => {
  if (weapons.length === 0) return undefined;

  // Which stat modifier should be highest to counter this monster?
  // vs Warrior(STR) → use INT weapon, vs Rogue(AGI) → use STR weapon, vs Mage(INT) → use AGI weapon
  const counterStat: 'intModifier' | 'strModifier' | 'agiModifier' =
    monsterClass === StatsClasses.Strength ? 'intModifier'
      : monsterClass === StatsClasses.Agility ? 'strModifier'
        : 'agiModifier';

  // Find weapon where the counter stat modifier is the highest modifier
  const counterWeapons = weapons.filter(w => {
    const str = Number(w.strModifier ?? 0n);
    const agi = Number(w.agiModifier ?? 0n);
    const int = Number(w.intModifier ?? 0n);
    const counter = Number(w[counterStat] ?? 0n);
    return counter > 0 && counter >= str && counter >= agi && counter >= int;
  });

  // Return the counter weapon with the highest base damage
  if (counterWeapons.length > 0) {
    return counterWeapons.reduce((best, w) =>
      (w.maxDamage ?? 0n) > (best.maxDamage ?? 0n) ? w : best,
    );
  }

  return undefined; // caller falls back to first weapon
};

const REST_FLAVOR_COUNT = 5;

export const TileDetailsPanel = (): JSX.Element => {
  const { t } = useTranslation('ui');
  const { t: tn } = useTranslation('narrative');
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    isOpen: isSafetyZoneInfoModalOpen,
    onClose: onCloseSafetyZoneInfoModal,
    onOpen: onOpenSafetyZoneInfoModal,
  } = useDisclosure();
  const {
    isOpen: isNoMoveEquippedModalOpen,
    onClose: onCloseNoMoveEquippedModal,
    onOpen: onOpenNoMoveEquippedModal,
  } = useDisclosure();
  const {
    isOpen: isFragmentClaimModalOpen,
    onClose: onCloseFragmentClaimModal,
    onOpen: onOpenFragmentClaimModal,
  } = useDisclosure();
  const {
    isOpen: isNpcDialogueOpen,
    onClose: onCloseNpcDialogue,
    onOpen: onOpenNpcDialogue,
  } = useDisclosure();

  const [dialogueNpc, setDialogueNpc] = useState<{ id: string; name: string; metadataUri: string } | null>(null);
  const handleOpenNpcDialogue = useCallback((npcId: string, npcName: string, metadataUri: string) => {
    setDialogueNpc({ id: npcId, name: npcName, metadataUri });
    onOpenNpcDialogue();
  }, [onOpenNpcDialogue]);
  const handleCloseNpcDialogue = useCallback(() => {
    onCloseNpcDialogue();
    setDialogueNpc(null);
  }, [onCloseNpcDialogue]);

  const {
    delegatorAddress,
    systemCalls: { createEncounter, autoFight, rest },
  } = useMUD();
  const { pendingEcho } = useFragments();

  // Hold fragment data while modal is open — pendingEcho goes null after
  // claim (RECS updates reactively), which would unmount the modal mid-read.
  const fragmentClaimRef = useRef(pendingEcho);
  useEffect(() => {
    if (pendingEcho) {
      fragmentClaimRef.current = pendingEcho;
    }
  }, [pendingEcho]);
  const fragmentForModal = pendingEcho ?? fragmentClaimRef.current;
  const handleCloseFragmentClaim = () => {
    onCloseFragmentClaimModal();
    if (!pendingEcho) {
      fragmentClaimRef.current = null;
    }
  };

  const {
    character,
    equippedSpells,
    equippedWeapons,
    isMoveEquipped,
    isRefreshing: isRefreshingCharacter,
    refreshCharacter,
  } = useCharacter();
  const {
    inSafetyZone,
    isSpawned,
    monstersOnTile,
    npcsOnTile,
    otherCharactersOnTile,
    position,
    shopsOnTile,
    visibleMonstersOnTile,
    worldBosses,
  } = useMap();
  const {
    attackOutcomes,
    currentBattle,
    dotActions,
    lastestBattleOutcome,
    opponent,
    statusEffectActions,
    userCharacterForBattleRendering,
  } = useBattle();
  const { autoAdventureMode, isRefreshing } = useMovement();
  const stage = useOnboardingStage();

  const MONSTER_COLLAPSE_LIMIT = 3;
  const [monstersExpanded, setMonstersExpanded] = useState(false);

  // Reset expanded state when player moves to a new tile
  const tileKey = position ? `${position.x},${position.y}` : null;
  useEffect(() => {
    setMonstersExpanded(false);
  }, [tileKey]);

  // Sort monsters by level relevance (closest to player level first), elites on top
  const sortedMonsters = useMemo(() => {
    if (visibleMonstersOnTile.length === 0) return [];
    const playerLevel = character?.level ? Number(character.level) : 1;
    return [...visibleMonstersOnTile].sort((a, b) => {
      // Elites always surface first
      if (a.isElite !== b.isElite) return a.isElite ? -1 : 1;
      // Then by closeness to player level
      return Math.abs(Number(a.level) - playerLevel) - Math.abs(Number(b.level) - playerLevel);
    });
  }, [visibleMonstersOnTile, character?.level]);

  // World boss entity IDs for special rendering
  const worldBossEntityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const boss of worldBosses) {
      if (boss.isAlive && boss.entityId) ids.add(boss.entityId);
    }
    return ids;
  }, [worldBosses]);

  const visibleMonsters = monstersExpanded
    ? sortedMonsters
    : sortedMonsters.slice(0, MONSTER_COLLAPSE_LIMIT);
  const hiddenMonsterCount = sortedMonsters.length - MONSTER_COLLAPSE_LIMIT;

  const { isCounterattackPending, pendingCounterattackDamage } = useCombatPacing({
    attackOutcomes,
    characterId: character?.id,
    isInBattle: !!currentBattle,
  });

  const encounterTx = useTransaction({
    actionName: 'initiate battle',
  });

  const restTx = useTransaction({
    actionName: 'Resting by the fire',
    showSuccessToast: false,
  });

  const { renderSuccess } = useToast();

  const onRest = useCallback(async () => {
    if (!character) return;
    const result = await restTx.execute(async () => {
      const { error, success } = await rest(character.id);
      if (error && !success) throw new Error(error);
      return true;
    });
    if (result !== undefined) {
      const idx = Math.floor(Math.random() * REST_FLAVOR_COUNT);
      renderSuccess(tn(`restFlavor.${idx}`));
    }
  }, [character, rest, restTx, renderSuccess, tn]);

  const [isWaitingForBattle, setIsWaitingForBattle] = useState(false);
  const [pendingOpponent, setPendingOpponent] = useState<{ name: string; image?: string } | null>(null);

  // Clear waiting state when ALL battle data is ready (not just currentBattle)
  // Battle view requires: currentBattle + opponent + userCharacterForBattleRendering
  useEffect(() => {
    if (currentBattle && opponent && userCharacterForBattleRendering && isWaitingForBattle) {
      setIsWaitingForBattle(false);
      setPendingOpponent(null);
    }
  }, [currentBattle, opponent, userCharacterForBattleRendering, isWaitingForBattle]);

  // Safety timeout — clear if battle never starts (10s)
  useEffect(() => {
    if (!isWaitingForBattle) return;
    const timeout = setTimeout(() => setIsWaitingForBattle(false), 10000);
    return () => clearTimeout(timeout);
  }, [isWaitingForBattle]);

  // Safety timeout — clear pendingOpponent if store sync never delivers (5s)
  useEffect(() => {
    if (!pendingOpponent) return;
    const timeout = setTimeout(() => {
      setPendingOpponent(null);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [pendingOpponent]);

  const [isUserHit, setIsUserHit] = useState(false);
  const [isMonsterHit, setIsMonsterHit] = useState(false);

  useEffect(() => {
    if (isCounterattackPending) return;
    if (!(attackOutcomes[0] && currentBattle && opponent)) return;

    const attackIndex = attackOutcomes.findLastIndex(
      attack => attack.attackerId === opponent.id,
    );

    if (attackIndex === -1) return;

    const currentBattleOpponentTurn = localStorage.getItem(
      CURRENT_BATTLE_OPPONENT_TURN_KEY,
    );

    if (currentBattleOpponentTurn) {
      if (currentBattleOpponentTurn === attackIndex.toString()) {
        return;
      }
    }

    if (
      attackOutcomes[attackIndex]?.attackerDamageDelt !== BigInt(0) &&
      attackIndex - Number(currentBattle.currentTurn) <= 2
    ) {
      setIsUserHit(true);
      setTimeout(() => {
        setIsUserHit(false);
      }, 700);

      localStorage.setItem(
        CURRENT_BATTLE_OPPONENT_TURN_KEY,
        attackIndex.toString(),
      );
    }
  }, [attackOutcomes, currentBattle, opponent, isCounterattackPending]);

  useEffect(() => {
    if (!(attackOutcomes[0] && character && currentBattle)) return;

    const attackIndex = attackOutcomes.findLastIndex(
      attack => attack.attackerId === character.id,
    );

    if (attackIndex === -1) return;

    const currentBattleDefenderTurn = localStorage.getItem(
      CURRENT_BATTLE_USER_TURN_KEY,
    );

    if (currentBattleDefenderTurn) {
      if (currentBattleDefenderTurn === attackIndex.toString()) {
        return;
      }
    }

    if (
      attackOutcomes[attackIndex]?.attackerDamageDelt !== BigInt(0) &&
      attackIndex - Number(currentBattle.currentTurn) <= 2
    ) {
      setIsMonsterHit(true);
      setTimeout(() => {
        setIsMonsterHit(false);
      }, 700);

      localStorage.setItem(
        CURRENT_BATTLE_USER_TURN_KEY,
        attackIndex.toString(),
      );
    }
  }, [attackOutcomes, character, currentBattle]);

  const onInitiateCombat = useCallback(
    async (opponent: Character | Monster, encounterType: EncounterType) => {
      if (!character) return;
      if (!delegatorAddress) return;

      // Click-time validation: re-read store to catch ghosts that slipped
      // through the reactive filter (race condition between render and click).
      if (encounterType === EncounterType.PvE) {
        const ee = getTableValue('EncounterEntity', opponent.id) as { died?: boolean } | undefined;
        const sp = getTableValue('Spawned', opponent.id) as { spawned?: boolean } | undefined;
        if (ee?.died || sp?.spawned === false) return;
      }

      // Auto adventure + PvE: single-tx fight, no battle screen
      if (autoAdventureMode && encounterType === EncounterType.PvE) {
        // Auto-select weapon based on combat triangle (STR > AGI > INT > STR)
        const monster = opponent as Monster;
        const allWeapons = [...equippedWeapons, ...equippedSpells] as WeaponTemplate[];
        const counterResult = pickWeaponForMonster(monster.entityClass, allWeapons);
        const bestWeapon = counterResult ?? allWeapons[0];

        console.info('[autoFight] DEBUG', {
          monsterClass: monster.entityClass,
          monsterName: monster.name,
          monsterId: monster.id,
          characterId: character.id,
          counterWeapon: counterResult ? { tokenId: counterResult.tokenId, name: counterResult.name } : 'NONE (using fallback)',
          selectedWeapon: bestWeapon ? { tokenId: bestWeapon.tokenId, name: bestWeapon.name } : 'NONE',
          allWeaponsCount: allWeapons.length,
          equippedWeaponsCount: equippedWeapons.length,
          equippedSpellsCount: equippedSpells.length,
          autoAdventureMode,
          path: 'autoFight',
        });

        if (!bestWeapon) return; // no weapons equipped

        setPendingOpponent({
          name: opponent.name,
          image: getMonsterImage(opponent.name),
        });

        const result = await encounterTx.execute(async () => {
          const { error, success } = await autoFight(
            character.id,
            opponent.id,
            bestWeapon.tokenId,
          );
          if (error && !success) throw new Error(error);
          return true;
        });

        // Always clear loading screen when TX completes — results appear
        // independently in ActionsPanel via store sync.
        setPendingOpponent(null);
        if (result !== undefined) {
          refreshCharacter();
          import('../utils/analytics').then(({ trackCombatStarted }) =>
            trackCombatStarted(opponent.name, Number(opponent.level ?? 1n), Number(character.level)),
          );
        }
        return;
      }

      console.warn('[createEncounter] DEBUG — manual path taken!', {
        autoAdventureMode,
        encounterType,
        opponentName: opponent.name,
        opponentId: opponent.id,
        characterId: character.id,
      });

      setIsWaitingForBattle(true);
      setPendingOpponent({
        name: opponent.name,
        image: encounterType === EncounterType.PvE
          ? getMonsterImage(opponent.name)
          : (opponent as Character).image,
      });

      const result = await encounterTx.execute(async () => {
        const { error, success } = await createEncounter(
          encounterType,
          [character.id],
          [opponent.id],
        );
        if (error && !success) throw new Error(error);
        return true;
      });

      if (result !== undefined) {
        refreshCharacter();
        if (encounterType === EncounterType.PvE) {
          import('../utils/analytics').then(({ trackCombatStarted }) =>
            trackCombatStarted(opponent.name, Number(opponent.level ?? 1n), Number(character.level)),
          );
        } else {
          import('../utils/analytics').then(({ trackPvpStarted }) =>
            trackPvpStarted(Number(opponent.level ?? 1n), Number(character.level)),
          );
        }
        // Don't clear isWaitingForBattle — effect clears when currentBattle arrives
      } else {
        // TX failed, clear immediately
        setIsWaitingForBattle(false);
        setPendingOpponent(null);
      }
    },
    [
      autoAdventureMode,
      autoFight,
      character,
      createEncounter,
      delegatorAddress,
      encounterTx,
      equippedSpells,
      equippedWeapons,
      refreshCharacter,
    ],
  );

  const isHomeTile = useMemo(() => {
    return position?.x === 0 && position?.y === 0;
  }, [position]);

  const opponentStatusEffects = useMemo(() => {
    const activeStatusEffects = statusEffectActions.filter(
      action => action.active,
    );

    const _opponentStatusEffects = activeStatusEffects.filter(
      action => action.victimId === opponent?.id,
    );

    const names = _opponentStatusEffects
      .map(action => action.name)
      .concat(
        (opponent as Character)?.worldStatusEffects
          ?.filter(effect => effect.active)
          .map(effect => effect.name) ?? [],
      );
    return [...new Set(names)];
  }, [opponent, statusEffectActions]);

  const userCharacterStatusEffects = useMemo(() => {
    const activeStatusEffects = statusEffectActions.filter(
      action => action.active,
    );

    const _userCharacterStatusEffects = activeStatusEffects.filter(
      action => action.victimId === userCharacterForBattleRendering?.id,
    );

    const names = _userCharacterStatusEffects
      .map(action => action.name)
      .concat(
        userCharacterForBattleRendering?.worldStatusEffects
          ?.filter(effect => effect.active)
          .map(effect => effect.name) ?? [],
      );
    return [...new Set(names)];
  }, [statusEffectActions, userCharacterForBattleRendering]);

  const expiredOpponentEffectModifications: {
    agiModifier: bigint;
    intModifier: bigint;
    strModifier: bigint;
  } = useMemo(() => {
    if (!opponent) {
      return {
        agiModifier: BigInt(0),
        intModifier: BigInt(0),
        strModifier: BigInt(0),
      };
    }

    if (!(opponent as Character).worldStatusEffects) {
      return {
        agiModifier: BigInt(0),
        intModifier: BigInt(0),
        strModifier: BigInt(0),
      };
    }

    const inactiveEffects = (opponent as Character).worldStatusEffects.filter(
      effect => !effect.active,
    );

    const agiModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.agiModifier,
      BigInt(0),
    );

    const intModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.intModifier,
      BigInt(0),
    );

    const strModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.strModifier,
      BigInt(0),
    );

    return {
      agiModifier,
      intModifier,
      strModifier,
    };
  }, [opponent]);

  // Active battle status effect modifiers on the opponent (e.g. Entangle: -5 AGI, -3 STR)
  const activeBattleEffectModifications: {
    agiModifier: bigint;
    intModifier: bigint;
    strModifier: bigint;
  } = useMemo(() => {
    const zero = { agiModifier: BigInt(0), intModifier: BigInt(0), strModifier: BigInt(0) };
    if (!opponent) return zero;

    const activeOpponentEffects = statusEffectActions.filter(
      action => action.active && action.victimId === opponent.id,
    );
    if (activeOpponentEffects.length === 0) return zero;

    let agi = BigInt(0);
    let int = BigInt(0);
    let str = BigInt(0);

    for (const effect of activeOpponentEffects) {
      const stats = getTableValue('StatusEffectStats', effect.effectId);
      if (!stats) continue;
      agi += toBigInt(stats.agiModifier);
      int += toBigInt(stats.intModifier);
      str += toBigInt(stats.strModifier);
    }

    return { agiModifier: agi, intModifier: int, strModifier: str };
  }, [opponent, statusEffectActions]);

  const expiredUserEffectModifications: {
    agiModifier: bigint;
    intModifier: bigint;
    strModifier: bigint;
  } = useMemo(() => {
    if (!userCharacterForBattleRendering) {
      return {
        agiModifier: BigInt(0),
        intModifier: BigInt(0),
        strModifier: BigInt(0),
      };
    }

    const inactiveEffects =
      userCharacterForBattleRendering.worldStatusEffects.filter(
        effect => !effect.active,
      );

    const agiModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.agiModifier,
      BigInt(0),
    );

    const intModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.intModifier,
      BigInt(0),
    );

    const strModifier = inactiveEffects.reduce(
      (acc, effect) => acc + effect.strModifier,
      BigInt(0),
    );

    return {
      agiModifier,
      intModifier,
      strModifier,
    };
  }, [userCharacterForBattleRendering]);

  // Active battle status effect modifiers on the user (buffs like Battle Cry, or enemy debuffs)
  const activeUserBattleEffectModifications: {
    agiModifier: bigint;
    intModifier: bigint;
    strModifier: bigint;
  } = useMemo(() => {
    const zero = { agiModifier: BigInt(0), intModifier: BigInt(0), strModifier: BigInt(0) };
    if (!userCharacterForBattleRendering) return zero;

    const activeUserEffects = statusEffectActions.filter(
      action => action.active && action.victimId === userCharacterForBattleRendering.id,
    );
    if (activeUserEffects.length === 0) return zero;

    let agi = BigInt(0);
    let int = BigInt(0);
    let str = BigInt(0);

    for (const effect of activeUserEffects) {
      const stats = getTableValue('StatusEffectStats', effect.effectId);
      if (!stats) continue;
      agi += toBigInt(stats.agiModifier);
      int += toBigInt(stats.intModifier);
      str += toBigInt(stats.strModifier);
    }

    return { agiModifier: agi, intModifier: int, strModifier: str };
  }, [userCharacterForBattleRendering, statusEffectActions]);

  // Find latest DoT data for each entity in the current battle
  const latestUserDot = useMemo(() => {
    if (!userCharacterForBattleRendering) return null;
    return dotActions
      .filter(
        d =>
          d.entityId.toLowerCase() ===
          userCharacterForBattleRendering.id.toLowerCase(),
      )
      .sort((a, b) => (a.turnNumber > b.turnNumber ? 1 : -1))
      .pop() ?? null;
  }, [dotActions, userCharacterForBattleRendering]);

  const latestOpponentDot = useMemo(() => {
    if (!opponent) return null;
    return dotActions
      .filter(
        d => d.entityId.toLowerCase() === opponent.id.toLowerCase(),
      )
      .sort((a, b) => (a.turnNumber > b.turnNumber ? 1 : -1))
      .pop() ?? null;
  }, [dotActions, opponent]);

  const {
    displayedHp: userDisplayedHp,
    isDotTicking: isUserDotTicking,
  } = useBattleHpAnimation({
    actualHp: (userCharacterForBattleRendering?.currentHp ?? 0n) + pendingCounterattackDamage,
    dotDamage: latestUserDot?.totalDamage ?? 0n,
    dotTurnNumber: latestUserDot?.turnNumber ?? 0n,
    isInBattle: !!currentBattle,
  });

  const {
    displayedHp: opponentDisplayedHp,
    isDotTicking: isOpponentDotTicking,
  } = useBattleHpAnimation({
    actualHp: opponent?.currentHp ?? 0n,
    dotDamage: latestOpponentDot?.totalDamage ?? 0n,
    dotTurnNumber: latestOpponentDot?.turnNumber ?? 0n,
    isInBattle: !!currentBattle,
  });

  const battleOver = currentBattle?.encounterId === lastestBattleOutcome?.encounterId;
  const opponentDefeated = opponentDisplayedHp <= 0n && battleOver;
  const userDefeated = userDisplayedHp <= 0n && battleOver;

  if (!character) {
    return (
      <Box>
        <HStack
          bgColor="blue500"
          h={{ base: '40px', md: '66px' }}
          px="20px"
          width="100%"
        >
          <Heading color="#E8DCC8" size={{ base: 'sm', md: 'md' }}>
            {t('gameBoard.tileDetailsHeading')}
          </Heading>
        </HStack>
        {isRefreshingCharacter ? (
          <Flex alignItems="center" h="100%" justifyContent="center" mt={6}>
            <Spinner size="lg" />
          </Flex>
        ) : (
          <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }} p={6}>
            {t('gameBoard.errorOccurred')}
          </Text>
        )}
      </Box>
    );
  }

  if (!currentBattle && !isSpawned) {
    return (
      <Box>
        <HStack
          bgColor="blue500"
          h={{ base: '40px', md: '66px' }}
          px="20px"
          width="100%"
        >
          <Heading color="#E8DCC8" size={{ base: 'sm', md: 'md' }}>
            {t('gameBoard.tileDetailsHeading')}
          </Heading>
        </HStack>
        <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }} p={6}>
          {t('gameBoard.notSpawned')}
        </Text>
      </Box>
    );
  }

  if (currentBattle && opponent && userCharacterForBattleRendering && !autoAdventureMode) {
    return (
      <Box h={{ base: 'auto', lg: '100%' }} position="relative">
        <style>
          {`
          @keyframes flicker {
            0% { opacity: 1; }
            25% { opacity: 0; }
            50% { opacity: 1; }
            75% { opacity: 0; }
            100% { opacity: 1; }
          }
        `}
        </style>
        <HStack bgColor="blue500" h={{ base: '36px', md: '46px' }} px={4}>
          <Heading color="#E8DCC8" size="sm">
            {t('tile.battlefield')}
          </Heading>
        </HStack>
        <Box
          bgColor="blue500"
          h={{ base: 'auto', lg: '100%' }}
          position="absolute"
          top={0}
          transform="translateX(50%)"
          right="50%"
          w="6px"
        />
        <Box
          h={{ base: 'auto', md: 'calc(100% - 66px)' }}
          overflowY={{ base: 'visible', md: 'auto' }}
        >
          <HStack alignItems="start" spacing={0} w="100%">
            <VStack w="50%">
              <Stack
                alignItems="center"
                direction={{ base: 'row', lg: 'column' }}
                justify={{ base: 'center', lg: 'start' }}
                mt={{ base: 2, lg: 6 }}
                spacing={{ base: 2, lg: 0 }}
              >
                <Avatar
                  animation={isUserHit ? 'flicker .7s infinite' : 'none'}
                  filter={userDefeated ? 'grayscale(100%)' : undefined}
                  mb={{ base: 0, lg: 2 }}
                  opacity={userDefeated ? 0.4 : isUserHit ? 0 : 1}
                  size={{ base: '2xs', lg: 'md' }}
                  src={userCharacterForBattleRendering.image}
                />
                <HStack>
                  <Text fontWeight={700} size={{ base: 'sm', lg: 'lg' }}>
                    {userCharacterForBattleRendering.name}
                  </Text>
                  <ClassSymbol
                    advancedClass={userCharacterForBattleRendering.advancedClass}
                    entityClass={userCharacterForBattleRendering.entityClass}
                    mb={1}
                    theme="dark"
                  />
                </HStack>
              </Stack>
              <VStack spacing={{ base: 0, lg: 2 }} w="100%">
                {userCharacterForBattleRendering.maxHp > BigInt(0) && (
                  <HealthBar
                    maxHp={userCharacterForBattleRendering.maxHp}
                    currentHp={userDisplayedHp}
                    isDotTicking={isUserDotTicking}
                    level={userCharacterForBattleRendering.level}
                    px={8}
                    statusEffects={userCharacterStatusEffects}
                    w="100%"
                  />
                )}

                <Box mt={2} w="100%">
                  <Box backgroundColor="rgba(196,184,158,0.08)" boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)" h="1px" w="100%" />
                  <HStack justifyContent="center" spacing={{ base: 3, lg: 4 }} px={2} py={1} w="100%">
                    {([
                      { label: 'AGI', color: '#5A8A3E', base: userCharacterForBattleRendering.agility - expiredUserEffectModifications.agiModifier, mod: activeUserBattleEffectModifications.agiModifier },
                      { label: 'INT', color: '#4A7AB5', base: userCharacterForBattleRendering.intelligence - expiredUserEffectModifications.intModifier, mod: activeUserBattleEffectModifications.intModifier },
                      { label: 'STR', color: '#B85C3A', base: userCharacterForBattleRendering.strength - expiredUserEffectModifications.strModifier, mod: activeUserBattleEffectModifications.strModifier },
                    ] as const).map(({ label, color, base, mod }) => {
                      const effective = base + mod;
                      return (
                        <HStack key={label} spacing={1}>
                          <Text size={{ base: '2xs', lg: 'xs' }} color={color} fontWeight={600}>{label}</Text>
                          <Text fontFamily="mono" size={{ base: '2xs', lg: 'xs' }}>
                            {effective.toString()}{mod > 0n && <Text as="span" color="cyan.300">{` (+${mod.toString()})`}</Text>}{mod < 0n && <Text as="span" color="orange.300">{` (${mod.toString()})`}</Text>}
                          </Text>
                        </HStack>
                      );
                    })}
                  </HStack>
                  <Box backgroundColor="rgba(196,184,158,0.08)" boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)" h="1px" w="100%" />
                </Box>
              </VStack>
            </VStack>

            <VStack w="50%" position="relative" minH={{ lg: '280px' }}>
              {/* ASCII monster backdrop — fills the monster's half */}
              {isDesktop && currentBattle.encounterType === EncounterType.PvE && (
                <BattleMonsterAscii
                  monsterName={opponent.name}
                  defeated={opponentDefeated}
                  hit={isMonsterHit}
                />
              )}
              {currentBattle.encounterType === EncounterType.PvE ? (
                <VStack mt={{ base: 2, lg: 6 }} spacing={0} position="relative" zIndex={2}>
                  {!isDesktop && (
                    <Avatar
                      animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                      bgColor="grey300"
                      boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                      filter={opponentDefeated ? 'grayscale(100%)' : undefined}
                      mb={1}
                      opacity={opponentDefeated ? 0.4 : isMonsterHit ? 0 : 1}
                      size="2xs"
                      src={getMonsterImage(opponent.name)}
                      name={opponent.name}
                    >
                      {!getMonsterImage(opponent.name) && (
                        <Text
                          animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                          fontSize="42px"
                        >
                          {getEmoji(opponent.name)}
                        </Text>
                      )}
                    </Avatar>
                  )}
                  <HStack>
                    <Text
                      fontWeight={700}
                      size={{ base: 'sm', lg: 'lg' }}
                      color={opponentDefeated ? 'red.400' : undefined}
                    >
                      {opponentDefeated ? t('tile.opponentDefeated', { name: opponent.name }) : opponent.name}
                    </Text>
                    <ClassSymbol
                      entityClass={opponent.entityClass}
                      mb={1}
                      theme="dark"
                    />
                  </HStack>
                </VStack>
              ) : (
                <Stack
                  alignItems="center"
                  direction={{ base: 'row', lg: 'column' }}
                  justify={{ base: 'center', lg: 'start' }}
                  mt={{ base: 2, lg: 6 }}
                  spacing={0}
                >
                  <Avatar
                    animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                    filter={opponentDefeated ? 'grayscale(100%)' : undefined}
                    mb={{ base: 1, lg: 2 }}
                    opacity={opponentDefeated ? 0.4 : isMonsterHit ? 0 : 1}
                    size={{ base: '2xs', lg: 'md' }}
                    src={opponent.image}
                  />
                  <HStack>
                    <Text
                      fontWeight={700}
                      size={{ base: 'sm', lg: 'lg' }}
                      color={opponentDefeated ? 'red.400' : undefined}
                    >
                      {opponentDefeated ? t('tile.opponentDefeated', { name: opponent.name }) : opponent.name}
                    </Text>
                    <ClassSymbol
                      advancedClass={(opponent as Character).advancedClass}
                      entityClass={opponent.entityClass}
                      mb={1}
                      theme="dark"
                    />
                  </HStack>
                </Stack>
              )}
              <VStack spacing={{ base: 0, lg: 2 }} w="100%">
                {opponent.maxHp > BigInt(0) && (
                  <HealthBar
                    maxHp={opponent.maxHp}
                    currentHp={opponentDisplayedHp}
                    isDotTicking={isOpponentDotTicking}
                    level={opponent.level}
                    px={8}
                    statusEffects={opponentStatusEffects}
                    w="100%"
                  />
                )}

                <Box mt={2} w="100%">
                  <Box backgroundColor="rgba(196,184,158,0.08)" boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)" h="1px" w="100%" />
                  <HStack justifyContent="center" spacing={{ base: 3, lg: 4 }} px={2} py={1} w="100%">
                    {([
                      { label: 'AGI', color: '#5A8A3E', stat: opponent.agility, expiredMod: expiredOpponentEffectModifications.agiModifier, activeMod: activeBattleEffectModifications.agiModifier },
                      { label: 'INT', color: '#4A7AB5', stat: opponent.intelligence, expiredMod: expiredOpponentEffectModifications.intModifier, activeMod: activeBattleEffectModifications.intModifier },
                      { label: 'STR', color: '#B85C3A', stat: opponent.strength, expiredMod: expiredOpponentEffectModifications.strModifier, activeMod: activeBattleEffectModifications.strModifier },
                    ] as const).map(({ label, color, stat, expiredMod, activeMod }) => {
                      if (!stat) return null;
                      const base = stat - expiredMod;
                      const effective = base + activeMod;
                      return (
                        <HStack key={label} spacing={1}>
                          <Text size={{ base: '2xs', lg: 'xs' }} color={color} fontWeight={600}>{label}</Text>
                          <Text fontFamily="mono" size={{ base: '2xs', lg: 'xs' }}>
                            {effective.toString()}{activeMod > 0n && <Text as="span" color="cyan.300">{` (+${activeMod.toString()})`}</Text>}{activeMod < 0n && <Text as="span" color="orange.300">{` (${activeMod.toString()})`}</Text>}
                          </Text>
                        </HStack>
                      );
                    })}
                  </HStack>
                  <Box backgroundColor="rgba(196,184,158,0.08)" boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)" h="1px" w="100%" />
                </Box>
              </VStack>
            </VStack>
          </HStack>
        </Box>
      </Box>
    );
  }

  if (isWaitingForBattle || encounterTx.isLoading || pendingOpponent || (!autoAdventureMode && currentBattle && (!opponent || !userCharacterForBattleRendering) && currentBattle.encounterId !== lastestBattleOutcome?.encounterId)) {
    return (
      <Box h="100%" bg="gray.900" position="relative" overflow="hidden">
        <style>
          {`
          @keyframes battlePulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateY(10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          `}
        </style>
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="linear-gradient(180deg, rgba(200,30,30,0.15) 0%, transparent 40%, transparent 60%, rgba(200,30,30,0.15) 100%)"
        />
        <VStack h="100%" justifyContent="center" spacing={5} position="relative">
          {pendingOpponent?.image && (
            <Avatar
              size={{ base: 'lg', lg: 'xl' }}
              src={pendingOpponent.image}
              name={pendingOpponent.name}
              animation="slideIn 0.3s ease-out"
              border="3px solid"
              borderColor="red.600"
            />
          )}
          <Text
            animation="battlePulse 1.5s ease-in-out infinite"
            color="red.400"
            fontWeight={700}
            letterSpacing="wider"
            size={{ base: 'md', lg: 'xl' }}
            textTransform="uppercase"
          >
            {pendingOpponent ? t('combat.fighting', { name: pendingOpponent.name }) : t('combat.initiatingBattle')}
          </Text>
          <Spinner color="red.400" size="lg" thickness="3px" speed="0.8s" />
        </VStack>
      </Box>
    );
  }

  return (
    <Box h={{ base: 'calc(100% - 36px)', md: 'calc(100% - 46px)' }} position="relative">
      <HStack bgColor="blue500" h={{ base: '36px', md: '46px' }}>
        <Grid
          alignItems="center"
          color="#E8DCC8"
          h="100%"
          px={6}
          templateColumns="repeat(4, 1fr)"
          w="100%"
        >
          {isHomeTile && shopsOnTile.length > 0 && (
            <GridItem colSpan={2}>
              <Heading size="sm">{t('tile.shops')}</Heading>
            </GridItem>
          )}
          {!isHomeTile && (
            <GridItem colSpan={2}>
              <Heading size="sm">
                {t('tile.monsters')}
              </Heading>
            </GridItem>
          )}
          <GridItem colSpan={2}>
            <Heading size="sm">
              {shopsOnTile.length > 0 && !isHomeTile ? t('tile.shopsAndPlayers') : t('tile.players')}
            </Heading>
          </GridItem>
        </Grid>
      </HStack>

      <Grid
        h="100%"
        overflowY="auto"
        position="relative"
        templateColumns="repeat(4, 1fr)"
      >
        <Box
          background={
            inSafetyZone
              ? 'linear-gradient(180deg, rgba(180, 183, 53, 0.33) 0%, rgba(80, 81, 23, 0) 100%)'
              : 'linear-gradient(180deg, rgba(183, 53, 53, 0.33) 0%, rgba(81, 23, 23, 0) 100%)'
          }
          h="40px"
          left="50%"
          position="absolute"
          top={0}
          w="50%"
        />
        {isHomeTile && (
          <GridItem borderColor="blue500" borderRight="6px solid" colSpan={2}>
            <VStack alignItems="start" minH="76px" p={2}>
              {stage >= OnboardingStage.ESTABLISHED && (
                <Text
                  fontFamily="mono"
                  fontSize={{ base: '3xs', sm: 'xs' }}
                  fontWeight={700}
                  textAlign="start"
                >
                  Gold: {etherToFixedNumber(character.externalGoldBalance)} Gold
                </Text>
              )}
              {isHomeTile && !character.inBattle && (
                  <VStack
                    bg="rgba(0, 0, 0, 0.45)"
                    borderRadius="md"
                    mt={3}
                    px={3}
                    py={2}
                    spacing={1}
                  >
                    {character.currentHp > BigInt(0) &&
                    character.currentHp < character.maxHp ? (
                      <>
                        <Text
                          color="orange.300"
                          fontFamily="mono"
                          fontSize="xs"
                          fontStyle="italic"
                          textAlign="center"
                        >
                          {t('tile.fireCracklesNear')}
                        </Text>
                        <Button
                          alignSelf="center"
                          isDisabled={restTx.isLoading}
                          isLoading={restTx.isLoading}
                          loadingText={t('tile.restingByFire')}
                          onClick={onRest}
                          size="xs"
                          variant="outline"
                          color="orange.200"
                          borderColor="orange.400"
                          _hover={{ bg: 'orange.900', borderColor: 'orange.300' }}
                        >
                          {t('tile.restByFire')}
                        </Button>
                      </>
                    ) : (
                      <Text
                        color="green.300"
                        fontFamily="mono"
                        fontSize="xs"
                        fontStyle="italic"
                        textAlign="center"
                      >
                        {t('tile.fullyRested')}
                      </Text>
                    )}
                  </VStack>
                )}
            </VStack>
            <Box
              backgroundColor="rgba(196,184,158,0.08)"
              boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
              h="6px"
              w="100%"
            />
            {pendingEcho && (
              <>
                <FragmentEchoRow
                  fragmentName={pendingEcho.name}
                  fragmentType={pendingEcho.fragmentType}
                  onClick={onOpenFragmentClaimModal}
                />
                <Box
                  backgroundColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="6px"
                  w="100%"
                />
              </>
            )}
            {shopsOnTile.map((shop, i) => (
              <Box key={`tile-shop-${i}`}>
                <ShopRow shopId={shop.shopId} shopName={shop.name} />
                <Box
                  backgroundColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="6px"
                  w="100%"
                />
              </Box>
            ))}
            {npcsOnTile.map((npc, i) => (
              <Box key={`tile-npc-${i}`}>
                <NpcRow
                  npcName={npc.name}
                  interaction={npc.interaction}
                  entityId={npc.entityId}
                  metadataUri={npc.metadataUri}
                  onOpenDialogue={handleOpenNpcDialogue}
                />
                <Box
                  backgroundColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="6px"
                  w="100%"
                />
              </Box>
            ))}
          </GridItem>
        )}

        {!isHomeTile && (
          <GridItem borderColor="blue500" borderRight="6px solid" colSpan={2}>
            <Box
              backgroundColor="rgba(196,184,158,0.08)"
              boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
              h="6px"
              w="100%"
            />
            {pendingEcho && (
              <>
                <FragmentEchoRow
                  fragmentName={pendingEcho.name}
                  fragmentType={pendingEcho.fragmentType}
                  onClick={onOpenFragmentClaimModal}
                />
                <Box
                  backgroundColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="6px"
                  w="100%"
                />
              </>
            )}
            {sortedMonsters.length > 0 && (
              <>
                {visibleMonsters.map((monster, i) => (
                  <Box key={`tile-monster-${i}-${monster.name}`}>
                    <OpponentRow
                      encounterType={EncounterType.PvE}
                      isWorldBoss={worldBossEntityIds.has(monster.id)}
                      onClick={() => {
                        if (isMoveEquipped) {
                          onInitiateCombat(monster, EncounterType.PvE);
                        } else {
                          onOpenNoMoveEquippedModal();
                        }
                      }}
                      opponent={monster}
                      playerStats={{
                        strength: character?.strength ?? 0n,
                        agility: character?.agility ?? 0n,
                        intelligence: character?.intelligence ?? 0n,
                        level: character?.level ?? 1n,
                        maxHp: character?.maxHp ?? 18n,
                      }}
                    />
                    <Box
                      backgroundColor="rgba(196,184,158,0.08)"
                      boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                      h="6px"
                      w="100%"
                    />
                  </Box>
                ))}
                {hiddenMonsterCount > 0 && (
                  <HStack
                    as="button"
                    h={ROW_HEIGHT}
                    justify="center"
                    onClick={() => setMonstersExpanded(prev => !prev)}
                    px={4}
                    w="100%"
                    cursor="pointer"
                    _hover={{ bg: 'rgba(200,122,42,0.1)' }}
                    transition="background 0.2s"
                  >
                    <Text
                      color="#8A7E6A"
                      fontFamily="mono"
                      fontSize={{ base: '2xs', lg: 'xs' }}
                      fontWeight={500}
                    >
                      {monstersExpanded
                        ? t('combat.showFewer')
                        : t('tile.moreMonsters', { count: hiddenMonsterCount })}
                    </Text>
                  </HStack>
                )}
              </>
            )}
            {sortedMonsters.length === 0 && (
              <Text p={2} size={{ base: '2xs', lg: 'sm' }}>
                {t('tile.noMonstersArea')}
              </Text>
            )}
          </GridItem>
        )}

        <GridItem colSpan={2}>
          <Box
            backgroundColor="rgba(196,184,158,0.08)"
            boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
            h="6px"
            w="100%"
          />
          {stage >= OnboardingStage.FIRST_STEPS && stage < OnboardingStage.FIRST_BLOOD && visibleMonstersOnTile.length === 0 && (
            <VStack
              align="center"
              justify="center"
              py={8}
              px={4}
              spacing={2}
            >
              <Text
                animation={`${explorePulse} 3s ease-in-out infinite`}
                color="#A8DEFF"
                fontFamily="Cinzel, serif"
                fontSize={{ base: 'md', lg: 'lg' }}
                fontWeight={600}
                letterSpacing="0.1em"
                textAlign="center"
                textShadow="0 0 20px rgba(168, 222, 255, 0.4), 0 0 40px rgba(168, 222, 255, 0.15)"
              >
                {t('tile.exploreDarkCave')}
              </Text>
              <Text
                color="#5A5040"
                fontSize="2xs"
                letterSpacing="0.15em"
                textTransform="uppercase"
              >
                {t('tile.useCompass')}
              </Text>
            </VStack>
          )}
          {stage >= OnboardingStage.ESTABLISHED && (
            <>
              <HStack h={ROW_HEIGHT} justifyContent="end" px={4}>
                <Text size={{ base: '3xs', sm: '2xs', md: 'xs' }} textAlign="right">
                  {inSafetyZone ? t('tile.theAlcove') : t('tile.theWindingDark')}
                </Text>
              </HStack>
              <Box
                backgroundColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="6px"
                w="100%"
              />
            </>
          )}
          {!isHomeTile &&
            shopsOnTile.map((shop, i) => (
              <Box key={`tile-shop-${i}`}>
                <ShopRow shopId={shop.shopId} shopName={shop.name} />
                <Box
                  backgroundColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="6px"
                  w="100%"
                />
              </Box>
            ))}
          {!isHomeTile &&
            npcsOnTile.map((npc, i) => (
              <Box key={`tile-npc-${i}`}>
                <NpcRow
                  npcName={npc.name}
                  interaction={npc.interaction}
                  entityId={npc.entityId}
                  metadataUri={npc.metadataUri}
                  onOpenDialogue={handleOpenNpcDialogue}
                />
                <Box
                  backgroundColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="6px"
                  w="100%"
                />
              </Box>
            ))}
          {/* Dead world boss respawn timer — shows on the boss's spawn tile */}
          {worldBosses
            .filter(b => !b.isAlive && b.lastKilledAt > 0 && position
              && b.spawnX === position.x && b.spawnY === position.y)
            .map(boss => {
              const respawnAt = boss.lastKilledAt + boss.respawnSeconds;
              const now = Math.floor(Date.now() / 1000);
              const remaining = Math.max(0, respawnAt - now);
              const minutes = Math.floor(remaining / 60);
              const seconds = remaining % 60;
              return (
                <HStack
                  key={`boss-timer-${boss.bossId}`}
                  h={ROW_HEIGHT}
                  px={{ base: 3, sm: 4 }}
                  spacing={3}
                  opacity={0.6}
                >
                  <Text color="#8A7E6A" size={{ base: '2xs', md: 'sm' }} fontStyle="italic">
                    {remaining > 0
                      ? t('tile.worldBossReturns', { time: `${minutes}m ${seconds.toString().padStart(2, '0')}s` })
                      : t('tile.worldBossStirring')}
                  </Text>
                </HStack>
              );
            })}
          {stage >= OnboardingStage.SETTLING_IN && (
            <>
              {otherCharactersOnTile.length > 0 &&
                otherCharactersOnTile.map((player, i) => (
                  <Box key={`tile-player-${i}-${player.name}`}>
                    <OpponentRow
                      encounterType={EncounterType.PvP}
                      onClick={() =>
                        inSafetyZone
                          ? onOpenSafetyZoneInfoModal()
                          : onInitiateCombat(player, EncounterType.PvP)
                      }
                      opponent={player}
                      playerStats={{
                        strength: character?.strength ?? 0n,
                        agility: character?.agility ?? 0n,
                        intelligence: character?.intelligence ?? 0n,
                        level: character?.level ?? 1n,
                        maxHp: character?.maxHp ?? 18n,
                      }}
                    />
                    <Box
                      backgroundColor="rgba(196,184,158,0.08)"
                      boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                      h="6px"
                      w="100%"
                    />
                  </Box>
                ))}
              {otherCharactersOnTile.length === 0 && (
                <Text p={2} size={{ base: '2xs', lg: 'sm' }}>
                  {t('tile.noPlayersArea')}
                </Text>
              )}
            </>
          )}
        </GridItem>
      </Grid>

      <InfoModal
        heading={t('tile.noMovesEquipped')}
        isOpen={isNoMoveEquippedModalOpen}
        onClose={onCloseNoMoveEquippedModal}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Trans
            i18nKey="tile.noMovesBody"
            ns="ui"
            components={{
              link: <Text as={Link} color="blue" to={`/characters/${character?.id}`} _hover={{ textDecoration: 'underline' }} />,
            }}
          />
        </VStack>
      </InfoModal>

      <InfoModal
        heading={t('tile.cannotBattleAlcove')}
        isOpen={isSafetyZoneInfoModalOpen}
        onClose={onCloseSafetyZoneInfoModal}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Trans
            i18nKey="tile.cannotBattleAlcoveBody"
            ns="ui"
            components={{
              bold: <Text as="span" fontWeight={700} />,
            }}
          />
        </VStack>
      </InfoModal>

      {fragmentForModal && (
        <FragmentClaimModal
          fragment={fragmentForModal}
          isOpen={isFragmentClaimModalOpen}
          onClose={handleCloseFragmentClaim}
        />
      )}

      {dialogueNpc && (
        <NpcDialogueModal
          isOpen={isNpcDialogueOpen}
          onClose={handleCloseNpcDialogue}
          npcId={dialogueNpc.id}
          npcName={dialogueNpc.name}
          metadataUri={dialogueNpc.metadataUri}
        />
      )}
    </Box>
  );
};


const OpponentRow = ({
  encounterType,
  opponent,
  playerStats,
  onClick,
  isWorldBoss,
}: {
  encounterType: EncounterType;
  opponent: Character | Monster;
  playerStats: { strength: bigint; agility: bigint; intelligence: bigint; level: bigint; maxHp: bigint };
  onClick: () => void;
  isWorldBoss?: boolean;
}) => {
  const { t } = useTranslation('ui');
  const { inBattle, level, name } = opponent;
  const isElite = encounterType === EncounterType.PvE && (opponent as Monster).isElite;
  const navigate = useNavigate();

  const inCooldown = useMemo(() => {
    const cooldownTimer = (opponent as Character).pvpCooldownTimer;
    if (!cooldownTimer) return false;
    return Number(cooldownTimer) + 30 > Date.now() / 1000;
  }, [opponent]);

  const disableRow = inBattle || inCooldown;

  const monsterData = opponent as Monster;
  const nameColor = getThreatColor(playerStats, {
    strength: opponent.strength,
    agility: opponent.agility,
    intelligence: opponent.intelligence,
    level: opponent.level ?? 1n,
    maxHp: monsterData.maxHp ?? opponent.maxHp ?? 10n,
    armor: monsterData.armor ?? 0n,
    isElite: isElite,
  });

  return (
    <HStack
      borderBottom="2px solid transparent"
      h={ROW_HEIGHT}
      spacing={0}
      _active={{
        borderBottom: '2px solid white',
      }}
      _hover={{
        borderBottom: '2px solid white',
      }}
    >
      <HStack
        as="button"
        h="98%"
        justifyContent="space-between"
        onClick={disableRow ? undefined : onClick}
        px={{ base: 3, sm: 4 }}
        transition="all 0.3s ease"
        w="100%"
        _active={{
          bg: disableRow ? 'transparent' : 'grey300',
          cursor: disableRow ? 'not-allowed' : 'pointer',
        }}
        _hover={{
          cursor: disableRow ? 'not-allowed' : 'pointer',
        }}
      >
        <Tooltip
          label={(opponent as Monster).description || ''}
          placement="top"
          hasArrow
          isDisabled={encounterType !== EncounterType.PvE || !(opponent as Monster).description}
          shouldWrapChildren
        >
          <HStack justifyContent="start" spacing={4}>
            {(encounterType === EncounterType.PvE ? getMonsterImage(name) : opponent.image) && (
              <Avatar
                filter={disableRow ? 'grayscale(100%)' : 'none'}
                size={{ base: '2xs', md: 'xs' }}
                src={encounterType === EncounterType.PvE ? getMonsterImage(name) : opponent.image}
                name={name}
              />
            )}
            <Text
              color={isWorldBoss ? '#E8A840' : nameColor}
              filter={disableRow ? 'grayscale(100%)' : 'none'}
              fontWeight={isWorldBoss ? 700 : undefined}
              size={{ base: '2xs', sm: '2xs', md: 'sm', lg: 'md' }}
            >
              {isWorldBoss ? `${t('tile.bossPrefix')} \u2022 ` : isElite ? '★ ' : ''}{name}
            </Text>
          </HStack>
        </Tooltip>
        {!disableRow && !!level && (
          <HStack spacing={1}>
            <Text fontWeight={500} size={{ base: '2xs', sm: '2xs', md: 'sm' }}>
              {t('tile.levelLabel', { level: level.toString() })}
            </Text>
            {encounterType === EncounterType.PvP &&
              (opponent as Character).advancedClass != null &&
              (opponent as Character).advancedClass !== AdvancedClass.None && (
                <Text
                  color={ADVANCED_CLASS_COLORS[(opponent as Character).advancedClass]}
                  fontFamily="'Fira Code', monospace"
                  fontSize="2xs"
                  fontWeight={700}
                >
                  {t(ADVANCED_CLASS_I18N_KEYS[(opponent as Character).advancedClass])}
                </Text>
              )}
          </HStack>
        )}
        {!(opponent as Character).worldEncounter && inBattle && (
          <Text color="red" fontWeight={700} size={{ base: '3xs', sm: '2xs' }}>
            ({t('tile.inBattle')})
          </Text>
        )}
        {(opponent as Character).worldEncounter && (
          <Text color="red" fontWeight={700} size={{ base: '3xs', sm: '2xs' }}>
            ({t('tile.inShop')})
          </Text>
        )}
        {inCooldown && (
          <Text color="red" fontWeight={700} size={{ base: '3xs', sm: '2xs' }}>
            ({t('tile.inCooldown')})
          </Text>
        )}
      </HStack>
      {encounterType === EncounterType.PvP && (
        <Menu>
          <MenuButton
            as={Button}
            borderRadius={0}
            h="100%"
            size="xs"
            variant="ghost"
          >
            <BsThreeDotsVertical size={14} />
          </MenuButton>
          <MenuList>
            <MenuItem
              onClick={() =>
                navigate('/characters/' + (opponent as Character).id)
              }
            >
              {t('tile.viewCharacter')}
            </MenuItem>
          </MenuList>
        </Menu>
      )}
    </HStack>
  );
};

const explorePulse = keyframes`
  0%, 100% { text-shadow: 0 0 20px rgba(168, 222, 255, 0.3), 0 0 40px rgba(168, 222, 255, 0.1); }
  50%      { text-shadow: 0 0 25px rgba(168, 222, 255, 0.6), 0 0 50px rgba(168, 222, 255, 0.25); }
`;

const echoPulse = keyframes`
  0%, 100% { filter: brightness(0.8); }
  50%      { filter: brightness(1.3); }
`;

const movementHintPulse = keyframes`
  0%, 100% { filter: brightness(0.85); }
  50%      { filter: brightness(1.2); }
`;

const FragmentEchoRow = ({
  fragmentName,
  fragmentType,
  onClick,
}: {
  fragmentName: string;
  fragmentType: number;
  onClick: () => void;
}) => {
  return (
    <HStack
      borderBottom="2px solid rgba(168, 222, 255, 0.5)"
      h={ROW_HEIGHT}
      spacing={0}
      bg="linear-gradient(90deg, rgba(168, 222, 255, 0.15) 0%, rgba(168, 222, 255, 0.05) 100%)"
      boxShadow="0 0 12px 4px rgba(168, 222, 255, 0.3), 0 0 24px 8px rgba(168, 222, 255, 0.12), inset 0 0 12px rgba(168, 222, 255, 0.1)"
      animation={`${echoPulse} 3s cubic-bezier(0.4, 0, 0.6, 1) infinite`}
      _active={{
        borderBottom: '2px solid rgba(168, 222, 255, 1)',
      }}
      _hover={{
        borderBottom: '2px solid rgba(168, 222, 255, 1)',
        bg: 'linear-gradient(90deg, rgba(168, 222, 255, 0.25) 0%, rgba(168, 222, 255, 0.1) 100%)',
      }}
    >
      <HStack
        as="button"
        h="98%"
        justifyContent="space-between"
        onClick={onClick}
        px={{ base: 1, sm: 4 }}
        transition="all 0.3s ease"
        w="100%"
        _active={{
          cursor: 'pointer',
        }}
        _hover={{
          cursor: 'pointer',
        }}
      >
        <HStack justifyContent="start" spacing={2}>
          <Text
            color="#A8DEFF"
            fontWeight={700}
            size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
            textShadow="0 0 8px rgba(120, 200, 255, 0.6)"
          >
            ✦
          </Text>
          <Text
            color="#A8DEFF"
            fontWeight={600}
            size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
          >
            {fragmentName}
          </Text>
        </HStack>
        <Text
          color="#A8DEFF"
          fontWeight={500}
          size={{ base: '3xs', sm: '2xs', md: 'sm' }}
        >
          Fragment {getRomanNumeral(fragmentType)}
        </Text>
      </HStack>
    </HStack>
  );
};
