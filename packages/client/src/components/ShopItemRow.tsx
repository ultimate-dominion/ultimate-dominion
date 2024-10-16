import {
  Avatar,
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
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { Entity } from '@latticexyz/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io';

import { useAllowance } from '../contexts/AllowanceContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import {
  etherToFixedNumber,
  getEmoji,
  getStatSymbol,
  removeEmoji,
} from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  ItemType,
  OrderType,
  Shop,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';
import { PolygonalCard } from './PolygonalCard';
import { ShopAllowanceModal } from './ShopAllowanceModal';
import { ForwardCaretSvg } from './SVGs/ForwardCaretSvg';

export const ShopItemRow = ({
  balance,
  characterId,
  item,
  itemIndex,
  orderType,
  unsellable,
  stock,
  shop,
  theme,
}: {
  balance: bigint | null;
  characterId: Entity;
  item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
  itemIndex: string;
  orderType: OrderType;
  unsellable: boolean;
  shop: Shop;
  stock: bigint | null;
  theme: string;
}): JSX.Element => {
  const {
    systemCalls: { buy, sell },
  } = useMUD();
  const { renderSuccess, renderError } = useToast();

  const {
    goldShopAllowance,
    itemsShopAllowance,
    isApprovingGold,
    isApprovingItems,
  } = useAllowance();
  const { character: userCharacter, refreshCharacter } = useCharacter();

  const {
    isOpen: isAllowanceOpen,
    onOpen: onAllowanceOpen,
    onClose: onAllowanceClose,
  } = useDisclosure();

  const [amount, setAmount] = useState(1);
  const [showError, setShowError] = useState(false);
  const [isTxPending, setIsTxPending] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const { name, statRestrictions } = item;

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

  const insufficientGold = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Selling) return false;
    return price > BigInt(userCharacter.externalGoldBalance);
  }, [orderType, price, userCharacter]);

  const unsellableError = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Buying) return false;
    return unsellable;
  }, [orderType, unsellable, userCharacter]);

  const onBuyOrSell = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (insufficientGold) {
        setShowError(true);
        return;
      }
      if (unsellableError) {
        setShowError(true);
        return;
      }
      try {
        setIsTxPending(true);
        if (orderType == OrderType.Buying && goldShopAllowance < price) {
          onAllowanceOpen();
          setIsTxPending(false);
          return;
        }
        if (orderType == OrderType.Selling && !itemsShopAllowance) {
          onAllowanceOpen();
          setIsTxPending(false);
          return;
        }

        if (orderType == OrderType.Buying) {
          const { error, success } = await buy(
            BigInt(amount),
            shop.shopId,
            itemIndex,
            characterId,
          );
          if (error && !success) {
            throw new Error(error);
          }

          renderSuccess('Item purchased successfully!');
        } else {
          const { error, success } = await sell(
            BigInt(amount),
            shop.shopId,
            itemIndex,
            characterId,
          );
          if (error && !success) {
            throw new Error(error);
          }
          renderSuccess('Item sold successfully!');
        }

        onAllowanceClose();
        onClose();
        refreshCharacter();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Shop transaction failed', e);
      } finally {
        setIsTxPending(false);
      }
    },
    [
      amount,
      buy,
      characterId,
      goldShopAllowance,
      insufficientGold,
      itemIndex,
      itemsShopAllowance,
      onAllowanceClose,
      onAllowanceOpen,
      onClose,
      orderType,
      price,
      refreshCharacter,
      renderError,
      renderSuccess,
      sell,
      shop.shopId,
      unsellableError,
    ],
  );

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [price]);

  return (
    <Flex
      background="#F5F5FA1F"
      borderBottom={`4px solid ${theme || 'white'}`}
      boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset;"
      justify="space-between"
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
      onClick={onOpen}
    >
      <Flex>
        <Avatar
          backgroundColor="transparent"
          borderRadius={0}
          name=" "
          size="lg"
        >
          {name ? getEmoji(name.toString()) : ''}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text fontWeight={700} size={{ base: 'lg', lg: 'xl' }}>
              {name ? removeEmoji(name.toString()) : ''}
            </Text>
          </HStack>
        </VStack>
      </Flex>
      <HStack>
        <HStack w="100%">
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="75px"
          />
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="75px"
          >
            {balance?.toString() || stock?.toString()}
          </Text>
          <Text
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {etherToFixedNumber(priceSingle)}
          </Text>
        </HStack>

        <ShopAllowanceModal
          completeMessage={
            orderType === OrderType.Buying
              ? `Allowance was successful! You can now buy ${name}`
              : `Allowance was successful! You can now sell ${name}`
          }
          isCompleting={isTxPending}
          isOpen={isAllowanceOpen}
          itemName={name}
          onClose={onAllowanceClose}
          onComplete={onBuyOrSell}
          orderPrice={price}
          orderType={orderType}
        />

        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <PolygonalCard isModal />
            <ModalCloseButton />
            <ModalHeader>
              <Text fontWeight={700} fontSize={24}>
                {orderType == OrderType.Buying ? 'Buy' : 'Sell'}{' '}
                {name ? removeEmoji(name.toString()) : ''}
              </Text>
            </ModalHeader>
            <ModalBody>
              <Grid
                gap={10}
                p={5}
                templateColumns="repeat(2,1fr)"
                templateRows="2fr"
              >
                <GridItem>
                  <Avatar
                    backgroundColor={'grey300'}
                    borderRadius={0}
                    name={' '}
                    size="lg"
                  >
                    {name ? getEmoji(name.toString()) : ''}
                  </Avatar>

                  <Text fontWeight={400} fontSize={14} mt={8}>
                    {item?.description || ''}
                  </Text>
                </GridItem>
                <GridItem>
                  <Text fontWeight={700} fontSize={14}>
                    Stats
                  </Text>
                  {(item.itemType == ItemType.Armor ||
                    (item.itemType == ItemType.Consumable &&
                      (item as ConsumableTemplate).hpRestoreAmount ===
                        BigInt(0)) ||
                    item.itemType == ItemType.Weapon) && (
                    <Text fontWeight={400} fontSize={14}>
                      STR
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
                  {item.itemType == ItemType.Consumable &&
                    (item as ConsumableTemplate).hpRestoreAmount !==
                      BigInt(0) && (
                      <Text fontWeight={400} fontSize={14}>
                        Restores{' '}
                        {(
                          item as ConsumableTemplate
                        ).hpRestoreAmount.toString()}{' '}
                        HP
                      </Text>
                    )}
                  {item.itemType == ItemType.Armor && (
                    <Text fontWeight={400} fontSize={14}>
                      {(item as ArmorTemplate).armorModifier
                        ? `ARM${getStatSymbol((item as ArmorTemplate).armorModifier.toString())}${(item as ArmorTemplate).armorModifier}`
                        : ''}
                    </Text>
                  )}

                  <Text mt={8} fontWeight={700} fontSize={14}>
                    Restrictions
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    - LVL {item?.minLevel.toString() || '0'}
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    -{' '}
                    {statRestrictions['minIntelligence']
                      ? statRestrictions.minIntelligence.toString()
                      : 0}{' '}
                    INT
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    -{' '}
                    {statRestrictions['minStrength']
                      ? statRestrictions.minIntelligence?.toString()
                      : 0}{' '}
                    STR
                  </Text>
                </GridItem>
                <GridItem
                  colSpan={2}
                  textAlign="center"
                  as="form"
                  onSubmit={onBuyOrSell}
                >
                  <VStack spacing={4}>
                    <VStack>
                      <Text fontSize={{ base: 'sm' }} fontWeight={500}>
                        max {stock?.toString() || balance?.toString()} items
                      </Text>
                      <HStack>
                        <Button
                          aspectRatio="1 / 1"
                          background="#D0D0D0"
                          boxShadow="1.5px 1.5px 3px 0px #54545466, -1px -1px 3px 0px #545454B2"
                          borderRadius="5px"
                          color="#1633B6"
                          minW="24px"
                          minH="24px"
                          isDisabled={amount <= 1}
                          onClick={() =>
                            setAmount(
                              amount > 1 && amount <= Number(stock)
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
                          background="#B3B9BE"
                          boxShadow="-5px -5px 10px 0px #54545440 inset, 5px 5px 2px 0px #A6A6A680 inset, 2px 2px 2px 0px #18161640 inset, -2px -2px 2px 0px #A2A9B080 inset"
                          fontSize="lg"
                          fontWeight={500}
                          max={stock?.toString() || balance?.toString() || 0}
                          min={1}
                          minW="45px"
                          minH="45px"
                          onChange={e => {
                            const value = e.target.value;
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
                              Number(value) >
                              Number(stock || balance?.toString())
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
                          background="#D0D0D0"
                          boxShadow="1.5px 1.5px 3px 0px #54545466, -1px -1px 3px 0px #545454B2"
                          borderRadius="5px"
                          color="#1633B6"
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
                      backgroundColor="#F5F5FA1F"
                      boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset"
                      h="7px"
                      w="100%"
                    ></Box>
                    <VStack>
                      {orderType == OrderType.Buying ? (
                        <Text fontSize={{ base: 'sm' }} fontWeight={700}>
                          Total Cost: {etherToFixedNumber(price)} $GOLD
                        </Text>
                      ) : (
                        <Text fontSize={{ base: 'sm' }} fontWeight={700}>
                          Total to recieve: {etherToFixedNumber(price)} $GOLD
                        </Text>
                      )}
                      <Text color="#3D4247" size="xs">
                        Current Balance{' '}
                        {etherToFixedNumber(
                          userCharacter?.externalGoldBalance ?? '0',
                        )}{' '}
                        $GOLD
                      </Text>
                      <FormControl
                        isInvalid={
                          showError && (insufficientGold || unsellableError)
                        }
                      >
                        {showError && insufficientGold && (
                          <FormHelperText color="red" m={3}>
                            You don&apos;t have enough $GOLD to buy this.
                          </FormHelperText>
                        )}
                        {showError && unsellableError && (
                          <FormHelperText color="red" m={3}>
                            You can&apos;t sell your last item.
                          </FormHelperText>
                        )}
                        {orderType == OrderType.Buying &&
                          goldShopAllowance < price && (
                            <Button
                              type="submit"
                              isLoading={
                                isApprovingGold ||
                                isApprovingItems ||
                                isTxPending
                              }
                            >
                              Approve
                            </Button>
                          )}
                        {orderType == OrderType.Selling &&
                          !itemsShopAllowance && (
                            <Button
                              type="submit"
                              isLoading={
                                isApprovingGold ||
                                isApprovingItems ||
                                isTxPending
                              }
                            >
                              Approve
                            </Button>
                          )}
                        {orderType == OrderType.Buying &&
                          goldShopAllowance >= price && (
                            <Button
                              type="submit"
                              isLoading={
                                isApprovingGold ||
                                isApprovingItems ||
                                isTxPending
                              }
                            >
                              Buy
                            </Button>
                          )}
                        {orderType == OrderType.Selling &&
                          itemsShopAllowance && (
                            <Button
                              type="submit"
                              isLoading={
                                isApprovingGold ||
                                isApprovingItems ||
                                isTxPending
                              }
                            >
                              Sell
                            </Button>
                          )}
                      </FormControl>
                      <Button onClick={() => onClose()} variant="ghost">
                        Cancel
                      </Button>
                    </VStack>
                  </VStack>
                </GridItem>
              </Grid>
            </ModalBody>
          </ModalContent>
        </Modal>
        <Box display={{ base: 'none', md: 'block' }} w="40px">
          <Button onClick={onOpen} p={1} variant="ghost">
            <ForwardCaretSvg />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
