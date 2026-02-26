import {
  Box,
  BoxProps,
  HStack,
  Progress,
  Spacer,
  Text,
} from '@chakra-ui/react';

export const Level = ({
  currentLevel,
  levelPercent,
  maxed,
  ...props
}: {
  currentLevel: bigint;
  levelPercent: number;
  maxed: boolean;
} & BoxProps): JSX.Element => {

  return (
    <Box fontSize="xs" position="relative" w="100%" {...props}>
      {maxed ? (
        <Box>
          <HStack mb={1}>
            <Spacer />
            <Text color="purple" fontWeight="bold">MAX</Text>
          </HStack>
          <Progress h={2.5} value={100} variant="maxed" />
          <HStack mt={1}>
            <Spacer />
            <Text fontWeight={600}>Level {Number(currentLevel)}</Text>
          </HStack>
        </Box>
      ) : (
        <Box>
          <HStack mb={1}>
            <Text color="#8A7E6A" fontWeight={600}>
              Level {currentLevel.toString()}
            </Text>
            <Spacer />
            <Text color="#5A5040" fontWeight={600}>
              Level {Number(currentLevel) + 1}
            </Text>
          </HStack>
          <Progress
            h={2.5}
            value={levelPercent}
            variant={levelPercent === 100 ? 'filled' : 'filling'}
          />
        </Box>
      )}
    </Box>
  );
};
