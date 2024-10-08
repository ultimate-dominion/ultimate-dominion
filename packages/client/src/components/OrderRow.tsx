import {
  Avatar,
  Button,
  Flex,
  HStack,
  Text,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useEntityQuery } from '@latticexyz/react';
import { getComponentValueStrict, Has, HasValue } from '@latticexyz/recs';
import { useCallback, useMemo, useState } from 'react';
import { BiPurchaseTagAlt } from 'react-icons/bi';
import { FaTimes } from 'react-icons/fa';
import { hexToString } from 'viem';

import { useAllowance } from '../contexts/AllowanceContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import {
  etherToFixedNumber,
  getEmoji,
  removeEmoji,
  shortenAddress,
} from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  type Order,
  OrderType,
  type SpellTemplate,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';
import { MarketplaceAllowanceModal } from './MarketplaceAllowanceModal';

type OrderRowProps = {
  item: ArmorTemplate | ConsumableTemplate | WeaponTemplate | SpellTemplate;
  order: Order;
  refreshOrders: () => void;
};

export const OrderRow = ({
  item,
  order,
  refreshOrders,
}: OrderRowProps): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    components: { Characters },
    systemCalls: { cancelOrder, fulfillOrder },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { goldMarketplaceAllowance, itemsMarketplaceAllowance } =
    useAllowance();

  const [isCancelling, setIsCancelling] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const {
    isOpen: isAllowanceModalOpen,
    onClose: onCloseAllowanceModal,
    onOpen: onOpenAllowanceModal,
  } = useDisclosure();

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

      renderSuccess('Listing removed successfully!');
      refreshCharacter();
      refreshOrders();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsCancelling(false);
    }
  }, [
    cancelOrder,
    order,
    refreshCharacter,
    refreshOrders,
    renderError,
    renderSuccess,
  ]);

  const insufficientGold = useMemo(() => {
    if (!character) return false;
    if (order.offer.tokenType === TokenType.ERC20) return false;
    return order.consideration.amount > character.externalGoldBalance;
  }, [character, order]);

  const onFulfillOrder = useCallback(async () => {
    try {
      setIsFilling(true);

      if (insufficientGold) {
        throw new Error('Insufficient gold balance.');
      }

      if (
        order.consideration.tokenType === TokenType.ERC20 &&
        goldMarketplaceAllowance < order.consideration.amount
      ) {
        onOpenAllowanceModal();
        return;
      }

      if (
        order.offer.tokenType === TokenType.ERC20 &&
        !itemsMarketplaceAllowance
      ) {
        onOpenAllowanceModal();
        return;
      }

      const { error, success } = await fulfillOrder(order.orderHash);

      if (error && !success) {
        throw new Error(error);
      }

      renderSuccess('Order filled successfully!');
      onCloseAllowanceModal();
      refreshCharacter();
      refreshOrders();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsFilling(false);
    }
  }, [
    fulfillOrder,
    goldMarketplaceAllowance,
    insufficientGold,
    itemsMarketplaceAllowance,
    onCloseAllowanceModal,
    onOpenAllowanceModal,
    order,
    refreshCharacter,
    refreshOrders,
    renderError,
    renderSuccess,
  ]);

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
          size={{ base: 'md', sm: 'lg' }}
          name={' '}
          backgroundColor="grey300"
        >
          {getEmoji(item.name)}
        </Avatar>
        <VStack
          align="start"
          justify="center"
          ml={{ base: 2, sm: 4 }}
          spacing={{ base: 1, sm: 2 }}
        >
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>
              From: {ownerCharacterName} {'('}
              {shortenAddress(consideration.recipient)}
              {')'}
            </Text>
          </HStack>
          {consideration.tokenType === TokenType.ERC20 ? (
            <Text fontWeight="bold" size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
              Wants {etherToFixedNumber(consideration.amount)} $GOLD for{' '}
              {offer.amount.toString()} {removeEmoji(item.name)}
            </Text>
          ) : (
            <Text fontWeight="bold" size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
              Wants {consideration.amount.toString()} {removeEmoji(item.name)}{' '}
              for {etherToFixedNumber(offer.amount)} $GOLD
            </Text>
          )}
        </VStack>
      </Flex>
      <HStack ml={2} mr={{ base: 2, sm: 4 }}>
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
            aria-label="Remove listing"
            bg="black"
            hasArrow
            label="Remove listing"
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
      <MarketplaceAllowanceModal
        completeMessage="Allowance was successful! You can now complete the order."
        isCompleting={isFilling}
        isOpen={isAllowanceModalOpen}
        itemName={item.name}
        onClose={onCloseAllowanceModal}
        onComplete={onFulfillOrder}
        orderPrice={
          consideration.tokenType === TokenType.ERC20
            ? consideration.amount
            : offer.amount
        }
        orderType={
          consideration.tokenType === TokenType.ERC20
            ? OrderType.Buying
            : OrderType.Selling
        }
      />
    </Flex>
  );
};
