import { Box, Grid, GridItem, HStack, Text, Tooltip, VStack } from '@chakra-ui/react';
import { useMemo } from 'react';
import { GiDeathSkull, GiPerson } from 'react-icons/gi';

import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';

const MAP_SIZE = 10; // 0–9

type TileInfo = {
  monsters: number;
  players: number;
} | null; // null = out of bounds

const DIRECTIONS: { label: string; dx: number; dy: number; row: number; col: number }[] = [
  { label: 'N', dx: 0, dy: -1, row: 1, col: 2 },
  { label: 'W', dx: -1, dy: 0, row: 2, col: 1 },
  { label: 'E', dx: 1, dy: 0, row: 2, col: 3 },
  { label: 'S', dx: 0, dy: 1, row: 3, col: 2 },
];

const DirectionCell = ({ info, label }: { info: TileInfo; label: string }): JSX.Element => {
  if (!info) {
    return (
      <VStack spacing={0} justify="center" h="100%">
        <Text color="#3A3428" fontSize="2xs" fontWeight={600}>{label}</Text>
        <Text color="#3A3428" fontSize="xs">&mdash;</Text>
      </VStack>
    );
  }

  return (
    <Tooltip
      hasArrow
      label={`${label}: ${info.monsters} monster${info.monsters !== 1 ? 's' : ''}, ${info.players} player${info.players !== 1 ? 's' : ''}`}
      placement="top"
    >
      <VStack spacing={0} justify="center" h="100%" cursor="default">
        <Text color="#5A5040" fontSize="2xs" fontWeight={600}>{label}</Text>
        <HStack spacing={1.5}>
          <HStack spacing={0.5}>
            <GiDeathSkull size={10} color={info.monsters > 0 ? '#8B4040' : '#3A3428'} />
            <Text
              color={info.monsters > 0 ? '#8B4040' : '#3A3428'}
              fontFamily="mono"
              fontSize="2xs"
              fontWeight={700}
            >
              {info.monsters}
            </Text>
          </HStack>
          <HStack spacing={0.5}>
            <GiPerson size={10} color={info.players > 0 ? '#D4A54A' : '#3A3428'} />
            <Text
              color={info.players > 0 ? '#D4A54A' : '#3A3428'}
              fontFamily="mono"
              fontSize="2xs"
              fontWeight={700}
            >
              {info.players}
            </Text>
          </HStack>
        </HStack>
      </VStack>
    </Tooltip>
  );
};

export const TileScout = (): JSX.Element | null => {
  const { allMonsters, allCharacters, isSpawned, position } = useMap();
  const { delegatorAddress } = useMUD();

  const adjacentTiles = useMemo(() => {
    if (!position) return null;

    const result: Record<string, TileInfo> = {};

    for (const dir of DIRECTIONS) {
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

  if (!isSpawned || !position || !adjacentTiles) return null;

  return (
    <VStack spacing={1} w="100%" px={2}>
      <Grid
        gap={0}
        templateColumns="repeat(3, 1fr)"
        templateRows="repeat(3, minmax(40px, auto))"
        w="100%"
      >
        {/* Row 1: empty - N - empty */}
        <GridItem />
        <GridItem>
          <DirectionCell info={adjacentTiles.N} label="N" />
        </GridItem>
        <GridItem />

        {/* Row 2: W - center coords - E */}
        <GridItem>
          <DirectionCell info={adjacentTiles.W} label="W" />
        </GridItem>
        <GridItem>
          <VStack spacing={0} justify="center" h="100%">
            <Text color="#8A7E6A" fontFamily="mono" fontSize="xs" fontWeight={700}>
              {position.x},{position.y}
            </Text>
          </VStack>
        </GridItem>
        <GridItem>
          <DirectionCell info={adjacentTiles.E} label="E" />
        </GridItem>

        {/* Row 3: empty - S - empty */}
        <GridItem />
        <GridItem>
          <DirectionCell info={adjacentTiles.S} label="S" />
        </GridItem>
        <GridItem />
      </Grid>
    </VStack>
  );
};
