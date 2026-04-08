import {
  Box,
  Button,
  Flex,
  HStack,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BiPurchaseTagAlt } from 'react-icons/bi';
import { FaTimes } from 'react-icons/fa';
import { hexToString } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useTransaction } from '../hooks/useTransaction';
import { useGameTable } from '../lib/gameStore';
import {
  etherToFixedNumber,
  removeEmoji,
  shortenAddress,
} from '../utils/helpers';
import { ItemAsciiIcon } from './ItemAsciiIcon';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  type Order,
  type SpellTemplate,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';


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
  const { t } = useTranslation('ui');
  const {
    systemCalls: { cancelOrder, fulfillOrder },
  } = useMUD();
  const charactersTable = useGameTable('Characters');
  const { character, refreshCharacter } = useCharacter();

  const cancelTx = useTransaction({ actionName: 'cancel listing', showSuccessToast: true, successMessage: 'Listing removed successfully!' });
  const fillTx = useTransaction({ actionName: 'fill order', showSuccessToast: true, successMessage: 'Order filled successfully!' });

  const ownerCharacterName = useMemo(() => {
    if (!charactersTable) return undefined;
    for (const [, row] of Object.entries(charactersTable)) {
      if ((row.owner as string)?.toLowerCase() === order.offerer?.toLowerCase()) {
        return hexToString((row.name as string) as `0x${string}`, { size: 32 });
      }
    }
    return undefined;
  }, [charactersTable, order.offerer]);

  const onCancelOrder = useCallback(async () => {
    const result = await cancelTx.execute(async () => {
      const { error, success } = await cancelOrder(order.orderHash);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      refreshCharacter();
      refreshOrders();
    }
  }, [cancelOrder, cancelTx, order, refreshCharacter, refreshOrders]);

  const insufficientGold = useMemo(() => {
    if (!character) return false;
    if (order.offer.tokenType === TokenType.ERC20) return false;
    return order.consideration.amount > character.externalGoldBalance;
  }, [character, order]);

  const onFulfillOrder = useCallback(async () => {
    if (insufficientGold) return;

    const result = await fillTx.execute(async () => {
      const { error, success } = await fulfillOrder(order.orderHash);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      refreshCharacter();
      refreshOrders();
    }
  }, [
    fillTx,
    fulfillOrder,
    insufficientGold,
    order,
    refreshCharacter,
    refreshOrders,
  ]);

  const isOfferer = useMemo(
    () => order.offerer === character?.owner,
    [character, order.offerer],
  );

  const { consideration, offer } = order;

  return (
    <Flex bgColor="#1C1814" justify="space-between" w="100%">
      <Flex>
        <Box mr={2} flexShrink={0}>
          <ItemAsciiIcon
            name={item.name}
            itemType={item.itemType}
            rarity={item.rarity}
            size={{ base: '48px', sm: '64px' }}
          />
        </Box>
        <VStack
          align="start"
          justify="center"
          ml={{ base: 2, sm: 4 }}
          spacing={{ base: 1, sm: 2 }}
        >
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>
              {t('order.from', { name: ownerCharacterName, address: shortenAddress(consideration.recipient) })}
            </Text>
          </HStack>
          {consideration.tokenType === TokenType.ERC20 ? (
            <Text fontWeight="bold" size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
              {t('order.wantsGoldFor', { gold: etherToFixedNumber(consideration.amount), amount: offer.amount.toString(), item: removeEmoji(item.name) })}
            </Text>
          ) : (
            <Text fontWeight="bold" size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
              {t('order.wantsItemFor', { amount: consideration.amount.toString(), item: removeEmoji(item.name), gold: etherToFixedNumber(offer.amount) })}
            </Text>
          )}
        </VStack>
      </Flex>
      <HStack ml={2} mr={{ base: 2, sm: 4 }}>
        {!isOfferer && (
          <Tooltip
            aria-label={
              insufficientGold
                ? t('order.notEnoughGold')
                : offer.tokenType === TokenType.ERC20 ? t('order.sellItem') : t('order.buyItem')
            }
            bg="#14120F"
            hasArrow
            label={
              insufficientGold
                ? t('order.notEnoughGold')
                : offer.tokenType === TokenType.ERC20 ? t('order.sellItem') : t('order.buyItem')
            }
            placement="top"
          >
            <Button
              isDisabled={insufficientGold}
              isLoading={fillTx.isLoading}
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
            aria-label={t('order.removeListing')}
            bg="#14120F"
            hasArrow
            label={t('order.removeListing')}
            placement="top"
          >
            <Button
              bgColor="red"
              color="white"
              isLoading={cancelTx.isLoading}
              onClick={onCancelOrder}
              p={2}
              size="sm"
              variant="solid"
              _active={{ bgColor: 'darkred' }}
              _hover={{ bgColor: 'darkred' }}
            >
              <FaTimes />
            </Button>
          </Tooltip>
        )}
      </HStack>
    </Flex>
  );
};
