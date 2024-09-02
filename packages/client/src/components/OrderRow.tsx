import {
  Avatar,
  Button,
  Flex,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { BiPurchaseTagAlt } from 'react-icons/bi';
import { FaTimes } from 'react-icons/fa';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorTemplate,
  type Order,
  type SpellTemplate,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';

type OrderRowProps = {
  item: ArmorTemplate | WeaponTemplate | SpellTemplate;
  order: Order;
};

export const OrderRow = ({ item, order }: OrderRowProps): JSX.Element => {
  const {
    systemCalls: { cancelOrder, fulfillOrder },
  } = useMUD();
  const { renderSuccess, renderError } = useToast();

  const [isCancelling, setIsCancelling] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const onCancelOrder = useCallback(async () => {
    try {
      setIsCancelling(true);

      const { error, success } = await cancelOrder(order.orderHash);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Order canceled successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelOrder, order, renderError, renderSuccess]);

  const onFulfillOrder = useCallback(async () => {
    try {
      setIsFilling(true);

      const { error, success } = await fulfillOrder(order.orderHash);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Order filled successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsFilling(false);
    }
  }, [fulfillOrder, order, renderError, renderSuccess]);

  const { consideration, offer } = order;

  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
      justify="space-between"
      w="100%"
    >
      <Flex>
        <Avatar
          borderRadius={0}
          size="lg"
          name={' '}
          backgroundColor={'grey300'}
        >
          {getEmoji(item.name)}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>
              From: {consideration.recipient}
            </Text>
          </HStack>
          <Text size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
            Wants {consideration.amount}{' '}
            {consideration.tokenType === TokenType.ERC20
              ? '$GOLD'
              : removeEmoji(item.name)}{' '}
            for {offer.amount}{' '}
            {offer.tokenType === TokenType.ERC20
              ? '$GOLD'
              : removeEmoji(item.name)}
          </Text>
        </VStack>
      </Flex>
      <HStack>
        <Stack display={{ base: 'none', md: 'block' }} w="100px">
          <Button
            ml={1}
            p={3}
            size="sm"
            variant="solid"
            isLoading={isFilling}
            onClick={onFulfillOrder}
          >
            <BiPurchaseTagAlt />
          </Button>{' '}
          <Button
            ml={1}
            p={3}
            size="sm"
            variant="ghost"
            backgroundColor="red"
            color="white"
            isLoading={isCancelling}
            onClick={onCancelOrder}
          >
            <FaTimes />
          </Button>
        </Stack>
      </HStack>
    </Flex>
  );
};
