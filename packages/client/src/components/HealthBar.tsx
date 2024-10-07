import {
  Badge,
  Box,
  Flex,
  HStack,
  StackProps,
  Text,
  VStack,
} from '@chakra-ui/react';

export const HealthBar = ({
  maxHp,
  currentHp,
  level,
  statusEffect,
  ...stackProps
}: {
  maxHp: bigint;
  currentHp: bigint;
  level?: bigint;
  statusEffect?: string;
} & StackProps): JSX.Element => {
  const currentHpWithFloor = currentHp < BigInt(0) ? BigInt(0) : currentHp;
  const health =
    (Number(currentHpWithFloor.toString()) / Number(maxHp.toString())) * 100;

  const barColor = health > 50 ? 'green' : health > 15 ? 'yellow' : 'red';

  return (
    <VStack spacing={0.5} {...stackProps}>
      {!!level && (
        <Text
          alignSelf="start"
          fontWeight="bold"
          size={{ base: '3xs', md: '2xs' }}
        >
          Lvl {level.toString()}
        </Text>
      )}
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
      <HStack justify={statusEffect ? 'space-between' : 'end'} w="100%">
        {statusEffect && (
          <Badge bgColor="red" color="white" fontSize="2xs" size="xs">
            {statusEffect}
          </Badge>
        )}
        <Text fontWeight={700} size={{ base: '2xs', md: 'xs' }}>
          {currentHpWithFloor.toString()} / {maxHp.toString()}
        </Text>
      </HStack>
    </VStack>
  );
};
