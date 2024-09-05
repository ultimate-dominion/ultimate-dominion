import { Box, Grid, useBreakpointValue } from '@chakra-ui/react';
import { garnet } from '@latticexyz/common/chains';
import { useEffect } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';

import { ChatBox } from './components/ChatBox';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { WalletDetailsModal } from './components/WalletDetailsModal';
import { BattleProvider } from './contexts/BattleContext';
import { MapProvider } from './contexts/MapContext';
import { MovementProvider } from './contexts/MovementContext';
import { useMUD } from './contexts/MUDContext';
import { DEFAULT_CHAIN_ID } from './lib/web3';
import AppRoutes, { CHARACTER_CREATION_PATH, HOME_PATH } from './Routes';

export const App = (): JSX.Element => {
  return (
    <Router>
      <MapProvider>
        <BattleProvider>
          <MovementProvider>
            <AppInner />
          </MovementProvider>
        </BattleProvider>
      </MapProvider>
    </Router>
  );
};

export default App;

const CHAT_NOT_ALLOWED_PATHS = [CHARACTER_CREATION_PATH, HOME_PATH];

const AppInner = (): JSX.Element => {
  const { pathname } = useLocation();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const {
    burnerBalance,
    burnerBalanceFetched,
    isSynced,
    isWalletDetailsModalOpen,
    onCloseWalletDetailsModal,
    onOpenWalletDetailsModal,
  } = useMUD();

  useEffect(() => {
    if (pathname === HOME_PATH) return;

    if (
      burnerBalanceFetched &&
      burnerBalance === '0' &&
      isSynced &&
      DEFAULT_CHAIN_ID !== garnet.id
    ) {
      onOpenWalletDetailsModal();
    }
  }, [
    burnerBalance,
    burnerBalanceFetched,
    isSynced,
    onOpenWalletDetailsModal,
    pathname,
  ]);

  return (
    <Grid
      maxW="1800px"
      minHeight="100vh"
      px={{ base: 2, sm: 12, md: 20 }}
      templateColumns="100%"
      templateRows="auto 1fr auto"
    >
      <Header onOpenWalletDetailsModal={onOpenWalletDetailsModal} />
      <AppRoutes />
      {isDesktop && <Footer />}
      {!CHAT_NOT_ALLOWED_PATHS.includes(pathname) && (
        <Box bottom={6} position="fixed" right={6}>
          <ChatBox />
        </Box>
      )}

      <WalletDetailsModal
        isOpen={isWalletDetailsModalOpen}
        onClose={onCloseWalletDetailsModal}
      />
    </Grid>
  );
};
