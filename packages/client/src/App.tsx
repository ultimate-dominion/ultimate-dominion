import { Grid } from '@chakra-ui/react';
import { BrowserRouter as Router } from 'react-router-dom';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import AppRoutes from './Routes';

export const App = (): JSX.Element => {
  return (
    <Router>
      <Grid
        maxW="1800px"
        minHeight="100vh"
        px={{ base: 8, sm: 12, md: 20 }}
        templateColumns="100%"
        templateRows="auto 1fr auto"
      >
        <Header />
        <AppRoutes />
        <Footer />
      </Grid>
    </Router>
  );
};

export default App;
