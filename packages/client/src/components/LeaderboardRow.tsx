import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { etherToFixedNumber } from '../utils/helpers';
import { type Character } from '../utils/types';

import { ClassSymbol } from './ClassSymbol';
import { ForwardCaretSvg } from './SVGs/ForwardCaretSvg';

export const LeaderboardRow = ({
  character: {
    baseStats: { agility, intelligence, strength },
    entityClass,
    externalGoldBalance,
    id,
    image,
    level,
    maxHp,
    name,
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
      bgColor={top3 ? 'rgba(200,122,42,0.08)' : '#1C1814'}
      justify="space-between"
      onClick={() => navigate(`/characters/${id}`)}
      px={{ base: 1, sm: 2, md: 4 }}
      py={2}
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
      <Flex position="relative">
        <HStack ml={{ base: 3, sm: 0 }} spacing={{ base: 2, md: 6 }}>
          <Text
            color="#C87A2A"
            fontWeight={700}
            justifySelf="center"
            left={0}
            position={{ base: 'absolute', sm: 'static' }}
            size={{ base: 'xs', lg: 'md' }}
            top={0}
          >
            {index + 1}
          </Text>
          <Avatar
            borderRadius="100%"
            size={{ base: 'sm', md: 'md' }}
            src={image}
          />
        </HStack>
        <VStack
          align="start"
          justify="center"
          ml={{ base: 3, sm: 4 }}
          spacing={{ base: 0, sm: 1 }}
        >
          <HStack>
            <Text
              color="#E8DCC8"
              fontWeight={700}
              size={{ base: 'sm', lg: 'xl' }}
              mt={1}
            >
              {name}
            </Text>
            <ClassSymbol entityClass={entityClass} responsive theme="dark" />
          </HStack>
          <Text
            color="#8A7E6A"
            fontWeight={500}
            size={{ base: '2xs', lg: 'md' }}
          >
            HP {maxHp.toString()} • STR {strength.toString()} • AGI{' '}
            {agility.toString()} • INT {intelligence.toString()}
          </Text>
        </VStack>
      </Flex>
      <HStack>
        <HStack w={{ base: '120px', sm: '185px', md: '300px', lg: '450px' }}>
          <Text
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {totalStats}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {level.toString()}
          </Text>
          <Text
            color="yellow"
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
