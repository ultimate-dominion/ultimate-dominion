import { Grid, GridItem } from '@chakra-ui/react';

import { Monsters } from './Monsters';
import { Players } from './Players';
import { SafeZone } from './SafeZone';

export const TileDetailsPanel = (): JSX.Element => {
  return (
    <Grid h="100%" templateColumns="repeat(4, 1fr)" gap={5}>
      <GridItem colSpan={2}>
        <Monsters />
      </GridItem>
      <GridItem colSpan={1}>
        <Players />
      </GridItem>
      <GridItem colSpan={1}>
        <SafeZone />
      </GridItem>
    </Grid>
  );
};
