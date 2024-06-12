import { useBreakpointValue, VStack } from '@chakra-ui/react';

import { HealthPotion } from './HealthPotion';
import { Inventory } from './Inventory';
import { Level } from './Level';
import { Money } from './Money';
import { Navigation } from './Navigation';
import { Socials } from './Socials';
import { Stats } from './Stats';
import { TopBar } from './TopBar';

export const StatsPanel = (): JSX.Element => {
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  return (
    <VStack h="100%" spacing={4}>
      <TopBar />
      <Stats />
      <Level />
      <Money />
      <Inventory />
      <HealthPotion />

      {isDesktop && (
        <>
          <Navigation />
          <Socials />
        </>
      )}
    </VStack>
  );
};
