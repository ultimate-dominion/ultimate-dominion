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
import { ForwardCaretSvg } from './SVGs/ForwardCaretSvg';

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
      bgColor="#F5F5FA1F"
      justify="space-between"
      onClick={() => navigate(`${ITEM_PATH}/${tokenId}?${newSearchParams}`)}
      px={{ base: 1, sm: 2, md: 4 }}
      py={2}
      w="100%"
      _hover={{
        cursor: 'pointer',
        button: {
          bgColor: 'grey100',
        },
      }}
      _active={{
        button: {
          bgColor: 'grey400',
        },
      }}
    >
      <Flex>
        <Avatar bgColor="#F5F5FA1F" borderRadius={0} size="lg" name={' '}>
          {getEmoji(name)}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <Text fontWeight={700} size={{ base: 'sm', lg: 'lg' }}>
            {removeEmoji(name)}
          </Text>
          {itemType !== ItemType.Spell && (
            <Text
              color="#121B45"
              fontWeight={500}
              size={{ base: '2xs', lg: 'md' }}
            >
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
        <HStack w={{ base: '0px', md: '350px', lg: '500px' }}>
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
            display={{ base: 'none', md: 'block' }}
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
            display={{ base: 'none', md: 'block' }}
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
        <Box display={{ base: 'none', md: 'block' }} mr={2} w="50px">
          <Button size="sm" variant="ghost">
            <ForwardCaretSvg />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
