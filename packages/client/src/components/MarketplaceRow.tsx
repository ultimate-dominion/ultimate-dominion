import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { IoIosArrowForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

import { ITEM_PATH } from '../Routes';
import { getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorTemplate,
  ItemType,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

export const MarketplaceRow = ({
  floor,
  itemType,
  minLevel,
  name,
  tokenId,
  ...item
}: (ArmorTemplate | SpellTemplate | WeaponTemplate) & {
  floor: string;
}): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
      justify="space-between"
      onClick={() => navigate(`${ITEM_PATH}${tokenId}`)}
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
          {getEmoji(name)}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>{removeEmoji(name)}</Text>
          </HStack>
          {itemType !== ItemType.Spell && (
            <Text size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
              HP {(item as ArmorTemplate | WeaponTemplate).hpModifier} • STR{' '}
              {(item as ArmorTemplate | WeaponTemplate).strModifier} • AGI{' '}
              {(item as ArmorTemplate | WeaponTemplate).agiModifier} • INT{' '}
              {(item as ArmorTemplate | WeaponTemplate).intModifier}
            </Text>
          )}
        </VStack>
      </Flex>
      <HStack>
        <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(minLevel).toLocaleString()}
          </Text>
          <Text
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(floor) == 0 ? 'N/A' : Number(floor).toLocaleString()}
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
