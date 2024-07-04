import { HStack, Text, VStack } from '@chakra-ui/react';

export const Stats = ({
  agi,
  hp,
  int,
  str,
}: {
  agi: number;
  hp: number;
  int: number;
  str: number;
}): JSX.Element => {
  return (
    <VStack>
      <HStack justify="space-between" w="100%">
        <Text alignSelf="start" fontWeight="bold">
          My Stats
        </Text>
        <Text alignSelf="start" fontWeight="bold">
          Ability Points: 3
        </Text>
      </HStack>
      <Text alignSelf="end" mt={4} size="xs">
        Base
      </Text>
      <VStack w="100%">
        <HStack justify="space-between" w="100%">
          <Text size="lg">HP - Hit</Text>
          <Text size="lg">{hp}</Text>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text size="lg">STR - Strength</Text>
          <Text size="lg">{str}</Text>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text size="lg">AGI - Agility</Text>
          <Text size="lg">{agi}</Text>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text size="lg">INT - Intelligence</Text>
          <Text size="lg">{int}</Text>
        </HStack>
      </VStack>
    </VStack>
  );
};
