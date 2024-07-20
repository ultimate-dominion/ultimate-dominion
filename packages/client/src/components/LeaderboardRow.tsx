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
import { FaFire, FaRoad, FaShieldAlt } from 'react-icons/fa';
import { IoIosArrowForward } from 'react-icons/io';

export const LeaderboardRow = ({
  name,
  gold,
  level,
  stats,
  total,
  type,
}: {
  name: string;
  type: number;
  stats: { STR: string; AGI: string; INT: string; HP: string };
  total: string;
  level: string;
  gold: string;
}): JSX.Element => {
  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
      justify="space-between"
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
        <Avatar borderRadius={0} size="lg" />
        <VStack justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>{name}</Text>
            <Center>
              {type == 0 && <FaFire size={15} />}
              {type == 1 && <FaRoad size={15} />}
              {type == 2 && <FaShieldAlt size={15} />}
            </Center>
          </HStack>
          <Text size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
            HP {stats['HP']} • STR {stats['STR']} • AGI
            {stats['AGI']} • INT {stats['INT']}
          </Text>
        </VStack>
      </Flex>
      <HStack>
        <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
          <Text
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {total}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {level}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {gold}
          </Text>
        </HStack>
        <Box display={{ base: 'none', md: 'block' }} w="50px">
          <Button p={3} variant="ghost">
            <IoIosArrowForward />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
