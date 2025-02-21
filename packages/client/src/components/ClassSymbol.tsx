import { Box, IconProps, Tooltip, useBreakpointValue } from '@chakra-ui/react';

import { StatsClasses } from '../utils/types';

import { MageSvg, RogueSvg, WarriorSvg } from './SVGs';

const ICON_SIZE = {
  desktop: {
    mage: undefined,
    rogue: undefined,
    warrior: undefined,
  },
  mobile: {
    mage: 3,
    rogue: 4,
    warrior: 3,
  },
};

export const ClassSymbol = ({
  entityClass,
  responsive = false,
  theme = 'light',
  ...props
}: {
  entityClass: StatsClasses;
  responsive?: boolean;
  theme?: 'light' | 'dark';
} & IconProps): JSX.Element => {
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  switch (entityClass) {
    case StatsClasses.Mage:
      return (
        <Tooltip
          aria-label="Mage"
          bg="#070D2A"
          hasArrow
          label="Mage"
          shouldWrapChildren
        >
          <MageSvg
            size={
              ICON_SIZE[!isDesktop && responsive ? 'mobile' : 'desktop'].mage
            }
            theme={theme}
            {...props}
          />
        </Tooltip>
      );
    case StatsClasses.Rogue:
      return (
        <Tooltip
          aria-label="Rogue"
          bg="#070D2A"
          hasArrow
          label="Rogue"
          shouldWrapChildren
        >
          <RogueSvg
            size={
              ICON_SIZE[!isDesktop && responsive ? 'mobile' : 'desktop'].rogue
            }
            theme={theme}
            {...props}
          />
        </Tooltip>
      );
    case StatsClasses.Warrior:
      return (
        <Tooltip
          aria-label="Warrior"
          bg="#070D2A"
          hasArrow
          label="Warrior"
          shouldWrapChildren
        >
          <WarriorSvg
            size={
              ICON_SIZE[!isDesktop && responsive ? 'mobile' : 'desktop'].warrior
            }
            theme={theme}
            {...props}
          />
        </Tooltip>
      );
    default:
      return <Box />;
  }
};
