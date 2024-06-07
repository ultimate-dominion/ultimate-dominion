import { Box, Text, VStack } from '@chakra-ui/react';

export const Players = (): JSX.Element => {
  return (
    <Box>
      <Text fontWeight="bold" size="lg">
        Players
      </Text>
      <VStack>
        <Text>Mon-o 🧙‍♂️</Text>
        <Text>GUATY 🎭</Text>
        <Text>Wolf R ※</Text>
        <Text>GUATY 🎭</Text>
        <Text>Wolf R ※</Text>
      </VStack>
    </Box>
  );
};
