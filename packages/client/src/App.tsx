import {
  Box,
  Button,
  Grid,
  ScaleFade,
  useBreakpointValue,
} from '@chakra-ui/react';
import { garnet } from '@latticexyz/common/chains';
import { createClient as createFaucetClient } from '@latticexyz/faucet';
import { useEffect } from 'react';
import { IoChatbubble } from 'react-icons/io5';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { parseEther } from 'viem';
import { useWalletClient } from 'wagmi';

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
import { IS_CHAT_BOX_OPEN_KEY } from './utils/constants';

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
  const { data: externalWalletClient } = useWalletClient();
  const {
    burnerBalance,
    burnerBalanceFetched,
    isSynced,
    isWalletDetailsModalOpen,
    network,
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

  useEffect(() => {
    if (DEFAULT_CHAIN_ID === garnet.id && externalWalletClient) {
      const address = externalWalletClient.account?.address;

      if (!address) return;

      // eslint-disable-next-line no-console
      console.info('[Dev Faucet]: External address -> ', address);
      const faucetClient = createFaucetClient({
        url: 'https://ultimate-dominion-faucet.onrender.com/trpc',
      });
      const requestDrip = async () => {
        const balance = await network.publicClient.getBalance({
          address,
        });
        // eslint-disable-next-line no-console
        console.info(`[Dev Faucet]: External balance -> ${balance}`);
        const lowBalance = balance < parseEther('0.00001');
        if (lowBalance) {
          // eslint-disable-next-line no-console
          console.info(
            '[Dev Faucet]: Balance is low, dripping funds to external wallet',
          );
          await faucetClient.drip.mutate({
            address,
          });
        }
      };
      requestDrip();
      // Request a drip every 20 seconds
      setInterval(requestDrip, 20000);
    }
  }, [externalWalletClient, network]);

  useEffect(() => {
    const isChatBoxOpen = localStorage.getItem(IS_CHAT_BOX_OPEN_KEY);

    if (CHAT_NOT_ALLOWED_PATHS.includes(pathname)) return;

    if (!isChatBoxOpen || isChatBoxOpen === 'true') {
      localStorage.setItem(IS_CHAT_BOX_OPEN_KEY, 'true');
      onOpenChatBox();
    }
  }, [pathname, onOpenChatBox]);

  return (
    <Grid
      minHeight="100vh"
      templateColumns="100%"
      templateRows="auto 1fr auto"
      w="100%"
    >
      <Header onOpenWalletDetailsModal={onOpenWalletDetailsModal} />
      <Box
        m="0 auto"
        maxW="1800px"
        my={{ base: 4, lg: 12 }}
        px={{ base: 2, sm: 12, md: 20 }}
        w="100%"
      >
        <AppRoutes />
      </Box>
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
            bottom={isChatBoxOpen ? { base: 2, lg: 6 } : { base: -1 }}
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
