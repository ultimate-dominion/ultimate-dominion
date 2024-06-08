import { Box, Button, HStack, Spacer, Text, VStack } from '@chakra-ui/react';

export const Inventory = (): JSX.Element => {
  return (
    <Box padding="5px" w="100%">
      <VStack align="stretch" spacing={2}>
        <HStack alignItems="start" fontWeight="bold">
          <Text>Active Items</Text>
          <Spacer />
          <Text>1/3</Text>
        </HStack>
        <HStack alignItems="center" fontSize="xs" fontWeight="bold">
          <Text>Rusty Dagger</Text>
          <Spacer />
          <Button padding="0 2px" size="sm" variant="disabled">
            ⁂
          </Button>
        </HStack>
        <HStack alignItems="center" fontSize="xs">
          <Text>Empty Slot</Text>
          <Spacer />
          <Button padding="0 2px" size="sm" variant="ghost">
            +
          </Button>
        </HStack>
        <HStack alignItems="center" fontSize="xs">
          <Text>Empty Slot</Text>
          <Spacer />
          <Button padding="0 2px" size="sm" variant="ghost">
            +
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};
