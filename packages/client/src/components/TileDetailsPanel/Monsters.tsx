import { Box, HStack, Spacer, Text } from '@chakra-ui/react';

export const Monsters = (): JSX.Element => {
  return (
    <Box>
      <Text fontWeight="bold" size="lg">
        Monsters
      </Text>
      <Box>
        <HStack padding="5px 10px">
          <Text color="yellow">Kobold</Text>
          <Spacer />
          <Text fontWeight="bold">Level 2</Text>
        </HStack>
        <Spacer />
        <HStack bg="lightgray" padding="5px 10px">
          <Text color="green">Green Slime</Text>
          <Spacer />
          <Text fontWeight="bold">Level 2</Text>
        </HStack>
        <Spacer />
        <HStack padding="5px 10px">
          <Text color="red">Cave Bandit</Text>
          <Spacer />
          <Text fontWeight="bold">Level 2</Text>
        </HStack>
      </Box>
    </Box>
  );
};
