import { Box, Text, VStack } from '@chakra-ui/react';

export const Players = (): JSX.Element => {
  return (
    <Box>
      <Text fontWeight="bold" p="10px" size="lg">
        Players
      </Text>
      <VStack alignItems="start" mt={4} p="0 10px">
        <Text>Mon-o 🧙‍♂️</Text>
        <Text>GUATY 🎭</Text>
        <Text>Wolf R ※</Text>
        <Text>GUATY 🎭</Text>
        <Text>Wolf R ※</Text>
      </VStack>
    </Box>
  );
};
