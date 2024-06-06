import { Box, Heading, HStack, Spacer, Text } from '@chakra-ui/react';

export const HealthPotion = (): JSX.Element => {
  return (
    <Box padding="5px" w="100%">
      <HStack>
        <Heading>Health Potion</Heading>
        <Spacer></Spacer>
        <Text>3θ</Text>
      </HStack>
    </Box>
  );
};
