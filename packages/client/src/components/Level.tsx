import { Box, HStack, Progress, Spacer, Text } from '@chakra-ui/react';

export const Level = ({
  currentLevel,
  levelPercent,
}: {
  currentLevel: bigint;
  levelPercent: number;
}): JSX.Element => {
  return (
    <Box fontSize="10px" mt={8} position="relative" w="100%">
      <Text
        color={levelPercent === 100 ? 'green' : 'black'}
        fontWeight={levelPercent === 100 ? 'bold' : 'normal'}
        position="absolute"
        right={100 - levelPercent - 2 + '%'}
        top="-15px"
      >
        {levelPercent.toFixed(2)}%
      </Text>
      <Text
        display={levelPercent > 90 ? 'none' : 'block'}
        position="absolute"
        right="0%"
        top="-15px"
      >
        100%
      </Text>
      <Progress
        h={2}
        variant={levelPercent === 100 ? 'filled' : 'filling'}
        value={levelPercent}
      />
      <HStack mt={1}>
        <Text>Level {currentLevel.toString()}</Text>
        <Spacer />
        <Text>Level {Number(currentLevel) + 1}</Text>
      </HStack>
    </Box>
  );
};
