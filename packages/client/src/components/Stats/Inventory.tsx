import { Box, Heading, HStack, Spacer, Text, VStack } from '@chakra-ui/react';

export const Inventory = (): JSX.Element => {
  return (
    <Box padding="5px" w="100%">
      <VStack align="stretch" spacing={2}>
        <HStack>
          <Heading>Active Items</Heading>
          <Spacer></Spacer>
          <Text>1/3</Text>
        </HStack>
        <HStack fontSize="small" fontWeight="bold">
          <Text>Rusty Dagger</Text>
          <Spacer></Spacer>
          <Text>⁂</Text>
        </HStack>
        <HStack fontSize="small">
          <Text>Empty Slot</Text>
          <Spacer></Spacer>
          <Text>+</Text>
        </HStack>
        <HStack fontSize="small">
          <Text>Empty Slot</Text>
          <Spacer></Spacer>
          <Text>+</Text>
        </HStack>
      </VStack>
    </Box>
  );
};
