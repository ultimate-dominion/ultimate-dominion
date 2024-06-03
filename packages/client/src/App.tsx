import { Grid, GridItem } from '@chakra-ui/react';

import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Welcome } from './components/Welcome';
        
import AppRoutes from './Routes';

export const App = (): JSX.Element => {
  return (
    <Grid minH="100vh" padding="10px" templateRows="repeat(6, 1fr)">
      <GridItem as="header" rowSpan={1}>
        <Header></Header>
      </GridItem>
      <GridItem rowSpan={4}>
        <AppRoutes />
      </GridItem>
      <GridItem position="relative" rowSpan={1}>
        <Footer></Footer>
      </GridItem>
    </Grid>
  );

};

export default App;
