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
  Image,
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
import { Entity } from '@latticexyz/recs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io';

import { useAllowance } from '../contexts/AllowanceContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import {
  etherToFixedNumber,
  getEmoji,
  getStatSymbol,
  removeEmoji,
} from '../utils/helpers';
import { getItemImage } from '../utils/itemImages';
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
  isEquipped,
  item,
  itemIndex,
  orderType,
  stock,
  shop,
  theme,
}: {
  balance: bigint | null;
  characterId: Entity;
  isEquipped: boolean;
  item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
  itemIndex: string;
  orderType: OrderType;
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

  const shopTx = useTransaction({ actionName: 'shop', showSuccessToast: false });

  const [amount, setAmount] = useState(1);
  const [showError, setShowError] = useState(false);

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
        onAllowanceOpen();
        return;
      }
      if (orderType == OrderType.Selling && !itemsShopAllowance) {
        onAllowanceOpen();
        return;
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
        } else {
          const { error, success } = await sell(
            BigInt(amount),
            shop.shopId,
            itemIndex,
            characterId,
          );
          if (error && !success) throw new Error(error);
        }
      });

      if (result !== undefined) {
        renderSuccess(
          orderType == OrderType.Buying
            ? 'Item purchased successfully!'
            : 'Item sold successfully!',
        );
        onAllowanceClose();
        onClose();
        refreshCharacter();
      }
    },
    [
      amount,
      buy,
      characterId,
      goldShopAllowance,
      insufficientGold,
      insufficientStock,
      itemIndex,
      itemsShopAllowance,
      onAllowanceClose,
      onAllowanceOpen,
      onClose,
      orderType,
      price,
      refreshCharacter,
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
      boxShadow="-5px -5px 10px 0px #B3B9BE inset, 5px 5px 10px 0px #949CA380 inset, 2px 2px 4px 0px #88919980 inset, 0px 0px 4px 0px #545454 inset;"
      justify="space-between"
      onClick={onOpen}
      transition="all 0.3s"
      w="100%"
      _hover={{
        borderBottom: '2px solid black',
        cursor: 'pointer',
        button: {
          bgColor: 'grey300',
        },
      }}
      _active={{
        borderBottom: '2px solid black',
        button: {
          bgColor: 'grey400',
        },
      }}
    >
      <Flex>
        {name && getItemImage(removeEmoji(name.toString())) ? (
          <Image
            src={getItemImage(removeEmoji(name.toString()))}
            alt={removeEmoji(name.toString())}
            boxSize={{ base: '48px', sm: '64px' }}
            objectFit="contain"
            mr={2}
          />
        ) : (
          <Avatar
            backgroundColor="transparent"
            borderRadius={0}
            name=" "
            size={{ base: 'md', sm: 'lg' }}
          >
            {name ? getEmoji(name.toString()) : ''}
          </Avatar>
        )}
        <VStack justify="center" ml={{ base: 0, sm: 4 }}>
          <Text fontWeight={700} size={{ base: 'xs', sm: 'md', lg: 'lg' }}>
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

      <ShopAllowanceModal
        completeMessage={
          orderType === OrderType.Buying
            ? `Allowance was successful! You can now buy ${name}`
            : `Allowance was successful! You can now sell ${name}`
        }
        isCompleting={shopTx.isLoading}
        isOpen={isAllowanceOpen}
        itemName={name}
        onClose={onAllowanceClose}
        onComplete={onBuyOrSell}
        orderPrice={price}
        orderType={orderType}
      />

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent as="form" onSubmit={onBuyOrSell}>
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
              gap={{ base: 4, sm: 10 }}
              px={6}
              templateColumns="repeat(2, 1fr)"
              templateRows="2fr"
            >
              <GridItem colSpan={{ base: 2, sm: 1 }}>
                {name && getItemImage(removeEmoji(name.toString())) ? (
                  <Image
                    src={getItemImage(removeEmoji(name.toString()))}
                    alt={removeEmoji(name.toString())}
                    boxSize="64px"
                    objectFit="contain"
                  />
                ) : (
                  <Avatar
                    backgroundColor="grey300"
                    borderRadius={0}
                    name={' '}
                    size="lg"
                  >
                    {name ? getEmoji(name.toString()) : ''}
                  </Avatar>
                )}

                <Text mt={{ base: 4, sm: 8 }} size="sm">
                  {item?.description || ''}
                </Text>
              </GridItem>
              <GridItem colSpan={{ base: 2, sm: 1 }}>
                <Text fontWeight={700} size="sm">
                  Stats
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
                      - Min Damage:{' '}
                      {(
                        item as SpellTemplate | WeaponTemplate
                      ).minDamage.toString()}
                    </Text>
                    <Text size="sm">
                      - Max Damage:{' '}
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
                  Restrictions
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
                        background="#B3B9BE"
                        boxShadow="-5px -5px 10px 0px #54545440 inset, 5px 5px 2px 0px #A6A6A680 inset, 2px 2px 2px 0px #18161640 inset, -2px -2px 2px 0px #A2A9B080 inset"
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
                  />
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
                  Insufficient stock.
                </FormHelperText>
              )}
              {showError && insufficientGold && (
                <FormHelperText color="red" m={3}>
                  You don&apos;t have enough $GOLD to buy this.
                </FormHelperText>
              )}
              {showError && unsellableError && (
                <FormHelperText color="red" m={3}>
                  You can&apos;t sell the last of an equipped item.
                </FormHelperText>
              )}
              <HStack gap={3}>
                <Button onClick={onClose} variant="ghost">
                  Cancel
                </Button>
                {orderType == OrderType.Buying && goldShopAllowance < price && (
                  <Button
                    type="submit"
                    isLoading={
                      isApprovingGold || isApprovingItems || shopTx.isLoading
                    }
                  >
                    Approve
                  </Button>
                )}
                {orderType == OrderType.Selling && !itemsShopAllowance && (
                  <Button
                    type="submit"
                    isLoading={
                      isApprovingGold || isApprovingItems || shopTx.isLoading
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
                        isApprovingGold || isApprovingItems || shopTx.isLoading
                      }
                    >
                      Buy
                    </Button>
                  )}
                {orderType == OrderType.Selling && itemsShopAllowance && (
                  <Button
                    type="submit"
                    isLoading={
                      isApprovingGold || isApprovingItems || shopTx.isLoading
                    }
                  >
                    Sell
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
