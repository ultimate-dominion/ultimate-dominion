import {
  Box,
  Button,
  Heading,
  HStack,
  IconButton,
  Stack,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useMemo } from 'react';
import {
  BiChevronDown,
  BiChevronLeft,
  BiChevronRight,
  BiChevronUp,
  BiSolidNavigation,
} from 'react-icons/bi';
import { FaStoreAlt } from 'react-icons/fa';

import { useBattle } from '../contexts/BattleContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { ChatBox } from './ChatBox';
import { PolygonalCard } from './PolygonalCard';
import { CharacterPieceSvg } from './SVGs/CharacterPieceSvg';
import { CompassSvg } from './SVGs/CompassSvg';
import { TileNumberSvg } from './SVGs/TileNumberSvg';

const SAFE_ZONE_AREA = {
  topLeft: { x: 0, y: 4 },
  bottomRight: { x: 4, y: 0 },
};

// Wrapper component that handles undefined MUD components
export const MapPanel = (): JSX.Element => {
  const { components } = useMUD();

  if (!components?.UltimateDominion) {
    return <Box />;
  }

  return <MapPanelInner UltimateDominion={components.UltimateDominion} />;
};

const MapPanelInner = ({ UltimateDominion }: { UltimateDominion: any }): JSX.Element => {
  const { allCharacters, isSpawned, isSpawning, onSpawn, position } = useMap();
  const { allShops } = useMap();
  const { currentBattle } = useBattle();
  const { isRefreshing, onMove } = useMovement();

  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const currentPlayersSpawned = useMemo(() => {
    return allCharacters.filter(character => character.isSpawned).length;
  }, [allCharacters]);

  const configValue = useComponentValue(
    UltimateDominion,
    singletonEntity,
  );
  const maxPlayers = configValue?.maxPlayers ?? BigInt(0);

  return (
    <Stack alignItems="center" className="data-dense" h="100%">
      <Box w="100%" h={{ base: '300px', lg: '300px' }}>
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
            gridTemplateColumns="repeat(10, 1fr)"
            gridTemplateRows="repeat(10, 1fr)"
            h={{ base: 'calc(100% - 56px)', md: 'calc(100% - 68px)' }}
            maxW="100%"
            m="0 auto"
            mt={1}
          >
            {[...Array(100)].map((_, i) => {
              const row = 9 - Math.floor(i / 10); // Reverse the row
              const col = i % 10;
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
          <HStack
            justifyContent={isSpawned && position ? 'space-between' : 'end'}
            mt={0.5}
            px={{ base: 1, sm: 2 }}
          >
            {isSpawned && position && (
              <HStack spacing={1}>
                <BiSolidNavigation color="#C87A2A" size={isDesktop ? 12 : 10} />
                <Text
                  color="#E8DCC8"
                  fontFamily="mono"
                  fontWeight={700}
                  size={{ base: 'xs', sm: 'sm' }}
                >
                  {position.x},{position.y}
                </Text>
              </HStack>
            )}
            <Text color="#8A7E6A" fontWeight={500} size={{ base: '2xs', sm: 'xs' }}>
              {currentPlayersSpawned} Player
              {currentPlayersSpawned === 1 ? '' : 's'}
            </Text>
          </HStack>
        </PolygonalCard>
      </Box>
      {isSpawned ? (
        <NavigationCompass
          isDisabled={!!currentBattle || isRefreshing}
          onMove={onMove}
        />
      ) : (
        <VStack mt={{ base: 0, lg: 8 }} spacing={3}>
          {currentPlayersSpawned >= Number(maxPlayers) && (
            <Text color="red" fontWeight={500} size="sm">
              Max players reached
            </Text>
          )}
          <Button
            isDisabled={
              !!currentBattle || currentPlayersSpawned >= Number(maxPlayers)
            }
            isLoading={isSpawning}
            loadingText="Spawning..."
            onClick={onSpawn}
            size="sm"
          >
            Spawn
          </Button>
        </VStack>
      )}
      {isDesktop && isSpawned && (
        <Box w="100%" flex={1} minH="100px" mt={2}>
          <ChatBox inline />
        </Box>
      )}
    </Stack>
  );
};

const NavigationCompass = ({
  isDisabled,
  onMove,
}: {
  isDisabled: boolean;
  onMove: (direction: 'up' | 'down' | 'left' | 'right') => void;
}): JSX.Element => {
  const btnSize = { base: 7, lg: 8 };

  return (
    <Box
      mt={{ base: 1, lg: 2 }}
      position="relative"
      h={{ base: '100px', lg: '120px' }}
      w={{ base: '100px', lg: '120px' }}
    >
      <Box
        left="50%"
        opacity={0.25}
        position="absolute"
        top="50%"
        transform="translate(-50%, -50%)"
      >
        <CompassSvg size={16} />
      </Box>
      <IconButton
        aria-label="Move north"
        borderRadius="50%"
        icon={<BiChevronUp size="20px" />}
        isDisabled={isDisabled}
        left="50%"
        onClick={() => onMove('up')}
        position="absolute"
        top={0}
        transform="translateX(-50%)"
        h={btnSize}
        w={btnSize}
        minW={0}
        variant="blue"
      />
      <IconButton
        aria-label="Move west"
        borderRadius="50%"
        icon={<BiChevronLeft size="20px" />}
        isDisabled={isDisabled}
        left={0}
        onClick={() => onMove('left')}
        position="absolute"
        top="50%"
        transform="translateY(-50%)"
        h={btnSize}
        w={btnSize}
        minW={0}
        variant="blue"
      />
      <IconButton
        aria-label="Move east"
        borderRadius="50%"
        icon={<BiChevronRight size="20px" />}
        isDisabled={isDisabled}
        onClick={() => onMove('right')}
        position="absolute"
        right={0}
        top="50%"
        transform="translateY(-50%)"
        h={btnSize}
        w={btnSize}
        minW={0}
        variant="blue"
      />
      <IconButton
        aria-label="Move south"
        borderRadius="50%"
        icon={<BiChevronDown size="20px" />}
        isDisabled={isDisabled}
        bottom={0}
        left="50%"
        onClick={() => onMove('down')}
        position="absolute"
        transform="translateX(-50%)"
        h={btnSize}
        w={btnSize}
        minW={0}
        variant="blue"
      />
    </Box>
  );
};
