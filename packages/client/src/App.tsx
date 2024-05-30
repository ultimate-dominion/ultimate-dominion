import { Box } from '@chakra-ui/react';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Welcome } from './components/Welcome';

export const App = (): JSX.Element => {
  return (
    <Box>
      <Header></Header>
      <Welcome />
      <Footer></Footer>
    </Box>
  );
};
