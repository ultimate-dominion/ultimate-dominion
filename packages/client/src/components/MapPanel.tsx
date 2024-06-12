import { Box, Button, HStack, Stack, Text, VStack } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { BiSolidNavigation } from 'react-icons/bi';
import {
  IoIosArrowDropdownCircle,
  IoIosArrowDropleftCircle,
  IoIosArrowDroprightCircle,
  IoIosArrowDropupCircle,
} from 'react-icons/io';
import { TbDirectionArrows } from 'react-icons/tb';

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
      if (
        (direction === 'up' && position.y === 9) ||
        (direction === 'down' && position.y === 0) ||
        (direction === 'left' && position.x === 0) ||
        (direction === 'right' && position.x === 9)
      ) {
        return;
      }

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
    [position],
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
              <VStack
                borderTop={hasSafeZoneTopBorder ? '2px solid' : '2px solid'}
                borderTopColor={hasSafeZoneTopBorder ? 'yellow' : 'black'}
                borderRight={hasSafeZoneRightBorder ? '2px solid' : '2px solid'}
                borderRightColor={hasSafeZoneRightBorder ? 'yellow' : 'black'}
                justifyContent="center"
                key={`map-tile${i}`}
              >
                {currentTile && <CharacterPiece />}
              </VStack>
            );
          })}
        </Box>
        <Stack
          direction={{ base: 'column-reverse', xl: 'row' }}
          justifyContent="space-between"
          mt={{ base: 2, xl: 1 }}
        >
          <HStack>
            <BiSolidNavigation />
            <Text fontWeight={700} size="sm">
              {position.x}, {position.y}
            </Text>
          </HStack>
          <Text size="xs">Dark Cave - 2,344 Players</Text>
        </Stack>
      </Box>
      <NavigationCompass onMove={onMove} />
    </Stack>
  );
};

const CharacterPiece = (): JSX.Element => (
  <Box
    bg="transparent"
    border={{ base: '4px solid', lg: '8px solid' }}
    borderColor={{ base: 'yellow', lg: 'yellow' }}
    borderRadius="50%"
    h={{ base: '12px', lg: '28px' }}
    w={{ base: '12px', lg: '28px' }}
  />
);

const NavigationCompass = ({
  onMove,
}: {
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
