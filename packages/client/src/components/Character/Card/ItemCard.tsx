import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Center,
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
      cursor="pointer"
      direction="row"
      overflow="hidden"
      variant={disabled ? 'light' : 'outline'}
      _active={{
        bgColor: 'rgba(0, 0, 0, .04)',
        border: 'solid',
      }}
      _hover={{
        border: 'solid',
      }}
    >
      <CardHeader backgroundColor="grey300">
        <Center h="100%">
          {image == 'book' && <FaBook size={24} />}
          {image == 'bug' && <FaBug size={24} />}
          {image == 'database' && <FaDatabase size={24} />}
          {image == 'door-closed' && <FaDoorClosed size={24} />}
          {image == 'pizza-slice' && <FaPizzaSlice size={24} />}
          {image == 'scribd' && <FaScribd size={24} />}
          {image == 'search' && <FaSearchLocation size={24} />}
          {image == 'socks' && <FaSocks size={24} />}
          {image == 'star-crescent' && <FaStarAndCrescent size={24} />}
        </Center>
      </CardHeader>
      <CardBody>
        <Text fontWeight="bold" size={{ base: 'xs', sm: 'md' }}>
          {name}
        </Text>

        <Text size={{ base: '2xs', sm: 'sm' }}>
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
    </Card>
  );
};
