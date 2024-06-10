import { Box, HStack, Spacer, Text } from '@chakra-ui/react';

export const Monsters = (): JSX.Element => {
  return (
    <Box>
      <Text fontWeight="bold" p="10px" size="lg">
        Monsters
      </Text>
      <Box mt={4}>
        <HStack p="5px 10px" w="100%">
          <Text color="yellow">Kobold</Text>
          <Spacer />
          <Text fontWeight="bold">Level 2</Text>
        </HStack>
        <Spacer />
        <HStack bg="grey300" p="5px 10px">
          <Text color="green">Green Slime</Text>
          <Spacer />
          <Text fontWeight="bold">Level 2</Text>
        </HStack>
        <Spacer />
        <HStack p="5px 10px">
          <Text color="red">Cave Bandit</Text>
          <Spacer />
          <Text fontWeight="bold">Level 2</Text>
        </HStack>
      </Box>
    </Box>
  );
};
