import { Box, Flex, StackProps, Text, VStack } from '@chakra-ui/react';

export const HealthBar = ({
  currentHp,
  baseHp,
  ...stackProps
}: {
  currentHp: string;
  baseHp: string;
} & StackProps): JSX.Element => {
  const health = (parseInt(currentHp) / parseInt(baseHp)) * 100;

  const barColor = health > 50 ? 'green' : health > 15 ? 'yellow' : 'red';

  return (
    <VStack alignItems="end" spacing={0.5} {...stackProps}>
      <Flex border="2px solid black" width="100%" height="24px">
        <Text
          bgColor="black"
          color="white"
          fontSize="sm"
          fontWeight={700}
          px={2}
        >
          HP
        </Text>
        <Box borderLeft="2px solid black" h="100%" position="relative" w="100%">
          <Box bgColor={barColor} h="100%" w={`${health}%`} />
        </Box>
      </Flex>
      <Text fontSize="xs" fontWeight={700}>
        {currentHp} / {baseHp}
      </Text>
    </VStack>
  );
};
