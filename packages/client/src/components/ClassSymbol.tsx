import { Box, Tooltip } from '@chakra-ui/react';
import { FaHatWizard } from 'react-icons/fa';
import { GiAxeSword, GiRogue } from 'react-icons/gi';

import { StatsClasses } from '../utils/types';

export const ClassSymbol = ({
  entityClass,
  size = 28,
}: {
  entityClass: StatsClasses;
  size?: number;
}): JSX.Element => {
  switch (entityClass) {
    case StatsClasses.Warrior:
      return (
        <Tooltip
          aria-label="Warrior"
          bg="black"
          hasArrow
          label="Warrior"
          shouldWrapChildren
        >
          <GiAxeSword size={size} />
        </Tooltip>
      );
    case StatsClasses.Rogue:
      return (
        <Tooltip
          aria-label="Rogue"
          bg="black"
          hasArrow
          label="Rogue"
          shouldWrapChildren
        >
          <GiRogue size={size} />
        </Tooltip>
      );
    case StatsClasses.Mage:
      return (
        <Tooltip
          aria-label="Mage"
          bg="black"
          hasArrow
          label="Mage"
          shouldWrapChildren
        >
          <FaHatWizard size={size} />
        </Tooltip>
      );
    default:
      return <Box />;
  }
};
