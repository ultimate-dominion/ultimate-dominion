import { Box, Grid, useBreakpointValue } from '@chakra-ui/react';
import { BrowserRouter as Router } from 'react-router-dom';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import AppRoutes from './Routes';

export const App = (): JSX.Element => {
  const isMobile = useBreakpointValue({ base: true, lg: false });
  return (
    <Router>
      <Grid
        maxW="1800px"
        minHeight="100vh"
        px={{ base: 2, sm: 12, md: 20 }}
        templateColumns="100%"
        templateRows="auto 1fr auto"
      >
        <Header />
        <AppRoutes />
        {isMobile ? (
          <Box as="header" bgColor="grey300" mb={8} h={8} />
        ) : (
          <Footer />
        )}
      </Grid>
    </Router>
  );
};

export default App;
