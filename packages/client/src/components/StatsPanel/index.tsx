import { Spacer, VStack } from '@chakra-ui/react';

import { HealthPotion } from './HealthPotion';
import { Inventory } from './Inventory';
import { Level } from './Level';
import { Money } from './Money';
import { Navigation } from './Navigation';
import { Socials } from './Socials';
import { Stats } from './Stats';
import { TopBar } from './TopBar';

export const StatsPanel = (): JSX.Element => {
  return (
    <VStack h="100%">
      <TopBar />
      <Spacer />
      <Stats />
      <Spacer />
      <Level />
      <Spacer />
      <Money />
      <Spacer />
      <Inventory />
      <Spacer />
      <HealthPotion />
      <Spacer />
      <Navigation />
      <Spacer />
      <Socials />
    </VStack>
  );
};
