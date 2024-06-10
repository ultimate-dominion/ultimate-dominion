import { Grid, GridItem, Heading } from '@chakra-ui/react';

import { ActionsPanel } from '../components/ActionsPanel';
import { MapPanel } from '../components/MapPanel';
import { StatsPanel } from '../components/StatsPanel';
import { TileDetailsPanel } from '../components/TileDetailsPanel';

export const GameBoard = (): JSX.Element => {
  return (
    <Grid
      gap={2}
      minH="100vh"
      mt={4}
      templateColumns={{ base: 'repeat(16, 1fr)', md: 'repeat(16, 1fr)' }}
      templateRows={{ base: 'repeat(13, 1fr)', md: 'repeat(12, 1fr)' }}
    >
      <GridItem
        border="2px solid"
        colSpan={{ base: 3, md: 4 }}
        display={{ base: 'none', md: 'block' }}
        p={4}
        rowSpan={{ base: 12, md: 12 }}
      >
        <StatsPanel />
      </GridItem>
      <GridItem
        border="2px solid"
        colSpan={{ base: 10, md: 8 }}
        colStart={{ base: 0, md: 5 }}
        p={4}
        rowSpan={{ base: 4, md: 6 }}
        rowStart={{ base: 0, md: 0 }}
      >
        <TileDetailsPanel />
      </GridItem>
      <GridItem
        border="2px solid"
        colSpan={{ base: 10, md: 8 }}
        colStart={{ base: 0, md: 5 }}
        maxH={450}
        overflowY="auto"
        p={4}
        rowSpan={{ base: 4, md: 6 }}
        rowStart={{ base: 5, md: 7 }}
      >
        <ActionsPanel />
      </GridItem>
      <GridItem
        colSpan={{ base: 10, md: 4 }}
        colStart={{ base: 0, md: 13 }}
        rowSpan={{ base: 4, md: 8 }}
        rowStart={{ base: 9, md: 0 }}
      >
        <MapPanel />
      </GridItem>
      {/* <GridItem
        background="lavender"
        border="2px solid"
        colSpan={{ base: 0, md: 2 }}
        colStart={{ base: 0, md: 7 }}
        display={{ base: 'none', md: 'block' }}
        p={4}
        rowSpan={{ base: 0, md: 4 }}
        rowStart={{ base: 0, md: 9 }}
      >
        <Heading>Chat</Heading>
      </GridItem> */}
      <GridItem
        background="plum"
        border="2px solid"
        colSpan={{ base: 8, md: 0 }}
        colStart={{ base: 0, md: 0 }}
        display={{ base: 'block', md: 'none' }}
        padding="5px"
        rowSpan={{ base: 1, md: 0 }}
        rowStart={{ base: 13, md: 0 }}
      >
        <Heading>Tray</Heading>
      </GridItem>
    </Grid>
  );
};
