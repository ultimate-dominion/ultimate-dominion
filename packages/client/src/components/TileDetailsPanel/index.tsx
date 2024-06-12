import {
  Box,
  Flex,
  Grid,
  GridItem,
  HStack,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';

import { MONSTERS, PLAYERS } from './data';

const ROW_HEIGHT = { base: 5, md: 8, lg: 10 };

export const TileDetailsPanel = (): JSX.Element => {
  return (
    <Box>
      <Grid gap={5} templateColumns="repeat(4, 1fr)">
        <GridItem colSpan={2}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Monsters
          </Text>
        </GridItem>
        <GridItem colSpan={1}>
          <Text fontWeight="bold" size={{ base: 'sm', lg: 'lg' }}>
            Players
          </Text>
        </GridItem>
        <GridItem colSpan={1}>
          <Text mt={1} size={{ base: '2xs', lg: 'sm' }}>
            Safe Zone
          </Text>
        </GridItem>
      </Grid>
      <Grid gap={5} mt={1} templateColumns="repeat(4, 1fr)">
        <GridItem colSpan={2}>
          {MONSTERS.map((monster, i) => (
            <MonsterRow
              key={`tile-monster-${i}-${monster.name}`}
              monster={monster}
            />
          ))}
        </GridItem>
        <GridItem colSpan={1}>
          {PLAYERS.map((player, i) => (
            <PlayerRow
              key={`tile-player-${i}-${player.name}`}
              player={player}
            />
          ))}
        </GridItem>
        <GridItem colSpan={1}>
          {PLAYERS.map((player, i) => (
            <PlayerLevelRow
              key={`tile-player-level-${i}-${player.name}`}
              player={player}
            />
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
};

const MonsterRow = ({ monster }: { monster: (typeof MONSTERS)[0] }) => {
  const { color, level, name } = monster;

  const isFighting = monster.name === 'Green Slime';

  return (
    <HStack
      as="button"
      bg={isFighting ? 'grey300' : 'transparent'}
      border="1px solid transparent"
      h={ROW_HEIGHT}
      justifyContent="space-between"
      px={{ base: 1, sm: 2, md: 4 }}
      transition="all 0.3s ease"
      w="100%"
      _active={{
        bg: 'grey300',
        border: '1px solid',
        cursor: 'pointer',
      }}
      _hover={{
        border: '1px solid',
        cursor: 'pointer',
      }}
    >
      <Text color={color} size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>
        {name}
      </Text>
      <Text
        fontWeight="bold"
        size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}
      >
        Level {level}
      </Text>
    </HStack>
  );
};

const PlayerRow = ({ player }: { player: (typeof PLAYERS)[0] }) => {
  const { name } = player;

  return (
    <HStack h={ROW_HEIGHT} justifyContent="start">
      <Text size={{ base: '3xs', sm: '2xs', md: 'sm', lg: 'md' }}>{name}</Text>
    </HStack>
  );
};

const PlayerLevelRow = ({ player }: { player: (typeof PLAYERS)[0] }) => {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { level } = player;

  return (
    <HStack h={ROW_HEIGHT}>
      <Flex
        alignItems="center"
        as="button"
        borderBottom="1px solid transparent"
        fontWeight="bold"
        gap={2}
        _hover={{ borderBottom: '1px solid', cursor: 'pointer' }}
      >
        <Text size={{ base: '4xs', sm: '3xs', md: 'xs', lg: 'sm' }}>
          Level {level}
        </Text>
        <IoIosArrowForward size={isMobile ? 10 : 20} />
      </Flex>
    </HStack>
  );
};
