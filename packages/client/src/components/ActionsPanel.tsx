import {
  Box,
  Button,
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
import SafeTypist from './SafeTypist';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { Consumable, EncounterType, Monster } from '../utils/types';
import { Switch } from '@chakra-ui/react';

import {
  STATUS_EFFECT_NAME_MAPPING,
  STATUS_EFFECT_DESCRIPTION_MAPPING,
} from '../utils/constants';
import { getItemImage } from '../utils/itemImages';
import { removeEmoji } from '../utils/helpers';
import { ConsumableQuickUse } from './ConsumableQuickUse';
import { ItemConsumeModal } from './ItemConsumeModal';
import { PotionSvg } from './SVGs/PotionSvg';

export const MONSTER_MOVE_MAPPING: Record<string, string> = {
  '1': 'Razor Claws',      // Dire Rat
  '2': 'Elemental Burst',  // Fungal Shaman
  '3': 'Stone Fist',       // Cavern Brute
  '4': 'Elemental Burst',  // Crystal Elemental
  '5': 'Crushing Slam',    // Ironhide Troll
  '6': 'Venomous Bite',    // Phase Spider
  '7': 'Dark Magic',       // Bonecaster
  '8': 'Crushing Slam',    // Rock Golem
  '9': 'Shadow Strike',    // Pale Stalker
  '10': 'Elemental Burst', // Dusk Drake
  '11': 'Basilisk Fangs',  // Basilisk (boss)
};

export const ActionsPanel = (): JSX.Element => {
  const { character, equippedConsumables, equippedSpells, equippedWeapons } =
    useCharacter();
  const { isSpawned, monstersOnTile, position } = useMap();
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
  const { grindMode, isRefreshing, onToggleGrindMode } = useMovement();
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

    const isAttacker = currentBattle.attackers.includes(character.id);

    if (isAttacker && currentBattle.currentTurn === BigInt('1')) {
      return true;
    }

    if (!isAttacker && currentBattle.currentTurn === BigInt('2')) {
      return true;
    }

    return false;
  }, [character, currentBattle]);

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
                  ? 'Smoke Cloak active — flee without gold penalty!'
                  : currentBattle.encounterType === EncounterType.PvP
                    ? 'First turn only. Costs 25% escrow gold.'
                    : 'First turn only.'}
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
            bgColor="#1C1814"
            position="sticky"
            spacing={0}
            top={0}
            w="100%"
          >
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
              <HStack spacing={0} w="100%" flexWrap={{ base: 'wrap', lg: 'nowrap' }}>
                {equippedSpellsAndWeapons.map((item, index) => {
                  const icon = getItemImage(removeEmoji(item.name));
                  return (
                    <Button
                      borderLeft={{
                        base: index % 2 === 0 ? 'none' : '2px',
                        lg: index === 0 ? 'none' : '2px',
                      }}
                      borderTop={{
                        base: index >= 2 ? '2px' : 'none',
                        lg: 'none',
                      }}
                      borderRadius={0}
                      borderRight="none"
                      isDisabled={
                        attackingItemId !== null || !canAttack || isFleeing
                      }
                      isLoading={attackingItemId === item.tokenId}
                      key={`equipped-item-${index}`}
                      loadingText=""
                      onClick={() => onAttack(item.tokenId)}
                      ref={getButtonRef(index)}
                      fontSize={
                        equippedSpellsAndWeapons.length > 2 ? '2xs' : 'xs'
                      }
                      size={{ base: 'sm', sm: 'sm', lg: 'md' }}
                      py={{ base: 5, sm: 4, lg: 'unset' }}
                      variant="outline"
                      w={{ base: '50%', lg: '100%' }}
                    >
                      <>
                        {isDesktop && (
                          <Text as="span" fontSize="2xs" fontFamily="mono" opacity={0.6} mr={1}>
                            [{index + 1}]
                          </Text>
                        )}
                        {icon && <Image src={icon} boxSize="20px" mr={1} />}
                        {removeEmoji(item.name)}
                      </>
                    </Button>
                  );
                })}
              </HStack>
            </HStack>
            {isDesktop && equippedSpellsAndWeapons.length > 0 && (
              <Text fontSize="2xs" color="grey400" textAlign="center" mt={1}>
                Use 1-{Math.min(equippedSpellsAndWeapons.length, 4)} keys to attack
              </Text>
            )}
            {(combatConsumables.length > 0 || canFlee) && (
              <HStack mt={{ base: 2, lg: 0 }} spacing={0} w="100%">
                {combatConsumables.map((consumable, index) => {
                  const consumableIcon = getItemImage(removeEmoji(consumable.name));
                  return (
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
                      fontSize="xs"
                      size={{ base: 'sm', sm: 'sm', lg: 'md' }}
                      py={{ base: 5, sm: 4, lg: 'unset' }}
                      variant="outline"
                      w="100%"
                    >
                      {consumableIcon ? (
                        <Image src={consumableIcon} boxSize="20px" mr={1} />
                      ) : (
                        <PotionSvg size={3} theme="dark" mr={1} />
                      )}
                      {removeEmoji(consumable.name)} (x{consumable.balance.toString()})
                    </Button>
                  );
                })}
                {canFlee && (
                  <Button
                    borderLeft={combatConsumables.length > 0 ? '2px' : 'none'}
                    borderRadius={0}
                    borderRight="none"
                    borderTop="none"
                    isLoading={isFleeing}
                    fontSize="xs"
                    size={{ base: 'sm', sm: 'sm', lg: 'md' }}
                    py={{ base: 5, sm: 4, lg: 'unset' }}
                    onClick={onFleePvp}
                    variant="outline"
                    color="#A0522D"
                    borderColor="#A0522D"
                    _hover={{ bg: 'rgba(160,82,45,0.15)' }}
                    w="100%"
                  >
                    Flee
                  </Button>
                )}
              </HStack>
            )}
          </VStack>
        )}
      <Stack p={{ base: 2, lg: 4 }}>
        {!currentBattle && !(isSpawned && position) && (
          <SafeTypist
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
          </SafeTypist>
        )}
        {!currentBattle && isSpawned && position && (
          <VStack spacing={3} w="100%">
            {isDesktop && <ConsumableQuickUse />}
            <HStack justify="space-between" w="100%">
              <Text color="#8A7E6A" fontStyle="italic" size="xs">
                {position.x === 0 && position.y === 0
                  ? 'Move to a new tile to find monsters.'
                  : grindMode
                    ? 'Grind mode — combat auto-resolves on move.'
                    : monstersOnTile.length === 0
                      ? 'No monsters here. Try another tile.'
                      : 'Click on a monster to battle.'}
              </Text>
              <HStack spacing={2} flexShrink={0}>
                <Text color="#8A7E6A" fontSize="2xs" whiteSpace="nowrap">
                  Grind
                </Text>
                <Switch
                  size="sm"
                  isChecked={grindMode}
                  onChange={onToggleGrindMode}
                  colorScheme="orange"
                />
              </HStack>
            </HStack>
          </VStack>
        )}

        {opponent &&
          (() => {
            const seenDotTurns = new Set<string>();
            return [...attackOutcomes].reverse().map((attack, reverseIndex) => {
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

            // Check if there's a DoT message for this turn (show once per turn)
            const turnKey = attack.currentTurn.toString();
            const dotForTurn = !seenDotTurns.has(turnKey)
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
                <Text color="purple.300" size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                  Poison deals{' '}
                  <Text as="span" fontFamily="mono">
                    {dotForTurn.totalDamage.toString()}
                  </Text>{' '}
                  damage to{' '}
                  {dotForTurn.entityId.toLowerCase() === character?.id.toLowerCase()
                    ? 'you'
                    : opponent.name}
                  .
                </Text>
              </SafeTypist>
            ) : null;

            if (attack.miss[0]) {
              return (
                <Box key={`battle-attack-${i}`}>
                  <SafeTypist
                    avgTypingDelay={10}
                    cursor={{ show: false }}
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
                  </SafeTypist>
                  {dotMessageElement}
                </Box>
              );
            }

            const critText = attack.crit[0] ? 'Critical hit! ' : '';

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
                    : `${opponent.name} is affected by ${possibleStatusEffectAttack.name}.`)
                : (isSelfBuff
                    ? `${opponent.name} is affected by ${possibleStatusEffectAttack.name}.`
                    : `You are affected by ${possibleStatusEffectAttack.name}.`);

              attackContent = (
                <Box>
                  <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                    {critText}
                    {isPlayerAttack ? (
                      <Text as="span">
                        You cast {itemName}
                        {!isSelfBuff && (
                          <Text as="span">
                            {' '}on{' '}
                            <Text as="span" color="green">
                              {opponent.name}
                            </Text>
                          </Text>
                        )}
                      </Text>
                    ) : (
                      <Text as="span">
                        <Text as="span" color="green">
                          {opponent.name}
                        </Text>{' '}
                        cast {itemName}
                      </Text>
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
                </Box>
              );
            } else if (hasOnlyStatusEffects && !alreadyAffected) {
              attackContent = (
                <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                  {isPlayerAttack ? 'You' : (
                    <Text as="span" color="green">{opponent.name}</Text>
                  )} cast {itemName} on{' '}
                  {isPlayerAttack ? (
                    <Text as="span" color="green">{opponent.name}</Text>
                  ) : 'you'}
                  .
                  {effectNames[0] &&
                    STATUS_EFFECT_DESCRIPTION_MAPPING[effectNames[0]] && (
                      <Text
                        as="span"
                        color="#D08040"
                      >
                        {' '}
                        {effectNames[0]}.{' '}
                        {STATUS_EFFECT_DESCRIPTION_MAPPING[effectNames[0]]}
                      </Text>
                    )}
                </Text>
              );
            } else if (alreadyAffected) {
              attackContent = (
                <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                  {isPlayerAttack ? 'You' : (
                    <Text as="span" color="green">{opponent.name}</Text>
                  )} cast {itemName} on{' '}
                  {isPlayerAttack ? (
                    <Text as="span" color="green">{opponent.name}</Text>
                  ) : 'you'}
                  .{' '}
                  {effectNames[0]
                    ? `${effectNames[0]} is already active.`
                    : 'It had no effect.'}
                </Text>
              );
            } else if (isPlayerAttack) {
              attackContent = (
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
              );
            } else {
              attackContent = (
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
              );
            }

            return (
              <Box key={`battle-attack-${i}`}>
                <SafeTypist
                  avgTypingDelay={10}
                  cursor={{ show: false }}
                  stdTypingDelay={10}
                >
                  {attackContent}
                </SafeTypist>
                {dotMessageElement}
              </Box>
            );
          });
          })()}
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
            <SafeTypist
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
            </SafeTypist>
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
