import { Grid, useBreakpointValue, useDisclosure } from '@chakra-ui/react';
import { useEffect } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { WalletDetailsModal } from './components/WalletDetailsModal';
import { useMUD } from './contexts/MUDContext';
import AppRoutes, { HOME_PATH } from './Routes';

export const App = (): JSX.Element => {
  return (
    <Router>
      <AppInner />
    </Router>
  );
};

export default App;

const AppInner = (): JSX.Element => {
  const { pathname } = useLocation();
  const isDesktop = useBreakpointValue({ base: false, lg: true });
  const { burnerBalance, burnerBalanceFetched, isSynced } = useMUD();

  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    if (pathname === HOME_PATH) return;

    if (burnerBalanceFetched && burnerBalance === '0' && isSynced) {
      onOpen();
    }
  }, [burnerBalance, burnerBalanceFetched, isSynced, pathname, onOpen]);

  return (
    <Grid
      maxW="1800px"
      minHeight="100vh"
      px={{ base: 2, sm: 12, md: 20 }}
      templateColumns="100%"
      templateRows="auto 1fr auto"
    >
      <Header onOpenWalletDetailsModal={onOpen} />
      <AppRoutes />
      {isDesktop && <Footer />}
      <WalletDetailsModal isOpen={isOpen} onClose={onClose} />
    </Grid>
  );
};
