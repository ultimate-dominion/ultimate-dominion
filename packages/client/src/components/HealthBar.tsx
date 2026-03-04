import {
  Badge,
  Box,
  Flex,
  HStack,
  StackProps,
  Text,
  VStack,
} from '@chakra-ui/react';

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
  const currentHpWithFloor = currentHp < BigInt(0) ? BigInt(0) : currentHp;
  const health = Math.min(
    (Number(currentHpWithFloor.toString()) / Number(maxHp.toString())) * 100,
    100,
  );

  const barColor = health > 50 ? 'green' : health > 15 ? 'yellow' : 'red';

  return (
    <VStack spacing={0.5} {...stackProps}>
      {!!level && (
        <Text alignSelf="start" size={{ base: '3xs', md: '2xs' }}>
          Lvl {level.toString()}
        </Text>
      )}
      <Flex
        bgColor="grey100"
        borderRadius="10px"
        boxShadow={
          isDotTicking
            ? '0 0 8px 2px rgba(128,0,128,0.6), -2px 2px 3px 0px #00000040'
            : '-2px 2px 3px 0px #00000040'
        }
        h={{ base: '14px', md: '16px' }}
        overflow="hidden"
        position="relative"
        transition="box-shadow 0.3s"
        width="100%"
      >
        <Box
          borderRadius="10px"
          bgColor={barColor}
          h="100%"
          position="absolute"
          transition="all 0.5s"
          w={`${health}%`}
        />
        <Text
          color="#E8DCC8"
          fontWeight={500}
          position="absolute"
          left={3}
          size={{ base: '2xs', md: 'xs' }}
        >
          HP
        </Text>
      </Flex>
      <HStack
        justify={statusEffects && statusEffects[0] ? 'space-between' : 'end'}
        w="100%"
      >
        <HStack>
          {statusEffects?.slice(0, 3).map(statusEffect => (
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
        <Text size={{ base: '2xs', md: 'xs' }}>
          {currentHpWithFloor.toString()} / {maxHp.toString()}
        </Text>
      </HStack>
    </VStack>
  );
};
