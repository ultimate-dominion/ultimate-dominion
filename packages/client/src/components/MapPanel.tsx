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
import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useMemo } from 'react';
import { BiSolidNavigation } from 'react-icons/bi';
import { FaStoreAlt } from 'react-icons/fa';

import { useBattle } from '../contexts/BattleContext';
import { useMap } from '../contexts/MapContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
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
    <Stack alignItems="center" h="100%">
      <Box w="100%" h={{ base: '250px', lg: '400px' }}>
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
            aspectRatio="1/1"
            border="0.5px solid"
            borderColor="grey500"
            display="grid"
            gridTemplateColumns="repeat(10, 1fr)"
            gridTemplateRows="repeat(10, 1fr)"
            h={{ base: 'calc(100% - 75px)', md: 'calc(100% - 120px)' }}
            maxW="100%"
            m="0 auto"
            mt={2}
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
            mt={2}
            px={{ base: 1, sm: 2 }}
          >
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
              {currentPlayersSpawned} Player
              {currentPlayersSpawned === 1 ? '' : 's'}
            </Text>
          </HStack>
        </PolygonalCard>
      </Box>
      {isSpawned ? (
        <Box>
          <NavigationCompass
            isDisabled={!!currentBattle || isRefreshing}
            onMove={onMove}
          />
        </Box>
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
