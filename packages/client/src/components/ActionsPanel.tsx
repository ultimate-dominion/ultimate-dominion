import {
  Box,
  Button,
  Divider,
  HStack,
  Progress,
  Spinner,
  Stack,
  Text,
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
import { EncounterType } from '../utils/types';

export const ActionsPanel = (): JSX.Element => {
  const { character, equippedSpells, equippedWeapons } = useCharacter();
  const { isSpawned, monstersOnTile, position } = useMap();
  const {
    attackOutcomes,
    attackingItemId,
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
    if (parentDivRef.current) {
      parentDivRef.current.scrollTo({
        behavior: 'smooth',
        top: parentDivRef.current.scrollHeight,
      });
    }

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
      if (turnEndTime - Date.now() < 0) {
        setTurnTimeLeft(0);
        return;
      }
      setTurnTimeLeft(prev => prev - 1);
    }, 1000);

    if (currentBattle?.encounterType === EncounterType.PvE) {
      return () => clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [currentBattle, turnEndTime, turnTimeLeft]);

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

    if (isAttacker && currentBattle.currentTurn === '1') {
      return true;
    }

    if (!isAttacker && currentBattle.currentTurn === '2') {
      return true;
    }

    return false;
  }, [character, currentBattle]);

  if (isItemTemplatesLoading) {
    return (
      <VStack mt={12}>
        <Spinner size="lg" />
      </VStack>
    );
  }

  return (
    <Box maxH="100%" overflowY="auto" pb={4} ref={parentDivRef}>
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
            bgColor="white"
            position="sticky"
            spacing={0}
            top={0}
            w="100%"
          >
            {currentBattle.encounterType === EncounterType.PvE && (
              <Text p={{ base: 2, lg: 4 }} size="xs" textAlign="center">
                <Text as="span" fontWeight="bold">
                  Choose your move!
                </Text>
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
              {equippedSpellsAndWeapons.map((item, index) => (
                <Button
                  borderLeft={index === 0 ? 'none' : '2px'}
                  borderRadius={0}
                  borderRight="none"
                  isDisabled={
                    attackingItemId !== null || !canAttack || isFleeing
                  }
                  isLoading={attackingItemId === item.tokenId}
                  key={`equipped-item-${index}`}
                  loadingText="Attacking..."
                  onClick={() => onAttack(item.tokenId)}
                  ref={getButtonRef(index)}
                  variant="outline"
                  w="100%"
                >
                  {item.name}
                </Button>
              ))}
            </HStack>
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
                  By fleeing, you will lose 25% of the $GOLD in your Adventure
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
        {!currentBattle &&
          isSpawned &&
          position?.x === 0 &&
          position?.y === 0 && (
            <Typist
              avgTypingDelay={10}
              cursor={{ show: false }}
              stdTypingDelay={10}
            >
              <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                You are currently in the starting tile.{' '}
                <Text as="span" fontWeight={700}>
                  Move to a new tile
                </Text>{' '}
                to find monsters to battle.
              </Text>
            </Typist>
          )}
        {!currentBattle &&
          !isRefreshing &&
          isSpawned &&
          (position?.x !== 0 || position?.y !== 0) &&
          monstersOnTile.length === 0 && (
            <Typist
              avgTypingDelay={10}
              cursor={{ show: false }}
              stdTypingDelay={10}
            >
              <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                Looks like there are no monsters in this tile.{' '}
                <Text as="span" fontWeight={700}>
                  Move to a new tile
                </Text>{' '}
                to find monsters to battle.
              </Text>
            </Typist>
          )}
        {!currentBattle &&
          !isRefreshing &&
          (position?.x !== 0 || position?.y !== 0) &&
          monstersOnTile.length > 0 && (
            <Typist
              avgTypingDelay={10}
              cursor={{ show: false }}
              stdTypingDelay={10}
            >
              <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                To initiate a battle,{' '}
                <Text as="span" fontWeight={700}>
                  click on a monster
                </Text>
                .
              </Text>
            </Typist>
          )}

        {opponent?.name &&
          attackOutcomes.map((attack, i) => {
            const attackItem = spellAndWeaponTemplates.find(
              item => item.tokenId === attack.itemId,
            );
            const itemName = attackItem?.name ?? 'an item';
            const possibleStatusEffectAttack = statusEffectActions.find(
              statusEffectAction =>
                Number(statusEffectAction.turnStart) - 1 === i,
            );

            if (attack.miss[0]) {
              return (
                <Typist
                  avgTypingDelay={10}
                  cursor={{ show: false }}
                  key={`battle-attack-${i}`}
                  stdTypingDelay={10}
                >
                  {attack.attackerId === character?.id ? (
                    <Text
                      key={`battle-attack-${i}`}
                      size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                    >
                      You missed{' '}
                      <Text as="span" color="green">
                        {opponent.name}
                      </Text>{' '}
                      with {itemName}.
                    </Text>
                  ) : (
                    <Text
                      key={`battle-attack-${i}`}
                      size={{ base: 'xs', sm: 'sm', lg: 'md' }}
                    >
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
                {attack.attackerId === character?.id &&
                  !!possibleStatusEffectAttack && (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      {critText}You attacked{' '}
                      <Text as="span" color="green">
                        {opponent?.name}
                      </Text>{' '}
                      with {itemName}. You inflicted{' '}
                      <Text as="span" color="red">
                        {possibleStatusEffectAttack.name}
                      </Text>
                      !
                    </Text>
                  )}
                {attack.attackerId !== character?.id &&
                  !!possibleStatusEffectAttack && (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      {critText}
                      <Text as="span" color="green">
                        {opponent?.name}
                      </Text>{' '}
                      attacked you with {itemName}. You were inflicted with{' '}
                      <Text as="span" color="red">
                        {possibleStatusEffectAttack.name}
                      </Text>
                      !
                    </Text>
                  )}
                {attack.attackerId === character?.id &&
                  !possibleStatusEffectAttack && (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      {critText}You attacked{' '}
                      <Text as="span" color="green">
                        {opponent?.name}
                      </Text>{' '}
                      with {itemName} for{' '}
                      <Text as="span" color="red">
                        {attack.attackerDamageDelt}
                      </Text>{' '}
                      damage.
                    </Text>
                  )}
                {attack.attackerId !== character?.id &&
                  !possibleStatusEffectAttack && (
                    <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }}>
                      {critText}
                      <Text as="span" color="green">
                        {opponent?.name}
                      </Text>{' '}
                      attacked you with {itemName} for{' '}
                      <Text as="span" color="red">
                        {attack.attackerDamageDelt}
                      </Text>{' '}
                      damage.
                    </Text>
                  )}
              </Typist>
            );
          })}
      </Stack>
      {battleOver && currentBattle && (
        <Stack my={4} spacing={4}>
          <Divider />
          <Typist
            avgTypingDelay={10}
            cursor={{ show: false }}
            stdTypingDelay={10}
          >
            <Text
              fontWeight="bold"
              size={{ base: 'xs', sm: 'sm', lg: 'md' }}
              textAlign="center"
            >
              {lastestBattleOutcome?.winner === character?.id
                ? 'You won!'
                : 'You died...'}
            </Text>
          </Typist>
          <HStack justifyContent="center">
            <Button
              onClick={() => onContinueToBattleOutcome(true)}
              size="sm"
              variant="outline"
            >
              View Results
            </Button>
          </HStack>
        </Stack>
      )}
    </Box>
  );
};
