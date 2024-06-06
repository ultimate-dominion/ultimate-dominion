import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

export const Stats = (): JSX.Element => {
  return (
    <Box w="100%" textAlign="left">
      <Grid
        padding="5px"
        templateColumns="repeat(2, 1fr)"
        columnGap="5"
        width="75%"
      >
        <GridItem>
          <Text fontWeight="bold">HP</Text>
        </GridItem>
        <GridItem>
          <Text>1</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold">STR</Text>
        </GridItem>
        <GridItem>
          <Text>3</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold">AGI</Text>
        </GridItem>
        <GridItem>
          <Text>4</Text>
        </GridItem>
        <GridItem>
          <Text fontWeight="bold">INT</Text>
        </GridItem>
        <GridItem>
          <Text>5</Text>
        </GridItem>
      </Grid>
    </Box>
  );
};
