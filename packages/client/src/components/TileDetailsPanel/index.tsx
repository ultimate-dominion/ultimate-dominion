import { Box, HStack, Spacer } from '@chakra-ui/react';

import { Monsters } from './Monsters';
import { Players } from './Players';
import { SafeZone } from './SafeZone';

export const TileDetailsPanel = (): JSX.Element => {
  return (
    <Box h="100%">
      <HStack alignItems="start" h="100%" p={3}>
        <Monsters />
        <Spacer />
        <Players />
        <Spacer />
        <SafeZone />
      </HStack>
    </Box>
  );
};
