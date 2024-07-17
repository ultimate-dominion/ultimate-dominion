import { HStack, Text, VStack } from '@chakra-ui/react';

export const Stats = ({
  agility,
  baseHitPoints,
  currentHp,
  intelligence,
  strength,
}: {
  agility: string;
  baseHitPoints: string;
  currentHp: string;
  intelligence: string;
  strength: string;
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
          <Text size="lg">
            {currentHp}/{baseHitPoints}
          </Text>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text size="lg">STR - Strength</Text>
          <Text size="lg">{strength}</Text>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text size="lg">AGI - Agility</Text>
          <Text size="lg">{agility}</Text>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text size="lg">INT - Intelligence</Text>
          <Text size="lg">{intelligence}</Text>
        </HStack>
      </VStack>
    </VStack>
  );
};
