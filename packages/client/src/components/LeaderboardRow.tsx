import {
  Avatar,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { etherToFixedNumber } from '../utils/helpers';
import { type Character, StatsClasses } from '../utils/types';
import { MageSvg, RogueSvg, WarriorSvg } from './SVGs';
import { ForwardCaretSvg } from './SVGs/ForwardCaretSvg';

export const LeaderboardRow = ({
  character: {
    agility,
    entityClass,
    externalGoldBalance,
    id,
    image,
    intelligence,
    level,
    maxHp,
    name,
    strength,
  },
  index,
  top3,
}: {
  character: Character;
  index: number;
  top3: boolean;
}): JSX.Element => {
  const navigate = useNavigate();

  const totalStats = useMemo(
    () => Number(agility) + Number(strength) + Number(intelligence),
    [agility, strength, intelligence],
  );

  return (
    <Flex
      bgColor={top3 ? '#F5F5FA1F' : '#a2a9b0'}
      justify="space-between"
      onClick={() => navigate(`/characters/${id}`)}
      px={4}
      py={1}
      w="100%"
      _hover={{
        cursor: 'pointer',
        button: {
          bgColor: 'grey100',
        },
      }}
      _active={{
        button: {
          bgColor: 'grey400',
        },
      }}
    >
      <Flex>
        <HStack spacing={6}>
          <Text color="#283570" fontWeight={700} justifySelf="center">
            {index + 1}
          </Text>
          <Avatar borderRadius="100%" src={image} />
        </HStack>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text
              color="black"
              fontWeight={700}
              size={{ base: 'sm', lg: 'xl' }}
            >
              {name}
            </Text>
            <Center>
              {entityClass == StatsClasses.Warrior && (
                <WarriorSvg theme="dark" />
              )}
              {entityClass == StatsClasses.Rogue && <RogueSvg theme="dark" />}
              {entityClass == StatsClasses.Mage && <MageSvg theme="dark" />}
            </Center>
          </HStack>
          <Text
            color="#121B45"
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
          >
            HP {maxHp.toString()} • STR {strength.toString()} • AGI{' '}
            {agility.toString()} • INT {intelligence.toString()}
          </Text>
        </VStack>
      </Flex>
      <HStack>
        <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
          <Text
            color="#121B45"
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {totalStats}
          </Text>
          <Text
            color="black"
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {level.toString()}
          </Text>
          <Text
            color="#EFD31C"
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {etherToFixedNumber(externalGoldBalance)}
          </Text>
        </HStack>
        <Box display={{ base: 'none', md: 'block' }}>
          <Button size="sm" variant="ghost">
            <ForwardCaretSvg />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
