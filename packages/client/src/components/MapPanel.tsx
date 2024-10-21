import {
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  useBreakpointValue,
  VStack,
} from '@chakra-ui/react';
import { BiSolidNavigation } from 'react-icons/bi';

import { useBattle } from '../contexts/BattleContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { PolygonalCard } from './PolygonalCard';
import { CharacterPieceSvg } from './SVGs/CharacterPieceSvg';
import { CompassSvg } from './SVGs/CompassSvg';
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
      alignItems="center"
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
      position="relative"
      w={175}
    >
      <Box
        left="50%"
        position="absolute"
        top="50%"
        transform="translate(-50%, -50%)"
      >
        <CompassSvg />
      </Box>
      <VStack spacing={0}>
        <Icon
          fill="none"
          height={3}
          viewBox="0 0 22 9"
          width={4}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20.6967 7.93237L10.9997 1.212L1.30273 7.93237"
            stroke="#283570"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </Icon>

        <Button
          borderRadius="50%"
          fontWeight={700}
          isDisabled={isDisabled}
          onClick={() => onMove('up')}
          p={0}
          size="sm"
          variant="blue"
        >
          N
        </Button>
      </VStack>
      <HStack justifyContent="space-between" spacing={10}>
        <HStack spacing={1}>
          <Icon
            fill="none"
            height={4}
            viewBox="0 0 10 22"
            width={2}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8.20899 1.09093L1.48862 10.7879L8.20898 20.4849"
              stroke="#283570"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </Icon>

          <Button
            borderRadius="50%"
            fontWeight={700}
            isDisabled={isDisabled}
            onClick={() => onMove('left')}
            p={0}
            size="sm"
            variant="blue"
          >
            W
          </Button>
        </HStack>
        <HStack spacing={1}>
          <Button
            borderRadius="50%"
            fontWeight={700}
            isDisabled={isDisabled}
            onClick={() => onMove('right')}
            p={0}
            size="sm"
            variant="blue"
          >
            E
          </Button>
          <Icon
            fill="none"
            height={4}
            viewBox="0 0 10 22"
            width={2}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1.79101 20.4848L8.51138 10.7878L1.79102 1.09082"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="#283570"
            />
          </Icon>
        </HStack>
      </HStack>
      <VStack spacing={0}>
        <Button
          borderRadius="50%"
          fontWeight={700}
          isDisabled={isDisabled}
          onClick={() => onMove('down')}
          p={0}
          size="sm"
          variant="blue"
        >
          S
        </Button>
        <Icon
          fill="none"
          height={3}
          viewBox="0 0 22 10"
          width={4}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1.30332 1.51514L11.0003 8.2355L20.6973 1.51514"
            stroke="#283570"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </Icon>
      </VStack>
    </VStack>
  );
};
