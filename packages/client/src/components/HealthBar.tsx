import {
  Badge,
  Box,
  HStack,
  StackProps,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { DARK_INSET_SHADOW } from '../utils/theme';

const STATUS_EFFECT_COLOR_MAPPING: { [key: string]: string } = {
  'AGI boost': 'yellow',
  blind: 'black',
  drunk: 'red',
  'INT boost': 'blue',
  poison: 'purple',
  'STR boost': 'red',
  stupify: 'blue',
  weaken: 'red',
  'Battle Cry': 'orange',
  'Divine Shield': 'yellow',
  "Hunter's Mark": 'orange',
  Shadowstep: 'cyan',
  Entangle: 'green',
  'Soul Drain': 'purple',
  Blessing: 'teal',
  Venom: 'purple.400',
  'Basilisk Venom': 'purple.600',
};

export const HealthBar = ({
  maxHp,
  currentHp,
  isDotTicking,
  level,
  statusEffects,
  ...stackProps
}: {
  maxHp: bigint;
  currentHp: bigint;
  isDotTicking?: boolean;
  level?: bigint;
  statusEffects?: string[];
} & StackProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const currentHpWithFloor = currentHp < BigInt(0) ? BigInt(0) : currentHp;
  const health = Math.min(
    (Number(currentHpWithFloor.toString()) / Number(maxHp.toString())) * 100,
    100,
  );

  const barColor = health > 60 ? '#5A8A3E' : health > 30 ? '#C87A2A' : '#8B2020';

  return (
    <VStack spacing={0.5} {...stackProps}>
      <HStack justifyContent="space-between" w="100%">
        <HStack spacing={1}>
          <Text fontWeight={700} size={{ base: '2xs', md: 'xs' }}>
            {t('health.hp')}
          </Text>
          {!!level && (
            <Text color="#8A7E6A" size={{ base: '3xs', md: '2xs' }}>
              {t('health.lvl', { level: level.toString() })}
            </Text>
          )}
        </HStack>
        <Text color="#8A7E6A" fontFamily="mono" fontWeight={700} size={{ base: '2xs', md: 'xs' }}>
          {currentHpWithFloor.toString()}/{maxHp.toString()}
        </Text>
      </HStack>
      <Box
        bg="#14120F"
        borderRadius="md"
        boxShadow={
          isDotTicking
            ? `${DARK_INSET_SHADOW}, 0 0 8px 2px rgba(128,0,128,0.6)`
            : health <= 30
              ? `${DARK_INSET_SHADOW}, 0 0 6px 1px rgba(139,32,32,0.5)`
              : DARK_INSET_SHADOW
        }
        h="10px"
        overflow="hidden"
        transition="box-shadow 0.3s ease"
        w="100%"
      >
        <Box
          bg={barColor}
          borderRadius="md"
          h="100%"
          transition="width 0.25s ease-out, background-color 0.25s ease-out"
          w={`${health}%`}
        />
      </Box>
      {statusEffects && statusEffects[0] && (
        <HStack w="100%">
          {statusEffects.slice(0, 3).map(statusEffect => (
            <Badge
              bgColor={STATUS_EFFECT_COLOR_MAPPING[statusEffect] ?? 'red'}
              color="white"
              fontSize="2xs"
              key={`status-effect-display-${statusEffect}`}
              size="xs"
            >
              {statusEffect}
            </Badge>
          ))}
        </HStack>
      )}
    </VStack>
  );
};
