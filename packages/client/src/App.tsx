import {
  Box,
  Button,
  Grid,
  ScaleFade,
  useBreakpointValue,
} from '@chakra-ui/react';
import { garnet } from '@latticexyz/common/chains';
import { useEffect } from 'react';
import { IoChatbubble } from 'react-icons/io5';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';

import { ChatBox } from './components/ChatBox';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { WalletDetailsModal } from './components/WalletDetailsModal';
import { BattleProvider } from './contexts/BattleContext';
import { ChatProvider, useChat } from './contexts/ChatContext';
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
          <ChatProvider>
            <MovementProvider>
              <AppInner />
            </MovementProvider>
          </ChatProvider>
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
  const { isOpen: isChatBoxOpen, onOpen: onOpenChatBox } = useChat();

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
        <>
          <Box
            bottom={{ base: 2, lg: 6 }}
            position="fixed"
            right={{ base: 2, lg: 6 }}
          >
            <ScaleFade initialScale={0.9} in={!isChatBoxOpen}>
              <Button
                onClick={onOpenChatBox}
                opacity={isChatBoxOpen ? 0 : 1}
                px={4}
                py={{ base: 5, lg: 6 }}
                transition="opacity 0.3s ease"
              >
                <IoChatbubble size={isDesktop ? 28 : 24} />
              </Button>
            </ScaleFade>
          </Box>
          <Box
            bottom={{ base: 2, lg: 6 }}
            position="fixed"
            right={{ base: 2, lg: 6 }}
          >
            <ChatBox />
          </Box>
        </>
      )}

      <WalletDetailsModal
        isOpen={isWalletDetailsModalOpen}
        onClose={onCloseWalletDetailsModal}
      />
    </Grid>
  );
};
