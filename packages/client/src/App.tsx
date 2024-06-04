import { Box } from '@chakra-ui/react';
import { BrowserRouter as Router } from 'react-router-dom';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import AppRoutes from './Routes';

export const App = (): JSX.Element => {
  return (
    <Router>
      <Box px={{ base: 8, sm: 12, md: 20 }}>
        <Header />
        <AppRoutes />
        <Footer />
      </Box>
    </Router>
  );
};

export default App;
