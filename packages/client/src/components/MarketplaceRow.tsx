import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { IoIosArrowForward } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

import { ITEM_PATH } from '../Routes';
import { getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemType,
  OrderType,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

export const MarketplaceRow = ({
  highestOffer,
  itemType,
  lowestPrice,
  minLevel,
  name,
  orderType,
  tokenId,
  ...item
}: (ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate) & {
  highestOffer: string;
  lowestPrice: string;
  orderType: OrderType;
}): JSX.Element => {
  const navigate = useNavigate();

  const newSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('orderType', orderType);
    return searchParams;
  }, [orderType]);

  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
      justify="space-between"
      onClick={() => navigate(`${ITEM_PATH}${tokenId}?${newSearchParams}`)}
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
              HP{' '}
              {(item as ArmorTemplate | WeaponTemplate).hpModifier.toString()} •
              STR{' '}
              {(item as ArmorTemplate | WeaponTemplate).strModifier.toString()}{' '}
              • AGI{' '}
              {(item as ArmorTemplate | WeaponTemplate).agiModifier.toString()}{' '}
              • INT{' '}
              {(item as ArmorTemplate | WeaponTemplate).intModifier.toString()}
            </Text>
          )}
        </VStack>
      </Flex>
      <HStack>
        <HStack w={{ base: '0px', sm: '250px', md: '350px', lg: '500px' }}>
          <Text
            display={{ base: 'none', md: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(minLevel).toLocaleString()}
          </Text>
          <Text
            display={{ base: 'none', sm: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(lowestPrice) == 0
              ? 'N/A'
              : `${Number(lowestPrice).toLocaleString()} $GOLD`}
          </Text>
          <Text
            display={{ base: 'none', sm: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(highestOffer) == 0
              ? 'N/A'
              : `${Number(highestOffer).toLocaleString()} $GOLD`}
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
