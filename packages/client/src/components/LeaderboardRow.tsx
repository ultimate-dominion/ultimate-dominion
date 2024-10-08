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
import { FaHatWizard } from 'react-icons/fa';
import { GiAxeSword, GiRogue } from 'react-icons/gi';
import { IoIosArrowForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

import { etherToFixedNumber } from '../utils/helpers';
import { type Character, StatsClasses } from '../utils/types';

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
    <Flex
      backgroundColor={top ? '#F5F5FA1F' : '#F5F5FA1F'}
      borderRadius={2}
      boxShadow={
        '-5px -5px 10px 0px #B3B9BE inset,5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset'
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
              size={{ base: 'lg', lg: 'xl' }}
            >
              {name}
            </Text>
            <Center>
              {entityClass == StatsClasses.Warrior && <GiAxeSword size={15} />}
              {entityClass == StatsClasses.Rogue && <GiRogue size={15} />}
              {entityClass == StatsClasses.Mage && <FaHatWizard size={15} />}
            </Center>
          </HStack>
          <Text
            color="#121B45"
            fontWeight={500}
            size={{ base: 'xs', sm: 'sm', lg: 'md' }}
          >
            HP {maxHp.toString()} • STR {strength.toString()} • AGI
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
        <Box display={{ base: 'none', md: 'block' }} w="50px">
          <Button p={3} variant="link">
            <IoIosArrowForward />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
