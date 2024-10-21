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
    <Box fontSize="10px" mt={8} position="relative" w="100%" {...props}>
      {maxed ? (
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
          <Progress h={2} value={100} variant="maxed" />
          <HStack mt={1}>
            <Spacer />
            <Text>Level {Number(currentLevel)}</Text>
          </HStack>
        </Box>
      ) : (
        <Box>
          <Text
            color={levelPercent === 100 ? 'green' : 'grey500'}
            fontWeight={levelPercent === 100 ? 'bold' : 'normal'}
            position="absolute"
            right={95 - levelPercent - 2 + '%'}
            top="-15px"
          >
            {levelPercent.toFixed(2)}%
          </Text>
          <Text
            color="grey500"
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
            <Text>Level {currentLevel.toString()}</Text>
            <Spacer />
            <Text>Level {Number(currentLevel) + 1}</Text>
          </HStack>
        </Box>
      )}
    </Box>
  );
};
