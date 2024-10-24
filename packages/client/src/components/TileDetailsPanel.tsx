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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { IoIosWarning, IoMdInformationCircleOutline } from 'react-icons/io';
import { Link, useNavigate } from 'react-router-dom';

import { useBattle } from '../contexts/BattleContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import {
  CURRENT_BATTLE_OPPONENT_TURN_KEY,
  CURRENT_BATTLE_USER_TURN_KEY,
} from '../utils/constants';
import { etherToFixedNumber, getEmoji, removeEmoji } from '../utils/helpers';
import { type Character, EncounterType, type Monster } from '../utils/types';
import { AdventureEscrowModal } from './AdventureEscrowModal';
import { ClassSymbol } from './ClassSymbol';
import { HealthBar } from './HealthBar';
import { InfoModal } from './InfoModal';
import { ShopRow } from './ShopRow';

const ROW_HEIGHT = { base: 5, md: 8 };

export const TileDetailsPanel = (): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
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
    delegatorAddress,
    systemCalls: { createEncounter },
  } = useMUD();
  const {
    character,
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
    opponent,
    statusEffectActions,
    userCharacterForBattleRendering,
  } = useBattle();
  const { isRefreshing } = useMovement();

  const [isInitiating, setIsInitiating] = useState(false);
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
      try {
        setIsInitiating(true);

        if (!character) {
          throw new Error('Character not found.');
        }

        if (!delegatorAddress) {
          throw new Error('Missing delegation.');
        }

        const { error, success } = await createEncounter(
          encounterType,
          [character.id],
          [opponent.id],
        );

        if (error && !success) {
          throw new Error(error);
        }

        renderSuccess('Battle has begun!');
        refreshCharacter();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to initiate battle.', e);
      } finally {
        setIsInitiating(false);
      }
    },
    [
      character,
      createEncounter,
      delegatorAddress,
      refreshCharacter,
      renderError,
      renderSuccess,
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

    return _opponentStatusEffects
      .map(action => action.name)
      .concat(
        (opponent as Character)?.worldStatusEffects
          ?.filter(effect => effect.active)
          .map(effect => effect.name) ?? [],
      );
  }, [opponent, statusEffectActions]);

  const userCharacterStatusEffects = useMemo(() => {
    const activeStatusEffects = statusEffectActions.filter(
      action => action.active,
    );

    const _userCharacterStatusEffects = activeStatusEffects.filter(
      action => action.victimId === userCharacterForBattleRendering?.id,
    );

    return _userCharacterStatusEffects
      .map(action => action.name)
      .concat(
        userCharacterForBattleRendering?.worldStatusEffects
          ?.filter(effect => effect.active)
          .map(effect => effect.name) ?? [],
      );
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

  if (!character) {
    return (
      <Box>
        <HStack
          bgColor="blue500"
          h={{ base: '40px', md: '66px' }}
          px="20px"
          width="100%"
        >
          <Heading color="white" size={{ base: 'sm', md: 'md' }}>
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

  if (!currentBattle && isRefreshing) {
    return (
      <Box>
        <HStack
          bgColor="blue500"
          h={{ base: '40px', md: '66px' }}
          px="20px"
          width="100%"
        >
          <Heading color="white" size={{ base: 'sm', md: 'md' }}>
            Moving...
          </Heading>
        </HStack>
        <Flex alignItems="center" h="100%" justifyContent="center" mt={6}>
          <Spinner size="lg" />
        </Flex>
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
          <Heading color="white" size={{ base: 'sm', md: 'md' }}>
            Tile Details
          </Heading>
        </HStack>
        <Text size={{ base: 'xs', sm: 'sm', lg: 'md' }} p={6}>
          You have not yet spawned to the map.
        </Text>
      </Box>
    );
  }

  if (currentBattle && opponent && userCharacterForBattleRendering) {
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
        <HStack bgColor="blue500" h={{ base: '40px', md: '66px' }} px={4}>
          <Heading color="white" size={{ base: 'sm', md: 'md' }}>
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
            <VStack borderColor="blue500" w="50%">
              {currentBattle.encounterType === EncounterType.PvE ? (
                <VStack mt={{ base: 2, lg: 6 }} spacing={0}>
                  {isDesktop && (
                    <Avatar
                      animation={isMonsterHit ? 'flicker .7s infinite' : 'none'}
                      bgColor="grey300"
                      boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset"
                      mb={{ base: 1, lg: 2 }}
                      opacity={isMonsterHit ? 0 : 1}
                      size={{ base: '2xs', lg: 'md' }}
                      name=" "
                    >
                      <Text
                        animation={
                          isMonsterHit ? 'flicker .7s infinite' : 'none'
                        }
                        fontSize="36px"
                      >
                        {getEmoji(opponent.name)}
                      </Text>
                    </Avatar>
                  )}
                  <HStack>
                    <Text fontWeight={700} size={{ base: 'sm', lg: 'lg' }}>
                      {isDesktop ? removeEmoji(opponent.name) : opponent.name}
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
                    mb={{ base: 1, lg: 2 }}
                    opacity={isMonsterHit ? 0 : 1}
                    size={{ base: '2xs', lg: 'md' }}
                    src={opponent.image}
                  />
                  <HStack>
                    <Text fontWeight={700} size={{ base: 'sm', lg: 'lg' }}>
                      {opponent.name}
                    </Text>
                    <ClassSymbol
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
                    currentHp={opponent.currentHp}
                    level={opponent.level}
                    px={8}
                    statusEffects={opponentStatusEffects}
                    w="100%"
                  />
                )}

                <Box mt={4} w="100%">
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text size={{ base: '2xs', lg: 'sm' }}>AGI</Text>
                    {!!opponent.agility && (
                      <Text size={{ base: '2xs', lg: 'sm' }}>
                        {(
                          opponent.agility -
                          expiredOpponentEffectModifications.agiModifier
                        ).toString()}
                      </Text>
                    )}
                  </HStack>
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text size={{ base: '2xs', lg: 'sm' }}>INT</Text>
                    {!!opponent.intelligence && (
                      <Text size={{ base: '2xs', lg: 'sm' }}>
                        {(
                          opponent.intelligence -
                          expiredOpponentEffectModifications.intModifier
                        ).toString()}
                      </Text>
                    )}
                  </HStack>
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text size={{ base: '2xs', lg: 'sm' }}>STR</Text>
                    {!!opponent.strength && (
                      <Text size={{ base: '2xs', lg: 'sm' }}>
                        {(
                          opponent.strength -
                          expiredOpponentEffectModifications.strModifier
                        ).toString()}
                      </Text>
                    )}
                  </HStack>
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                    h="6px"
                    w="100%"
                  />
                </Box>
              </VStack>
            </VStack>

            <VStack h="100%" w="50%">
              <Stack
                alignItems="center"
                direction={{ base: 'row', lg: 'column' }}
                justify={{ base: 'center', lg: 'start' }}
                mt={{ base: 2, lg: 6 }}
                spacing={{ base: 2, lg: 0 }}
              >
                <Avatar
                  animation={isUserHit ? 'flicker .7s infinite' : 'none'}
                  mb={{ base: 0, lg: 2 }}
                  opacity={isUserHit ? 0 : 1}
                  size={{ base: '2xs', lg: 'md' }}
                  src={userCharacterForBattleRendering.image}
                />
                <HStack>
                  <Text fontWeight={700} size={{ base: 'sm', lg: 'lg' }}>
                    {userCharacterForBattleRendering.name}
                  </Text>
                  <ClassSymbol
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
                    currentHp={userCharacterForBattleRendering.currentHp}
                    level={userCharacterForBattleRendering.level}
                    px={8}
                    statusEffects={userCharacterStatusEffects}
                    w="100%"
                  />
                )}

                <Box mt={4} w="100%">
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text size={{ base: '2xs', lg: 'sm' }}>AGI</Text>
                    <Text size={{ base: '2xs', lg: 'sm' }}>
                      {(
                        userCharacterForBattleRendering.agility -
                        expiredUserEffectModifications.agiModifier
                      ).toString()}
                    </Text>
                  </HStack>
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text size={{ base: '2xs', lg: 'sm' }}>INT</Text>
                    <Text size={{ base: '2xs', lg: 'sm' }}>
                      {(
                        userCharacterForBattleRendering.intelligence -
                        expiredUserEffectModifications.intModifier
                      ).toString()}
                    </Text>
                  </HStack>
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
                    h="6px"
                    w="100%"
                  />
                  <HStack justifyContent="space-between" px={8} w="100%">
                    <Text size={{ base: '2xs', lg: 'sm' }}>STR</Text>
                    <Text size={{ base: '2xs', lg: 'sm' }}>
                      {(
                        userCharacterForBattleRendering.strength -
                        expiredUserEffectModifications.strModifier
                      ).toString()}
                    </Text>
                  </HStack>
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
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

  if (isInitiating) {
    return (
      <Box h="100%">
        <VStack h="100%" justifyContent="center" spacing={8}>
          <Text fontWeight={700} size={{ base: 'md', lg: 'xl' }}>
            Initiating battle!
          </Text>
          <Spinner color="red" size="xl" />
        </VStack>
      </Box>
    );
  }

  return (
    <Box h={{ base: 'calc(100% - 40px)', md: 'calc(100% - 66px)' }}>
      <HStack bgColor="blue500" h={{ base: '40px', md: '66px' }}>
        <Grid
          alignItems="center"
          color="white"
          h="100%"
          px={6}
          templateColumns="repeat(4, 1fr)"
          w="100%"
        >
          {isHomeTile && shopsOnTile.length > 0 && (
            <GridItem colSpan={2}>
              <Heading size={{ base: 'xs', sm: 'sm', md: 'md' }}>Shops</Heading>
            </GridItem>
          )}
          {!isHomeTile && (
            <GridItem colSpan={2}>
              <Heading size={{ base: 'xs', sm: 'sm', md: 'md' }}>
                Monsters
              </Heading>
            </GridItem>
          )}
          <GridItem colSpan={2}>
            <Heading size={{ base: 'xs', sm: 'sm', md: 'md' }}>
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
            <VStack alignItems="start" h="76px" p={2}>
              <HStack>
                <Text
                  fontSize={{ base: '3xs', sm: 'xs' }}
                  fontWeight={700}
                  textAlign="start"
                >
                  Adventure Escrow balance:{' '}
                  {etherToFixedNumber(character.escrowGoldBalance)} $GOLD
                </Text>
                <Tooltip
                  bg="#070D2A"
                  hasArrow
                  label="Your Adventure Escrow is where $GOLD goes when you win battles. Leaving $GOLD in your escrow will help you level up faster, but in the Outer Realms, you run the risk of losing it all against other players. You can withdraw your $GOLD at 0,0 on the map."
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
                  Move $GOLD
                </Button>
              )}
            </VStack>
            <Box
              backgroundColor="#F5F5FA1F"
              boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
              h="6px"
              w="100%"
            />
            {shopsOnTile.map((shop, i) => (
              <Box key={`tile-shop-${i}`}>
                <ShopRow shopId={shop.shopId} shopName={shop.name} />
                <Box
                  backgroundColor="#F5F5FA1F"
                  boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
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
              backgroundColor="#F5F5FA1F"
              boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
              h="6px"
              w="100%"
            />
            {monstersOnTile.length > 0 &&
              monstersOnTile.map((monster, i) => (
                <Box key={`tile-monster-${i}-${monster.name}`}>
                  <OpponentRow
                    encounterType={EncounterType.PvE}
                    onClick={() =>
                      isMoveEquipped
                        ? onInitiateCombat(monster, EncounterType.PvE)
                        : onOpenNoMoveEquippedModal()
                    }
                    opponent={monster}
                  />
                  <Box
                    backgroundColor="#F5F5FA1F"
                    boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
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
            backgroundColor="#F5F5FA1F"
            boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
            h="6px"
            w="100%"
          />
          <HStack h={ROW_HEIGHT} justifyContent="end" px={4}>
            <Text size={{ base: '3xs', sm: '2xs', md: 'xs' }} textAlign="right">
              {inSafetyZone ? 'Safety Zone' : 'Outer Realms'}
            </Text>
          </HStack>
          <Box
            backgroundColor="#F5F5FA1F"
            boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
            h="6px"
            w="100%"
          />
          {!isHomeTile &&
            shopsOnTile.map((shop, i) => (
              <Box key={`tile-shop-${i}`}>
                <ShopRow shopId={shop.shopId} shopName={shop.name} />
                <Box
                  backgroundColor="#F5F5FA1F"
                  boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
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
                />
                <Box
                  backgroundColor="#F5F5FA1F"
                  boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #54545433 inset"
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
    </Box>
  );
};

const OPPONENT_COLORS = {
  [0]: 'red',
  [1]: 'yellow',
  [2]: 'green',
};

const OpponentRow = ({
  encounterType,
  opponent,
  onClick,
}: {
  encounterType: EncounterType;
  opponent: Character | Monster;
  onClick: () => void;
}) => {
  const { inBattle, level, name } = opponent;
  const navigate = useNavigate();

  const inCooldown = useMemo(() => {
    const cooldownTimer = (opponent as Character).pvpCooldownTimer;
    if (!cooldownTimer) return false;
    return Number(cooldownTimer) + 30 > Date.now() / 1000;
  }, [opponent]);

  const disableRow = inBattle || inCooldown;

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
        px={{ base: 1, sm: 4 }}
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
          <Text
            color={OPPONENT_COLORS[opponent.entityClass]}
            filter={disableRow ? 'grayscale(100%)' : 'none'}
            size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
          >
            {name}
          </Text>
          {encounterType === EncounterType.PvP && (
            <Avatar
              filter={disableRow ? 'grayscale(100%)' : 'none'}
              size={{ base: '2xs', md: 'xs' }}
              src={opponent.image}
            />
          )}
        </HStack>
        {!disableRow && !!level && (
          <Text fontWeight={500} size={{ base: '3xs', sm: '2xs', md: 'sm' }}>
            Level {level.toString()}
          </Text>
        )}
        {inBattle && (
          <Text color="red" fontWeight={700} size={{ base: '3xs', sm: '2xs' }}>
            (In battle...)
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
