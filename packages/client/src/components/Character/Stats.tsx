import {
  Box,
  Grid,
  GridItem,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';

export const Stats = ({
  agi,
  hp,
  int,
  str,
}: {
  agi: number;
  hp: number;
  int: number;
  str: number;
}): JSX.Element => {
  return (
    <Box>
      <VStack>
        <HStack alignItems="start" padding="5px" w="100%">
          <Box>
            <Text fontWeight="bold">My Stats</Text>
          </Box>
          <Spacer />
          {/* <Text fontWeight="bold"></Text> */}
        </HStack>
        <Box textAlign="left" w="100%">
          <Grid
            columnGap="5"
            padding="5px"
            templateColumns="repeat(4, 1fr)"
            width="100%"
          >
            <GridItem colSpan={3}>
              <Text fontWeight="bold" size="lg"></Text>
            </GridItem>
            <GridItem>
              <Text>Base</Text>
            </GridItem>
            {/* <GridItem>
              <Text>Items</Text>
            </GridItem>
            <GridItem>
              <Text>Total</Text>
            </GridItem> */}
            <GridItem colSpan={3}>
              <Text fontWeight="bold" size="lg">
                HP - Hit
              </Text>
            </GridItem>
            <GridItem>
              <Text>{hp || 0}</Text>
            </GridItem>
            {/* <GridItem>
              <Text>+2</Text>
            </GridItem>
            <GridItem>
              <Text>1</Text>
            </GridItem> */}

            <GridItem colSpan={3}>
              <Text fontWeight="bold" size="lg">
                STR - Strength
              </Text>
            </GridItem>
            <GridItem>
              <Text>{str || 0}</Text>
            </GridItem>
            {/* <GridItem>
              <Text>+3</Text>
            </GridItem>
            <GridItem>
              <Text>1</Text>
            </GridItem> */}

            <GridItem colSpan={3}>
              <Text fontWeight="bold" size="lg">
                AGI - Agility
              </Text>
            </GridItem>
            <GridItem>
              <Text>{agi || 0}</Text>
            </GridItem>
            {/* <GridItem>
              <Text>+1</Text>
            </GridItem>
            <GridItem>
              <Text>1</Text>
            </GridItem> */}

            <GridItem colSpan={3}>
              <Text fontWeight="bold" size="lg">
                INT - Intelligence
              </Text>
            </GridItem>
            <GridItem>
              <Text>{int || 0}</Text>
            </GridItem>
            {/* <GridItem>
              <Text>+2</Text>
            </GridItem>
            <GridItem>
              <Text>1</Text>
            </GridItem> */}
          </Grid>
        </Box>
      </VStack>
    </Box>
  );
};
