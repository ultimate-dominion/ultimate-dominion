import {
  Avatar,
  Button,
  Card,
  CardBody,
  Center,
  Grid,
  GridItem,
  HStack,
  Spacer,
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
    <Card
      borderRadius={2}
      direction="row"
      minW={800}
      overflow="hidden"
      variant="outline"
      w="100%"
    >
      <Center h="100%">
        <Avatar borderRadius={0} size={['2xl', 'xl', 'xl', 'lg']}></Avatar>
      </Center>
      <CardBody h="100%" p={0} w="100%">
        <Center h="100%">
          <HStack w="100%" mx={3}>
            <VStack>
              <HStack w="100%" textAlign="left">
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
            <Spacer />
            <Grid
              templateColumns="repeat(10, 1fr)"
              w={{ base: '60vh', lg: '60vh' }}
              float="right"
              textAlign="right"
            >
              <GridItem colSpan={3}>
                <Center h="100%">
                  <Text textAlign="center">{total}</Text>
                </Center>
              </GridItem>
              <GridItem colSpan={3}>
                <Center h="100%">
                  <Text textAlign="center">{level}</Text>
                </Center>
              </GridItem>
              <GridItem colSpan={3}>
                <Center h="100%">
                  <Text textAlign="center">{gold}</Text>
                </Center>
              </GridItem>
              <GridItem colSpan={1}>
                <Button variant="ghost">
                  <IoIosArrowForward />
                </Button>
              </GridItem>
            </Grid>
          </HStack>
        </Center>
      </CardBody>
    </Card>
  );
};
