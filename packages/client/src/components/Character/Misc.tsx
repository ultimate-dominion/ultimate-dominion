import { Box, Button, HStack, Spacer, Text, VStack } from '@chakra-ui/react';

import { Level } from '../Level';

export const Misc = ({
  experience,
  isPlayer,
  max,
  gold,
}: {
  experience: number;
  isPlayer: boolean;
  max: number;
  gold: number;
}): JSX.Element => {
  return (
    <VStack h="100%">
      <Box w="100%">
        <HStack alignItems="start" padding="5px">
          <Box>
            <Text fontWeight="bold">
              {gold.toLocaleString('en', { useGrouping: true })} $GOLD
            </Text>
            <Text>
              {experience}/{max}
            </Text>
          </Box>
          <Spacer />
          <Text fontWeight="bold">Level 1</Text>
        </HStack>
        <Level experience={experience} max={max} />
      </Box>

      <Spacer />
      <Box alignSelf="start" w="100%">
        <Button margin="5px 0" w="100%">
          {isPlayer ? 'Auction House' : 'Chat'}
        </Button>
        <Button margin="5px 0" w="100%">
          Leader Board
        </Button>
      </Box>
    </VStack>
  );
};
