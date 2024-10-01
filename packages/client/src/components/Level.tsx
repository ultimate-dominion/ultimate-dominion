import { Box, HStack, Progress, Spacer, Text } from '@chakra-ui/react';
export const Level = ({
  currentLevel,
  levelPercent,
  maxLevelXpRequirement,
  maxxed,
}: {
  currentLevel: string;
  levelPercent: number;
  maxLevelXpRequirement: bigint;
  maxxed: boolean;
}): JSX.Element => {
  return (
    <Box fontSize="10px" mt={8} position="relative" w="100%">
      {!maxxed ? (
        <Box>
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
            value={levelPercent}
            variant={levelPercent === 100 ? 'filled' : 'filling'}
          />
          <HStack mt={1}>
            <Text>Level {currentLevel}</Text>
            <Spacer />
            <Text>Level {Number(currentLevel) + 1}</Text>
          </HStack>
        </Box>
      ) : (
        <Box>
          <Text
            color="purple"
            fontWeight="bold"
            position="absolute"
            right="-2%"
            top="-15px"
          >
            MAX
          </Text>
          <Text display="none" position="absolute" right="0%" top="-15px">
            100%
          </Text>
          <Progress h={2} value={100} variant="maxxed" />
          <HStack mt={1}>
            <Spacer />
            <Text>Level {maxLevelXpRequirement.toString()}</Text>
          </HStack>
        </Box>
      )}
    </Box>
  );
};
