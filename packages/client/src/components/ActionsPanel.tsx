import {
  Box,
  Button,
  HStack,
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
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { Consumable, EncounterType, Monster } from '../utils/types';

import {
  STATUS_EFFECT_NAME_MAPPING,
  STATUS_EFFECT_DESCRIPTION_MAPPING,
} from '../utils/constants';
import { ConsumableQuickUse } from './ConsumableQuickUse';
import { ItemConsumeModal } from './ItemConsumeModal';
import { PotionSvg } from './SVGs/PotionSvg';
import { TransactionProgressBar } from './TransactionProgressBar';

export const MONSTER_MOVE_MAPPING: Record<string, string> = {
  '1': 'Razor Claws',      // Rock Beetle
  '2': 'Razor Claws',      // Cave Rat
  '3': 'Dark Magic',       // Glowcap Sprite
  '4': 'Razor Claws',      // Tunnel Crawler
  '5': 'Razor Claws',      // Shadow Bat
  '6': 'Elemental Burst',  // Fungal Shaman
  '7': 'Stone Fist',       // Cavern Brute
  '8': 'Venomous Bite',    // Cave Spider
  '9': 'Dark Magic',       // Dark Wisp
  '10': 'Stone Fist',      // Stone Golem Shard
  '11': 'Venomous Bite',   // Giant Scorpion
  '12': 'Elemental Burst', // Crystal Elemental
  '13': 'Crushing Slam',   // Cave Troll
  '14': 'Razor Claws',     // Stalker
  '15': 'Dark Magic',      // Shadow Caster
  '16': 'Stone Fist',      // Iron Golem
  '17': 'Venomous Bite',   // Phase Spider
  '18': 'Dark Magic',      // Void Whisper
  '19': 'Crushing Slam',   // Cavern Ogre
  '20': 'Venomous Bite',   // Assassin Bug
  '21': 'Dark Magic',      // Lich Acolyte
  '22': 'Crushing Slam',   // Stone Giant
  '23': 'Shadow Strike',   // Tunnel Wraith
  '24': 'Dark Magic',      // Dark Sorcerer
  '25': 'Crushing Slam',   // Mountain Troll
  '26': 'Shadow Strike',   // Shadow Stalker
  '27': 'Dark Magic',      // Abyssal Channeler
  '28': 'Crushing Slam',   // Cavern Lord
  '29': 'Shadow Strike',   // Cave Wyvern
  '30': 'Elemental Burst', // Shadow Dragon
};

export const ActionsPanel = (): JSX.Element => {
  const { character, equippedConsumables, equippedSpells, equippedWeapons } =
    useCharacter();
  const { isSpawned, monstersOnTile, position } = useMap();
  const {
    attackOutcomes,
    attackingItemId,
    attackProgress,
    attackStatusMessage,
    currentBattle,
    isFleeing,
    lastestBattleOutcome,
    onAttack,
    onContinueToBattleOutcome,
    onFleePvp,
    opponent,
    statusEffectActions,
  } = useBattle();
  const { isRefreshing } = useMovement();
  const {
    isLoading: isItemTemplatesLoading,
    spellTemplates,
    weaponTemplates,
  } = useItems();

  const {
    isOpen: isConsumeModalOpen,
    onOpen: onOpenConsumeModal,
    onClose: onCloseConsumeModal,
  } = useDisclosure();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const [selectedConsumable, setSelectedConsumable] =
    useState<Consumable | null>(null);

  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(32);
  const [attackButtonFocus, setAttackButtonFocus] = useState<number>(0);

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
      attackButton1Ref.current.focus();
      setAttackButtonFocus(0);
    }
  }, [attackOutcomes]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          if (attackButtonFocus === 1 && attackButton2Ref.current) {
            attackButton1Ref.current?.focus();
            setAttackButtonFocus(0);
          }
          if (attackButtonFocus === 2 && attackButton3Ref.current) {
            attackButton2Ref.current?.focus();
            setAttackButtonFocus(1);
          }
          if (attackButtonFocus === 3 && attackButton4Ref.current) {
            attackButton3Ref.current?.focus();
            setAttackButtonFocus(2);
          }
          break;
        case 'ArrowRight':
          if (attackButtonFocus === 0 && attackButton1Ref.current) {
            attackButton2Ref.current?.focus();
            setAttackButtonFocus(1);
          }
          if (attackButtonFocus === 1 && attackButton2Ref.current) {
            attackButton3Ref.current?.focus();
            setAttackButtonFocus(2);
          }
          if (attackButtonFocus === 2 && attackButton3Ref.current) {
            attackButton4Ref.current?.focus();
            setAttackButtonFocus(3);
          }
          break;
        case '1':
          attackButton1Ref.current?.focus();
          setAttackButtonFocus(1);
          if (attackButton1Ref.current?.disabled) {
            break;
          }
          attackButton1Ref.current?.click();
          break;
        case '2':
          attackButton2Ref.current?.focus();
          setAttackButtonFocus(2);
          if (attackButton2Ref.current?.disabled) {
            break;
          }
          attackButton2Ref.current?.click();
          break;
        case '3':
          attackButton3Ref.current?.focus();
          setAttackButtonFocus(3);
          if (attackButton3Ref.current?.disabled) {
            break;
          }
          attackButton3Ref.current?.click();
          break;
        case '4':
          attackButton4Ref.current?.focus();
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

  const battleOver = useMemo(
    () => currentBattle?.encounterId === lastestBattleOutcome?.encounterId,
    [currentBattle, lastestBattleOutcome],
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
  }, [currentBattle, userTurn, turnTimeLeft]);

  const equippedSpellsAndWeapons = useMemo(
    () => [...equippedSpells, ...equippedWeapons],
    [equippedSpells, equippedWeapons],
  );

  const combatConsumables = useMemo(
    () => equippedConsumables.filter(c => c.hpRestoreAmount !== BigInt(0)),
    [equippedConsumables],
  );

  const onUsePotion = useCallback(
    (consumable: Consumable) => {
      setSelectedConsumable(consumable);
      onOpenConsumeModal();
    },
    [onOpenConsumeModal],
  );

  const spellAndWeaponTemplates = useMemo(
    () => [...spellTemplates, ...weaponTemplates],
    [spellTemplates, weaponTemplates],
  );

  const canFlee = useMemo(() => {
    if (!character) return false;
    if (!currentBattle) return false;

    if (currentBattle.encounterType === EncounterType.PvE) {
      return false;
    }

    const isAttacker = currentBattle.attackers.includes(character.id);

    if (isAttacker && currentBattle.currentTurn === BigInt('1')) {
      return true;
    }

    if (!isAttacker && currentBattle.currentTurn === BigInt('2')) {
      return true;
    }

    return false;
  }, [character, currentBattle]);

  const battleDraw = useMemo(() => {
    return currentBattle?.maxTurns === currentBattle?.currentTurn;
  }, [currentBattle]);

  if (isItemTemplatesLoading) {
    return (
      <VStack mt={12}>
        <Spinner size="lg" />
      </VStack>
    );
  }

  return (
    <Box fontWeight={500} maxH="100%" overflowY="auto" ref={parentDivRef}>
      {currentBattle && equippedSpellsAndWeapons.length === 0 && (
        <Text color="red" fontWeight={700} p={{ base: 2, lg: 4 }}>
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
      )}
      {!battleOver &&
        currentBattle &&
        equippedSpellsAndWeapons.length !== 0 &&
        opponent && (
          <VStack
            bgColor="#1C1814"
            position="sticky"
            spacing={0}
            top={0}
            w="100%"
          >
            <Box position="relative" w="100%">
              <TransactionProgressBar progress={attackProgress} />
            </Box>
            {currentBattle.encounterType === EncounterType.PvE && (
              <Text
                fontWeight="bold"
                p={{ base: 2, lg: 4 }}
                size="xs"
                textAlign="center"
              >
                Choose your move!
              </Text>
            )}

            {currentBattle.encounterType === EncounterType.PvP && (
              <>
                {userTurn && (
                  <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
                    <Text as="span" fontWeight="bold">
                      Choose your move!
                    </Text>{' '}
                    You have {turnTimeLeft} seconds before your opponent can
                    attack.
                  </Text>
                )}
                {!userTurn && !canAttack && (
                  <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
                    It is your opponent&apos;s turn. But you can attack in{' '}
                    {turnTimeLeft} seconds.
                  </Text>
                )}
                {!userTurn && canAttack && (
                  <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
                    Your opponent took too long to make a move.{' '}
                    <Text as="span" fontWeight={700}>
                      You can now attack!
                    </Text>
                  </Text>
                )}
              </>
            )}
            <HStack position="relative" spacing={0} w="100%">
              {currentBattle.encounterType === EncounterType.PvP && (
                <Progress
                  position="absolute"
                  size="xs"
                  top={-1}
                  value={(turnTimeLeft / 32) * 100}
                  variant="timer"
                  w="100%"
                />
              )}
              <Stack
                direction={
                  equippedSpellsAndWeapons.length > 2 ? 'column' : 'row'
                }
                spacing={0}
                w="100%"
              >
                <HStack spacing={0} w="100%">
                  {equippedSpellsAndWeapons.slice(0, 2).map((item, index) => (
                    <Button
                      borderLeft={index === 0 ? 'none' : '2px'}
                      borderRadius={0}
                      borderRight="none"
                      isDisabled={
                        attackingItemId !== null || !canAttack || isFleeing
                      }
                      isLoading={attackingItemId === item.tokenId}
                      key={`equipped-item-${index}`}
                      loadingText={attackStatusMessage}
                      onClick={() => onAttack(item.tokenId)}
                      ref={getButtonRef(index)}
                      fontSize={
                        equippedSpellsAndWeapons.length > 3 ? 'xs' : 'md'
                      }
                      size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                      variant="outline"
                      w="100%"
                    >
                      <>
                        {isDesktop && (
                          <Text as="span" fontSize="2xs" fontFamily="mono" opacity={0.6} mr={1}>
                            [{index + 1}]
                          </Text>
                        )}
                        {item.name}
                      </>
                    </Button>
                  ))}
                </HStack>
                {equippedSpellsAndWeapons.length > 2 && (
                  <HStack spacing={0} w="100%">
                    {equippedSpellsAndWeapons.slice(2).map((item, index) => (
                      <Button
                        borderLeft={index === 0 ? 'none' : '2px'}
                        borderRadius={0}
                        borderRight="none"
                        borderTop={
                          equippedSpellsAndWeapons.length > 2 ? 'none' : '2px'
                        }
                        isDisabled={
                          attackingItemId !== null || !canAttack || isFleeing
                        }
                        isLoading={attackingItemId === item.tokenId}
                        key={`equipped-item-${index + 2}`}
                        loadingText={attackStatusMessage}
                        onClick={() => onAttack(item.tokenId)}
                        ref={getButtonRef(index + 2)}
                        size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                        fontSize={
                          equippedSpellsAndWeapons.length > 3 ? 'xs' : 'md'
                        }
                        variant="outline"
                        w="100%"
                      >
                        <>
                          {isDesktop && (
                            <Text as="span" fontSize="2xs" fontFamily="mono" opacity={0.6} mr={1}>
                              [{index + 3}]
                            </Text>
                          )}
                          {item.name}
                        </>
                      </Button>
                    ))}
                  </HStack>
                )}
              </Stack>
            </HStack>
            {isDesktop && equippedSpellsAndWeapons.length > 0 && (
              <Text fontSize="2xs" color="grey400" textAlign="center" mt={1}>
                Use 1-{Math.min(equippedSpellsAndWeapons.length, 4)} keys to attack
              </Text>
            )}
            {combatConsumables.length > 0 && (
              <HStack spacing={0} w="100%">
                {combatConsumables.map((consumable, index) => (
                  <Button
                    borderLeft={index === 0 ? 'none' : '2px'}
                    borderRadius={0}
                    borderRight="none"
                    borderTop="none"
                    isDisabled={
                      attackingItemId !== null || !canAttack || isFleeing
                    }
                    key={`consumable-${index}`}
                    onClick={() => onUsePotion(consumable)}
                    size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                    variant="outline"
                    w="100%"
                  >
                    <PotionSvg size={3} theme="dark" mr={1} />
                    {consumable.name} (x{consumable.balance.toString()})
                  </Button>
                ))}
              </HStack>
            )}
            {canFlee && (
              <VStack>
                <Button
                  alignSelf="center"
                  isLoading={isFleeing}
                  mt={4}
                  size="sm"
                  onClick={onFleePvp}
                  variant="outline"
                >
                  Flee
                </Button>
                <Text size="xs" textAlign="center">
                  You can only flee on your first turn.
                </Text>
                <Text size="xs" textAlign="center">
                  By fleeing, you will lose 25% of the Gold in your Adventure
                  Escrow.
                </Text>
              </VStack>
            )}
          </VStack>
        )}
      <Stack p={{ base: 2, lg: 4 }}>
        {!currentBattle && !(isSpawned && position) && (
          <Typist
            avgTypingDelay={10}
            cursor={{ show: false }}
            stdTypingDelay={10}
          >
            <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
              In order to begin battling, you must{' '}
              <Text as="span" fontWeight={700}>
                spawn
              </Text>{' '}
              your character.
            </Text>
          </Typist>
        )}
        {!currentBattle && isSpawned && position && (
          <VStack spacing={3} w="100%">
            {isDesktop && <ConsumableQuickUse />}
            <Text color="#8A7E6A" fontStyle="italic" size="xs">
              {position.x === 0 && position.y === 0
                ? 'Move to a new tile to find monsters.'
                : monstersOnTile.length === 0
                  ? 'No monsters here. Try another tile.'
                  : 'Click on a monster to battle.'}
            </Text>
          </VStack>
        )}

        {opponent &&
          [...attackOutcomes].reverse().map((attack, reverseIndex) => {
            const i = attackOutcomes.length - 1 - reverseIndex;
            const attackItem = spellAndWeaponTemplates.find(
              item => item.tokenId === attack.itemId,
            );
            const itemName =
              currentBattle?.encounterType === EncounterType.PvE &&
              attack.attackerId !== character?.id
                ? MONSTER_MOVE_MAPPING[(opponent as Monster).mobId] ?? 'an item'
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
            const hasOnlyStatusEffects =
              attack.attackerDamageDelt === 0n &&
              attack.effectIds.length > 0 &&
              !possibleStatusEffectAttack;

            if (attack.miss[0]) {
              return (
                <Typist
                  avgTypingDelay={10}
                  cursor={{ show: false }}
                  key={`battle-attack-${i}`}
                  stdTypingDelay={10}
                >
                  {isPlayerAttack ? (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      You missed{' '}
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>{' '}
                      with {itemName}.
                    </Text>
                  ) : (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>{' '}
                      missed you with {itemName}.
                    </Text>
                  )}
                </Typist>
              );
            }

            const critText = attack.crit[0] ? 'Critical hit! ' : '';

            return (
              <Typist
                avgTypingDelay={10}
                cursor={{ show: false }}
                key={`battle-attack-${i}`}
                stdTypingDelay={10}
              >
                {/* Status effect applied — passive style */}
                {isPlayerAttack && !!possibleStatusEffectAttack && (() => {
                  const isSelfBuff = possibleStatusEffectAttack.victimId === character?.id;
                  const effectColor = isSelfBuff ? 'cyan.300' : 'orange.300';
                  const affectedText = isSelfBuff
                    ? `You are affected by ${possibleStatusEffectAttack.name}.`
                    : `${opponent.name} is affected by ${possibleStatusEffectAttack.name}.`;
                  return (
                    <>
                      <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                        {critText}You cast {itemName}
                        {!isSelfBuff && (
                          <>
                            {' '}on{' '}
                            <Text as="span" color="green">
                              {opponent.name}
                            </Text>
                          </>
                        )}
                        .{' '}
                        <Text as="span" color={effectColor}>
                          {affectedText}
                        </Text>
                      </Text>
                      {STATUS_EFFECT_DESCRIPTION_MAPPING[
                        possibleStatusEffectAttack.name
                      ] && (
                        <Text
                          size={{ base: '2xs', sm: 'xs', lg: 'sm' }}
                          color={effectColor}
                        >
                          {STATUS_EFFECT_DESCRIPTION_MAPPING[
                            possibleStatusEffectAttack.name
                          ]}
                        </Text>
                      )}
                    </>
                  );
                })()}
                {!isPlayerAttack && !!possibleStatusEffectAttack && (() => {
                  const isSelfBuff = possibleStatusEffectAttack.victimId === opponent?.id;
                  const effectColor = isSelfBuff ? 'orange.300' : 'cyan.300';
                  const affectedText = isSelfBuff
                    ? `${opponent.name} is affected by ${possibleStatusEffectAttack.name}.`
                    : `You are affected by ${possibleStatusEffectAttack.name}.`;
                  return (
                    <>
                      <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                        {critText}
                        <Text as="span" color="green">
                          {opponent.name}
                        </Text>{' '}
                        cast {itemName}.{' '}
                        <Text as="span" color={effectColor}>
                          {affectedText}
                        </Text>
                      </Text>
                      {STATUS_EFFECT_DESCRIPTION_MAPPING[
                        possibleStatusEffectAttack.name
                      ] && (
                        <Text
                          size={{ base: '2xs', sm: 'xs', lg: 'sm' }}
                          color={effectColor}
                        >
                          {STATUS_EFFECT_DESCRIPTION_MAPPING[
                            possibleStatusEffectAttack.name
                          ]}
                        </Text>
                      )}
                    </>
                  );
                })()}

                {/* Normal damage attack */}
                {isPlayerAttack &&
                  !possibleStatusEffectAttack &&
                  !alreadyAffected &&
                  !hasOnlyStatusEffects && (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      {critText}You attacked{' '}
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>{' '}
                      with {itemName} for{' '}
                      <Text as="span" color="red" fontFamily="mono">
                        {attack.attackerDamageDelt.toString()}
                      </Text>{' '}
                      damage.
                    </Text>
                  )}
                {!isPlayerAttack &&
                  !possibleStatusEffectAttack &&
                  !alreadyAffected &&
                  !hasOnlyStatusEffects && (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      {critText}
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>{' '}
                      attacked you with {itemName} for{' '}
                      <Text as="span" color="red" fontFamily="mono">
                        {attack.attackerDamageDelt.toString()}
                      </Text>{' '}
                      damage.
                    </Text>
                  )}

                {/* 0-damage spell cast (no new status effect applied, but has effects) */}
                {isPlayerAttack && hasOnlyStatusEffects && !alreadyAffected && (
                  <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                    You cast {itemName} on{' '}
                    <Text as="span" color="green">
                      {opponent.name}
                    </Text>
                    .
                    {effectNames[0] &&
                      STATUS_EFFECT_DESCRIPTION_MAPPING[effectNames[0]] && (
                        <Text
                          as="span"
                          color="orange.300"
                        >
                          {' '}
                          {effectNames[0]}.{' '}
                          {STATUS_EFFECT_DESCRIPTION_MAPPING[effectNames[0]]}
                        </Text>
                      )}
                  </Text>
                )}

                {/* Already affected — spell had no new effect */}
                {isPlayerAttack &&
                  alreadyAffected &&
                  !possibleStatusEffectAttack && (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      You cast {itemName} on{' '}
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>
                      .{' '}
                      {effectNames[0]
                        ? `${effectNames[0]} is already active.`
                        : 'It had no effect.'}
                    </Text>
                  )}
              </Typist>
            );
          })}
      </Stack>
      {battleOver && currentBattle && (
        <Stack py={4} spacing={4}>
          <Box
            backgroundColor="rgba(196,184,158,0.08)"
            boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
            h="1px"
            w="100%"
          />
          <HStack justifyContent="space-between" px={{ base: 2, lg: 4 }}>
            <Typist
              avgTypingDelay={10}
              cursor={{ show: false }}
              stdTypingDelay={10}
            >
              {battleDraw ? (
                <Text
                  fontWeight="bold"
                  size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                  textAlign="center"
                >
                  The battle ended in a draw.
                </Text>
              ) : (
                <Text
                  fontWeight="bold"
                  size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                  textAlign="center"
                >
                  {lastestBattleOutcome?.winner === character?.id &&
                  lastestBattleOutcome?.playerFled
                    ? `${opponent?.name} fled!`
                    : ''}
                  {lastestBattleOutcome?.winner !== character?.id &&
                  lastestBattleOutcome?.playerFled
                    ? 'You fled!'
                    : ''}
                  {lastestBattleOutcome?.winner === character?.id &&
                  !lastestBattleOutcome?.playerFled
                    ? 'You won!'
                    : ''}
                  {lastestBattleOutcome?.winner !== character?.id &&
                  !lastestBattleOutcome?.playerFled
                    ? 'You died...'
                    : ''}
                </Text>
              )}
            </Typist>
            <HStack justifyContent="center">
              <Button
                onClick={() => onContinueToBattleOutcome(true)}
                size="sm"
                variant="white"
              >
                View Results
              </Button>
            </HStack>
          </HStack>
        </Stack>
      )}
      {selectedConsumable && (
        <ItemConsumeModal
          {...selectedConsumable}
          isEquipped
          isOpen={isConsumeModalOpen}
          onClose={onCloseConsumeModal}
        />
      )}
    </Box>
  );
};
