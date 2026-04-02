import {
  Box,
  Button,
  Grid,
  HStack,
  Image,
  Progress,
  Spinner,
  Stack,
  Text,
  useBreakpointValue,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { zeroAddress, zeroHash } from 'viem';
import { Trans, useTranslation } from 'react-i18next';
import SafeTypist from './SafeTypist';
import { getBattleConsoleState } from './battleConsole';

import { SHOW_Z2 } from '../lib/env';
import { BattleCombatLog } from './pretext/game/BattleCombatLog';
import { CombatTypewriter } from './pretext/game/CombatTypewriter';
import { GameItemTooltip } from './pretext/game/GameItemTooltip';
import { useCombatLogEntries } from '../hooks/useCombatLogEntries';
import { useCombatNarrative } from '../hooks/useCombatNarrative';
import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useCombatPacing } from '../hooks/useCombatPacing';
import { OnboardingStage, useOnboardingStage } from '../hooks/useOnboardingStage';
import { useSlotOrder } from '../hooks/useSlotOrder';
import { type Armor, CLASS_COLORS, EncounterType, type Monster, RARITY_COLORS, type Spell, StatsClasses, type Weapon } from '../utils/types';
import {
  BATTLE_OUTCOME_SEEN_KEY,
  SLOT_ORDER_KEY_PREFIX,
  STATUS_EFFECT_NAME_MAPPING,
} from '../utils/constants';
import { getItemImage } from '../utils/itemImages';
import { etherToFixedNumber, removeEmoji } from '../utils/helpers';
import { ConsumableQuickUse } from './ConsumableQuickUse';
import { ItemEquipModal } from './ItemEquipModal';
import { PotionSvg } from './SVGs/PotionSvg';

