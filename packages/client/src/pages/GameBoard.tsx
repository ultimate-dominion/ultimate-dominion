import { Grid, GridItem, Heading } from '@chakra-ui/react';

export const GameBoard = (): JSX.Element => {
  return (
    <Grid
      gap={2}
      minH="100vh"
      padding="5px 0"
      templateColumns={{ base: 'repeat(8, 1fr)', md: 'repeat(8, 1fr)' }}
      templateRows={{ base: 'repeat(13, 1fr)', md: 'repeat(12, 1fr)' }}
    >
      <GridItem
        background="powderblue"
        border="solid"
        colSpan={{ base: 2, md: 2 }}
        display={{ base: 'none', md: 'block' }}
        padding="5px"
        rowSpan={{ base: 12, md: 12 }}
      >
        <Heading>StatsPanel</Heading>
      </GridItem>
      <GridItem
        background="mintcream"
        border="solid"
        colSpan={{ base: 8, md: 4 }}
        colStart={{ base: 0, md: 0 }}
        padding="5px"
        rowSpan={{ base: 4, md: 6 }}
        rowStart={{ base: 0, md: 0 }}
      >
        <Heading>TileDetailsPanel</Heading>
      </GridItem>
      <GridItem
        background="mintcream"
        border="solid"
        colSpan={{ base: 8, md: 4 }}
        colStart={{ base: 0, md: 3 }}
        padding="5px"
        rowSpan={{ base: 4, md: 6 }}
        rowStart={{ base: 5, md: 7 }}
      >
        <Heading>ActionPanel</Heading>
      </GridItem>
      <GridItem
        background="lavender"
        border="solid"
        colSpan={{ base: 8, md: 2 }}
        colStart={{ base: 0, md: 7 }}
        padding="5px"
        rowSpan={{ base: 4, md: 8 }}
        rowStart={{ base: 9, md: 0 }}
      >
        <Heading>MapPanel</Heading>
      </GridItem>
      <GridItem
        background="lavender"
        border="solid"
        colSpan={{ base: 0, md: 2 }}
        colStart={{ base: 0, md: 7 }}
        display={{ base: 'none', md: 'block' }}
        padding="5px"
        rowSpan={{ base: 0, md: 4 }}
        rowStart={{ base: 0, md: 9 }}
      >
        <Heading>Chat</Heading>
      </GridItem>
      <GridItem
        background="plum"
        border="solid"
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
