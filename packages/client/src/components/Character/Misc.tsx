import { Box, Button, HStack, Spacer, Text, VStack } from '@chakra-ui/react';

import { Level } from '../StatsPanel/Level';

export const Misc = (): JSX.Element => {
  return (
    <VStack h="100%">
      <Box w="100%">
        <HStack alignItems="start" padding="5px">
          <Box>
            <Text fontWeight="bold">2,00 $GOLD</Text>
            <Text>190/345</Text>
          </Box>
          <Spacer />
          <Text fontWeight="bold">Level 1</Text>
        </HStack>
        <Level></Level>
      </Box>

      <Spacer></Spacer>
      <Box w="100%" alignSelf="start">
        <Button w="100%" margin="5px 0">
          Chat
        </Button>
        <Button w="100%" margin="5px 0">
          Leader Board
        </Button>
      </Box>
    </VStack>
  );
};
