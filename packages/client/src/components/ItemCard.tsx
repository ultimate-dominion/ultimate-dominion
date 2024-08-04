import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Center,
  Text,
} from '@chakra-ui/react';
import { FaHatWizard } from 'react-icons/fa';
import { GiAxeSword, GiRogue } from 'react-icons/gi';

import { type Armor, StatsClasses, type Weapon } from '../utils/types';

type ItemCardProps = (Armor | Weapon) & {
  isEquipped?: boolean;
  onClick?: () => void;
};

export const ItemCard: React.FC<ItemCardProps> = ({
  isEquipped = false,
  onClick,
  ...item
}): JSX.Element => {
  const { agiModifier, classRestrictions, intModifier, strModifier, name } =
    item;

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
          STR+{strModifier} AGI+{agiModifier} INT+
          {intModifier}{' '}
          {(item as Armor).armorModifier
            ? `ARM+${(item as Armor).armorModifier}`
            : ''}
        </Text>
      </CardBody>

      <CardFooter>
        <Center>
          {classRestrictions.includes(StatsClasses.Warrior) && (
            <GiAxeSword size={28} />
          )}
          {classRestrictions.includes(StatsClasses.Rogue) && (
            <GiRogue size={28} />
          )}
          {classRestrictions.includes(StatsClasses.Mage) && (
            <FaHatWizard size={28} />
          )}
        </Center>
      </CardFooter>
    </Card>
  );
};
