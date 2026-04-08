import {
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  Grid,
  GridItem,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io';

import { useAllowance } from '../contexts/AllowanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import {
  etherToFixedNumber,
  getStatSymbol,
  removeEmoji,
} from '../utils/helpers';
import { ItemAsciiIcon } from './ItemAsciiIcon';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemType,
  OrderType,
  Rarity,
  RARITY_COLORS,
  Shop,
  type SpellTemplate,
  SystemToAllow,
  type WeaponTemplate,
} from '../utils/types';

import { PolygonalCard } from './PolygonalCard';
import { ShopAllowanceModal } from './ShopAllowanceModal';
import { ForwardCaretSvg } from './SVGs/ForwardCaretSvg';

export const ShopItemRow = ({
  balance,
  characterId,
  isEquipped,
  item,
  itemIndex,
  onTradeComplete,
  orderType,
  stock,
  shop,
  theme,
}: {
  balance: bigint | null;
  characterId: string;
  isEquipped: boolean;
  item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
  itemIndex: string;
  onTradeComplete?: (tokenId: string, amount: number, goldDelta: bigint, orderType: OrderType) => void;
  orderType: OrderType;
  shop: Shop;
  stock: bigint | null;
  theme: string;
}): JSX.Element => {
  const { t } = useTranslation('ui');
  const {
    systemCalls: { buy, sell },
  } = useMUD();
  const { renderSuccess, renderError } = useToast();

  const {
    ensureGoldAllowance,
    ensureItemsAllowance,
    goldShopAllowance,
    itemsShopAllowance,
    isApprovingGold,
    isApprovingItems,
  } = useAllowance();
  const { authMethod } = useAuth();
  const { character: userCharacter } = useCharacter();

  const {
    isOpen: isAllowanceOpen,
    onOpen: onAllowanceOpen,
    onClose: onAllowanceClose,
  } = useDisclosure();

  const shopTx = useTransaction({ actionName: 'shop', showSuccessToast: false });

  const [amount, setAmount] = useState(1);
  const [showError, setShowError] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const { name, statRestrictions } = item;
  const rarityColor = item.rarity !== undefined ? RARITY_COLORS[item.rarity] : undefined;
  const hasRarityAccent = item.rarity !== undefined && item.rarity >= Rarity.Rare;

  const price = useMemo(() => {
    if (orderType == OrderType.Selling)
      return BigInt(amount) * ((item.price * shop.priceMarkdown) / 10_000n);
    return (
      BigInt(amount) * (item.price + (item.price * shop.priceMarkup) / 10_000n)
    );
  }, [amount, item.price, orderType, shop.priceMarkdown, shop.priceMarkup]);

  const priceSingle = useMemo(() => {
    if (orderType == OrderType.Selling)
      return (item.price * shop.priceMarkdown) / 10_000n;
    return item.price + (item.price * shop.priceMarkup) / 10_000n;
  }, [item.price, orderType, shop.priceMarkdown, shop.priceMarkup]);

  const insufficientStock = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Selling) return false;
    if (!stock) return true;
    return stock < 1;
  }, [orderType, stock, userCharacter]);

  const insufficientGold = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Selling) return false;
    return price > BigInt(userCharacter.externalGoldBalance);
  }, [orderType, price, userCharacter]);

  const unsellableError = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Buying) return false;
    if (!balance) return false;
    if (Number(balance) - amount !== 0) return false;
    return isEquipped;
  }, [amount, balance, isEquipped, orderType, userCharacter]);

  const onBuyOrSell = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (insufficientGold) {
        setShowError(true);
        return;
      }
      if (insufficientStock) {
        setShowError(true);
        return;
      }
      if (unsellableError) {
        setShowError(true);
        return;
      }

      if (orderType == OrderType.Buying && goldShopAllowance < price) {
        if (authMethod === 'embedded') {
          const ok = await ensureGoldAllowance(SystemToAllow.Shop, price);
          if (!ok) return;
        } else {
          onAllowanceOpen();
          return;
        }
      }
      if (orderType == OrderType.Selling && !itemsShopAllowance) {
        if (authMethod === 'embedded') {
          const ok = await ensureItemsAllowance(SystemToAllow.Shop);
          if (!ok) return;
        } else {
          onAllowanceOpen();
          return;
        }
      }

      const result = await shopTx.execute(async () => {
        if (orderType == OrderType.Buying) {
          const { error, success } = await buy(
            BigInt(amount),
            shop.shopId,
            itemIndex,
            characterId,
          );
          if (error && !success) throw new Error(error);
          return success;
        } else {
          const { error, success } = await sell(
            BigInt(amount),
            shop.shopId,
            item.tokenId,
            characterId,
          );
          if (error && !success) throw new Error(error);
          return success;
        }
      });

      if (result !== undefined) {
        const itemName = name ? removeEmoji(name.toString()) : 'Item';
        renderSuccess(
          orderType == OrderType.Buying
            ? t('shop.boughtItems', { amount, name: itemName })
            : t('shop.soldItems', { amount, name: itemName, gold: etherToFixedNumber(price) }),
        );
        import('../utils/analytics').then(({ trackShopPurchase, trackShopSale }) => {
          const gold = Number(etherToFixedNumber(price));
          if (orderType == OrderType.Buying) trackShopPurchase(itemName, gold);
          else trackShopSale(itemName, gold);
        });
        onTradeComplete?.(item.tokenId, amount, price, orderType);
        onAllowanceClose();
        onClose();
      }
    },
    [
      amount,
      authMethod,
      buy,
      characterId,
      ensureGoldAllowance,
      ensureItemsAllowance,
      goldShopAllowance,
      insufficientGold,
      insufficientStock,
      item.tokenId,
      itemIndex,
      itemsShopAllowance,
      name,
      onAllowanceClose,
      onAllowanceOpen,
      onClose,
      onTradeComplete,
      orderType,
      price,
      renderSuccess,
      sell,
      shop.shopId,
      shopTx,
      unsellableError,
    ],
  );

  // Reset showError state when any of the form fields change
  useEffect(() => {
    if (!isOpen) {
      setAmount(1);
    }
    setShowError(false);
  }, [isOpen, price]);

  return (
    <Flex
      borderBottom={`2px solid ${theme || 'white'}`}
      borderLeft={hasRarityAccent ? `3px solid ${rarityColor}` : undefined}
      boxShadow="inset 0 1px 3px rgba(0,0,0,0.4), inset 0 -1px 2px rgba(196,184,158,0.05)"
      justify="space-between"
      onClick={onOpen}
      transition="all 0.3s"
      w="100%"
      _hover={{
        borderBottom: '2px solid #3A3228',
        cursor: 'pointer',
        button: {
          bgColor: 'grey300',
        },
      }}
      _active={{
        borderBottom: '2px solid #3A3228',
        button: {
          bgColor: 'grey400',
        },
      }}
    >
      <Flex>
        <Box mr={2}>
          <ItemAsciiIcon
            name={name?.toString() ?? ''}
            itemType={item.itemType}
            rarity={item.rarity}
            size={{ base: '48px', sm: '64px' }}
          />
        </Box>
        <VStack justify="center" ml={{ base: 0, sm: 4 }}>
          <Text
            color={rarityColor}
            fontWeight={700}
            size={{ base: 'xs', sm: 'md', lg: 'lg' }}
          >
            {name ? removeEmoji(name.toString()) : ''}
          </Text>
        </VStack>
      </Flex>
      <HStack>
        <HStack w="100%">
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w={{ base: '50px', sm: '75px' }}
          />
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w={{ base: '50px', sm: '75px' }}
          >
            {balance?.toString() || stock?.toString()}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {etherToFixedNumber(priceSingle)}
          </Text>
        </HStack>
        <Box display={{ base: 'none', md: 'block' }} mr={2} w="40px">
          <Button onClick={onOpen} p={1} variant="ghost">
            <ForwardCaretSvg />
          </Button>
        </Box>
      </HStack>

      {authMethod !== 'embedded' && (
        <ShopAllowanceModal
          completeMessage={
            orderType === OrderType.Buying
              ? t('shop.buyAllowanceSuccess', { name })
              : t('shop.sellAllowanceSuccess', { name })
          }
          isCompleting={shopTx.isLoading}
          isOpen={isAllowanceOpen}
          itemName={name}
          onClose={onAllowanceClose}
          onComplete={onBuyOrSell}
          orderPrice={price}
          orderType={orderType}
        />
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={onBuyOrSell}>
          <PolygonalCard isModal />
          <ModalCloseButton />
          <ModalHeader>
            <Text fontWeight={700} fontSize={28}>
              {orderType == OrderType.Buying ? t('shop.buy') : t('shop.sell')}{' '}
              {name ? removeEmoji(name.toString()) : ''}
            </Text>
          </ModalHeader>
          <ModalBody>
            <Grid
              gap={{ base: 4, sm: 10 }}
              px={6}
              templateColumns="repeat(2, 1fr)"
              templateRows="2fr"
            >
              <GridItem colSpan={{ base: 2, sm: 1 }}>
                <ItemAsciiIcon
                  name={name?.toString() ?? ''}
                  itemType={item.itemType}
                  rarity={item.rarity}
                  size="64px"
                />

                <Text mt={{ base: 4, sm: 8 }} size="sm">
                  {item?.description || ''}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 2, sm: 1 }}>
                <Text fontWeight={700} size="sm">
                  {t('shop.stats')}
                </Text>
                {(item.itemType === ItemType.Armor ||
                  (item.itemType === ItemType.Consumable &&
                    (item as ConsumableTemplate).hpRestoreAmount ===
                      BigInt(0)) ||
                  item.itemType === ItemType.Weapon) && (
                  <Text size="sm">
                    - STR
                    {getStatSymbol(
                      (item as WeaponTemplate).strModifier.toString(),
                    )}
                    {(item as WeaponTemplate).strModifier.toString()} AGI
                    {getStatSymbol(
                      (item as WeaponTemplate).agiModifier.toString(),
                    )}
                    {(item as WeaponTemplate).agiModifier.toString()} INT
                    {getStatSymbol(
                      (item as WeaponTemplate).intModifier.toString(),
                    )}
                    {(item as WeaponTemplate).intModifier.toString()}{' '}
                  </Text>
                )}
                {(item.itemType === ItemType.Spell ||
                  item.itemType === ItemType.Weapon) && (
                  <>
                    <Text size="sm">
                      - {t('shop.minDamage')}{' '}
                      {(
                        item as SpellTemplate | WeaponTemplate
                      ).minDamage.toString()}
                    </Text>
                    <Text size="sm">
                      - {t('shop.maxDamage')}{' '}
                      {(
                        item as SpellTemplate | WeaponTemplate
                      ).maxDamage.toString()}
                    </Text>
                  </>
                )}
                {item.itemType == ItemType.Consumable &&
                  (item as ConsumableTemplate).hpRestoreAmount !==
                    BigInt(0) && (
                    <Text size="sm">
                      Restores{' '}
                      {(item as ConsumableTemplate).hpRestoreAmount.toString()}{' '}
                      HP
                    </Text>
                  )}
                {item.itemType == ItemType.Armor && (
                  <Text size="sm">
                    {(item as ArmorTemplate).armorModifier
                      ? `ARM${getStatSymbol((item as ArmorTemplate).armorModifier.toString())}${(item as ArmorTemplate).armorModifier}`
                      : ''}
                  </Text>
                )}

                <Text fontWeight={700} mt={8} size="sm">
                  {t('shop.restrictions')}
                </Text>
                <Text size="sm">- LVL {item?.minLevel.toString() || '0'}</Text>
                <Text size="sm">
                  - {statRestrictions.minAgility.toString()} AGI
                </Text>
                <Text size="sm">
                  - {statRestrictions.minIntelligence.toString()} INT
                </Text>
                <Text size="sm">
                  - {statRestrictions.minStrength.toString()} STR
                </Text>
              </GridItem>
              <GridItem colSpan={2} textAlign="center" onSubmit={onBuyOrSell}>
                <VStack spacing={4}>
                  <VStack>
                    <Text fontSize={{ base: 'sm' }} fontWeight={500}>
                      {t('shop.maxItems', { count: stock?.toString() || balance?.toString() })}
                    </Text>
                    <HStack>
                      <Button
                        aspectRatio="1 / 1"
                        background="#24201A"
                        boxShadow="1.5px 1.5px 3px 0px rgba(0,0,0,0.3), -1px -1px 3px 0px rgba(0,0,0,0.2)"
                        borderRadius="5px"
                        color="#C87A2A"
                        minW="24px"
                        minH="24px"
                        isDisabled={amount <= 1}
                        onClick={() =>
                          setAmount(
                            amount > 1 &&
                              amount <= Number(stock || balance?.toString())
                              ? amount - 1
                              : amount,
                          )
                        }
                        size="xs"
                        variant="ghost"
                      >
                        <IoIosArrowBack />
                      </Button>
                      <Input
                        aspectRatio="1 / 1"
                        background="#14120F"
                        boxShadow="inset 0 1px 3px rgba(0,0,0,0.4), inset 0 -1px 2px rgba(196,184,158,0.05)"
                        fontSize="lg"
                        fontWeight={500}
                        max={stock?.toString() || balance?.toString() || 0}
                        min={1}
                        minW="55px"
                        minH="55px"
                        onChange={e => {
                          const { value } = e.target;
                          if (value === '') {
                            setAmount(0);
                            return;
                          }
                          if (isNaN(Number(value))) {
                            return;
                          }
                          if (Number(value) < 1) {
                            return;
                          }
                          if (
                            Number(value) > Number(stock || balance?.toString())
                          ) {
                            setAmount(Number(stock || balance?.toString()));
                            return;
                          }
                          setAmount(Number(value));
                        }}
                        p={4}
                        size="sm"
                        step={1}
                        value={amount === 0 ? '' : amount}
                        w={10}
                      />
                      <Button
                        aspectRatio="1 / 1"
                        background="#24201A"
                        boxShadow="1.5px 1.5px 3px 0px rgba(0,0,0,0.3), -1px -1px 3px 0px rgba(0,0,0,0.2)"
                        borderRadius="5px"
                        color="#C87A2A"
                        minW="24px"
                        minH="24px"
                        isDisabled={
                          amount === Number(stock || balance?.toString())
                        }
                        onClick={() =>
                          setAmount(
                            amount > -1 &&
                              amount < Number(stock || balance?.toString())
                              ? amount + 1
                              : amount,
                          )
                        }
                        size="xs"
                        variant="ghost"
                      >
                        <IoIosArrowForward />
                      </Button>
                    </HStack>
                  </VStack>
                  <Box
                    bg="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="1px"
                    w="100%"
                  />
                  <VStack>
                    {orderType == OrderType.Buying ? (
                      <Text fontSize={{ base: 'sm' }} fontWeight={700}>
                        {t('shop.totalCost', { amount: etherToFixedNumber(price) })}
                      </Text>
                    ) : (
                      <Text fontSize={{ base: 'sm' }} fontWeight={700}>
                        {t('shop.totalReceive', { amount: etherToFixedNumber(price) })}
                      </Text>
                    )}
                    <Text color="#8A7E6A" size="xs">
                      {t('shop.currentBalance', { amount: etherToFixedNumber(
                        userCharacter?.externalGoldBalance ?? '0',
                      ) })}
                    </Text>
                  </VStack>
                </VStack>
              </GridItem>
            </Grid>
          </ModalBody>

          <ModalFooter>
            <FormControl
              alignItems="center"
              display="flex"
              flexDirection="column"
              isInvalid={
                showError &&
                (insufficientGold || unsellableError || insufficientStock)
              }
            >
              {showError && insufficientStock && (
                <FormHelperText color="red" m={3}>
                  {t('shop.insufficientStock')}
                </FormHelperText>
              )}
              {showError && insufficientGold && (
                <FormHelperText color="red" m={3}>
                  {t('shop.notEnoughGold')}
                </FormHelperText>
              )}
              {showError && unsellableError && (
                <FormHelperText color="red" m={3}>
                  {t('shop.cantSellEquipped')}
                </FormHelperText>
              )}
              <HStack gap={3}>
                <Button onClick={onClose} variant="ghost">
                  {t('common.cancel')}
                </Button>
                {authMethod !== 'embedded' && orderType == OrderType.Buying && goldShopAllowance < price && (
                  <Button
                    type="submit"
                    isLoading={
                      isApprovingGold || isApprovingItems || shopTx.isLoading
                    }
                  >
                    {t('shop.approve')}
                  </Button>
                )}
                {authMethod !== 'embedded' && orderType == OrderType.Selling && !itemsShopAllowance && (
                  <Button
                    type="submit"
                    isLoading={
                      isApprovingGold || isApprovingItems || shopTx.isLoading
                    }
                  >
                    {t('shop.approve')}
                  </Button>
                )}
                {orderType == OrderType.Buying &&
                  (authMethod === 'embedded' || goldShopAllowance >= price) && (
                    <Button
                      type="submit"
                      isLoading={
                        isApprovingGold || isApprovingItems || shopTx.isLoading
                      }
                    >
                      {t('shop.buy')}
                    </Button>
                  )}
                {orderType == OrderType.Selling &&
                  (authMethod === 'embedded' || itemsShopAllowance) && (
                    <Button
                      type="submit"
                      isLoading={
                        isApprovingGold || isApprovingItems || shopTx.isLoading
                      }
                    >
                      {t('shop.sell')}
                    </Button>
                  )}
              </HStack>
            </FormControl>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
};
