import { HStack, Text, TextProps, Tooltip } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

import {
  ADVANCED_CLASS_COLORS,
  ADVANCED_CLASS_NAMES,
  AdvancedClass,
  CLASS_COLORS,
  StatsClasses,
} from '../utils/types';

const CLASS_LABEL_KEYS: Record<StatsClasses, string> = {
  [StatsClasses.Intelligence]: 'classSymbol.intelligence',
  [StatsClasses.Agility]: 'classSymbol.agility',
  [StatsClasses.Strength]: 'classSymbol.strength',
};

const CLASS_CODES: Record<StatsClasses, string> = {
  [StatsClasses.Intelligence]: 'INT',
  [StatsClasses.Agility]: 'AGI',
  [StatsClasses.Strength]: 'STR',
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
} & TextProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const classLabel = t(CLASS_LABEL_KEYS[entityClass]) ?? '';
  const hasAdvancedClass =
    advancedClass != null && advancedClass !== AdvancedClass.None;
  const tooltipLabel = hasAdvancedClass
    ? `${ADVANCED_CLASS_NAMES[advancedClass]} (${classLabel})`
    : classLabel;

  return (
    <Tooltip
      aria-label={tooltipLabel}
      bg="#14120F"
      hasArrow
      label={tooltipLabel}
      shouldWrapChildren
    >
      <HStack
        opacity={theme === 'dark' ? 0.85 : 1}
        spacing={responsive ? 0.5 : 1}
      >
        <Text
          border="1px solid"
          borderColor={CLASS_COLORS[entityClass]}
          color={CLASS_COLORS[entityClass]}
          fontFamily="'Fira Code', monospace"
          fontSize="2xs"
          fontWeight={800}
          letterSpacing="0.08em"
          lineHeight={1}
          px={1.5}
          py={1}
          {...props}
        >
          {CLASS_CODES[entityClass]}
        </Text>
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
