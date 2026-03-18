import {
  Box,
  Button,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  keyframes,
  Stack,
  Switch,
  Text,
  Tooltip,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { FaStoreAlt } from 'react-icons/fa';


import { useNavigate } from 'react-router-dom';
import { useBattle } from '../contexts/BattleContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useQueue } from '../contexts/QueueContext';
import { useGameConfig } from '../lib/gameStore';
import { OnboardingStage, useOnboardingStage } from '../hooks/useOnboardingStage';
import { WAITING_ROOM_PATH } from '../Routes';
import { CaptchaGate } from './CaptchaGate';
import { WorldFeed } from './WorldFeed';
import { OnlineLink } from './OnlineRoster';
import { PolygonalCard } from './PolygonalCard';
import { CharacterPieceSvg } from './SVGs/CharacterPieceSvg';
import { CompassArrowSvg, CompassRoseOrnamentSvg } from './SVGs/CompassRoseSvg';
import { TileNumberSvg } from './SVGs/TileNumberSvg';

const SAFE_ZONE_AREA = {
  topLeft: { x: 0, y: 4 },
  bottomRight: { x: 4, y: 0 },
};

const MAP_SIZE = 10;

type TileInfo = {
  monsters: number;
  players: number;
} | null;

const COMPASS_DIRECTIONS: {
  label: string;
  direction: 'up' | 'down' | 'left' | 'right';
  rotate: string;
  dx: number;
  dy: number;
  gridRow: number;
  gridCol: number;
}[] = [
  { label: 'N', direction: 'up', rotate: '0deg', dx: 0, dy: 1, gridRow: 1, gridCol: 2 },
  { label: 'W', direction: 'left', rotate: '-90deg', dx: -1, dy: 0, gridRow: 2, gridCol: 1 },
  { label: 'E', direction: 'right', rotate: '90deg', dx: 1, dy: 0, gridRow: 2, gridCol: 3 },
  { label: 'S', direction: 'down', rotate: '180deg', dx: 0, dy: -1, gridRow: 3, gridCol: 2 },
];

export const MapPanel = (): JSX.Element => {
  const { allCharacters, allMonsters, allShops, isSpawned, isSpawning, onSpawn, position } = useMap();
  const { currentBattle } = useBattle();
  const { autoAdventureMode, isRefreshing, onMove, onToggleAutoAdventure } = useMovement();
  const { delegatorAddress } = useMUD();
  const navigate = useNavigate();
  const {
    queuePosition,
    queueStatus,
    isMapFull,
    estimatedWaitMinutes,
    joinQueue,
    reportSpawned,
  } = useQueue();
  const [showCaptcha, setShowCaptcha] = useState(false);
  const stage = useOnboardingStage();

  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const currentPlayersSpawned = useMemo(() => {
    return allCharacters.filter(character => character.isSpawned).length;
  }, [allCharacters]);

  const configValue = useGameConfig('UltimateDominionConfig');
  const maxPlayers = configValue?.maxPlayers ? BigInt(configValue.maxPlayers as string) : BigInt(0);

  const adjacentTiles = useMemo(() => {
    if (!position) return null;

    const result: Record<string, TileInfo> = {};

    for (const dir of COMPASS_DIRECTIONS) {
      const tx = position.x + dir.dx;
      const ty = position.y + dir.dy;

      if (tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE) {
        result[dir.label] = null;
      } else {
        const monsters = allMonsters.filter(
          m => m.position.x === tx && m.position.y === ty && m.currentHp > BigInt(0),
        ).length;

        const players = allCharacters.filter(
          c =>
            c.position.x === tx &&
            c.position.y === ty &&
            c.owner.toLowerCase() !== delegatorAddress?.toLowerCase(),
        ).length;

        result[dir.label] = { monsters, players };
      }
    }

    return result;
  }, [allMonsters, allCharacters, delegatorAddress, position]);

  return (
    <Stack alignItems="center" className="data-dense" h="100%">
      {/* Compass — above map on mobile, below on desktop */}
      <Box order={{ base: 0, lg: 2 }} w="100%">
        {isSpawned && stage >= OnboardingStage.FIRST_STEPS ? (
          <>
            <NavigationCompass
              adjacentTiles={adjacentTiles}
              isDisabled={!!currentBattle || isRefreshing}
              onMove={onMove}
              position={position}
              stage={stage}
            />
            {/* Mobile-only auto adventure toggle */}
            {!isDesktop && stage >= OnboardingStage.SETTLING_IN && (
              <HStack
                justify="center"
                spacing={2.5}
                pt={1}
                pb={0.5}
              >
                <Text
                  color={autoAdventureMode ? '#C87A2A' : '#5A5248'}
                  fontFamily="mono"
                  fontSize="11px"
                  fontWeight={500}
                  letterSpacing="0.5px"
                  transition="color 0.2s"
                >
                  Auto Adventure
                </Text>
                <Switch
                  size="sm"
                  isChecked={autoAdventureMode}
                  onChange={onToggleAutoAdventure}
                  colorScheme="orange"
                />
              </HStack>
            )}
          </>
        ) : !isSpawned ? (
          <VStack mt={{ base: 0, lg: 8 }} spacing={3}>
            {isMapFull && queueStatus === 'idle' && !showCaptcha && (
              <>
                <Text color="red" fontWeight={500} size="sm">
                  Server Full ({currentPlayersSpawned}/{Number(maxPlayers)})
                </Text>
                <Button
                  onClick={() => setShowCaptcha(true)}
                  size="sm"
                >
                  Join Queue
                </Button>
              </>
            )}
            {isMapFull && queueStatus === 'idle' && showCaptcha && (
              <CaptchaGate
                isLoading={queueStatus === 'joining' as any}
                onVerified={async (token) => {
                  await joinQueue(token);
                  navigate(WAITING_ROOM_PATH);
                }}
              />
            )}
            {isMapFull && (queueStatus === 'waiting' || queueStatus === 'joining') && (
              <>
                <Text color="#D4A54A" fontWeight={500} size="sm">
                  Queue Position: #{queuePosition}
                </Text>
                <Text color="#8A7E6A" size="xs">
                  ~{estimatedWaitMinutes} min wait
                </Text>
                <Button
                  onClick={() => navigate(WAITING_ROOM_PATH)}
                  size="sm"
                  variant="outline"
                >
                  View Waiting Room
                </Button>
              </>
            )}
            {isMapFull && queueStatus === 'ready' && (
              <>
                <Text color="green.300" fontWeight={700} size="sm">
                  A slot opened!
                </Text>
                <Button
                  isLoading={isSpawning}
                  loadingText="Spawning..."
                  onClick={() => {
                    reportSpawned();
                    onSpawn();
                  }}
                  size="sm"
                  colorScheme="green"
                >
                  Spawn Now
                </Button>
              </>
            )}
            <Button
              isDisabled={!!currentBattle}
              isLoading={isSpawning}
              loadingText="Spawning..."
              onClick={onSpawn}
              size="sm"
            >
              Spawn
            </Button>
          </VStack>
        ) : null}
      </Box>

      {/* Map grid */}
      <Box order={{ base: 1, lg: 1 }} w="100%" h={{ base: '300px', lg: '35%' }} flexShrink={0}>
        <PolygonalCard clipPath="none">
          <HStack
            bgColor="blue500"
            h={{ base: '36px', md: '46px' }}
            px="20px"
            width="100%"
          >
            <Heading size="sm">
              Dark Cave
            </Heading>
          </HStack>
          <Box
            aspectRatio="1/1"
            border="0.5px solid"
            borderColor="grey500"
            display="grid"
            gridTemplateColumns={stage >= OnboardingStage.VETERAN ? 'repeat(10, 1fr)' : 'repeat(5, 1fr)'}
            gridTemplateRows={stage >= OnboardingStage.VETERAN ? 'repeat(10, 1fr)' : 'repeat(5, 1fr)'}
            maxH={{ base: 'calc(100% - 56px)', md: 'calc(100% - 68px)' }}
            maxW="100%"
            m="0 auto"
            mt={1}
          >
            {[...Array(stage >= OnboardingStage.VETERAN ? 100 : 25)].map((_, i) => {
              const gridSize = stage >= OnboardingStage.VETERAN ? MAP_SIZE : 5;
              const row = (gridSize - 1) - Math.floor(i / gridSize);
              const col = i % gridSize;
              const currentTile = position?.x === col && position?.y === row;

              const hasSafeZoneTopBorder =
                row === SAFE_ZONE_AREA.topLeft.y &&
                col >= SAFE_ZONE_AREA.topLeft.x &&
                col <= SAFE_ZONE_AREA.bottomRight.x;

              const hasSafeZoneRightBorder =
                col === SAFE_ZONE_AREA.bottomRight.x &&
                row >= SAFE_ZONE_AREA.bottomRight.y &&
                row <= SAFE_ZONE_AREA.topLeft.y;

              const hasSafeZoneBottomBorder =
                row === SAFE_ZONE_AREA.bottomRight.y &&
                col >= SAFE_ZONE_AREA.topLeft.x &&
                col <= SAFE_ZONE_AREA.bottomRight.x;

              const hasSafeZoneLeftBorder =
                row >= SAFE_ZONE_AREA.bottomRight.y &&
                row <= SAFE_ZONE_AREA.topLeft.y &&
                col === SAFE_ZONE_AREA.topLeft.x;

              return (
                <VStack
                  bgColor={
                    col <= SAFE_ZONE_AREA.topLeft.y &&
                    row <= SAFE_ZONE_AREA.bottomRight.x
                      ? 'rgba(200,122,42,0.06)'
                      : 'transparent'
                  }
                  borderBottom={
                    hasSafeZoneBottomBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderBottomColor={
                    hasSafeZoneBottomBorder ? '#C87A2A' : 'grey500'
                  }
                  borderLeft={
                    hasSafeZoneLeftBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderLeftColor={hasSafeZoneLeftBorder ? '#C87A2A' : 'grey500'}
                  borderRight={
                    hasSafeZoneRightBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderRightColor={
                    hasSafeZoneRightBorder ? '#C87A2A' : 'grey500'
                  }
                  borderTop={
                    hasSafeZoneTopBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderTopColor={hasSafeZoneTopBorder ? '#C87A2A' : 'grey500'}
                  justifyContent="center"
                  key={`map-tile${i}`}
                  position="relative"
                >
                  {(col === 0 || row === 0) && (
                    <TileNumberSvg number={col || row} />
                  )}

                  {currentTile && isSpawned && (
                    <CharacterPieceSvg
                      position="absolute"
                      left="50%"
                      transform="translateX(-30%)"
                    />
                  )}

                  {allShops.map((shop, index) => {
                    const isShopHere =
                      shop.position.x === col && shop.position.y === row;

                    return (
                      isShopHere && (
                        <VStack
                          key={`shop-${index}`}
                          left="50%"
                          position="absolute"
                          transform="translateX(-50%)"
                        >
                          <FaStoreAlt size={14} />
                        </VStack>
                      )
                    );
                  })}
                </VStack>
              );
            })}
          </Box>
          {stage >= OnboardingStage.SETTLING_IN && (
            <HStack
              justifyContent="end"
              mt={0.5}
              px={{ base: 1, sm: 2 }}
            >
              <OnlineLink />
            </HStack>
          )}
        </PolygonalCard>
      </Box>

      {isDesktop && stage >= OnboardingStage.SETTLING_IN && (
        <Box order={3} w="100%" flex={1} minH="100px" mt={2}>
          <WorldFeed inline />
        </Box>
      )}
    </Stack>
  );
};


const compassPulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const WASD_MAP: Record<string, string> = { N: 'W', W: 'A', S: 'S', E: 'D' };
const ARROW_MAP: Record<string, string> = { N: '\u2191', W: '\u2190', S: '\u2193', E: '\u2192' };

const NavigationCompass = ({
  adjacentTiles,
  isDisabled,
  onMove,
  position,
  stage,
}: {
  adjacentTiles: Record<string, TileInfo> | null;
  isDisabled: boolean;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
  position: { x: number; y: number } | null;
  stage: OnboardingStage;
}): JSX.Element => {
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const useFullCompass = !isDesktop || stage < OnboardingStage.SETTLING_IN;
  const btnSize = isDesktop && !useFullCompass ? '32px' : '44px';
  const arrowSize = isDesktop && !useFullCompass ? '14px' : '18px';

  if (isDesktop && !useFullCompass) {
    // Desktop veteran: compact horizontal arrow bar — N W [coords] E S
    return (
      <VStack spacing={0} w="100%">
        <HStack justify="center" py={1} spacing={1} w="100%">
          {COMPASS_DIRECTIONS.map(({ label, direction, rotate }) => {
            const isOob = adjacentTiles ? adjacentTiles[label] === null : false;
            const info = adjacentTiles?.[label] ?? null;

            return (
              <Tooltip
                key={label}
                hasArrow
                isDisabled={!info}
                label={
                  info
                    ? `${label}: ${info.monsters} monster${info.monsters !== 1 ? 's' : ''}, ${info.players} player${info.players !== 1 ? 's' : ''}`
                    : undefined
                }
                placement="top"
              >
                <IconButton
                  aria-label={`Move ${label}`}
                  icon={
                    <HStack spacing={0.5}>
                      <Text color="#8A7E6A" fontSize="2xs" fontWeight={700} lineHeight={1}>
                        {label}
                      </Text>
                      <Box transform={`rotate(${rotate})`} lineHeight={0}>
                        <CompassArrowSvg boxSize="12px" />
                      </Box>
                    </HStack>
                  }
                  isDisabled={isDisabled || isOob}
                  onClick={() => onMove(direction)}
                  h="28px"
                  w="36px"
                  minW={0}
                  variant="ghost"
                  size="xs"
                  opacity={isDisabled ? 0.4 : 1}
                  _hover={isDisabled ? {} : { bg: 'rgba(200,122,42,0.15)' }}
                />
              </Tooltip>
            );
          })}
          {position && (
            <Text
              color="#E8DCC8"
              fontFamily="mono"
              fontSize="2xs"
              fontWeight={700}
              ml={1}
            >
              {position.x},{position.y}
            </Text>
          )}
        </HStack>
        <Text color="#5A5040" fontSize="2xs" lineHeight={1} pb={1}>
          WASD or Arrow Keys to move
        </Text>
      </VStack>
    );
  }

  // Full compass rose — mobile always, desktop for early players
  return (
    <Box py={2} w="100%">
      <Grid
        gap={0}
        mx="auto"
        templateColumns={`1fr ${btnSize} 1fr`}
        templateRows={`1fr ${btnSize} 1fr`}
        w="160px"
        h="160px"
        position="relative"
      >
        {/* Rose ornament behind everything */}
        <Box
          gridColumn="1 / 4"
          gridRow="1 / 4"
          display="flex"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <CompassRoseOrnamentSvg
            boxSize="130px"
            opacity={0.35}
          />
        </Box>

        {/* Direction buttons */}
        {COMPASS_DIRECTIONS.map(({ label, direction, rotate, gridRow, gridCol }) => {
          const info = adjacentTiles?.[label] ?? null;
          const isOob = adjacentTiles ? adjacentTiles[label] === null : false;
          const isActive = !isDisabled && !isOob;

          return (
            <GridItem
              key={label}
              gridRow={gridRow}
              gridColumn={gridCol}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              position="relative"
              zIndex={1}
            >
              <Tooltip
                hasArrow
                isDisabled={!info}
                label={
                  info
                    ? `${label}: ${info.monsters} monster${info.monsters !== 1 ? 's' : ''}, ${info.players} player${info.players !== 1 ? 's' : ''}`
                    : undefined
                }
                placement="top"
              >
                <IconButton
                  aria-label={`Move ${label}`}
                  icon={
                    <VStack spacing={0}>
                      <Text
                        color="#8A7E6A"
                        fontSize="2xs"
                        fontWeight={700}
                        lineHeight={1}
                        mb={-0.5}
                      >
                        {label}
                      </Text>
                      <Box transform={`rotate(${rotate})`} lineHeight={0}>
                        <CompassArrowSvg boxSize={arrowSize} />
                      </Box>
                    </VStack>
                  }
                  isDisabled={isDisabled || isOob}
                  onClick={() => onMove(direction)}
                  h={btnSize}
                  w={btnSize}
                  minW={0}
                  variant="ghost"
                  size="xs"
                  animation={
                    stage < OnboardingStage.SETTLING_IN && isActive
                      ? `${compassPulse} 2s ease-in-out infinite`
                      : undefined
                  }
                  opacity={isDisabled || isOob ? 0.2 : 1}
                  _hover={isDisabled ? {} : { bg: 'rgba(200,122,42,0.15)' }}
                />
              </Tooltip>
            </GridItem>
          );
        })}

        {/* Center — coords */}
        <GridItem
          gridRow={2}
          gridColumn={2}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1}
        >
          {position && (
            <Text
              color="#E8DCC8"
              fontFamily="mono"
              fontSize="xs"
              fontWeight={700}
              lineHeight={1}
              textAlign="center"
            >
              {position.x},{position.y}
            </Text>
          )}
        </GridItem>
      </Grid>

      {/* WASD / Arrow key hint — desktop only, early players */}
      {isDesktop && stage < OnboardingStage.SETTLING_IN && (
        <HStack justify="center" mt={1} spacing={3}>
          {['N', 'W', 'S', 'E'].map(dir => (
            <HStack key={dir} spacing={1}>
              <Box
                bg="rgba(168, 222, 255, 0.08)"
                border="1px solid rgba(168, 222, 255, 0.2)"
                borderRadius="3px"
                color="#A8DEFF"
                fontFamily="mono"
                fontSize="2xs"
                fontWeight={700}
                h="18px"
                lineHeight="18px"
                textAlign="center"
                w="18px"
              >
                {WASD_MAP[dir]}
              </Box>
              <Text color="#5A5040" fontSize="2xs" lineHeight={1}>
                {ARROW_MAP[dir]}
              </Text>
            </HStack>
          ))}
        </HStack>
      )}
    </Box>
  );
};
