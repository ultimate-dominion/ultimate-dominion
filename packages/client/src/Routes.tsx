import { Text, VStack } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { Route, Routes, useLocation } from 'react-router-dom';

import { useMUD } from './contexts/MUDContext';
import { AuctionHouse } from './pages/AuctionHouse';
import { AuctionHouseItem } from './pages/AuctionHouseItem';
import { CharacterPage } from './pages/Character';
import { CharacterCreation } from './pages/CharacterCreation';
import { GameBoard } from './pages/GameBoard';
import { Leaderboard } from './pages/Leaderboard';
import { Welcome } from './pages/Welcome';

export const HOME_PATH = '/';
export const CHARACTER_CREATION_PATH = '/character-creation';
export const GAME_BOARD_PATH = '/game-board';
export const LEADERBOARD_PATH = '/leaderboard';
export const AUCTION_HOUSE_PATH = '/auction';
const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  const {
    components: { SyncProgress },
  } = useMUD();

  const syncProgress = useComponentValue(SyncProgress, singletonEntity);

  if (
    syncProgress &&
    syncProgress.step !== SyncStep.LIVE &&
    pathname !== HOME_PATH
  ) {
    return (
      <VStack justify="center" h="100%">
        <Text>
          {syncProgress.message} {Math.round(syncProgress.percentage)}%
        </Text>
      </VStack>
    );
  }

  return (
    <Routes>
      <Route path={HOME_PATH} element={<Welcome />} />
      <Route path={CHARACTER_CREATION_PATH} element={<CharacterCreation />} />
      <Route path={GAME_BOARD_PATH} element={<GameBoard />} />
      <Route path="/characters/:characterId" element={<CharacterPage />} />
      <Route path={LEADERBOARD_PATH} element={<Leaderboard />} />
      <Route path={AUCTION_HOUSE_PATH} element={<AuctionHouse />} />
      <Route path="/item/:itemId" element={<AuctionHouseItem />} />
    </Routes>
  );
};

export default AppRoutes;
