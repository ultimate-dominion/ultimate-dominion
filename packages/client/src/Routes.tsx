import { Progress, Text, VStack } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { SyncStep } from '@latticexyz/store-sync';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import React, { Component, ReactNode, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { useMUD } from './contexts/MUDContext';

// Auto-reload on stale chunk after deploy. If a lazy import fails (old chunk
// hash no longer exists), reload the page once to get fresh HTML with new hashes.
function lazyWithReload<T extends React.ComponentType>(
  factory: () => Promise<{ default: T }>,
) {
  return React.lazy(() =>
    factory().catch(() => {
      const reloaded = sessionStorage.getItem('chunk-reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk-reload', '1');
        window.location.reload();
      }
      // Clear flag on successful load so future deploys also get retried
      sessionStorage.removeItem('chunk-reload');
      return factory();
    }),
  );
}

// Error boundary that catches chunk load failures React.lazy can't recover from
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    const reloaded = sessionStorage.getItem('chunk-reload');
    if (!reloaded) {
      sessionStorage.setItem('chunk-reload', '1');
      window.location.reload();
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <VStack justify="center" h="100%">
          <Text>Updating... please refresh if this persists.</Text>
        </VStack>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded page components — each gets its own chunk
const CharacterPage = lazyWithReload(() =>
  import('./pages/Character').then(m => ({ default: m.CharacterPage })),
);
const CharacterCreation = lazyWithReload(() =>
  import('./pages/CharacterCreation').then(m => ({ default: m.CharacterCreation })),
);
const GameBoard = lazyWithReload(() =>
  import('./pages/GameBoard').then(m => ({ default: m.GameBoard })),
);
const Leaderboard = lazyWithReload(() =>
  import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })),
);
const Marketplace = lazyWithReload(() =>
  import('./pages/Marketplace').then(m => ({ default: m.Marketplace })),
);
const MarketplaceItem = lazyWithReload(() =>
  import('./pages/MarketplaceItem').then(m => ({ default: m.MarketplaceItem })),
);
const Shop = lazyWithReload(() =>
  import('./pages/Shop').then(m => ({ default: m.Shop })),
);
const Welcome = lazyWithReload(() =>
  import('./pages/Welcome').then(m => ({ default: m.Welcome })),
);
const Manifesto = lazyWithReload(() =>
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
    syncProgress.percentage < 100 &&
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
    <ChunkErrorBoundary>
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
    </ChunkErrorBoundary>
  );
};

export default AppRoutes;
