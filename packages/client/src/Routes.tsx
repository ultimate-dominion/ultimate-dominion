import { Text, VStack } from '@chakra-ui/react';
import React, { Component, ReactNode, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { BootScreen } from './components/BootScreen';
import { SHOW_Z2 } from './lib/env';

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
const Respec = lazyWithReload(() =>
  import('./pages/Respec').then(m => ({ default: m.Respec })),
);
const Welcome = lazyWithReload(() =>
  import('./pages/Welcome').then(m => ({ default: m.Welcome })),
);
const Manifesto = lazyWithReload(() =>
  import('./pages/Manifesto').then(m => ({ default: m.Manifesto })),
);
const Guide = lazyWithReload(() =>
  import('./pages/Tavern').then(m => ({ default: m.Tavern })),
);
const WaitingRoom = lazyWithReload(() =>
  import('./pages/WaitingRoom').then(m => ({ default: m.WaitingRoom })),
);
const Privacy = lazyWithReload(() =>
  import('./pages/Privacy').then(m => ({ default: m.Privacy })),
);
const Terms = lazyWithReload(() =>
  import('./pages/Terms').then(m => ({ default: m.Terms })),
);
const FAQ = lazyWithReload(() =>
  import('./pages/FAQ').then(m => ({ default: m.FAQ })),
);
const ClassPage = lazyWithReload(() =>
  import('./pages/ClassPage').then(m => ({ default: m.ClassPage })),
);
const Guild = lazyWithReload(() =>
  import('./pages/Guild').then(m => ({ default: m.Guild })),
);
const PretextLab = lazyWithReload(() =>
  import('./pages/PretextLab').then(m => ({ default: m.PretextLab })),
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
export const GUIDE_PATH = '/guide';
export const CLASS_PAGE_PATH = '/guide/classes';
export const WAITING_ROOM_PATH = '/waiting-room';
export const PRIVACY_PATH = '/privacy';
export const TERMS_PATH = '/terms';
export const FAQ_PATH = '/faq';
export const GUILD_PATH = '/guild';
export const RESPEC_PATH = '/respec';
export const PRETEXT_LAB_PATH = '/pretext-lab';
export const BLOG_URL = 'https://ultimatedominion.com/blog';
export const TAVERN_URL = 'https://tavern.ultimatedominion.com';

const ExternalRedirect = ({ to }: { to: string }) => {
  useEffect(() => { window.location.href = to; }, [to]);
  return null;
};

// Suspense fallback for AppRoutes. On /game-board we render the full dark
// BootScreen (position:fixed, zIndex 9999) so the one-render-tick where
// React.lazy throws-to-Suspense on first encounter is visually identical to
// the AppInner boot gate — no flash to the orange app shell with "Loading...".
// Other routes fall through to the in-grid VStack.
const RoutesFallback = () => {
  const { pathname } = useLocation();
  if (pathname === GAME_BOARD_PATH) {
    return (
      <BootScreen
        body="Rebuilding the world state..."
        eyebrow="Entering The Realm"
      />
    );
  }
  return (
    <VStack justify="center" h="100%">
      <Text>Loading...</Text>
    </VStack>
  );
};

const AppRoutes: React.FC = () => {
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
          {SHOW_Z2 && <Route path={GUILD_PATH} element={<Guild />} />}
          {SHOW_Z2 && <Route path={RESPEC_PATH} element={<Respec />} />}
          {SHOW_Z2 && <Route path={PRETEXT_LAB_PATH} element={<PretextLab />} />}
          <Route path={MARKETPLACE_PATH} element={<Marketplace />} />
          <Route path={ITEM_PATH + '/:itemId'} element={<MarketplaceItem />} />
          <Route path={SHOP_PATH + '/:shopId'} element={<Shop />} />
          <Route path={GUIDE_PATH} element={<Guide />} />
          <Route path={CLASS_PAGE_PATH + '/:className'} element={<ClassPage />} />
          <Route path={WAITING_ROOM_PATH} element={<WaitingRoom />} />
          <Route path={PRIVACY_PATH} element={<Privacy />} />
          <Route path={TERMS_PATH} element={<Terms />} />
          <Route path={FAQ_PATH} element={<FAQ />} />
          <Route path="/tavern" element={<ExternalRedirect to={TAVERN_URL} />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
};

export default AppRoutes;
