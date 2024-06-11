import { Grid, GridItem } from '@chakra-ui/react';

import { ActionsPanel } from '../components/ActionsPanel';
import { MapPanel } from '../components/MapPanel';
import { StatsPanel } from '../components/StatsPanel';
import { TileDetailsPanel } from '../components/TileDetailsPanel';

export const GameBoard = (): JSX.Element => {
  return (
    <Grid
      gap={2}
      h={{ base: 'auto', lg: 'calc(100vh - 100px)' }}
      mt={4}
      templateColumns={{ base: '1fr', lg: 'repeat(16, 1fr)' }}
      templateRows={{ base: 'repeat(16, 50px)', lg: 'repeat(12, 1fr)' }}
    >
      <GridItem
        border="2px solid"
        colSpan={{ base: 1, lg: 4 }}
        display={{ base: 'none', lg: 'block' }}
        overflowY="auto"
        p={4}
        rowSpan={{ base: 12, lg: 12 }}
      >
        <StatsPanel />
      </GridItem>
      <GridItem
        border="2px solid"
        colSpan={{ base: 1, lg: 8 }}
        colStart={{ base: 0, lg: 5 }}
        overflowY="auto"
        p={{ base: 2, lg: 4 }}
        rowSpan={{ base: 5, lg: 6 }}
        rowStart={{ base: 0, lg: 0 }}
      >
        <TileDetailsPanel />
      </GridItem>
      <GridItem
        border="2px solid"
        colSpan={{ base: 1, lg: 8 }}
        colStart={{ base: 0, lg: 5 }}
        overflowY="auto"
        p={4}
        rowSpan={{ base: 5, lg: 6 }}
        rowStart={{ base: 6, lg: 7 }}
      >
        <ActionsPanel />
      </GridItem>
      <GridItem
        colSpan={{ base: 1, lg: 4 }}
        colStart={{ base: 0, lg: 13 }}
        rowSpan={{ base: 5, lg: 8 }}
        rowStart={{ base: 11, lg: 0 }}
      >
        <MapPanel />
      </GridItem>
      {/* <GridItem
        background="lavender"
        border="2px solid"
        colSpan={{ base: 0, lg: 2 }}
        colStart={{ base: 0, lg: 7 }}
        display={{ base: 'none', lg: 'block' }}
        p={4}
        rowSpan={{ base: 0, lg: 4 }}
        rowStart={{ base: 0, lg: 9 }}
      >
        <Heading>Chat</Heading>
      </GridItem> */}
      {/* <GridItem
        background="plum"
        border="2px solid"
        colSpan={{ base: 1, lg: 0 }}
        colStart={{ base: 0, lg: 0 }}
        display={{ base: 'block', lg: 'none' }}
        padding="5px"
        rowSpan={{ base: 1, lg: 0 }}
        rowStart={{ base: 13, lg: 0 }}
      >
        <Heading>Tray</Heading>
      </GridItem> */}
    </Grid>
  );
};
