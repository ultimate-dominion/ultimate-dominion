import { Progress, Text, VStack } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import React, { Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { useMUD } from './contexts/MUDContext';

// Lazy-loaded page components — each gets its own chunk
const CharacterPage = React.lazy(() =>
  import('./pages/Character').then(m => ({ default: m.CharacterPage })),
);
const CharacterCreation = React.lazy(() =>
  import('./pages/CharacterCreation').then(m => ({ default: m.CharacterCreation })),
);
const GameBoard = React.lazy(() =>
  import('./pages/GameBoard').then(m => ({ default: m.GameBoard })),
);
const Leaderboard = React.lazy(() =>
  import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })),
);
const Marketplace = React.lazy(() =>
  import('./pages/Marketplace').then(m => ({ default: m.Marketplace })),
);
const MarketplaceItem = React.lazy(() =>
  import('./pages/MarketplaceItem').then(m => ({ default: m.MarketplaceItem })),
);
const Shop = React.lazy(() =>
  import('./pages/Shop').then(m => ({ default: m.Shop })),
);
const Welcome = React.lazy(() =>
  import('./pages/Welcome').then(m => ({ default: m.Welcome })),
);
const Manifesto = React.lazy(() =>
  import('./pages/Manifesto').then(m => ({ default: m.Manifesto })),
);

export const HOME_PATH = '/';
export const MANIFESTO_PATH = '/manifesto';
export const CHARACTER_CREATION_PATH = '/character-creation';
export const GAME_BOARD_PATH = '/game-board';
export const CHARACTERS_PATH = '/characters';
export const LEADERBOARD_PATH = '/leaderboard';
export const MARKETPLACE_PATH = '/marketplace';
export const ITEM_PATH = MARKETPLACE_PATH + '/items';
export const SHOP_PATH = '/shops';

const RoutesFallback = () => (
  <VStack justify="center" h="100%">
    <Text>Loading...</Text>
  </VStack>
);

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
    <Suspense fallback={<RoutesFallback />}>
      <Routes>
        <Route path={HOME_PATH} element={<Welcome />} />
        <Route path={MANIFESTO_PATH} element={<Manifesto />} />
        <Route path={CHARACTER_CREATION_PATH} element={<CharacterCreation />} />
        <Route path={GAME_BOARD_PATH} element={<GameBoard />} />
        <Route path={CHARACTERS_PATH + '/:id'} element={<CharacterPage />} />
        <Route path={LEADERBOARD_PATH} element={<Leaderboard />} />
        <Route path={MARKETPLACE_PATH} element={<Marketplace />} />
        <Route path={ITEM_PATH + '/:itemId'} element={<MarketplaceItem />} />
        <Route path={SHOP_PATH + '/:shopId'} element={<Shop />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
