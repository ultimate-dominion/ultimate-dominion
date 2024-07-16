import {
  Avatar,
  Button,
  Center,
  Flex,
  Grid,
  GridItem,
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
      direction="row"
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
      <Grid templateColumns="repeat(10, 1fr)" w="100%">
        <GridItem colSpan={6}>
          <Flex>
            <Avatar
              borderRadius={0}
              h="100%"
              size={['2xl', 'xl', 'xl', 'lg']}
            />
            <VStack justify="center" ml={4}>
              <HStack w="100%">
                <Text size={{ base: '2xs', lg: 'sm' }}>{name}</Text>
                <Center>
                  {type == 0 && <FaFire size={15} />}
                  {type == 1 && <FaRoad size={15} />}
                  {type == 2 && <FaShieldAlt size={15} />}
                </Center>
              </HStack>
              <Text size="sm">
                HP {stats['HP']} • STR {stats['STR']} • AGI
                {stats['AGI']} • INT {stats['INT']}
              </Text>
            </VStack>
          </Flex>
        </GridItem>
        <GridItem colSpan={1}>
          <Center h="100%">
            <Text textAlign="center">{total}</Text>
          </Center>
        </GridItem>
        <GridItem colSpan={1}>
          <Center h="100%">
            <Text textAlign="center">{level}</Text>
          </Center>
        </GridItem>
        <GridItem colSpan={1}>
          <Center h="100%">
            <Text textAlign="center">{gold}</Text>
          </Center>
        </GridItem>
        <GridItem colSpan={1}>
          <Center h="100%">
            <Button variant="ghost">
              <IoIosArrowForward />
            </Button>
          </Center>
        </GridItem>
      </Grid>
    </Flex>
  );
};
