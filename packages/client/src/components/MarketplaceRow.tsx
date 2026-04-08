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
import { useNavigate } from 'react-router-dom';

import { useAllowance } from '../contexts/AllowanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useTransaction } from '../hooks/useTransaction';
import { useOrders } from '../contexts/OrdersContext';
import { ITEM_PATH } from '../Routes';
import { etherToFixedNumber, removeEmoji } from '../utils/helpers';
import { ItemAsciiIcon } from './ItemAsciiIcon';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemType,
  type Order,
  OrderType,
  Rarity,
  RARITY_COLORS,
  type SpellTemplate,
  SystemToAllow,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';

import { ForwardCaretSvg } from './SVGs/ForwardCaretSvg';

export const MarketplaceRow = ({
  cheapestOrder,
  highestOffer,
  highestOfferOrder,
  itemType,
  lowestPrice,
  minLevel,
  name,
  orderType,
  tokenId,
  ...item
}: (ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate) & {
  cheapestOrder?: Order;
  highestOffer: string;
  highestOfferOrder?: Order;
  lowestPrice: string;
  orderType: OrderType;
}): JSX.Element => {
  const { t } = useTranslation('ui');
  const navigate = useNavigate();
  const { authMethod } = useAuth();
  const { character, refreshCharacter } = useCharacter();
  const {
    systemCalls: { fulfillOrder },
  } = useMUD();
  const { ensureGoldAllowance, goldMarketplaceAllowance } = useAllowance();
  const { refreshOrders } = useOrders();

  const buyTx = useTransaction({
    actionName: 'buy item',
    showSuccessToast: true,
    successMessage: t('marketplace.bought', { name: removeEmoji(name) }),
  });

  const acceptTx = useTransaction({
    actionName: 'accept offer',
    showSuccessToast: true,
    successMessage: t('marketplace.sold', { name: removeEmoji(name) }),
  });

  const rarityColor = item.rarity !== undefined ? RARITY_COLORS[item.rarity] : undefined;
  const hasRarityAccent = item.rarity !== undefined && item.rarity >= Rarity.Rare;

  const newSearchParams = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('orderType', orderType);
    return searchParams;
  }, [orderType]);

  const insufficientGold = useMemo(() => {
    if (!character || !cheapestOrder) return false;
    return cheapestOrder.consideration.amount > character.externalGoldBalance;
  }, [character, cheapestOrder]);

  const onBuyNow = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cheapestOrder || !character) return;

    // Check allowance for embedded wallets
    if (authMethod === 'embedded' && goldMarketplaceAllowance < cheapestOrder.consideration.amount) {
      const ok = await ensureGoldAllowance(SystemToAllow.Marketplace, cheapestOrder.consideration.amount);
      if (!ok) return;
    } else if (authMethod !== 'embedded' && goldMarketplaceAllowance < cheapestOrder.consideration.amount) {
      // External wallet needs allowance — send to detail page
      navigate(`${ITEM_PATH}/${tokenId}?orderType=${OrderType.Buying}`);
      return;
    }

    const result = await buyTx.execute(async () => {
      const { error, success } = await fulfillOrder(cheapestOrder.orderHash);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      refreshCharacter();
      refreshOrders();
    }
  }, [
    authMethod,
    buyTx,
    character,
    cheapestOrder,
    ensureGoldAllowance,
    fulfillOrder,
    goldMarketplaceAllowance,
    name,
    navigate,
    refreshCharacter,
    refreshOrders,
    tokenId,
  ]);

  const onAcceptOffer = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!highestOfferOrder || !character) return;

    const result = await acceptTx.execute(async () => {
      const { error, success } = await fulfillOrder(highestOfferOrder.orderHash);
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      refreshCharacter();
      refreshOrders();
    }
  }, [acceptTx, character, fulfillOrder, highestOfferOrder, refreshCharacter, refreshOrders]);

  const goToDetail = useCallback(() => {
    navigate(`${ITEM_PATH}/${tokenId}?${newSearchParams}`);
  }, [navigate, newSearchParams, tokenId]);

  // Determine which inline action to show
  const showBuyButton = orderType === OrderType.Buying && cheapestOrder && Number(lowestPrice) > 0;
  const showAcceptButton = orderType === OrderType.Selling && highestOfferOrder && Number(highestOffer) > 0;
  const isOwnListing = cheapestOrder?.offerer === character?.owner;
  const isOwnOffer = highestOfferOrder?.offerer === character?.owner;

  return (
    <Flex
      bgColor="#1C1814"
      borderLeft={hasRarityAccent ? `3px solid ${rarityColor}` : undefined}
      justify="space-between"
      onClick={goToDetail}
      px={{ base: 2, sm: 3, md: 4 }}
      py={{ base: 2, md: 3 }}
      w="100%"
      cursor="pointer"
      _hover={{
        bg: '#221E18',
      }}
      transition="background 0.15s"
    >
      {/* Left: Item info */}
      <Flex flex={1} minW={0}>
        <Box mr={2} flexShrink={0}>
          <ItemAsciiIcon
            name={name}
            itemType={itemType}
            rarity={item.rarity}
            size={{ base: '48px', md: '64px' }}
          />
        </Box>
        <VStack align="start" justify="center" ml={{ base: 2, md: 4 }} spacing={0} minW={0}>
          <Text
            color={rarityColor}
            fontWeight={700}
            size={{ base: 'sm', lg: 'md' }}
            noOfLines={1}
          >
            {removeEmoji(name)}
          </Text>
          {itemType !== ItemType.Spell && (
            <Text
              color="#8A7E6A"
              fontWeight={500}
              size={{ base: '3xs', sm: '2xs', lg: 'xs' }}
              noOfLines={1}
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
          {/* Mobile price — shown below stats */}
          <Text
            color={Number(lowestPrice) > 0 ? '#D4A54A' : '#5A5040'}
            display={{ base: 'block', md: 'none' }}
            fontFamily="'Fira Code', monospace"
            fontSize="xs"
            fontWeight={600}
            mt={0.5}
          >
            {Number(lowestPrice) > 0
              ? `${Number(lowestPrice).toLocaleString()} $GOLD`
              : t('marketplace.noListings')}
          </Text>
        </VStack>
      </Flex>

      {/* Right: Price columns (desktop) + Action */}
      <HStack spacing={0} flexShrink={0}>
        {/* Desktop columns */}
        <HStack w={{ base: '0px', md: '250px', lg: '350px' }} display={{ base: 'none', md: 'flex' }}>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'sm' }}
            textAlign="center"
            w="100%"
          >
            {Number(minLevel).toLocaleString()}
          </Text>
          <Text
            color={Number(lowestPrice) > 0 ? '#D4A54A' : '#8A7E6A'}
            fontFamily="'Fira Code', monospace"
            fontWeight={600}
            size={{ base: 'xs', lg: 'sm' }}
            textAlign="center"
            w="100%"
          >
            {Number(lowestPrice) == 0
              ? 'N/A'
              : `${Number(lowestPrice).toLocaleString()}`}
          </Text>
          <Text
            color={Number(highestOffer) > 0 ? '#A8DEFF' : '#8A7E6A'}
            fontFamily="'Fira Code', monospace"
            fontWeight={500}
            size={{ base: 'xs', lg: 'sm' }}
            textAlign="center"
            w="100%"
          >
            {Number(highestOffer) == 0
              ? 'N/A'
              : `${Number(highestOffer).toLocaleString()}`}
          </Text>
        </HStack>

        {/* Action button */}
        <Box w={{ base: 'auto', md: '100px' }} ml={{ base: 2, md: 3 }} display="flex" justifyContent="center">
          {showBuyButton && !isOwnListing ? (
            <Tooltip
              hasArrow
              isDisabled={!insufficientGold}
              label={t('marketplace.notEnoughGold')}
              placement="top"
            >
              <Button
                bg="#C87A2A"
                color="#E8DCC8"
                fontSize={{ base: '2xs', sm: 'xs' }}
                h={{ base: '32px', md: '34px' }}
                isDisabled={insufficientGold}
                isLoading={buyTx.isLoading}
                loadingText="..."
                minW={{ base: '60px', md: '80px' }}
                onClick={onBuyNow}
                px={{ base: 2, md: 3 }}
                size="sm"
                _hover={{ bg: '#E8A840' }}
                _active={{ bg: '#A86820' }}
              >
                Buy
              </Button>
            </Tooltip>
          ) : showAcceptButton && !isOwnOffer ? (
            <Button
              bg="transparent"
              border="1px solid #C87A2A"
              color="#C87A2A"
              fontSize={{ base: '2xs', sm: 'xs' }}
              h={{ base: '32px', md: '34px' }}
              isLoading={acceptTx.isLoading}
              loadingText="..."
              minW={{ base: '60px', md: '80px' }}
              onClick={onAcceptOffer}
              px={{ base: 2, md: 3 }}
              size="sm"
              _hover={{ bg: 'rgba(200,122,42,0.15)', borderColor: '#E8A840' }}
              _active={{ bg: 'rgba(200,122,42,0.25)' }}
            >
              Accept
            </Button>
          ) : (
            <Button
              display={{ base: 'none', md: 'flex' }}
              size="sm"
              variant="ghost"
              onClick={goToDetail}
            >
              <ForwardCaretSvg />
            </Button>
          )}
        </Box>
      </HStack>
    </Flex>
  );
};