export const ActionsPanel = (): JSX.Element => {
  const { t } = useTranslation('ui');
  const { t: te } = useTranslation('effects');
  const { t: tm } = useTranslation('monsters');
  const { character, equippedArmor, equippedConsumables, equippedSpells, equippedWeapons, refreshCharacter } =
    useCharacter();
  const { isSpawned, visibleMonstersOnTile, position } = useMap();
  const {
    attackOutcomes,
    attackingItemId,
    attackStatusMessage,
    currentBattle,
    dotActions,
    isFleeing,
    lastestBattleOutcome,
    onAttack,
    onContinueToBattleOutcome,
    onFleePvp,
    opponent,
    statusEffectActions,
  } = useBattle();
  const { autoAdventureMode, isRefreshing, onToggleAutoAdventure } = useMovement();
  const stage = useOnboardingStage();

  const { visibleOutcomes, pendingTurn, isBattleResolutionPending } = useCombatPacing({
    attackOutcomes,
    characterId: character?.id,
    isInBattle: !!currentBattle,
  });

  // Display name prefixed with "Elite" for elite mobs
  // (declared early so combatLogEntries can reference it)
  const opponentDisplayName = useMemo(() => {
    if (!opponent) return t('battle.aMonster');
    const isElite = 'isElite' in opponent && (opponent as Monster).isElite;
    return isElite ? t('battle.elitePrefix', { name: opponent.name }) : opponent.name;
  }, [opponent]);

  const combatLogEntries = useCombatLogEntries({
    visibleOutcomes,
    dotActions,
    characterId: character?.id,
    opponentName: opponentDisplayName,
  });

  const {
    armorTemplates,
    isLoading: isItemTemplatesLoading,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(32);
  const [attackButtonFocus, setAttackButtonFocus] = useState<number>(0);
  const [hoveredTokenId, setHoveredTokenId] = useState<string | null>(null);

  const parentDivRef = useRef<HTMLDivElement>(null);
  const attackButton1Ref = useRef<HTMLButtonElement>(null);
  const attackButton2Ref = useRef<HTMLButtonElement>(null);
  const attackButton3Ref = useRef<HTMLButtonElement>(null);
  const attackButton4Ref = useRef<HTMLButtonElement>(null);

  const getButtonRef = useCallback((index: number) => {
    switch (index) {
      case 0:
        return attackButton1Ref;
      case 1:
        return attackButton2Ref;
      case 2:
        return attackButton3Ref;
      case 3:
        return attackButton4Ref;
      default:
        return null;
    }
  }, []);

  useEffect(() => {
    if (attackButton1Ref.current) {
      attackButton1Ref.current.focus({ preventScroll: true });
      setAttackButtonFocus(0);
    }
  }, [attackOutcomes]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          if (attackButtonFocus === 1 && attackButton2Ref.current) {
            attackButton1Ref.current?.focus({ preventScroll: true });
            setAttackButtonFocus(0);
          }
          if (attackButtonFocus === 2 && attackButton3Ref.current) {
            attackButton2Ref.current?.focus({ preventScroll: true });
            setAttackButtonFocus(1);
          }
          if (attackButtonFocus === 3 && attackButton4Ref.current) {
            attackButton3Ref.current?.focus({ preventScroll: true });
            setAttackButtonFocus(2);
          }
          break;
        case 'ArrowRight':
          if (attackButtonFocus === 0 && attackButton1Ref.current) {
            attackButton2Ref.current?.focus({ preventScroll: true });
            setAttackButtonFocus(1);
          }
          if (attackButtonFocus === 1 && attackButton2Ref.current) {
            attackButton3Ref.current?.focus({ preventScroll: true });
            setAttackButtonFocus(2);
          }
          if (attackButtonFocus === 2 && attackButton3Ref.current) {
            attackButton4Ref.current?.focus({ preventScroll: true });
            setAttackButtonFocus(3);
          }
          break;
        case '1':
          attackButton1Ref.current?.focus({ preventScroll: true });
          setAttackButtonFocus(1);
          if (attackButton1Ref.current?.disabled) {
            break;
          }
          attackButton1Ref.current?.click();
          break;
        case '2':
          attackButton2Ref.current?.focus({ preventScroll: true });
          setAttackButtonFocus(2);
          if (attackButton2Ref.current?.disabled) {
            break;
          }
          attackButton2Ref.current?.click();
          break;
        case '3':
          attackButton3Ref.current?.focus({ preventScroll: true });
          setAttackButtonFocus(3);
          if (attackButton3Ref.current?.disabled) {
            break;
          }
          attackButton3Ref.current?.click();
          break;
        case '4':
          attackButton4Ref.current?.focus({ preventScroll: true });
          setAttackButtonFocus(4);
          if (attackButton4Ref.current?.disabled) {
            break;
          }
          attackButton4Ref.current?.click();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', listener);
    // eslint-disable-next-line consistent-return
    return () => window.removeEventListener('keydown', listener);
  }, [attackButtonFocus]);

  const battleResolved = useMemo(
    () => currentBattle?.encounterId === lastestBattleOutcome?.encounterId,
    [currentBattle, lastestBattleOutcome],
  );

  const battleOver = useMemo(
    () => battleResolved && !isBattleResolutionPending,
    [battleResolved, isBattleResolutionPending],
  );


  const userTurn = useMemo(() => {
    if (!(character && currentBattle)) return false;

    if (currentBattle.encounterType === EncounterType.PvE) {
      return true;
    }

    const attackersTurn = Number(currentBattle.currentTurn) % 2 === 1;

    if (attackersTurn && currentBattle.attackers.includes(character?.id)) {
      return true;
    }

    if (!attackersTurn && currentBattle.defenders.includes(character?.id)) {
      return true;
    }

    return false;
  }, [character, currentBattle]);

  const turnEndTime = useMemo(() => {
    if (!currentBattle) return 0;

    const _turnEndTime =
      (BigInt(currentBattle.currentTurnTimer) + BigInt(32)) * BigInt(1000);

    return Number(_turnEndTime);
  }, [currentBattle]);

  useEffect(() => {
    if (turnEndTime - Date.now() < 0) {
      setTurnTimeLeft(0);
    } else {
      setTurnTimeLeft(Math.floor((turnEndTime - Date.now()) / 1000));
    }

    const interval = setInterval(() => {
      const remaining = Math.floor((turnEndTime - Date.now()) / 1000);
      setTurnTimeLeft(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentBattle, turnEndTime]);

  const canAttack = useMemo(() => {
    if (!currentBattle) return false;
    if (battleResolved) return false;

    if (currentBattle.encounterType === EncounterType.PvE) {
      return true;
    }

    if (userTurn) {
      return true;
    }

    if (turnTimeLeft === 0) {
      return true;
    }

    return false;
  }, [battleResolved, currentBattle, userTurn, turnTimeLeft]);

  const weaponsAndSpells = useMemo(
    () => [...equippedWeapons, ...equippedSpells],
    [equippedWeapons, equippedSpells],
  );

  const storageKey = character ? `${SLOT_ORDER_KEY_PREFIX}${character.id}` : '';
  const { orderedItems: orderedAttackItems } = useSlotOrder(storageKey, weaponsAndSpells);

  // Keep legacy alias so the rest of the file (battle log, empty-weapon check) still works
  const equippedSpellsAndWeapons = orderedAttackItems;

  const combatConsumables = useMemo(
    () => equippedConsumables.filter(c => c.hpRestoreAmount !== BigInt(0) && c.balance > 0n),
    [equippedConsumables],
  );

  const actionItems = useMemo(() => [
    ...orderedAttackItems.map(item => ({
      tokenId: item.tokenId,
      name: item.name,
      type: 'attack' as const,
    })),
    ...combatConsumables.map(item => ({
      tokenId: item.tokenId,
      name: item.name,
      type: 'consumable' as const,
      balance: item.balance,
    })),
  ], [orderedAttackItems, combatConsumables]);

  const spellAndWeaponTemplates = useMemo(
    () => [...spellTemplates, ...weaponTemplates],
    [spellTemplates, weaponTemplates],
  );

  const combatNarrative = useCombatNarrative({
    visibleOutcomes,
    pendingTurn,
    dotActions,
    statusEffectActions,
    characterId: character?.id,
    opponentName: opponentDisplayName,
    opponent: opponent && 'mobId' in opponent ? opponent as Monster : null,
    encounterType: currentBattle?.encounterType,
    spellAndWeaponTemplates,
    combatConsumables,
  });

  const STAT_LABELS: Record<StatsClasses, string> = {
    [StatsClasses.Strength]: 'STR',
    [StatsClasses.Agility]: 'AGI',
    [StatsClasses.Intelligence]: 'INT',
  };

  const weaponMatchups = useMemo(() => {
    if (!opponent) return {};
    const result: Record<string, { matchup: 'strong' | 'weak' | 'neutral'; statType: StatsClasses }> = {};
    for (const item of orderedAttackItems) {
      const isSpell = spellTemplates.some(s => s.tokenId === item.tokenId);
      let statType: StatsClasses;
      if (isSpell) {
        statType = StatsClasses.Intelligence;
      } else {
        const w = item as Weapon;
        const str = Number(w.strModifier ?? 0n);
        const agi = Number(w.agiModifier ?? 0n);
        const int = Number(w.intModifier ?? 0n);
        if (int >= str && int >= agi) statType = StatsClasses.Intelligence;
        else if (agi >= str) statType = StatsClasses.Agility;
        else statType = StatsClasses.Strength;
      }
      const opClass = opponent.entityClass;
      let matchup: 'strong' | 'weak' | 'neutral' = 'neutral';
      if (
        (statType === StatsClasses.Strength && opClass === StatsClasses.Agility) ||
        (statType === StatsClasses.Agility && opClass === StatsClasses.Intelligence) ||
        (statType === StatsClasses.Intelligence && opClass === StatsClasses.Strength)
      ) {
        matchup = 'strong';
      } else if (
        (statType === StatsClasses.Strength && opClass === StatsClasses.Intelligence) ||
        (statType === StatsClasses.Agility && opClass === StatsClasses.Strength) ||
        (statType === StatsClasses.Intelligence && opClass === StatsClasses.Agility)
      ) {
        matchup = 'weak';
      }
      result[item.tokenId] = { matchup, statType };
    }
    return result;
  }, [opponent, orderedAttackItems, spellTemplates]);

  const canFlee = useMemo(() => {
    if (!character) return false;
    if (!currentBattle) return false;
    if (battleResolved) return false;

    const isAttacker = currentBattle.attackers.includes(character.id);

    if (isAttacker && currentBattle.currentTurn === BigInt('1')) {
      return true;
    }

    if (!isAttacker && currentBattle.currentTurn === BigInt('2')) {
      return true;
    }

    return false;
  }, [battleResolved, character, currentBattle]);

  const hasSmokeCover = useMemo(() => {
    if (!character) return false;
    return statusEffectActions.some(
      effect =>
        effect.name === 'Smoke Cloak' &&
        effect.active &&
        effect.victimId.toLowerCase() === character.id.toLowerCase(),
    );
  }, [character, statusEffectActions]);

  const battleDraw = useMemo(() => {
    if (!currentBattle) return false;
    return currentBattle.maxTurns === currentBattle.currentTurn;
  }, [currentBattle]);

  const battleConsole = useMemo(() => {
    if (!currentBattle || !opponent) return null;

    return getBattleConsoleState({
      encounterType: currentBattle.encounterType,
      opponentDisplayName,
      userTurn,
      canAttack,
      turnTimeLeft,
    });
  }, [canAttack, currentBattle, opponent, opponentDisplayName, turnTimeLeft, userTurn]);

  // Track the last known opponent name so auto-adventure results can capture it
  // even after the dead monster is pruned from allMonsters (opponent goes null).
  const lastOpponentNameRef = useRef(opponentDisplayName);
  useEffect(() => {
    if (opponent) lastOpponentNameRef.current = opponentDisplayName;
  }, [opponent, opponentDisplayName]);

  // --- Auto adventure inline results ---
  // Rolling history of last 5 battle results. Captured in local state so they
  // survive BattleContext fluctuations. BattleContext is dismissed immediately
  // when results are captured so the next battle can proceed.

  type InlineResult = {
    winner: string;
    expDropped: bigint;
    goldDropped: bigint;
    isDraw: boolean;
    encounterId: string;
    monsterName: string;
    items: (Armor | Spell | Weapon)[];
  };

  const [inlineResults, setInlineResults] = useState<InlineResult[]>([]);

  const [selectedItem, setSelectedItem] = useState<Armor | Spell | Weapon | null>(null);
  const { isOpen: isItemModalOpen, onClose: onCloseItemModal, onOpen: onOpenItemModal } = useDisclosure();

  // Capture results when a new outcome arrives, dismiss from BattleContext immediately
  useEffect(() => {
    if (!(autoAdventureMode && battleOver && currentBattle && lastestBattleOutcome)) return;
    if (inlineResults.some(r => r.encounterId === lastestBattleOutcome.encounterId)) return;

    const ids = lastestBattleOutcome.itemsDropped ?? [];
    const items = [
      ...armorTemplates.filter(a => ids.includes(a.tokenId)).map(a => ({
        ...a, balance: 1n, itemId: zeroHash, owner: zeroAddress,
      })),
      ...spellTemplates.filter(s => ids.includes(s.tokenId)).map(s => ({
        ...s, balance: 1n, itemId: zeroHash, owner: zeroAddress,
      })),
      ...weaponTemplates.filter(w => ids.includes(w.tokenId)).map(w => ({
        ...w, balance: 1n, itemId: zeroHash, owner: zeroAddress,
      })),
    ].sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0));

    setInlineResults(prev => [{
      winner: lastestBattleOutcome.winner,
      expDropped: lastestBattleOutcome.expDropped,
      goldDropped: lastestBattleOutcome.goldDropped,
      isDraw: currentBattle.maxTurns === currentBattle.currentTurn,
      encounterId: lastestBattleOutcome.encounterId,
      monsterName: lastOpponentNameRef.current,
      items,
    }, ...prev].slice(0, 5));

    // Immediately free BattleContext so next battle can proceed
    localStorage.setItem(BATTLE_OUTCOME_SEEN_KEY, lastestBattleOutcome.encounterId);
    onContinueToBattleOutcome(false);
  }, [autoAdventureMode, battleOver, currentBattle, lastestBattleOutcome, inlineResults, armorTemplates, spellTemplates, weaponTemplates, onContinueToBattleOutcome, opponent]);

  // Clear history when auto-adventure is turned off
  useEffect(() => {
    if (!autoAdventureMode) setInlineResults([]);
  }, [autoAdventureMode]);

  if (isItemTemplatesLoading) {
    return (
      <VStack mt={12}>
        <Spinner size="lg" />
      </VStack>
    );
  }

  return (
    <Box fontWeight={500} maxH="100%" overflowY="auto" ref={parentDivRef}>
      {battleOver && currentBattle && !autoAdventureMode && (
        <VStack
          bg="linear-gradient(180deg, rgba(28,24,20,0.98) 0%, rgba(18,15,12,0.98) 100%)"
          borderBottom="1px solid"
          borderColor="rgba(90,78,60,0.55)"
          boxShadow="0 10px 30px rgba(0,0,0,0.28)"
          position="sticky"
          top={0}
          w="100%"
          zIndex={1}
          py={{ base: 3, lg: 4 }}
          px={{ base: 3, lg: 4 }}
          spacing={3}
        >
          <Text
            color="#8A7E6A"
            fontFamily="mono"
            fontSize="2xs"
            letterSpacing="0.18em"
            textTransform="uppercase"
          >
            Battle Complete
          </Text>
          {battleDraw ? (
            <Text
              color="#E8DCC8"
              fontWeight="bold"
              size={{ base: 'sm', sm: 'md', lg: 'lg' }}
              textAlign="center"
            >
              {t('battle.drawEnd')}
            </Text>
          ) : (
            <Text
              color="#E8DCC8"
              fontWeight="bold"
              size={{ base: 'sm', sm: 'md', lg: 'lg' }}
              textAlign="center"
            >
              {lastestBattleOutcome?.winner === character?.id &&
              lastestBattleOutcome?.playerFled
                ? `${opponentDisplayName} fled!`
                : ''}
              {lastestBattleOutcome?.winner !== character?.id &&
              lastestBattleOutcome?.playerFled
                ? t('combat.youFled')
                : ''}
              {lastestBattleOutcome?.winner === character?.id &&
              !lastestBattleOutcome?.playerFled
                ? t('combat.youWon')
                : ''}
              {lastestBattleOutcome?.winner !== character?.id &&
              !lastestBattleOutcome?.playerFled
                ? t('combat.youDied')
                : ''}
            </Text>
          )}
          {lastestBattleOutcome && lastestBattleOutcome.winner === character?.id &&
            !lastestBattleOutcome.playerFled &&
            (lastestBattleOutcome.expDropped > 0n || lastestBattleOutcome.goldDropped > 0n) && (
            <HStack
              justifyContent="center"
              spacing={2}
              flexWrap="wrap"
            >
              {lastestBattleOutcome.expDropped > 0n && (
                <Box
                  bg="rgba(90,138,62,0.12)"
                  border="1px solid"
                  borderColor="rgba(90,138,62,0.32)"
                  borderRadius="full"
                  px={3}
                  py={1}
                >
                  <Text color="#8FCB6C" fontFamily="mono" fontWeight={700} size="xs">
                  +{lastestBattleOutcome.expDropped.toString()} XP
                  </Text>
                </Box>
              )}
              {lastestBattleOutcome.expDropped > 0n && lastestBattleOutcome.goldDropped > 0n && (
                <Text color="#8A7E6A" size="xs">·</Text>
              )}
              {lastestBattleOutcome.goldDropped > 0n && (
                <Box
                  bg="rgba(200,122,42,0.12)"
                  border="1px solid"
                  borderColor="rgba(200,122,42,0.32)"
                  borderRadius="full"
                  px={3}
                  py={1}
                >
                  <Text color="#D4A54A" fontFamily="mono" fontWeight={700} size="xs">
                  +{etherToFixedNumber(lastestBattleOutcome.goldDropped)} Gold
                  </Text>
                </Box>
              )}
            </HStack>
          )}
          <Button
            onClick={() => onContinueToBattleOutcome(true)}
            size="sm"
            variant="outline"
            borderColor="rgba(212,165,74,0.4)"
            color="#E8DCC8"
            bg="rgba(255,255,255,0.04)"
            _hover={{ bg: 'rgba(212,165,74,0.12)', borderColor: 'rgba(212,165,74,0.6)' }}
          >
            View Results
          </Button>
        </VStack>
      )}
      {currentBattle && equippedSpellsAndWeapons.length === 0 && (
        <VStack p={{ base: 2, lg: 4 }} spacing={3}>
          <Text color="red" fontWeight={700}>
            You have no equipped items. In order to attack, you must go to your{' '}
            <Text
              as={Link}
              color="blue"
              to={`/characters/${character?.id}`}
              _hover={{ textDecoration: 'underline' }}
            >
              character page
            </Text>{' '}
            and equip at least 1 item.
          </Text>
          {canFlee && (
            <HStack justify="center" spacing={3}>
              <Button
                isLoading={isFleeing}
                size="sm"
                onClick={onFleePvp}
                variant="outline"
                color="#A0522D"
                borderColor="#A0522D"
                _hover={{ bg: 'rgba(160,82,45,0.15)' }}
              >
                Flee
              </Button>
              <Text size="2xs" color={hasSmokeCover ? '#6B8E6B' : '#8A7E6A'} maxW="200px">
                {hasSmokeCover
                  ? t('combat.smokeCloakActive')
                  : currentBattle.encounterType === EncounterType.PvP
                    ? t('combat.fleeFirstTurnCost')
                    : t('combat.fleeFirstTurn')}
              </Text>
            </HStack>
          )}
        </VStack>
      )}
      {!battleOver &&
        currentBattle &&
        equippedSpellsAndWeapons.length !== 0 &&
        opponent && (
          <VStack
            bg="linear-gradient(180deg, rgba(28,24,20,0.98) 0%, rgba(18,15,12,0.98) 100%)"
            borderBottom="1px solid"
            borderColor="rgba(90,78,60,0.55)"
            boxShadow="0 10px 30px rgba(0,0,0,0.24)"
            position="sticky"
            spacing={0}
            top={0}
            w="100%"
          >
            {battleConsole && (
              <Box
                borderBottom="1px solid"
                borderColor="rgba(90,78,60,0.4)"
                px={{ base: 3, lg: 4 }}
                py={{ base: 3, lg: 4 }}
                w="100%"
              >
                <HStack align="start" justify="space-between" spacing={3}>
                  <VStack align="start" flex={1} spacing={1}>
                    <Text
                      color="#8A7E6A"
                      fontFamily="mono"
                      fontSize="2xs"
                      letterSpacing="0.18em"
                      textTransform="uppercase"
                    >
                      {battleConsole.eyebrow}
                    </Text>
                    <Text
                      color="#E8DCC8"
                      fontWeight={700}
                      size={{ base: 'sm', lg: 'md' }}
                    >
                      {battleConsole.title}
                    </Text>
                    <Text color="#8A7E6A" size="xs">
                      {battleConsole.detail}
                    </Text>
                  </VStack>
                  <Box
                    bg={battleConsole.badgeBg}
                    border="1px solid"
                    borderColor={battleConsole.badgeBorder}
                    borderRadius="full"
                    flexShrink={0}
                    px={3}
                    py={1}
                  >
                    <Text
                      color={battleConsole.badgeColor}
                      fontFamily="mono"
                      fontSize="2xs"
                      fontWeight={700}
                      letterSpacing="0.08em"
                      textTransform="uppercase"
                    >
                      {battleConsole.badge}
                    </Text>
                  </Box>
                </HStack>
                {currentBattle.encounterType === EncounterType.PvP && (
                  <Progress
                    borderRadius="full"
                    mt={3}
                    size="xs"
                    value={(turnTimeLeft / 32) * 100}
                    variant="timer"
                    w="100%"
                  />
                )}
              </Box>
            )}
            <Box position="relative" px={{ base: 2, lg: 4 }} py={{ base: 2, lg: 3 }} w="100%">
              {SHOW_Z2 && isDesktop && hoveredTokenId && (() => {
                const hovItem = orderedAttackItems.find(i => i.tokenId === hoveredTokenId);
                if (!hovItem) return null;
                const mu = weaponMatchups[hovItem.tokenId];
                return (
                  <Box
                    position="absolute"
                    bottom="calc(100% - 8px)"
                    left="50%"
                    transform="translateX(-50%)"
                    mb={1}
                    zIndex={10}
                    pointerEvents="none"
                  >
                    <GameItemTooltip
                      item={hovItem}
                      matchup={mu?.matchup}
                      opponentClass={opponent?.entityClass}
                    />
                  </Box>
                );
              })()}
              <Grid
                gap={2}
                templateColumns={{ base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }}
                w="100%"
              >
                {actionItems.map((item, index) => {
                  const icon = getItemImage(removeEmoji(item.name));
                  const matchupData = item.type === 'attack' ? weaponMatchups[item.tokenId] : undefined;
                  const matchup = matchupData?.matchup;
                  const statType = matchupData?.statType;
                  const accent = item.type === 'consumable'
                    ? {
                      bg: 'rgba(90,138,62,0.08)',
                      border: 'rgba(90,138,62,0.28)',
                      eyebrow: 'Consumable',
                      eyebrowColor: '#8FCB6C',
                    }
                    : matchup === 'strong'
                      ? {
                        bg: 'rgba(90,138,62,0.12)',
                        border: 'rgba(90,138,62,0.38)',
                        eyebrow: 'Advantage',
                        eyebrowColor: '#8FCB6C',
                      }
                      : matchup === 'weak'
                        ? {
                          bg: 'rgba(184,92,58,0.12)',
                          border: 'rgba(184,92,58,0.38)',
                          eyebrow: 'High Risk',
                          eyebrowColor: '#D89272',
                        }
                        : {
                          bg: 'rgba(255,255,255,0.03)',
                          border: 'rgba(120,108,92,0.3)',
                          eyebrow: 'Neutral',
                          eyebrowColor: '#B7AA95',
                        };
                  return (
                    <Button
                      alignItems="stretch"
                      bg={accent.bg}
                      border="1px solid"
                      borderColor={accent.border}
                      borderRadius="md"
                      isDisabled={
                        attackingItemId !== null || !canAttack || isFleeing
                      }
                      isLoading={attackingItemId === item.tokenId}
                      key={`action-item-${index}`}
                      loadingText={removeEmoji(item.name)}
                      onClick={() => onAttack(item.tokenId)}
                      onMouseEnter={item.type === 'attack' ? () => setHoveredTokenId(item.tokenId) : undefined}
                      onMouseLeave={item.type === 'attack' ? () => setHoveredTokenId(null) : undefined}
                      overflow="hidden"
                      px={0}
                      py={0}
                      ref={getButtonRef(index)}
                      fontSize="xs"
                      minH={{ base: '78px', lg: '92px' }}
                      h="auto"
                      justifyContent="flex-start"
                      size={{ base: 'sm', sm: 'sm', lg: 'md' }}
                      variant="ghost"
                      w="100%"
                      _active={{ bg: accent.bg }}
                      _disabled={{
                        bg: 'rgba(255,255,255,0.02)',
                        borderColor: 'rgba(120,108,92,0.2)',
                        opacity: 0.45,
                      }}
                      _hover={{
                        bg: accent.bg,
                        borderColor: accent.eyebrowColor,
                        transform: 'translateY(-1px)',
                      }}
                      whiteSpace="normal"
                    >
                      <VStack align="stretch" px={3} py={3} spacing={2} w="100%">
                        <HStack align="start" justify="space-between" spacing={2} w="100%">
                          <HStack align="start" spacing={2} minW={0}>
                            <Box
                              bg="rgba(255,255,255,0.06)"
                              border="1px solid"
                              borderColor="rgba(120,108,92,0.35)"
                              borderRadius="sm"
                              color="#B7AA95"
                              fontFamily="mono"
                              fontSize="2xs"
                              fontWeight={700}
                              minW="22px"
                              px={1.5}
                              py={1}
                              textAlign="center"
                            >
                              {index + 1}
                            </Box>
                            <VStack align="start" minW={0} spacing={0.5}>
                              <HStack spacing={1.5}>
                                {icon ? (
                                  <Image src={icon} boxSize="18px" />
                                ) : item.type === 'consumable' ? (
                                  <PotionSvg size={3} theme="dark" />
                                ) : null}
                                <Text
                                  color="#E8DCC8"
                                  fontSize="sm"
                                  fontWeight={600}
                                  noOfLines={1}
                                  textAlign="left"
                                >
                                  {removeEmoji(item.name)}
                                </Text>
                              </HStack>
                              <Text
                                color={accent.eyebrowColor}
                                fontFamily="mono"
                                fontSize="2xs"
                                letterSpacing="0.08em"
                                textTransform="uppercase"
                              >
                                {accent.eyebrow}
                              </Text>
                            </VStack>
                          </HStack>
                          {statType !== undefined && (
                            <Text
                              color={CLASS_COLORS[statType]}
                              fontFamily="mono"
                              fontSize="2xs"
                              fontWeight={700}
                              letterSpacing="0.08em"
                              textTransform="uppercase"
                            >
                              {STAT_LABELS[statType]}
                            </Text>
                          )}
                        </HStack>
                        <HStack justify="space-between" spacing={2} w="100%">
                          <HStack spacing={1}>
                            {matchup === 'strong' && (
                              <Text as="span" color="#8FCB6C" fontSize="2xs">▲</Text>
                            )}
                            {matchup === 'weak' && (
                              <Text as="span" color="#D89272" fontSize="2xs">▼</Text>
                            )}
                            <Text color="#8A7E6A" fontSize="2xs" textAlign="left">
                              {item.type === 'consumable'
                                ? 'Recover and reset your footing.'
                                : matchup === 'strong'
                                  ? 'Favored into this target.'
                                  : matchup === 'weak'
                                    ? 'Poor matchup into this target.'
                                    : 'Steady damage option.'}
                            </Text>
                          </HStack>
                          {item.type === 'consumable' && 'balance' in item && (
                            <Text as="span" color="#B7AA95" fontFamily="mono" fontSize="2xs" opacity={0.8}>
                              x{item.balance.toString()}
                            </Text>
                          )}
                        </HStack>
                      </VStack>
                    </Button>
                  );
                })}
              </Grid>
            </Box>
            <HStack
              align={{ base: 'start', sm: 'center' }}
              borderTop="1px solid"
              borderColor="rgba(90,78,60,0.35)"
              flexDirection={{ base: 'column', sm: 'row' }}
              justify="space-between"
              px={{ base: 3, lg: 4 }}
              pb={{ base: 3, lg: 4 }}
              pt={{ base: 0, lg: 0 }}
              spacing={{ base: 2, sm: 3 }}
              w="100%"
            >
              <VStack align="start" spacing={0.5}>
                {isDesktop && actionItems.length > 0 && (
                  <Text color="#8A7E6A" fontFamily="mono" fontSize="2xs">
                    Use 1-{Math.min(actionItems.length, 4)} keys to act
                  </Text>
                )}
                <Text color="#8A7E6A" fontSize="2xs">
                  {attackStatusMessage || (
                    currentBattle.encounterType === EncounterType.PvE
                      ? 'Pick the cleanest line and keep the tempo.'
                      : canAttack
                        ? 'The clock is yours. Take the opening.'
                        : 'Watch the timer and prepare the counter.'
                  )}
                </Text>
              </VStack>
              {canFlee && (
                <Button
                  isLoading={isFleeing}
                  size="sm"
                  onClick={onFleePvp}
                  variant="outline"
                  color="#D89272"
                  borderColor="rgba(184,92,58,0.45)"
                  bg="rgba(184,92,58,0.08)"
                  _hover={{ bg: 'rgba(184,92,58,0.16)', borderColor: 'rgba(184,92,58,0.65)' }}
                >
                  Flee
                </Button>
              )}
            </HStack>
          </VStack>
        )}
      {SHOW_Z2 && currentBattle && !battleOver && (
        <Box px={{ base: 2, lg: 4 }} pt={2}>
          <BattleCombatLog entries={combatLogEntries} />
        </Box>
      )}
      <Stack p={{ base: 2, lg: 4 }}>
        {!currentBattle && !isSpawned && (
          <SafeTypist
            avgTypingDelay={10}
            cursor={{ show: false }}
            stdTypingDelay={10}
          >
            <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
              <Trans i18nKey="gameBoard.spawnPrompt" ns="ui" components={{ bold: <Text as="span" fontWeight={700} /> }} />
            </Text>
          </SafeTypist>
        )}
        {((!currentBattle || autoAdventureMode) && isSpawned && position && stage >= OnboardingStage.FIRST_STEPS) && (
          <VStack spacing={3} w="100%">
            {isDesktop && stage >= OnboardingStage.FIRST_BLOOD && <ConsumableQuickUse />}
            <HStack justify="space-between" w="100%">
              <Text color="#8A7E6A" fontStyle="italic" size="xs">
                {position.x === 0 && position.y === 0
                  ? t('combat.moveToFind')
                  : visibleMonstersOnTile.length === 0
                    ? t('combat.noMonstersHere')
                    : t('combat.clickToFight')}
              </Text>
              {/* Auto-adventure paused — hidden until re-enabled */}
            </HStack>
          </VStack>
        )}

        {autoAdventureMode && character && Number(character.maxHp) > 0 && (() => {
          const hpRatio = Number(character.currentHp) / Number(character.maxHp);
          if (hpRatio <= 0.4) {
            const isCritical = hpRatio <= 0.2;
            return (
              <Box
                bg={isCritical ? 'rgba(139,32,32,0.25)' : 'rgba(200,122,42,0.15)'}
                border="1px solid"
                borderColor={isCritical ? '#8B2020' : '#C87A2A'}
                borderRadius="md"
                px={3}
                py={2}
                w="100%"
              >
                <Text
                  color={isCritical ? '#E05050' : '#C87A2A'}
                  fontWeight={700}
                  size="xs"
                >
                  {isCritical ? 'HP Critical' : 'HP Low'} — {character.currentHp.toString()}/{character.maxHp.toString()}
                </Text>
                <Text color={isCritical ? '#C08080' : '#8A7E6A'} size="2xs">
                  {isCritical
                    ? t('combat.closeToDeath')
                    : t('combat.considerPotion')}
                </Text>
              </Box>
            );
          }
          return null;
        })()}

        {SHOW_Z2 && !autoAdventureMode && opponent && combatNarrative && (
          <CombatTypewriter
            segments={combatNarrative.segments}
            narrativeKey={combatNarrative.key}
            isEnemyAttack={combatNarrative.isEnemyAttack}
          />
        )}
        {!SHOW_Z2 && !autoAdventureMode && opponent &&
          (() => {
            const seenDotTurns = new Set<string>();
            const logSize = { base: '2xs' as const, sm: 'xs' as const, lg: 'sm' as const };
            const elements = [...visibleOutcomes].reverse().map((attack, reverseIndex) => {
            const i = visibleOutcomes.length - 1 - reverseIndex;
            const attackItem = spellAndWeaponTemplates.find(
              item => item.tokenId === attack.itemId,
            );
            const itemName =
              currentBattle?.encounterType === EncounterType.PvE &&
              attack.attackerId !== character?.id
                ? tm(`moves.${(opponent as Monster).mobId}`, { defaultValue: 'an item' })
                : attackItem?.name ?? 'an item';

            const possibleStatusEffectAttack = statusEffectActions.find(
              statusEffectAction =>
                Number(statusEffectAction.turnStart) - 1 === i,
            );

            const alreadyAffected = attack.effectIds.some(effectId =>
              statusEffectActions.some(
                statusEffectAction => statusEffectAction.effectId === effectId,
              ),
            );

            // Resolve effect names for this attack's effects
            const effectNames = attack.effectIds
              .map(effectId => {
                const paddedId = effectId.toString().padEnd(66, '0');
                return STATUS_EFFECT_NAME_MAPPING[paddedId];
              })
              .filter(Boolean);

            const isPlayerAttack = attack.attackerId === character?.id;

            // Consumable self-use: contract writes attackerId === defenderId
            const isSelfUse = attack.attackerId.toLowerCase() === attack.defenderId.toLowerCase();
            if (isSelfUse) {
              const consumable = combatConsumables.find(c => c.tokenId === attack.itemId);
              const isPlayer = attack.attackerId.toLowerCase() === character?.id.toLowerCase();
              return (
                <Box key={`battle-attack-${i}`}>
                  <SafeTypist
                    avgTypingDelay={10}
                    cursor={{ show: false }}
                    stdTypingDelay={10}
                  >
                    <Text size={logSize}>
                      {isPlayer ? t('combat.you') : opponentDisplayName} {t('combat.used')}{' '}
                      <Text as="span" color="green">
                        {consumable ? removeEmoji(consumable.name) : 'a potion'}
                      </Text>
                      .{isPlayer && consumable?.hpRestoreAmount
                        ? ` Restored ${consumable.hpRestoreAmount.toString()} HP.`
                        : ''}
                    </Text>
                  </SafeTypist>
                </Box>
              );
            }

            const hasOnlyStatusEffects =
              attack.attackerDamageDelt === 0n &&
              attack.effectIds.length > 0 &&
              !possibleStatusEffectAttack;

            // Check if there's a DoT message for this turn (show once per turn)
            // Suppress DoT text while counterattack is still hidden (reveals together at T+600ms)
            const turnKey = attack.currentTurn.toString();
            const dotForTurn = (pendingTurn && attack.currentTurn === pendingTurn)
              ? null
              : !seenDotTurns.has(turnKey)
                ? dotActions.find(d => d.turnNumber === attack.currentTurn && d.totalDamage > 0n)
                : null;
            if (dotForTurn) seenDotTurns.add(turnKey);

            const dotMessageElement = dotForTurn ? (
              <SafeTypist
                avgTypingDelay={10}
                cursor={{ show: false }}
                key={`battle-dot-${i}`}
                stdTypingDelay={10}
              >
                <Text color="purple.300" fontStyle="italic" size={{ base: '2xs', sm: '2xs', lg: 'xs' }}>
                  Poison deals{' '}
                  <Text as="span" fontFamily="mono">
                    {dotForTurn.totalDamage.toString()}
                  </Text>{' '}
                  damage to{' '}
                  {dotForTurn.entityId.toLowerCase() === character?.id.toLowerCase()
                    ? 'you'
                    : opponentDisplayName}
                  .
                </Text>
              </SafeTypist>
            ) : null;

            if (attack.miss[0]) {
              return (
                <Box
                  key={`battle-attack-${i}`}
                  {...(!isPlayerAttack && { pl: 3, borderLeft: '2px solid rgba(184,92,58,0.3)' })}
                >
                  <SafeTypist
                    avgTypingDelay={10}
                    cursor={{ show: false }}
                    stdTypingDelay={10}
                  >
                    {isPlayerAttack ? (
                      <Text size={logSize} color="#5A5248" fontStyle="italic">
                        You missed{' '}
                        <Text as="span" color="#5A5248">
                          {opponentDisplayName}
                        </Text>{' '}
                        with {itemName}.
                      </Text>
                    ) : (
                      <Text size={logSize} color="#5A5248" fontStyle="italic">
                        <Text as="span" color="#5A5248">
                          {opponentDisplayName}
                        </Text>{' '}
                        missed you with {itemName}.
                      </Text>
                    )}
                  </SafeTypist>
                  {dotMessageElement}
                </Box>
              );
            }

            const isCrit = attack.crit[0];

            // Compute the single content element to avoid multiple conditional
            // children inside Typist. react-typist crashes (Array.from(null))
            // when falsy children produce null entries in its internal lines array.
            let attackContent: JSX.Element;

            if (possibleStatusEffectAttack) {
              const isSelfBuff = isPlayerAttack
                ? possibleStatusEffectAttack.victimId === character?.id
                : possibleStatusEffectAttack.victimId === opponent?.id;
              const effectColor = isPlayerAttack
                ? (isSelfBuff ? '#A8DEFF' : '#D08040')
                : (isSelfBuff ? '#D08040' : '#A8DEFF');
              const affectedText = isPlayerAttack
                ? (isSelfBuff
                    ? `You are affected by ${possibleStatusEffectAttack.name}.`
                    : `${opponentDisplayName} is affected by ${possibleStatusEffectAttack.name}.`)
                : (isSelfBuff
                    ? `${opponentDisplayName} is affected by ${possibleStatusEffectAttack.name}.`
                    : `You are affected by ${possibleStatusEffectAttack.name}.`);

              attackContent = (
                <Box>
                  <Text size={logSize}>
                    {isCrit && (
                      <Text as="span" color="#C87A2A" fontWeight={700}>{t('battle.criticalHit')} </Text>
                    )}
                    {isPlayerAttack ? (
                      <Text as="span">
                        You cast {itemName}
                        {!isSelfBuff && (
                          <Text as="span">
                            {' '}on{' '}
                            <Text as="span" color="green">
                              {opponentDisplayName}
                            </Text>
                          </Text>
                        )}
                      </Text>
                    ) : (
                      <Text as="span">
                        <Text as="span" color="green">
                          {opponentDisplayName}
                        </Text>{' '}
                        cast {itemName}
                      </Text>
                    )}
                    .{' '}
                    <Text as="span" color={effectColor}>
                      {affectedText}
                    </Text>
                  </Text>
                  {te(`descriptions.${possibleStatusEffectAttack.name}`, { defaultValue: '' }) && (
                    <Text
                      size={{ base: '2xs', sm: '2xs', lg: 'xs' }}
                      color={effectColor}
                    >
                      {te(`descriptions.${possibleStatusEffectAttack.name}`)}
                    </Text>
                  )}
                </Box>
              );
            } else if (hasOnlyStatusEffects && !alreadyAffected) {
              attackContent = (
                <Text size={logSize}>
                  {isPlayerAttack ? 'You' : (
                    <Text as="span" color="green">{opponentDisplayName}</Text>
                  )} cast {itemName} on{' '}
                  {isPlayerAttack ? (
                    <Text as="span" color="green">{opponentDisplayName}</Text>
                  ) : 'you'}
                  .
                  {effectNames[0] &&
                    te(`descriptions.${effectNames[0]}`, { defaultValue: '' }) && (
                      <Text
                        as="span"
                        color="#D08040"
                      >
                        {' '}
                        {te(`names.${effectNames[0]}`)}.{' '}
                        {te(`descriptions.${effectNames[0]}`)}
                      </Text>
                    )}
                </Text>
              );
            } else if (alreadyAffected) {
              attackContent = (
                <Text size={logSize}>
                  {isPlayerAttack ? 'You' : (
                    <Text as="span" color="green">{opponentDisplayName}</Text>
                  )} cast {itemName} on{' '}
                  {isPlayerAttack ? (
                    <Text as="span" color="green">{opponentDisplayName}</Text>
                  ) : 'you'}
                  .{' '}
                  {effectNames[0]
                    ? `${effectNames[0]} is already active.`
                    : t('combat.noEffect')}
                </Text>
              );
            } else if (isPlayerAttack) {
              attackContent = (
                <Text size={logSize}>
                  {isCrit ? (
                    <Text as="span" color="#C87A2A" fontWeight={700}>Critical hit! </Text>
                  ) : ''}
                  You attacked{' '}
                  <Text as="span" color="green">
                    {opponentDisplayName}
                  </Text>{' '}
                  with {itemName} for{' '}
                  <Text
                    as="span"
                    color="#D4A54A"
                    fontFamily="mono"
                    {...(isCrit && {
                      fontSize: { base: 'xs', sm: 'sm', lg: 'md' },
                      textShadow: '0 0 8px rgba(200,122,42,0.5)',
                    })}
                  >
                    {attack.attackerDamageDelt.toString()}
                  </Text>{' '}
                  damage.
                </Text>
              );
            } else {
              attackContent = (
                <Text size={logSize}>
                  {isCrit ? (
                    <Text as="span" color="#C87A2A" fontWeight={700}>Critical hit! </Text>
                  ) : ''}
                  <Text as="span" color="green">
                    {opponentDisplayName}
                  </Text>{' '}
                  attacked you with {itemName} for{' '}
                  <Text
                    as="span"
                    color="#B85C3A"
                    fontFamily="mono"
                    {...(isCrit && {
                      fontSize: { base: 'xs', sm: 'sm', lg: 'md' },
                      textShadow: '0 0 8px rgba(200,122,42,0.5)',
                    })}
                  >
                    {attack.attackerDamageDelt.toString()}
                  </Text>{' '}
                  damage.
                </Text>
              );
            }

            return (
              <Box
                key={`battle-attack-${i}`}
                {...(!isPlayerAttack && { pl: 3, borderLeft: '2px solid rgba(184,92,58,0.3)' })}
              >
                <SafeTypist
                  avgTypingDelay={10}
                  cursor={{ show: false }}
                  stdTypingDelay={10}
                >
                  {attackContent}
                </SafeTypist>
                {attack.doubleStrike && (
                  <Text size={{ base: '2xs', sm: '2xs', lg: 'xs' }} color="#A8DEFF" fontWeight={700}>
                    Double Strike!
                  </Text>
                )}
                {attack.blocked && (
                  <Text size={{ base: '2xs', sm: '2xs', lg: 'xs' }} color="#8B8B8B" fontWeight={700}>
                    {isPlayerAttack ? t('combat.blockedSome', { name: opponentDisplayName }) : t('combat.youBlockedSome')}
                  </Text>
                )}
                {attack.spellDodged && (
                  <Text size={{ base: '2xs', sm: '2xs', lg: 'xs' }} color="#A8DEFF" fontWeight={700}>
                    {isPlayerAttack ? `${opponentDisplayName} dodged the spell!` : 'You dodged the spell!'}
                  </Text>
                )}
                {dotMessageElement}
              </Box>
            );
          });
          return elements;
          })()}
      </Stack>
      {inlineResults.length > 0 && autoAdventureMode && (
        <Stack py={3} spacing={2} px={{ base: 2, lg: 4 }}>
          {inlineResults.map((result, i) => (
            <HStack key={result.encounterId} opacity={i === 0 ? 1 : 0.6} spacing={3} flexWrap="wrap">
              <Text fontWeight={700} size="xs">
                {result.isDraw
                  ? `Draw — ${result.monsterName}`
                  : result.winner === character?.id
                    ? `Defeated ${result.monsterName}!`
                    : `Defeated by ${result.monsterName}.`}
              </Text>
              {result.winner === character?.id && (
                <>
                  {(result.expDropped > 0n || result.goldDropped > 0n) && (
                    <Text size="xs">
                      You earned{' '}
                      {result.expDropped > 0n && (
                        <Text as="span" color="green" fontFamily="mono">
                          {result.expDropped.toString()} XP
                        </Text>
                      )}
                      {result.expDropped > 0n && result.goldDropped > 0n && ', '}
                      {result.goldDropped > 0n && (
                        <Text as="span" color="gold" fontFamily="mono">
                          {etherToFixedNumber(result.goldDropped)} Gold
                        </Text>
                      )}
                    </Text>
                  )}
                  {result.expDropped === 0n && result.goldDropped === 0n && result.items.length === 0 && (
                    <Text size="xs" color="gray.500">
                      No rewards — above level range
                    </Text>
                  )}
                </>
              )}
              {result.winner !== character?.id && result.goldDropped > 0n && (
                <Text size="xs" color="red" fontFamily="mono">
                  -{etherToFixedNumber(result.goldDropped)} Gold
                </Text>
              )}
              {result.items.length > 0 && (
                <Text size="xs">
                  Picked up{' '}
                  {result.items.map((item, idx) => (
                    <Text
                      key={`inline-loot-${result.encounterId}-${item.tokenId}`}
                      as="span"
                      role="button"
                      color={RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] ?? '#C4B89E'}
                      fontWeight={600}
                      onClick={() => { setSelectedItem(item); onOpenItemModal(); }}
                      _hover={{ textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {item.name}{idx < result.items.length - 1 ? ', ' : ''}
                    </Text>
                  ))}
                </Text>
              )}
            </HStack>
          ))}
        </Stack>
      )}
      {selectedItem && (
        <ItemEquipModal
          isEquipped={[...equippedArmor, ...equippedSpells, ...equippedWeapons].some(
            i => i.name === selectedItem.name
          )}
          isOpen={isItemModalOpen}
          onClose={() => { refreshCharacter(); onCloseItemModal(); }}
          {...{ ...selectedItem, owner: character?.owner ?? '' }}
        />
      )}
    </Box>
  );
};
