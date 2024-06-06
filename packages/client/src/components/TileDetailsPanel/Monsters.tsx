import { Box, Heading, HStack, Spacer, Text } from '@chakra-ui/react';

export const Monsters = (): JSX.Element => {
  return (
    <Box>
      <Heading>Monsters</Heading>
      <Box>
        <HStack>
          <Text color="yellow">Kobold</Text>
          <Spacer />
          <Text>Level 2</Text>
        </HStack>
        <Spacer />
        <HStack>
          <Text color="green">Green Slime</Text>
          <Spacer />
          <Text>Level 2</Text>
        </HStack>
        <Spacer />
        <HStack>
          <Text color="red">Cave Bandit</Text>
          <Spacer />
          <Text>Level 2</Text>
        </HStack>
      </Box>
    </Box>
  );
};
