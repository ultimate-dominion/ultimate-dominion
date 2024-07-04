import { Box, Button, HStack, Spacer, Text, VStack } from '@chakra-ui/react';
import { useMemo } from 'react';

import { Level } from '../Level';

export const Misc = ({
  experience,
  isPlayer,
  max,
  goldBalance,
}: {
  experience: string;
  isPlayer: boolean;
  max: string;
  goldBalance: string;
}): JSX.Element => {
  const levelPercent = useMemo(() => {
    return (100 * Number(experience)) / Number(max);
  }, [experience, max]);

  return (
    <VStack h="100%">
      <Box w="100%">
        <HStack alignItems="start">
          <Box>
            <Text fontWeight="bold">
              {Number(goldBalance).toLocaleString('en', { useGrouping: true })}{' '}
              $GOLD
            </Text>
            <Text>
              {experience}/{max}
            </Text>
          </Box>
          <Spacer />
          <Text fontWeight="bold">Level 1</Text>
        </HStack>
        <Level levelPercent={levelPercent} />
      </Box>

      <Spacer />
      <Box alignSelf="start" w="100%">
        <Button m={'5px 0'} w="100%">
          {isPlayer ? 'Auction House' : 'Chat'}
        </Button>
        <Button m={'5px 0'} w="100%">
          Leader Board
        </Button>
      </Box>
    </VStack>
  );
};
