import { Box, Button, HStack, Image, Text, VStack } from '@chakra-ui/react';
import { useCallback, useState } from 'react';

const SAFE_ZONE_AREA = {
  topLeft: { x: 0, y: 4 },
  bottomRight: { x: 4, y: 0 },
};

export const MapPanel = (): JSX.Element => {
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const onMove = useCallback(
    async (direction: 'up' | 'down' | 'left' | 'right') => {
      setPosition(prevPosition => {
        switch (direction) {
          case 'up':
            return { x: prevPosition.x, y: prevPosition.y + 1 };
          case 'down':
            return { x: prevPosition.x, y: prevPosition.y - 1 };
          case 'left':
            return { x: prevPosition.x - 1, y: prevPosition.y };
          case 'right':
            return { x: prevPosition.x + 1, y: prevPosition.y };
          default:
            return prevPosition;
        }
      });
    },
    [],
  );

  return (
    <VStack h="100%" w="100%">
      <Box
        border="2px solid black"
        borderRight="none"
        borderTop="none"
        display="grid"
        gridTemplateColumns="repeat(10, 1fr)"
        gridTemplateRows="repeat(10, 1fr)"
      >
        {[...Array(100)].map((_, i) => {
          const row = 9 - Math.floor(i / 10); // Reverse the row
          const col = i % 10;
          const currentTile = position.x === col && position.y === row;

          const hasSafeZoneTopBorder =
            row === SAFE_ZONE_AREA.topLeft.y &&
            col >= SAFE_ZONE_AREA.topLeft.x &&
            col <= SAFE_ZONE_AREA.bottomRight.x;

          const hasSafeZoneRightBorder =
            col === SAFE_ZONE_AREA.bottomRight.x &&
            row >= SAFE_ZONE_AREA.bottomRight.y &&
            row <= SAFE_ZONE_AREA.topLeft.y;

          return (
            <Box
              borderTop={hasSafeZoneTopBorder ? '3px solid' : '2px solid'}
              borderTopColor={hasSafeZoneTopBorder ? 'yellow' : 'black'}
              borderRight={hasSafeZoneRightBorder ? '3px solid' : '2px solid'}
              borderRightColor={hasSafeZoneRightBorder ? 'yellow' : 'black'}
              key={`map-tile${i}`}
              h="30px"
              w="30px"
            >
              {currentTile && <CharacterPiece />}
            </Box>
          );
        })}
      </Box>
      <HStack justifyContent="space-between" w="100%">
        <HStack>
          <Image
            src="/icons/navigation.svg"
            transform="rotate(45deg)"
            w="20px"
          />
          <Text fontWeight={700} size="sm">
            {position.x}, {position.y}
          </Text>
        </HStack>
        <Text size="xs">Dark Cave - 2,344 Players</Text>
      </HStack>
      <VStack alignItems="center" h="100%" w="100%">
        <Button colorScheme="blue" onClick={() => onMove('up')} size="sm">
          ↑
        </Button>
        <HStack spacing={10}>
          <Button colorScheme="blue" onClick={() => onMove('left')} size="sm">
            ←
          </Button>
          <Button colorScheme="blue" onClick={() => onMove('right')} size="sm">
            →
          </Button>
        </HStack>
        <Button colorScheme="blue" onClick={() => onMove('down')} size="sm">
          ↓
        </Button>
      </VStack>
    </VStack>
  );
};

const CharacterPiece = (): JSX.Element => (
  <Box
    bg="transparent"
    border="8px solid"
    borderColor="yellow"
    borderRadius="50%"
    h="28px"
    w="28px"
  />
);
