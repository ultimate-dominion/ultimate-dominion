import {
  Avatar,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
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
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import {
  CURRENT_BATTLE_OPPONENT_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
import { etherToFixedNumber, getEmoji, removeEmoji } from '../utils/helpers';
import { getMonsterImage } from '../utils/monsterImages';
import {
  ADVANCED_CLASS_COLORS,
  ADVANCED_CLASS_NAMES,
  AdvancedClass,
  type Character,
  EncounterType,
  type Monster,
  StatsClasses,
  type WeaponTemplate,
} from '../utils/types';

import { getRomanNumeral } from '../utils/fragmentNarratives';

import { AdventureEscrowModal } from './AdventureEscrowModal';
import { ClassSymbol } from './ClassSymbol';
import { FragmentClaimModal } from './FragmentClaimModal';
import { HealthBar } from './HealthBar';
import { InfoModal } from './InfoModal';
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

const REST_FLAVOR = [
  'The fire crackles softly as warmth seeps into your bones. Your wounds begin to close.',
  'You sit by the flames and let the heat chase away the cold. Strength returns.',
  'Embers dance in the dark. The world feels far away. You breathe deep, and heal.',
  'The fire hisses and pops. For a moment, the dangers beyond feel like a distant memory.',
  'Sparks drift upward like tiny stars. When you rise, the pain is gone.',
];

export const TileDetailsPanel = (): JSX.Element => {
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    isOpen: isSafetyZoneInfoModalOpen,
    onClose: onCloseSafetyZoneInfoModal,
    onOpen: onOpenSafetyZoneInfoModal,
  } = useDisclosure();
  const {
    isOpen: isAdventureEscrowModalOpen,
    onClose: onCloseAdventureEscrowModal,
    onOpen: onOpenAdventureEscrowModal,
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
    otherCharactersOnTile,
    position,
    shopsOnTile,
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
      renderSuccess(REST_FLAVOR[Math.floor(Math.random() * REST_FLAVOR.length)]);
    }
  }, [character, rest, restTx, renderSuccess]);

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
  }, [attackOutcomes, currentBattle, opponent]);

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

      // Auto adventure + PvE: single-tx fight, no battle screen
      if (autoAdventureMode && encounterType === EncounterType.PvE) {
        // Auto-select weapon based on combat triangle (STR > AGI > INT > STR)
        const monster = opponent as Monster;
        const allWeapons = [...equippedWeapons, ...equippedSpells] as WeaponTemplate[];
        const bestWeapon = pickWeaponForMonster(monster.entityClass, allWeapons)
          ?? allWeapons[0];

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
        }
        return;
      }

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
    actualHp: userCharacterForBattleRendering?.currentHp ?? 0n,
    dotDamage: latestUserDot?.totalDamage ?? 0n,
    dotTurnNumber: latestUserDot?.turnNumber ?? 0n,
    isInBattle: !!currentBattle,
  });

  const battleOver = currentBattle?.encounterId === lastestBattleOutcome?.encounterId;

  // When the battle is over, the loser's HP should show 0. The cached opponent
  // ref may hold a stale HP from the last render before the mob despawned.
  const opponentWon = battleOver && lastestBattleOutcome?.winner !== character?.id && !lastestBattleOutcome?.playerFled;
  const playerWon = battleOver && lastestBattleOutcome?.winner === character?.id && !lastestBattleOutcome?.playerFled;

  const {
    displayedHp: opponentDisplayedHp,
    isDotTicking: isOpponentDotTicking,
  } = useBattleHpAnimation({
    actualHp: playerWon ? 0n : (opponent?.currentHp ?? 0n),
    dotDamage: latestOpponentDot?.totalDamage ?? 0n,
    dotTurnNumber: latestOpponentDot?.turnNumber ?? 0n,
    isInBattle: !!currentBattle,
  });

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
            Tile Details
          </Heading>
        </HStack>
        {isRefreshingCharacter ? (
          <Flex alignItems="center" h="100%" justifyContent="center" mt={6}>
            <Spinner size="lg" />
          </Flex>
        ) : (
          <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }} p={6}>
            An error occurred.
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
            Tile Details
          </Heading>
        </HStack>
        <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }} p={6}>
          You have not yet spawned to the map.
        </Text>
      </Box>
    );
  }

  if (currentBattle && opponent && userCharacterForBattleRendering && !autoAdventureMode) {
    return (
      <Box h="100%" position="relative">
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
            Battlefield
          </Heading>
        </HStack>
        <Box
          bgColor="blue500"
          h="100%"
          position="absolute"
          top={0}
          transform="translateX(50%)"
          right="50%"
          w="6px"
        />
        <Box
          h={{ base: 'calc(100% - 40px)', md: 'calc(100% - 66px)' }}
          overflowY="auto"
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

                <Box mt={4} w="100%">
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text isTruncated size={{ base: '2xs', lg: 'sm' }} color="#5A8A3E">AGI</Text>
                    {(() => {
                      const base = userCharacterForBattleRendering.agility - expiredUserEffectModifications.agiModifier;
                      const mod = activeUserBattleEffectModifications.agiModifier;
                      const effective = base + mod;
                      const color = mod > 0n ? 'cyan.300' : mod < 0n ? 'orange.300' : undefined;
                      return (
                        <Text fontFamily="mono" size={{ base: '2xs', lg: 'sm' }} color={color}>
                          {effective.toString()}{mod > 0n && ` (+${mod.toString()})`}{mod < 0n && ` (${mod.toString()})`}
                        </Text>
                      );
                    })()}
                  </HStack>
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text isTruncated size={{ base: '2xs', lg: 'sm' }} color="#4A7AB5">INT</Text>
                    {(() => {
                      const base = userCharacterForBattleRendering.intelligence - expiredUserEffectModifications.intModifier;
                      const mod = activeUserBattleEffectModifications.intModifier;
                      const effective = base + mod;
                      const color = mod > 0n ? 'cyan.300' : mod < 0n ? 'orange.300' : undefined;
                      return (
                        <Text fontFamily="mono" size={{ base: '2xs', lg: 'sm' }} color={color}>
                          {effective.toString()}{mod > 0n && ` (+${mod.toString()})`}{mod < 0n && ` (${mod.toString()})`}
                        </Text>
                      );
                    })()}
                  </HStack>
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text isTruncated size={{ base: '2xs', lg: 'sm' }} color="#B85C3A">STR</Text>
                    {(() => {
                      const base = userCharacterForBattleRendering.strength - expiredUserEffectModifications.strModifier;
                      const mod = activeUserBattleEffectModifications.strModifier;
                      const effective = base + mod;
                      const color = mod > 0n ? 'cyan.300' : mod < 0n ? 'orange.300' : undefined;
                      return (
                        <Text fontFamily="mono" size={{ base: '2xs', lg: 'sm' }} color={color}>
                          {effective.toString()}{mod > 0n && ` (+${mod.toString()})`}{mod < 0n && ` (${mod.toString()})`}
                        </Text>
                      );
                    })()}
                  </HStack>
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
                </Box>
              </VStack>
            </VStack>

            <VStack w="50%">
              {currentBattle.encounterType === EncounterType.PvE ? (
                <VStack mt={{ base: 2, lg: 6 }} spacing={0}>
                  {isDesktop && (
                    <Avatar
                      animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                      bgColor="grey300"
                      boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                      filter={opponentDefeated ? 'grayscale(100%)' : undefined}
                      mb={{ base: 1, lg: 2 }}
                      opacity={opponentDefeated ? 0.4 : isMonsterHit ? 0 : 1}
                      size={{ base: '2xs', lg: 'md' }}
                      src={getMonsterImage(opponent.name)}
                      name={opponent.name}
                    >
                      {!getMonsterImage(opponent.name) && (
                        <Text
                          animation={
                            isMonsterHit ? 'flicker .7s infinite' : 'none'
                          }
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
                      {opponentDefeated ? `${opponent.name} defeated` : opponent.name}
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
                      {opponentDefeated ? `${opponent.name} defeated` : opponent.name}
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

                <Box mt={4} w="100%">
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text isTruncated size={{ base: '2xs', lg: 'sm' }} color="#5A8A3E">AGI</Text>
                    {!!opponent.agility && (() => {
                      const base = opponent.agility - expiredOpponentEffectModifications.agiModifier;
                      const mod = activeBattleEffectModifications.agiModifier;
                      const effective = base + mod;
                      const color = mod < 0n ? 'orange.300' : mod > 0n ? 'cyan.300' : undefined;
                      return (
                        <Text fontFamily="mono" size={{ base: '2xs', lg: 'sm' }} color={color}>
                          {effective.toString()}{mod !== 0n && ` (${mod > 0n ? '+' : ''}${mod.toString()})`}
                        </Text>
                      );
                    })()}
                  </HStack>
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text isTruncated size={{ base: '2xs', lg: 'sm' }} color="#4A7AB5">INT</Text>
                    {!!opponent.intelligence && (() => {
                      const base = opponent.intelligence - expiredOpponentEffectModifications.intModifier;
                      const mod = activeBattleEffectModifications.intModifier;
                      const effective = base + mod;
                      const color = mod < 0n ? 'orange.300' : mod > 0n ? 'cyan.300' : undefined;
                      return (
                        <Text fontFamily="mono" size={{ base: '2xs', lg: 'sm' }} color={color}>
                          {effective.toString()}{mod !== 0n && ` (${mod > 0n ? '+' : ''}${mod.toString()})`}
                        </Text>
                      );
                    })()}
                  </HStack>
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text isTruncated size={{ base: '2xs', lg: 'sm' }} color="#B85C3A">STR</Text>
                    {!!opponent.strength && (() => {
                      const base = opponent.strength - expiredOpponentEffectModifications.strModifier;
                      const mod = activeBattleEffectModifications.strModifier;
                      const effective = base + mod;
                      const color = mod < 0n ? 'orange.300' : mod > 0n ? 'cyan.300' : undefined;
                      return (
                        <Text fontFamily="mono" size={{ base: '2xs', lg: 'sm' }} color={color}>
                          {effective.toString()}{mod !== 0n && ` (${mod > 0n ? '+' : ''}${mod.toString()})`}
                        </Text>
                      );
                    })()}
                  </HStack>
                  <Box
                    backgroundColor="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="6px"
                    w="100%"
                  />
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
            {pendingOpponent ? `Fighting ${pendingOpponent.name}` : 'Initiating battle'}
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
              <Heading size="sm">Shops</Heading>
            </GridItem>
          )}
          {!isHomeTile && (
            <GridItem colSpan={2}>
              <Heading size="sm">
                Monsters
              </Heading>
            </GridItem>
          )}
          <GridItem colSpan={2}>
            <Heading size="sm">
              {shopsOnTile.length > 0 && !isHomeTile && 'Shops & '}Players
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
              <HStack>
                <Text
                  fontFamily="mono"
                  fontSize={{ base: '3xs', sm: 'xs' }}
                  fontWeight={700}
                  textAlign="start"
                >
                  Adventure Escrow balance:{' '}
                  {etherToFixedNumber(character.escrowGoldBalance)} Gold
                </Text>
                <Tooltip
                  bg="#14120F"
                  hasArrow
                  label="Your Adventure Escrow is where Gold goes when you win battles. Leaving Gold in your escrow will help you level up faster, but in the Outer Realms, you run the risk of losing it all against other players. You can withdraw your Gold at 0,0 on the map."
                  placement="top"
                  shouldWrapChildren
                >
                  <IoMdInformationCircleOutline />
                </Tooltip>
              </HStack>
              {isHomeTile && (
                <Button
                  borderRadius="0px"
                  onClick={onOpenAdventureEscrowModal}
                  size="xs"
                  variant="outline"
                >
                  Move Gold
                </Button>
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
                          A fire crackles nearby. You could rest here.
                        </Text>
                        <Button
                          alignSelf="center"
                          isDisabled={restTx.isLoading}
                          isLoading={restTx.isLoading}
                          loadingText="Resting by the fire..."
                          onClick={onRest}
                          size="xs"
                          variant="outline"
                          color="orange.200"
                          borderColor="orange.400"
                          _hover={{ bg: 'orange.900', borderColor: 'orange.300' }}
                        >
                          Rest by the Fire
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
                        A fire crackles softly. You are fully rested.
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
            {monstersOnTile.length > 0 &&
              monstersOnTile.map((monster, i) => (
                <Box key={`tile-monster-${i}-${monster.name}`}>
                  <OpponentRow
                    encounterType={EncounterType.PvE}
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
            {monstersOnTile.length === 0 && (
              <Text p={2} size={{ base: '2xs', lg: 'sm' }}>
                No monsters in this area
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
          <HStack h={ROW_HEIGHT} justifyContent="end" px={4}>
            <Text size={{ base: '3xs', sm: '2xs', md: 'xs' }} textAlign="right">
              {inSafetyZone ? 'Safety Zone' : 'Outer Realms'}
            </Text>
          </HStack>
          <Box
            backgroundColor="rgba(196,184,158,0.08)"
            boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
            h="6px"
            w="100%"
          />
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
              No players in this area
            </Text>
          )}
        </GridItem>
      </Grid>

      <AdventureEscrowModal
        isOpen={isAdventureEscrowModalOpen}
        onClose={onCloseAdventureEscrowModal}
      />

      <InfoModal
        heading="No moves equipped!"
        isOpen={isNoMoveEquippedModalOpen}
        onClose={onCloseNoMoveEquippedModal}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Text>
            In order to initiate a battle, you must have at least 1 weapon or
            spell equipped. Go to your{' '}
            <Text
              as={Link}
              color="blue"
              to={`/characters/${character?.id}`}
              _hover={{
                textDecoration: 'underline',
              }}
            >
              character page
            </Text>{' '}
            to equip a move.
          </Text>
        </VStack>
      </InfoModal>

      <InfoModal
        heading="Cannot Battle in the Safety Zone"
        isOpen={isSafetyZoneInfoModalOpen}
        onClose={onCloseSafetyZoneInfoModal}
      >
        <VStack p={4} spacing={4}>
          <IoIosWarning color="orange" size={40} />
          <Text mt={4}>
            You are currently in the{' '}
            <Text as="span" fontWeight={700}>
              Safety Zone
            </Text>
            .
          </Text>
          <Text textAlign="center">
            In order to battle other players, you must enter the{' '}
            <Text as="span" fontWeight={700}>
              Outer Realms
            </Text>
            .
          </Text>
        </VStack>
      </InfoModal>

      {fragmentForModal && (
        <FragmentClaimModal
          fragment={fragmentForModal}
          isOpen={isFragmentClaimModalOpen}
          onClose={handleCloseFragmentClaim}
        />
      )}
    </Box>
  );
};

/**
 * Get the dominant stat (highest of STR/AGI/INT) — mirrors the on-chain
 * _getDominantStat logic in CombatSystem.sol.
 *
 * Returns: [dominantIndex (0=STR, 1=AGI, 2=INT), dominantValue]
 */
const getDominantStat = (
  stats: { strength: bigint; agility: bigint; intelligence: bigint },
): [number, bigint] => {
  if (stats.strength >= stats.agility && stats.strength >= stats.intelligence) {
    return [0, stats.strength];
  }
  if (stats.agility > stats.strength && stats.agility >= stats.intelligence) {
    return [1, stats.agility];
  }
  return [2, stats.intelligence];
};

/**
 * Determine combat advantage color by comparing dominant stats and the
 * combat triangle, mirroring the on-chain CombatSystem logic.
 *
 * Triangle: STR(0) > AGI(1) > INT(2) > STR(0)
 *
 * Returns: 'green' (advantage), 'yellow' (even), 'red' (disadvantage)
 */
const getAdvantageColor = (
  player: { strength: bigint; agility: bigint; intelligence: bigint },
  opponent: { strength: bigint; agility: bigint; intelligence: bigint },
): string => {
  // Guard against undefined stats (e.g. monster template not yet loaded)
  if (
    opponent.strength == null ||
    opponent.agility == null ||
    opponent.intelligence == null
  ) {
    return 'yellow';
  }

  const [playerDom, playerVal] = getDominantStat(player);
  const [opponentDom, opponentVal] = getDominantStat(opponent);

  // Triangle: 0 beats 1, 1 beats 2, 2 beats 0
  const playerBeatsOpponent =
    (playerDom === 0 && opponentDom === 1) ||
    (playerDom === 1 && opponentDom === 2) ||
    (playerDom === 2 && opponentDom === 0);

  const opponentBeatsPlayer =
    (opponentDom === 0 && playerDom === 1) ||
    (opponentDom === 1 && playerDom === 2) ||
    (opponentDom === 2 && playerDom === 0);

  const statDiff = Number(playerVal) - Number(opponentVal);

  if (playerBeatsOpponent) {
    // You have triangle advantage — green unless heavily outstatted
    return statDiff >= -3 ? 'green' : 'yellow';
  }

  if (opponentBeatsPlayer) {
    // They have triangle advantage — red unless you heavily outstat them
    return statDiff <= 3 ? 'red' : 'yellow';
  }

  // Same dominant stat — pure stat comparison
  if (statDiff >= 3) return 'green';
  if (statDiff <= -3) return 'red';
  return 'yellow';
};

const OpponentRow = ({
  encounterType,
  opponent,
  playerStats,
  onClick,
}: {
  encounterType: EncounterType;
  opponent: Character | Monster;
  playerStats: { strength: bigint; agility: bigint; intelligence: bigint };
  onClick: () => void;
}) => {
  const { inBattle, level, name } = opponent;
  const isElite = encounterType === EncounterType.PvE && (opponent as Monster).isElite;
  const navigate = useNavigate();

  const inCooldown = useMemo(() => {
    const cooldownTimer = (opponent as Character).pvpCooldownTimer;
    if (!cooldownTimer) return false;
    return Number(cooldownTimer) + 30 > Date.now() / 1000;
  }, [opponent]);

  const disableRow = inBattle || inCooldown;

  const nameColor = getAdvantageColor(playerStats, {
    strength: opponent.strength,
    agility: opponent.agility,
    intelligence: opponent.intelligence,
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
            color={nameColor}
            filter={disableRow ? 'grayscale(100%)' : 'none'}
            size={{ base: '2xs', sm: '2xs', md: 'sm', lg: 'md' }}
          >
            {isElite ? '★ ' : ''}{name}
          </Text>
        </HStack>
        {!disableRow && !!level && (
          <HStack spacing={1}>
            <Text fontWeight={500} size={{ base: '2xs', sm: '2xs', md: 'sm' }}>
              Level {level.toString()}
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
                  {ADVANCED_CLASS_NAMES[(opponent as Character).advancedClass]}
                </Text>
              )}
          </HStack>
        )}
        {!(opponent as Character).worldEncounter && inBattle && (
          <Text color="red" fontWeight={700} size={{ base: '3xs', sm: '2xs' }}>
            (In battle...)
          </Text>
        )}
        {(opponent as Character).worldEncounter && (
          <Text color="red" fontWeight={700} size={{ base: '3xs', sm: '2xs' }}>
            (In shop...)
          </Text>
        )}
        {inCooldown && (
          <Text color="red" fontWeight={700} size={{ base: '3xs', sm: '2xs' }}>
            (In cooldown...)
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
              View character
            </MenuItem>
          </MenuList>
        </Menu>
      )}
    </HStack>
  );
};

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
      borderBottom="2px solid transparent"
      h={ROW_HEIGHT}
      spacing={0}
      bg="linear-gradient(90deg, rgba(120, 200, 255, 0.15) 0%, rgba(120, 200, 255, 0.05) 100%)"
      _active={{
        borderBottom: '2px solid rgba(120, 200, 255, 0.8)',
      }}
      _hover={{
        borderBottom: '2px solid rgba(120, 200, 255, 0.8)',
        bg: 'linear-gradient(90deg, rgba(120, 200, 255, 0.25) 0%, rgba(120, 200, 255, 0.1) 100%)',
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
