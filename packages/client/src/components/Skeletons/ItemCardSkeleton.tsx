import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Center,
  Skeleton,
  Text,
} from '@chakra-ui/react';
import { GiRogue } from 'react-icons/gi';

import type { Weapon } from '../../utils/types';

type ItemCardProps = Weapon & {
  isEquipped?: boolean;
  onClick?: () => void;
};

export const ItemCardSkeleton: React.FC<ItemCardProps> = ({
  isEquipped = false,
  onClick,
}): JSX.Element => {
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
          <Skeleton>
            <Text fontSize={{ base: 'xl', lg: '3xl' }}></Text>
          </Skeleton>
        </Center>
      </CardHeader>
      <CardBody>
        <Skeleton>
          <Text fontWeight="bold" size={{ base: 'xs', sm: 'md' }}></Text>
        </Skeleton>
        <Skeleton>
          <Text size={{ base: '2xs', sm: 'sm' }}>STR+ AGI+ INT+</Text>
        </Skeleton>
      </CardBody>

      <CardFooter>
        <Center>
          <Skeleton>
            <GiRogue size={28} />
          </Skeleton>
        </Center>
      </CardFooter>
    </Card>
  );
};
