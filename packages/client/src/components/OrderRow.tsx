import {
  Avatar,
  Button,
  Flex,
  HStack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useEntityQuery } from '@latticexyz/react';
import { getComponentValueStrict, Has, HasValue } from '@latticexyz/recs';
import { useCallback, useMemo, useState } from 'react';
import { BiPurchaseTagAlt } from 'react-icons/bi';
import { FaTimes } from 'react-icons/fa';
import { hexToString } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { getEmoji, removeEmoji, shortenAddress } from '../utils/helpers';
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
  refreshOrders: () => void;
};

export const OrderRow = ({
  item,
  order,
  refreshOrders,
}: OrderRowProps): JSX.Element => {
  const {
    components: { Characters },
    systemCalls: { cancelOrder, fulfillOrder },
  } = useMUD();
  const { renderSuccess, renderError } = useToast();
  const { character } = useCharacter();

  const [isCancelling, setIsCancelling] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const ownerCharacterName = useEntityQuery([
    Has(Characters),
    HasValue(Characters, { owner: order.offerer }),
  ]).map(entity => {
    const { name: nameBytes } = getComponentValueStrict(Characters, entity);
    return hexToString(nameBytes as `0x${string}`, { size: 32 });
  })[0];

  const onCancelOrder = useCallback(async () => {
    try {
      setIsCancelling(true);

      const { error, success } = await cancelOrder(order.orderHash);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Order canceled successfully!');
      refreshOrders();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsCancelling(false);
    }
  }, [cancelOrder, order, refreshOrders, renderError, renderSuccess]);

  const onFulfillOrder = useCallback(async () => {
    try {
      setIsFilling(true);

      const { error, success } = await fulfillOrder(order.orderHash);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Order filled successfully!');
      refreshOrders();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsFilling(false);
    }
  }, [fulfillOrder, order, refreshOrders, renderError, renderSuccess]);

  const isOfferer = useMemo(
    () => order.offerer === character?.owner,
    [character, order.offerer],
  );

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
              From: {ownerCharacterName} {'('}
              {shortenAddress(consideration.recipient)}
              {')'}
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
      <HStack mr={4}>
        {!isOfferer && (
          <Tooltip
            aria-label={
              offer.tokenType === TokenType.ERC20 ? 'Sell item' : 'Buy item'
            }
            bg="black"
            hasArrow
            label={
              offer.tokenType === TokenType.ERC20 ? 'Sell item' : 'Buy item'
            }
            placement="top"
          >
            <Button
              isLoading={isFilling}
              p={2}
              onClick={onFulfillOrder}
              size="sm"
              variant="solid"
            >
              <BiPurchaseTagAlt />
            </Button>
          </Tooltip>
        )}
        {isOfferer && (
          <Tooltip
            aria-label="Cancel order"
            bg="black"
            hasArrow
            label="Cancel order"
            placement="top"
          >
            <Button
              bgColor="red"
              color="white"
              isLoading={isCancelling}
              onClick={onCancelOrder}
              p={2}
              size="sm"
            >
              <FaTimes />
            </Button>
          </Tooltip>
        )}
      </HStack>
    </Flex>
  );
};
