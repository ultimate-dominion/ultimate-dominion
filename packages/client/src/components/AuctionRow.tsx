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
import { FaHatWizard } from 'react-icons/fa';
import { GiAxeSword, GiRogue } from 'react-icons/gi';
import { IoIosArrowForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

export const AuctionRow = ({
  agility,
  baseHp,
  itemId,
  emoji,
  intelligence,
  level,
  name,
  strength,
  floor,
  itemClass,
}: {
  agility: string;
  baseHp: string;
  characterId: string;
  emoji: string;
  entityClass: string;
  image: string;
  intelligence: string;
  goldBalance: string;
  level: string;
  name: string;
  strength: string;
  floor: string;
  high: string;
  itemClass: string;
}): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
      justify="space-between"
      onClick={() => navigate(`/item/${itemId}`)}
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
        <Avatar
          borderRadius={0}
          size="lg"
          name={' '}
          backgroundColor={'grey300'}
        >
          {emoji}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>{name}</Text>
          </HStack>
          <Text size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
            HP {baseHp} • STR {strength} • AGI
            {agility} • INT {intelligence}
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
            {Number(floor).toLocaleString()}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(level).toLocaleString()}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            <Center>
              {itemClass == 'Warrior' && <GiAxeSword size={15} />}
              {itemClass == 'Rogue' && <GiRogue size={15} />}
              {itemClass == 'Mage' && <FaHatWizard size={15} />}
            </Center>
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
