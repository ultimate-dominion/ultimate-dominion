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
  hp,
  str,
  agi,
  int,
}: {
  hp: number;
  str: number;
  agi: number;
  int: number;
}): JSX.Element => {
  return (
    <Box>
      <VStack>
        <HStack alignItems="start" padding="5px" w="100%">
          <Box>
            <Text fontWeight="bold">My Stats</Text>
          </Box>
          <Spacer />
          <Text fontWeight="bold"></Text>
        </HStack>
        <Box textAlign="left" w="100%">
          <Grid
            columnGap="5"
            padding="5px"
            templateColumns="repeat(2, 1fr)"
            width="75%"
          >
            <GridItem>
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
            <GridItem>
              <Text fontWeight="bold" size="lg">
                HP
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

            <GridItem>
              <Text fontWeight="bold" size="lg">
                STR
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

            <GridItem>
              <Text fontWeight="bold" size="lg">
                AGI
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

            <GridItem>
              <Text fontWeight="bold" size="lg">
                INT
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
