import { Box, Heading, HStack, Spacer, Text, VStack } from '@chakra-ui/react';

export const Inventory = (): JSX.Element => {
  return (
    <Box padding="5px" w="100%">
      <VStack align="stretch" fontWeight="bold" spacing={2}>
        <HStack alignItems="start">
          <Heading>Active Items</Heading>
          <Spacer />
          <Text>1/3</Text>
        </HStack>
        <HStack alignItems="start" fontSize="small" fontWeight="bold">
          <Text>Rusty Dagger</Text>
          <Spacer />
          <Text>⁂</Text>
        </HStack>
        <HStack alignItems="start" fontSize="small">
          <Text>Empty Slot</Text>
          <Spacer />
          <Text>+</Text>
        </HStack>
        <HStack alignItems="start" fontSize="small">
          <Text>Empty Slot</Text>
          <Spacer />
          <Text>+</Text>
        </HStack>
      </VStack>
    </Box>
  );
};
