import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Center,
  Text,
} from '@chakra-ui/react';
import { GiRogue } from 'react-icons/gi';

import type { Weapon } from '../utils/types';

type ItemCardProps = Weapon & {
  isEquipped?: boolean;
  onClick?: () => void;
};

export const ItemCard: React.FC<ItemCardProps> = ({
  isEquipped = false,
  onClick,
  ...weapon
}): JSX.Element => {
  const { agiModifier, intModifier, strModifier, name } = weapon;

  return (
    <Card
      border={isEquipped ? '3px solid' : '2px solid'}
      borderColor={isEquipped ? 'black' : 'grey300'}
      borderRadius={2}
      cursor={onClick ? 'pointer' : 'default'}
      direction="row"
      onClick={onClick}
      overflow="hidden"
      variant="light"
      _active={
        onClick && {
          bgColor: 'rgba(0, 0, 0, .04)',
          borderColor: 'black',
        }
      }
    >
      <CardHeader backgroundColor="grey300">
        <Center h="100%">
          <Text fontSize={{ base: 'xl', lg: '3xl' }}>{name.slice(-3)}</Text>
        </Center>
      </CardHeader>
      <CardBody>
        <Text fontWeight="bold" size={{ base: 'xs', sm: 'md' }}>
          {name.slice(0, -3)}
        </Text>

        <Text size={{ base: '2xs', sm: 'sm' }}>
          STR+{strModifier} AGI+{agiModifier} INT+{intModifier}
        </Text>
      </CardBody>

      <CardFooter>
        <Center>
          <GiRogue size={28} />
        </Center>
      </CardFooter>
    </Card>
  );
};
