import {
  Box,
  Button,
  Heading,
  HStack,
  Stack,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { BiSolidNavigation } from 'react-icons/bi';
import {
  IoIosArrowDropdownCircle,
  IoIosArrowDropleftCircle,
  IoIosArrowDroprightCircle,
  IoIosArrowDropupCircle,
} from 'react-icons/io';
import { TbDirectionArrows } from 'react-icons/tb';

import { useBattle } from '../contexts/BattleContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { PolygonalCard } from './PolygonalCard';
import { CharacterPieceSvg } from './SVGs/CharacterPieceSvg';
import { TileNumberSvg } from './SVGs/TileNumberSvg';

const SAFE_ZONE_AREA = {
  topLeft: { x: 0, y: 4 },
  bottomRight: { x: 4, y: 0 },
};

export const MapPanel = (): JSX.Element => {
  const { allCharacters, isSpawned, isSpawning, onSpawn, position } = useMap();
  const { currentBattle } = useBattle();
  const { isRefreshing, onMove } = useMovement();

  const isDesktop = useBreakpointValue({ base: false, lg: true });

  return (
    <Stack
      alignItems={{ base: 'start', lg: 'center' }}
      direction={{ base: 'row', lg: 'column' }}
      h="100%"
    >
      <Box w={{ base: '50%', lg: '100%' }} h={{ base: '100%', lg: '400px' }}>
        <PolygonalCard clipPath="none">
          <HStack
            bgColor="blue500"
            h={{ base: '40px', md: '66px' }}
            px="20px"
            width="100%"
          >
            <Heading color="white" size={{ base: 'sm', md: 'md' }}>
              Dark Cave
            </Heading>
          </HStack>
          <Box
            border="0.5px solid"
            borderColor="grey500"
            display="grid"
            gridTemplateColumns="repeat(10, 1fr)"
            gridTemplateRows="repeat(10, 1fr)"
            h={{ base: 'calc(100% - 75px)', md: 'calc(100% - 120px)' }}
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
                      ? '#DCD64F14'
                      : 'transparent'
                  }
                  borderBottom={
                    hasSafeZoneBottomBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderBottomColor={
                    hasSafeZoneBottomBorder ? 'yellow' : 'grey500'
                  }
                  borderLeft={
                    hasSafeZoneLeftBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderLeftColor={hasSafeZoneLeftBorder ? 'yellow' : 'grey500'}
                  borderRight={
                    hasSafeZoneRightBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderRightColor={
                    hasSafeZoneRightBorder ? 'yellow' : 'grey500'
                  }
                  borderTop={
                    hasSafeZoneTopBorder ? '1.5px solid' : '0.5px solid'
                  }
                  borderTopColor={hasSafeZoneTopBorder ? 'yellow' : 'grey500'}
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
                </VStack>
              );
            })}
          </Box>
          <HStack justifyContent="space-between" mt={2} px={{ base: 1, sm: 2 }}>
            {isSpawned && position && (
              <HStack>
                <BiSolidNavigation size={isDesktop ? 20 : 10} />
                <Text
                  fontWeight={700}
                  size={{ base: 'xs', sm: 'md', md: 'xl' }}
                >
                  {position.x},{position.y}
                </Text>
              </HStack>
            )}
            <Text fontWeight={500} size={{ base: '2xs', sm: 'sm', md: 'md' }}>
              {allCharacters.length} Player
              {allCharacters.length === 1 ? '' : 's'}
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
        <Button
          isDisabled={!!currentBattle}
          isLoading={isSpawning}
          loadingText="Spawning..."
          mt={{ base: 0, lg: 8 }}
          onClick={onSpawn}
          size="sm"
        >
          Spawn
        </Button>
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
  return (
    <VStack
      alignItems="stretch"
      h={175}
      justifyContent="space-between"
      mt={{ base: 0, lg: 12, xl: 8 }}
      pos="relative"
      w={175}
    >
      <Box
        border="2px solid black"
        borderRadius="50%"
        h={110}
        pos="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w={110}
        zIndex={-1}
      />
      <Box
        bg="black"
        h="2px"
        left="50%"
        pos="absolute"
        top="50%"
        transform="translate(-50%, 50%)"
        w={85}
        zIndex={-1}
      />
      <Box
        bg="black"
        h={85}
        pos="absolute"
        right="50%"
        top="50%"
        transform="translate(50%, -50%)"
        w="2px"
        zIndex={-1}
      />
      <Box
        bg="white"
        left="50%"
        pos="absolute"
        top="50%"
        transform="translate(-50%, -45%)"
      >
        <TbDirectionArrows size={32} />
      </Box>
      <VStack spacing={0}>
        <Text fontWeight={700} size="xs">
          N
        </Text>
        <Button
          bg="white"
          borderRadius="50%"
          isDisabled={isDisabled}
          p={0}
          onClick={() => onMove('up')}
          variant="ghost"
        >
          <IoIosArrowDropupCircle size={32} />
        </Button>
      </VStack>
      <HStack justifyContent="space-between" spacing={10}>
        <HStack spacing={1}>
          <Text fontWeight={700} size="xs">
            W
          </Text>
          <Button
            bg="white"
            borderRadius="50%"
            isDisabled={isDisabled}
            p={0}
            onClick={() => onMove('left')}
            variant="ghost"
          >
            <IoIosArrowDropleftCircle size={32} />
          </Button>
        </HStack>
        <HStack spacing={1}>
          <Button
            bg="white"
            borderRadius="50%"
            isDisabled={isDisabled}
            p={0}
            onClick={() => onMove('right')}
            variant="ghost"
          >
            <IoIosArrowDroprightCircle size={32} />
          </Button>
          <Text fontWeight={700} size="xs">
            E
          </Text>
        </HStack>
      </HStack>
      <VStack spacing={0}>
        <Button
          bg="white"
          borderRadius="50%"
          isDisabled={isDisabled}
          p={0}
          onClick={() => onMove('down')}
          variant="ghost"
        >
          <IoIosArrowDropdownCircle size={32} />
        </Button>
        <Text fontWeight={700} size="xs">
          S
        </Text>
      </VStack>
    </VStack>
  );
};
