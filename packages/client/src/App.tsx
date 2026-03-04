import {
  Box,
  Button,
  Grid,
  ScaleFade,
  useBreakpointValue,
  useDisclosure,
} from '@chakra-ui/react';
import { useEffect } from 'react';
import { IoChatbubble } from 'react-icons/io5';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';

import { ChatBox } from './components/ChatBox';
import { Footer } from './components/Footer';
import { GoldMerchantModal } from './components/GoldMerchantModal';
import { Header } from './components/Header';
import { OutOfResourcesModal } from './components/OutOfResourcesModal';
import { WalletDetailsModal } from './components/WalletDetailsModal';
import { useAuth } from './contexts/AuthContext';
import { BattleProvider } from './contexts/BattleContext';
import { useCharacter } from './contexts/CharacterContext';
import { ChatProvider, useChat } from './contexts/ChatContext';
import { FragmentProvider } from './contexts/FragmentContext';
import {
  GoldMerchantProvider,
  useGoldMerchant,
} from './contexts/GoldMerchantContext';
import { MapProvider, useMap } from './contexts/MapContext';
import { MovementProvider } from './contexts/MovementContext';
import { useMUD } from './contexts/MUDContext';
import { useGasStation } from './hooks/useGasStation';
import AppRoutes, { CHARACTER_CREATION_PATH, HOME_PATH } from './Routes';
import { IS_CHAT_BOX_OPEN_KEY } from './utils/constants';

export const App = (): JSX.Element => {
  return (
    <Router>
      <MapProvider>
        <BattleProvider>
          <ChatProvider>
            <MovementProvider>
              <FragmentProvider>
                <GoldMerchantProvider>
                  <AppInner />
                </GoldMerchantProvider>
              </FragmentProvider>
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
  const { authMethod } = useAuth();
  const {
    burnerBalance,
    burnerBalanceFetched,
    isSynced,
    isWalletDetailsModalOpen,
    onCloseWalletDetailsModal,
    onOpenWalletDetailsModal,
  } = useMUD();
  const { isSpawned } = useMap();
  const { isOpen: isChatBoxOpen, onOpen: onOpenChatBox, unreadCount } = useChat();
  const { character } = useCharacter();
  const {
    isOpen: isGoldMerchantOpen,
    onClose: onCloseGoldMerchant,
  } = useGoldMerchant();

  // Activate GasStation auto-swap hook
  useGasStation();

  // OutOfResources modal state (level 3+, 0 ETH, 0 Gold)
  const {
    isOpen: isOutOfResourcesOpen,
    onOpen: onOpenOutOfResources,
    onClose: onCloseOutOfResources,
  } = useDisclosure();

  useEffect(() => {
    if (pathname === HOME_PATH) return;
    if (!burnerBalanceFetched || !isSynced) return;

    // Embedded users: gas is fully sponsored (EIP-7702) — never show modals
    if (authMethod === 'embedded') return;

    // External users: show wallet modal if balance is 0
    if (burnerBalance === '0') {
      // Level 3+ with no Gold either → OutOfResources modal instead
      if (
        character &&
        character.level >= 3n &&
        character.externalGoldBalance === 0n
      ) {
        onOpenOutOfResources();
      } else {
        onOpenWalletDetailsModal();
      }
    }
  }, [
    authMethod,
    burnerBalance,
    burnerBalanceFetched,
    character,
    isSynced,
    onOpenOutOfResources,
    onOpenWalletDetailsModal,
    pathname,
  ]);

  useEffect(() => {
    if (!isSpawned) return;
    if (CHAT_NOT_ALLOWED_PATHS.includes(pathname)) return;
    // Only auto-open on desktop (inline chat). On mobile, let user tap the button
    // so unread badge can show new messages.
    if (!isDesktop) return;

    const isChatBoxOpen = localStorage.getItem(IS_CHAT_BOX_OPEN_KEY);
    if (!isChatBoxOpen || isChatBoxOpen === 'true') {
      localStorage.setItem(IS_CHAT_BOX_OPEN_KEY, 'true');
      onOpenChatBox();
    }
  }, [isDesktop, isSpawned, onOpenChatBox, pathname]);

  return (
    <Grid
      minHeight="100vh"
      templateColumns="100%"
      templateRows="auto 1fr auto"
      w="100%"
    >
      <Header />
      <Box
        m="0 auto"
        maxW="1800px"
        my={{ base: 4, lg: 12 }}
        px={{ base: 2, sm: 12, md: 20 }}
        w="100%"
      >
        <AppRoutes />
      </Box>
      {isDesktop && pathname !== HOME_PATH && <Footer />}
      {!CHAT_NOT_ALLOWED_PATHS.includes(pathname) && !isDesktop && (
        <>
          <Box
            bottom={2}
            position="fixed"
            right={2}
            zIndex={10}
          >
            <ScaleFade initialScale={0.9} in={!isChatBoxOpen}>
              <Button
                onClick={onOpenChatBox}
                opacity={isChatBoxOpen ? 0 : 1}
                position="relative"
                px={4}
                py={5}
                transition="opacity 0.3s ease"
              >
                <IoChatbubble size={24} />
                {unreadCount > 0 && (
                  <Box
                    alignItems="center"
                    bg="red.500"
                    borderRadius="full"
                    color="white"
                    display="flex"
                    fontSize="xs"
                    fontWeight="bold"
                    h={5}
                    justifyContent="center"
                    position="absolute"
                    right="-1"
                    top="-1"
                    w={5}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Box>
                )}
              </Button>
            </ScaleFade>
          </Box>
          <Box
            bottom={isChatBoxOpen ? 2 : -1}
            position="fixed"
            right={2}
            zIndex={10}
          >
            <ChatBox />
          </Box>
        </>
      )}

      <WalletDetailsModal
        isOpen={isWalletDetailsModalOpen}
        onClose={onCloseWalletDetailsModal}
      />

      <OutOfResourcesModal
        isOpen={isOutOfResourcesOpen}
        onClose={onCloseOutOfResources}
        onOpenWalletDetails={onOpenWalletDetailsModal}
      />

      <GoldMerchantModal
        isOpen={isGoldMerchantOpen}
        onClose={onCloseGoldMerchant}
      />
    </Grid>
  );
};
