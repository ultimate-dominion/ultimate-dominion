import {
  Box,
  Button,
  Grid,
  GridItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
  VStack,
} from '@chakra-ui/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletClient } from 'wagmi';

import { ActionsPanel } from '../components/ActionsPanel';
import { MapPanel } from '../components/MapPanel';
import { StatsPanel } from '../components/StatsPanel';
import { TileDetailsPanel } from '../components/TileDetailsPanel';
import { useCharacter } from '../contexts/CharacterContext';
import { MapNavigationProvider } from '../contexts/MapNavigationContext';
import { useMUD } from '../contexts/MUDContext';
import { GAME_BOARD_PATH, HOME_PATH } from '../Routes';

export const GameBoard = (): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();
  const navigate = useNavigate();
  const { delegatorAddress, isSynced } = useMUD();
  const { character } = useCharacter();

  useEffect(() => {
    if (!externalWalletClient) {
      navigate(HOME_PATH);
    }

    if (isSynced && !delegatorAddress) {
      navigate(HOME_PATH);
    }

    if (character?.locked) {
      navigate(GAME_BOARD_PATH);
    }
  }, [character, delegatorAddress, externalWalletClient, isSynced, navigate]);

  return (
    <MapNavigationProvider>
      <Grid
        gap={2}
        h={{ base: 'calc(100vh - 100px)', lg: 'calc(100vh - 100px)' }}
        mt={4}
        templateColumns={{ base: '1fr', lg: 'repeat(16, 1fr)' }}
        templateRows={{ base: 'repeat(12, 1fr)', lg: 'repeat(12, 1fr)' }}
      >
        <GridItem
          border="2px solid"
          colSpan={{ base: 1, lg: 4 }}
          display={{ base: 'none', lg: 'block' }}
          overflowY="auto"
          p={4}
          rowSpan={{ base: 12, lg: 12 }}
        >
          <StatsPanel />
        </GridItem>
        <GridItem
          border="2px solid"
          colSpan={{ base: 1, lg: 8 }}
          colStart={{ base: 0, lg: 5 }}
          overflowY="auto"
          p={{ base: 2, lg: 4 }}
          pos="relative"
          rowSpan={{ base: 3, lg: 6 }}
          rowStart={{ base: 0, lg: 0 }}
        >
          <TileDetailsPanel />
        </GridItem>
        <GridItem
          border="2px solid"
          colSpan={{ base: 1, lg: 8 }}
          colStart={{ base: 0, lg: 5 }}
          overflowY="auto"
          p={{ base: 2, lg: 4 }}
          rowSpan={{ base: 4, lg: 6 }}
          rowStart={{ base: 4, lg: 7 }}
        >
          <ActionsPanel />
        </GridItem>
        <GridItem
          colSpan={{ base: 1, lg: 4 }}
          colStart={{ base: 0, lg: 13 }}
          rowSpan={{ base: 3, lg: 12 }}
          rowStart={{ base: 8, lg: 0 }}
        >
          <MapPanel />
        </GridItem>
        <Box
          bottom={2}
          display={{ base: 'block', lg: 'none' }}
          left="50%"
          pos="fixed"
          px={2}
          transform="translateX(-50%)"
          w="100%"
        >
          <Popover>
            <PopoverTrigger>
              <VStack>
                <Button size="sm" w="100%">
                  Stats
                </Button>
              </VStack>
            </PopoverTrigger>
            <PopoverContent p={4}>
              <StatsPanel />
            </PopoverContent>
          </Popover>
        </Box>
      </Grid>
    </MapNavigationProvider>
  );
};
