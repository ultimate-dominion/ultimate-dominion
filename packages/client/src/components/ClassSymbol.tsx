import { Box, HStack, IconProps, Text, Tooltip, useBreakpointValue } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import {
  ADVANCED_CLASS_COLORS,
  ADVANCED_CLASS_NAMES,
  AdvancedClass,
  StatsClasses,
} from '../utils/types';

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

const CLASS_LABEL_KEYS: Record<StatsClasses, string> = {
  [StatsClasses.Intelligence]: 'classSymbol.intelligence',
  [StatsClasses.Agility]: 'classSymbol.agility',
  [StatsClasses.Strength]: 'classSymbol.strength',
};

export const ClassSymbol = ({
  advancedClass,
  entityClass,
  responsive = false,
  theme = 'light',
  ...props
}: {
  advancedClass?: AdvancedClass;
  entityClass: StatsClasses;
  responsive?: boolean;
  theme?: 'light' | 'dark';
} & IconProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const isDesktop = useBreakpointValue({ base: false, lg: true });

  const classLabel = t(CLASS_LABEL_KEYS[entityClass]) ?? '';
  const hasAdvancedClass = advancedClass != null && advancedClass !== AdvancedClass.None;
  const tooltipLabel = hasAdvancedClass
    ? `${ADVANCED_CLASS_NAMES[advancedClass]} (${classLabel})`
    : classLabel;

  const SvgComponent =
    entityClass === StatsClasses.Intelligence
      ? MageSvg
      : entityClass === StatsClasses.Agility
        ? RogueSvg
        : entityClass === StatsClasses.Strength
          ? WarriorSvg
          : null;

  if (!SvgComponent) return <Box />;

  const sizeKey =
    entityClass === StatsClasses.Intelligence
      ? 'mage'
      : entityClass === StatsClasses.Agility
        ? 'rogue'
        : 'warrior';

  return (
    <Tooltip
      aria-label={tooltipLabel}
      bg="#14120F"
      hasArrow
      label={tooltipLabel}
      shouldWrapChildren
    >
      <HStack spacing={1}>
        <SvgComponent
          size={ICON_SIZE[!isDesktop && responsive ? 'mobile' : 'desktop'][sizeKey]}
          theme={theme}
          {...props}
        />
        {hasAdvancedClass && (
          <Text
            color={ADVANCED_CLASS_COLORS[advancedClass]}
            fontFamily="'Fira Code', monospace"
            fontSize="2xs"
            fontWeight={700}
            letterSpacing="wider"
            textTransform="uppercase"
          >
            {ADVANCED_CLASS_NAMES[advancedClass]}
          </Text>
        )}
      </HStack>
    </Tooltip>
  );
};
