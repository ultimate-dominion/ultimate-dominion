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
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FaFire, FaRoad, FaShieldAlt } from 'react-icons/fa';
import { IoIosArrowForward } from 'react-icons/io';

export const Entry = ({
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
      overflow="hidden"
      variant="outline"
      w="100%"
    >
      <Center h="100%">
        <Avatar borderRadius={0} size="xl"></Avatar>
      </Center>
      <Stack w="100%">
        <CardBody w="100%">
          <HStack w="100%">
            <VStack>
              <HStack w="100%" textAlign="left">
                <Text size="sm">{name}</Text>
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
            <Grid w="50%" templateColumns="repeat(3, 1fr)">
              <GridItem>
                <Center>
                  <Button variant="ghost" fontWeight="bold">
                    {total}
                  </Button>
                </Center>
              </GridItem>
              <GridItem>
                <Center>
                  <Button variant="ghost" fontWeight="bold">
                    {level}
                  </Button>
                </Center>
              </GridItem>
              <GridItem>
                <Center>
                  <Button variant="ghost" fontWeight="bold">
                    {gold}
                  </Button>
                </Center>
              </GridItem>
            </Grid>
            <Button variant="link">
              <IoIosArrowForward />
            </Button>
          </HStack>
        </CardBody>
      </Stack>
    </Card>
  );
};
