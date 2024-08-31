import { Progress, Text, VStack } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { Route, Routes, useLocation } from 'react-router-dom';

import { useMUD } from './contexts/MUDContext';
import { AuctionHouse } from './pages/AuctionHouse';
import { AuctionItem } from './pages/AuctionItem';
import { CharacterPage } from './pages/Character';
import { CharacterCreation } from './pages/CharacterCreation';
import { GameBoard } from './pages/GameBoard';
import { Leaderboard } from './pages/Leaderboard';
import { Shop } from './pages/Shop';
import { Welcome } from './pages/Welcome';

export const HOME_PATH = '/';
export const CHARACTER_CREATION_PATH = '/character-creation';
export const GAME_BOARD_PATH = '/game-board';
export const LEADERBOARD_PATH = '/leaderboard';
export const AUCTION_HOUSE_PATH = '/auction-house';
export const ITEM_PATH = AUCTION_HOUSE_PATH + '/items/';
export const SHOP_PATH = '/shops/';

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
        <Text>Loading {Math.round(syncProgress.percentage)}%</Text>
        <Progress
          value={Math.round(syncProgress.percentage)}
          w={{ base: '80%', sm: '50%' }}
        />
      </VStack>
    );
  }

  return (
    <Routes>
      <Route path={HOME_PATH} element={<Welcome />} />
      <Route path={CHARACTER_CREATION_PATH} element={<CharacterCreation />} />
      <Route path={GAME_BOARD_PATH} element={<GameBoard />} />
      <Route path="/characters/:id" element={<CharacterPage />} />
      <Route path={LEADERBOARD_PATH} element={<Leaderboard />} />
      <Route path={AUCTION_HOUSE_PATH} element={<AuctionHouse />} />
      <Route path={ITEM_PATH + ':itemId'} element={<AuctionItem />} />
      <Route path={SHOP_PATH} element={<Shop />} />
    </Routes>
  );
};

export default AppRoutes;
