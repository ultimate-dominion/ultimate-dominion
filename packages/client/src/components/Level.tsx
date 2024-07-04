import { Box, HStack, Progress, Spacer, Text } from '@chakra-ui/react';

const CURRENT_LEVEL = 1;

export const Level = ({
  levelPercent,
}: {
  levelPercent: number;
}): JSX.Element => {
  return (
    <Box fontSize="10px" mt={8} position="relative" w="100%">
      <Text
        position="absolute"
        right={100 - levelPercent - 2 + '%'}
        top="-15px"
      >
        {levelPercent}%
      </Text>
      <Text
        display={levelPercent > 90 ? 'none' : 'block'}
        position="absolute"
        right="0%"
        top="-15px"
      >
        100%
      </Text>
      <Progress h={2} value={levelPercent} />
      <HStack mt={1}>
        <Text>Level {CURRENT_LEVEL}</Text>
        <Spacer />
        <Text>Level {CURRENT_LEVEL + 1}</Text>
      </HStack>
    </Box>
  );
};
