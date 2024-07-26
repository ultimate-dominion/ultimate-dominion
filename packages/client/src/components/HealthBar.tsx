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
      <Flex
        border="2px solid black"
        width="100%"
        h={{ base: '18px', md: '24px' }}
      >
        <Text
          bgColor="black"
          color="white"
          fontWeight={700}
          px={{ base: 1, md: 2 }}
          size={{ base: '2xs', md: 'xs' }}
        >
          HP
        </Text>
        <Box borderLeft="2px solid black" h="100%" position="relative" w="100%">
          <Box
            bgColor={barColor}
            h="100%"
            transition="all 0.5s"
            w={`${health}%`}
          />
        </Box>
      </Flex>
      <Text fontWeight={700} size={{ base: '2xs', md: 'xs' }}>
        {currentHp} / {baseHp}
      </Text>
    </VStack>
  );
};
