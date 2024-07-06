import { Box, Button, HStack, Stack, Text, VStack } from '@chakra-ui/react';
import { BiSolidNavigation } from 'react-icons/bi';
import {
  IoIosArrowDropdownCircle,
  IoIosArrowDropleftCircle,
  IoIosArrowDroprightCircle,
  IoIosArrowDropupCircle,
} from 'react-icons/io';
import { TbDirectionArrows } from 'react-icons/tb';

import { useMapNavigation } from '../contexts/MapNavigationContext';

const SAFE_ZONE_AREA = {
  topLeft: { x: 0, y: 4 },
  bottomRight: { x: 4, y: 0 },
};

export const MapPanel = (): JSX.Element => {
  const {
    burnerBalance,
    components: { Position, Spawned },
    delegatorAddress,
    systemCalls: { move, spawn },
  } = useMUD();
  const { character } = useCharacter();

  const [isSpawning, setIsSpawning] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const position = useComponentValue(
    Position,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.characterId ?? 0) },
    ),
  );

  const isSpawned = !!useComponentValue(
    Spawned,
    encodeEntity(
      { characterId: 'uint256' },
      { characterId: BigInt(character?.characterId ?? 0) },
    ),
  )?.spawned;

  const onSpawn = useCallback(async () => {
    try {
      setIsSpawning(true);

      if (burnerBalance === '0') {
        throw new Error(
          'Insufficient funds. Please top off your session account.',
        );
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!character) {
        throw new Error('Character not found.');
      }

      const success = await spawn(character.characterId);

      if (!success) {
        throw new Error('Contract call failed');
      }

      renderSuccess('Spawned!');
    } catch (e) {
      renderError(e, 'Failed to roll stats.');
    } finally {
      setIsSpawning(false);
    }
  }, [
    burnerBalance,
    character,
    delegatorAddress,
    renderError,
    renderSuccess,
    spawn,
  ]);

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      try {
        setIsMoving(true);

        if (!delegatorAddress) {
          throw new Error('Burner not found');
        }

        if (!position) {
          throw new Error('Position not found');
        }

        if (!character) {
          throw new Error('Character not found');
        }

        const { x, y } = position;

        if (
          (direction === 'up' && position.y === 9) ||
          (direction === 'down' && position.y === 0) ||
          (direction === 'left' && position.x === 0) ||
          (direction === 'right' && position.x === 9)
        ) {
          return;
        }

        let newX = x;
        let newY = y;

        switch (direction) {
          case 'up':
            newY = y + 1;
            break;
          case 'down':
            newY = y - 1;
            break;
          case 'left':
            newX = x - 1;
            break;
          case 'right':
            newX = x + 1;
            break;
          default:
            break;
        }

        const success = await move(character.characterId, newX, newY);

        if (!success) {
          throw new Error('Contract call failed');
        }
      } catch (e) {
        renderError(e, 'Failed to move.');
      } finally {
        setIsMoving(false);
      }
    },
    [character, delegatorAddress, move, position, renderError],
  );

  return (
    <Stack
      alignItems={{ base: 'start', lg: 'center' }}
      direction={{ base: 'row', lg: 'column' }}
      h="90%"
    >
      <Box w={{ base: '50%', lg: '100%' }} h={{ base: '100%', lg: '300px' }}>
        <Box
          border="2px solid black"
          borderRight="none"
          borderTop="none"
          display="grid"
          gridTemplateColumns="repeat(10, 1fr)"
          gridTemplateRows="repeat(10, 1fr)"
          h="100%"
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

            return (
              <VStack
                borderTop={hasSafeZoneTopBorder ? '2px solid' : '2px solid'}
                borderTopColor={hasSafeZoneTopBorder ? 'yellow' : 'black'}
                borderRight={hasSafeZoneRightBorder ? '2px solid' : '2px solid'}
                borderRightColor={hasSafeZoneRightBorder ? 'yellow' : 'black'}
                justifyContent="center"
                key={`map-tile${i}`}
              >
                {currentTile && isSpawned && <CharacterPiece />}
              </VStack>
            );
          })}
        </Box>
        <Stack
          direction={{ base: 'column-reverse', xl: 'row' }}
          justifyContent="space-between"
          mt={{ base: 2, xl: 1 }}
        >
          {isSpawned && position && (
            <HStack>
              <BiSolidNavigation />
              <Text fontWeight={700} size="sm">
                {position.x}, {position.y}
              </Text>
            </HStack>
          )}
          <Text size="xs">
            Dark Cave - {otherPlayers.length + 1} Player
            {otherPlayers.length + 1 > 1 ? 's' : ''}
          </Text>
        </Stack>
      </Box>
      {isSpawned ? (
        <NavigationCompass isMoving={isRefreshing} onMove={onMove} />
      ) : (
        <Button
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

const CharacterPiece = (): JSX.Element => (
  <Box
    bg="transparent"
    border={{ base: '4px solid', lg: '8px solid' }}
    borderColor={{ base: 'yellow', lg: 'yellow' }}
    borderRadius="50%"
    h={{ base: '12px', lg: '26px' }}
    w={{ base: '12px', lg: '26px' }}
  />
);

const NavigationCompass = ({
  isMoving,
  onMove,
}: {
  isMoving: boolean;
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
          isDisabled={isMoving}
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
            isDisabled={isMoving}
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
            isDisabled={isMoving}
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
          isDisabled={isMoving}
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
