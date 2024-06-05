import { Grid, GridItem, Heading } from '@chakra-ui/react';

export const GameBoard = (): JSX.Element => {
  // Reset showError state when any of the form fields change

  return (
    <Grid
      gap={2}
      minH="100vh"
      padding="5px 0"
      templateColumns={{ base: 'repeat(8, 1fr)', sm: 'repeat(8, 1fr)' }}
      templateRows={{ base: 'repeat(13, 1fr)', sm: 'repeat(12, 1fr)' }}
    >
      <GridItem
        background="powderblue"
        border="solid"
        padding="5px"
        display={{ base: 'none', sm: 'block' }}
        colSpan={{ base: 2, sm: 2 }}
        rowSpan={{ base: 12, sm: 12 }}
      >
        <Heading>Stats</Heading>
      </GridItem>
      <GridItem
        background="mintcream"
        border="solid"
        padding="5px"
        colSpan={{ base: 8, sm: 4 }}
        colStart={{ base: 0, sm: 0 }}
        rowSpan={{ base: 4, sm: 6 }}
        rowStart={{ base: 0, sm: 0 }}
      >
        <Heading>Board</Heading>
      </GridItem>
      <GridItem
        background="mintcream"
        border="solid"
        padding="5px"
        colSpan={{ base: 8, sm: 4 }}
        colStart={{ base: 0, sm: 3 }}
        rowSpan={{ base: 4, sm: 6 }}
        rowStart={{ base: 5, sm: 7 }}
      >
        <Heading>Status</Heading>
      </GridItem>
      <GridItem
        background="lavender"
        border="solid"
        padding="5px"
        colSpan={{ base: 4, sm: 2 }}
        colStart={{ base: 0, sm: 7 }}
        rowSpan={{ base: 4, sm: 4 }}
        rowStart={{ base: 9, sm: 0 }}
      >
        <Heading>Grid</Heading>
      </GridItem>
      <GridItem
        background="lavender"
        border="solid"
        padding="5px"
        colSpan={{ base: 4, sm: 2 }}
        colStart={{ base: 5, sm: 7 }}
        rowSpan={{ base: 4, sm: 4 }}
        rowStart={{ base: 9, sm: 0 }}
      >
        <Heading>Compass</Heading>
      </GridItem>
      <GridItem
        background="lavender"
        border="solid"
        padding="5px"
        display={{ base: 'none', sm: 'block' }}
        colSpan={{ base: 0, sm: 2 }}
        colStart={{ base: 0, sm: 7 }}
        rowSpan={{ base: 0, sm: 4 }}
        rowStart={{ base: 0, sm: 9 }}
      >
        <Heading>Chat</Heading>
      </GridItem>
      <GridItem
        background="plum"
        border="solid"
        padding="5px"
        display={{ base: 'block', sm: 'none' }}
        colSpan={{ base: 8, sm: 0 }}
        colStart={{ base: 0, sm: 0 }}
        rowSpan={{ base: 1, sm: 0 }}
        rowStart={{ base: 13, sm: 0 }}
      >
        <Heading>Tray</Heading>
      </GridItem>
    </Grid>
  );
};
