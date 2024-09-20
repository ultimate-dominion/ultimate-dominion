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
import { IoIosArrowForward } from 'react-icons/io';
import { IoAdd, IoRemove } from 'react-icons/io5';

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
  ItemType,
  OrderType,
  Shop,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';
import { ShopAllowanceModal } from './ShopAllowanceModal';

export const ShopItemRow = ({
  balance,
  characterId,
  item,
  itemIndex,
  orderType,
  stock,
  shop,
}: {
  balance: string | null;
  characterId: Entity;
  item: ArmorTemplate | SpellTemplate | WeaponTemplate;
  itemIndex: string;
  orderType: OrderType;
  shop: Shop;
  stock: string | null;
}): JSX.Element => {
  const {
    systemCalls: { buy, sell },
  } = useMUD();
  const { renderSuccess, renderError } = useToast();

  const { goldAllowanceShops, itemsAllowanceShops, refreshAllowances } =
    useAllowance();
  const { character: userCharacter, refreshCharacter } = useCharacter();

  const {
    isOpen: isAllowanceOpen,
    onOpen: onAllowanceOpen,
    onClose: onAllowanceClose,
  } = useDisclosure();

  const [amount, setAmount] = useState(1);
  const [showError, setShowError] = useState(false);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const { name, statRestrictions } = item;

  const price = useMemo(() => {
    if (orderType == OrderType.Selling)
      return BigInt(amount) * ((item.price * shop.priceMarkdown) / 100n);
    return (
      BigInt(amount) * (item.price + item.price * (shop.priceMarkup / 100n))
    );
  }, [amount, item.price, orderType, shop.priceMarkdown, shop.priceMarkup]);

  const priceSingle = useMemo(() => {
    if (orderType == OrderType.Selling)
      return (item.price * shop.priceMarkdown) / 100n;
    return item.price + item.price * (shop.priceMarkup / 100n);
  }, [item.price, orderType, shop.priceMarkdown, shop.priceMarkup]);

  const insufficientGold = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Selling) return false;
    return price > BigInt(userCharacter.goldBalance);
  }, [orderType, price, userCharacter]);

  const onBuyOrSell = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (insufficientGold) {
        setShowError(true);
        return;
      }
      try {
        if (orderType == OrderType.Buying && goldAllowanceShops < price) {
          onAllowanceOpen();
          return;
        }
        if (orderType == OrderType.Selling && !itemsAllowanceShops) {
          onAllowanceOpen();
          return;
        }
        if (orderType == OrderType.Buying) {
          await buy(amount.toString(), shop.shopId, itemIndex, characterId);
          renderSuccess('Item purchased successfully!');
        } else {
          await sell(amount.toString(), shop.shopId, itemIndex, characterId);
          renderSuccess('Item sold successfully!');
        }
      } catch (e) {
        renderError((e as Error)?.message ?? 'Shop transaction failed', e);
      } finally {
        refreshAllowances();
        refreshCharacter();
      }
    },
    [
      amount,
      buy,
      characterId,
      goldAllowanceShops,
      insufficientGold,
      itemIndex,
      itemsAllowanceShops,
      onAllowanceOpen,
      orderType,
      price,
      refreshAllowances,
      refreshCharacter,
      renderError,
      renderSuccess,
      sell,
      shop.shopId,
    ],
  );

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [price]);

  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
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
        <Avatar backgroundColor={'grey300'} borderRadius={0} name=" " size="lg">
          {name ? getEmoji(name.toString()) : ''}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>
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
            {balance || stock}
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
          isCompleting={false}
          isOpen={isAllowanceOpen}
          itemName={name}
          onClose={onAllowanceClose}
          onComplete={onAllowanceClose}
          orderPrice={price}
          orderType={orderType}
        />
        <Modal isCentered isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalCloseButton />
            <ModalHeader>
              <Text fontWeight={700} fontSize={24}>
                Buy {name ? removeEmoji(name.toString()) : ''}
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
                  {item.itemType == ItemType.Armor ||
                    (item.itemType == ItemType.Weapon && (
                      <Text fontWeight={400} fontSize={14}>
                        STR
                        {getStatSymbol((item as WeaponTemplate).strModifier)}
                        {(item as WeaponTemplate).strModifier} AGI
                        {getStatSymbol((item as WeaponTemplate).agiModifier)}
                        {(item as WeaponTemplate).agiModifier} INT
                        {getStatSymbol((item as WeaponTemplate).intModifier)}
                        {(item as WeaponTemplate).intModifier}{' '}
                      </Text>
                    ))}
                  {item.itemType == ItemType.Armor && (
                    <Text fontWeight={400} fontSize={14}>
                      {(item as ArmorTemplate).armorModifier
                        ? `ARM${getStatSymbol((item as ArmorTemplate).armorModifier)}${(item as ArmorTemplate).armorModifier}`
                        : ''}
                    </Text>
                  )}

                  <Text mt={8} fontWeight={700} fontSize={14}>
                    Restrictions
                  </Text>
                  <Text fontWeight={400} fontSize={14}>
                    - LVL {item?.minLevel || 0}
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
                      <Text>AMOUNT (MAX {stock || balance})</Text>
                      <HStack>
                        <Button
                          isDisabled={amount <= 1}
                          onClick={() =>
                            setAmount(
                              amount > 1 && amount <= Number(stock)
                                ? amount - 1
                                : amount,
                            )
                          }
                          size="xs"
                        >
                          <IoRemove />
                        </Button>
                        <Input
                          max={stock || balance || 0}
                          min={1}
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
                            if (Number(value) > Number(stock || balance)) {
                              setAmount(Number(stock || balance));
                              return;
                            }
                            setAmount(Number(value));
                          }}
                          p={2}
                          size="sm"
                          step={1}
                          value={amount === 0 ? '' : amount}
                          w={10}
                        />
                        <Button
                          isDisabled={amount === Number(stock || balance)}
                          onClick={() =>
                            setAmount(
                              amount > -1 && amount < Number(stock || balance)
                                ? amount + 1
                                : amount,
                            )
                          }
                          size="xs"
                        >
                          <IoAdd />
                        </Button>
                      </HStack>
                    </VStack>
                    <VStack>
                      {orderType == OrderType.Buying ? (
                        <Text>
                          Total Cost: {etherToFixedNumber(price)} $GOLD
                        </Text>
                      ) : (
                        <Text>
                          Total to recieve: {etherToFixedNumber(price)} $GOLD
                        </Text>
                      )}
                      <FormControl isInvalid={showError && insufficientGold}>
                        {showError && insufficientGold && (
                          <FormHelperText color="red" m={3}>
                            You don&apos;t have enough $GOLD to buy this.
                          </FormHelperText>
                        )}
                        {orderType == OrderType.Buying &&
                          goldAllowanceShops < price && (
                            <Button type="submit">Approve</Button>
                          )}
                        {orderType == OrderType.Selling &&
                          !itemsAllowanceShops && (
                            <Button type="submit">Approve</Button>
                          )}
                        {orderType == OrderType.Buying &&
                          goldAllowanceShops >= price && (
                            <Button type="submit">Buy</Button>
                          )}
                        {orderType == OrderType.Selling &&
                          itemsAllowanceShops && (
                            <Button type="submit">Sell</Button>
                          )}
                      </FormControl>
                    </VStack>
                  </VStack>
                </GridItem>
              </Grid>
            </ModalBody>
          </ModalContent>
        </Modal>
        <Box display={{ base: 'none', md: 'block' }} w="40px">
          <Button onClick={onOpen} p={3} variant="ghost">
            <IoIosArrowForward />
          </Button>
        </Box>
      </HStack>
    </Flex>
  );
};
