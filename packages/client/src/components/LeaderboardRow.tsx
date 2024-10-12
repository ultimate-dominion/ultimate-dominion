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
  top,
}: {
  character: Character;
  index: number;
  top: boolean;
}): JSX.Element => {
  const navigate = useNavigate();

  const totalStats = useMemo(
    () => Number(agility) + Number(strength) + Number(intelligence),
    [agility, strength, intelligence],
  );

  return (
    <Box w="100%">
      <Flex
        backgroundColor={top ? '#b1b8be' : '#a2a9b0'}
        borderRadius={2}
        dropShadow={''}
        boxShadow={
          top
            ? '-5px -5px 10px 0px #B3B9BE,5px 5px 10px 0px #949CA380, 2px 2px 4px 0px #88919980'
            : 'box-shadow: -5px -5px 10px 0px #B3B9BE inset,5px 5px 10px 0px #949CA380 inset,2px 2px 4px 0px #88919980 inset'
        }
        h="78px"
        justify="space-between"
        onClick={() => navigate(`/characters/${id}`)}
        w="100%"
        _hover={{
          cursor: 'pointer',
          button: {
            bgColor: 'grey300',
          },
        }}
        _active={{
          button: {
            bgColor: 'grey400',
          },
        }}
      >
        <Flex>
          <HStack ml={4}>
            <Text
              color="#283570"
              fontSize="16px"
              fontWeight={700}
              justifySelf="center"
            >
              {index + 1}
            </Text>
            <Avatar borderRadius="100%" size="md" src={image} />
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
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M7.36612 4.33474C7.85427 3.88842 8.64573 3.88842 9.13388 4.33474L16.6339 11.1919C17.122 11.6382 17.122 12.3618 16.6339 12.8081L9.13388 19.6653C8.64573 20.1116 7.85427 20.1116 7.36612 19.6653C6.87796 19.219 6.87796 18.4953 7.36612 18.049L13.9822 12L7.36612 5.95098C6.87796 5.50467 6.87796 4.78105 7.36612 4.33474Z"
                  fill="black"
                />
              </svg>
            </Button>
          </Box>
        </HStack>
      </Flex>
      <Box
        backgroundColor="#F5F5FA1F"
        boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset"
        w="100%"
        height="7px"
      ></Box>
    </Box>
  );
};
