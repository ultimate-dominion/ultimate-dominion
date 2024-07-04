import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Center,
  Heading,
  Stack,
  Text,
} from '@chakra-ui/react';
import {
  FaBook,
  FaBug,
  FaDatabase,
  FaDoorClosed,
  FaFire,
  FaPizzaSlice,
  FaRoad,
  FaScribd,
  FaSearchLocation,
  FaShieldAlt,
  FaSocks,
  FaStarAndCrescent,
} from 'react-icons/fa';

export const ItemCard = ({
  agi,
  disabled,
  icon,
  image,
  int,
  name,
  str,
}: {
  agi: number;
  disabled: boolean;
  icon: string;
  image: string;
  int: number;
  name: string;
  str: number;
}): JSX.Element => {
  return (
    <Card
      border={disabled ? 'solid lightgray' : 'solid'}
      borderRadius={2}
      direction="row"
      overflow="hidden"
      variant={disabled ? 'light' : 'outline'}
    >
      <Stack direction="row">
        <CardHeader backgroundColor="grey300">
          <Center h="100%">
            {image == 'book' && <FaBook size={40} />}
            {image == 'bug' && <FaBug size={40} />}
            {image == 'database' && <FaDatabase size={40} />}
            {image == 'door-closed' && <FaDoorClosed size={40} />}
            {image == 'pizza-slice' && <FaPizzaSlice size={40} />}
            {image == 'scribd' && <FaScribd size={40} />}
            {image == 'search' && <FaSearchLocation size={40} />}
            {image == 'socks' && <FaSocks size={40} />}
            {image == 'star-crescent' && <FaStarAndCrescent size={40} />}
          </Center>
        </CardHeader>
        <CardBody>
          <Heading size="sm">{name}</Heading>

          <Text size="sm">
            STR+{str} AGI+{agi} INT+{int}
          </Text>
        </CardBody>

        <CardFooter>
          <Center>
            {icon == 'fire' && <FaFire size={20} />}
            {icon == 'road' && <FaRoad size={20} />}
            {icon == 'shield' && <FaShieldAlt size={20} />}
          </Center>
        </CardFooter>
      </Stack>
    </Card>
  );
};
