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
    case StatsClasses.Intelligence:
      return (
        <Tooltip
          aria-label="Intelligence"
          bg="#14120F"
          hasArrow
          label="Intelligence"
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
    case StatsClasses.Agility:
      return (
        <Tooltip
          aria-label="Agility"
          bg="#14120F"
          hasArrow
          label="Agility"
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
    case StatsClasses.Strength:
      return (
        <Tooltip
          aria-label="Strength"
          bg="#14120F"
          hasArrow
          label="Strength"
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
