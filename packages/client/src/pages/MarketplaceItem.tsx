import {
  Avatar,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftAddon,
  Spacer,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { getComponentValue } from '@latticexyz/recs';
import { encodeEntity, singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { IoMdArrowRoundBack } from 'react-icons/io';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Address, parseEther } from 'viem';
import { useAccount } from 'wagmi';

import { InfoModal } from '../components/InfoModal';
import { MarketplaceAllowanceModal } from '../components/MarketplaceAllowanceModal';
import { OrderRow } from '../components/OrderRow';
import { useAllowance } from '../contexts/AllowanceContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useOrders } from '../contexts/OrdersContext';
import { useToast } from '../hooks/useToast';
import {
  CHARACTER_CREATION_PATH,
  HOME_PATH,
  MARKETPLACE_PATH,
} from '../Routes';
import { etherToFixedNumber, getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorTemplate,
  ItemType,
  MarketplaceFilter,
  OrderType,
  type SpellTemplate,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';

export const MarketplaceItem = (): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const navigate = useNavigate();
  const { itemId: selectedItemId } = useParams();
  const [searchParams] = useSearchParams();
  const { isConnected } = useAccount();

  const {
    components: { ItemsOwners, UltimateDominionConfig },
    delegatorAddress,
    isSynced,
    systemCalls: { createOrder },
  } = useMUD();
  const {
    armorTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const { goldAllowance, itemsAllowance } = useAllowance();
  const {
    activeOrders,
    highestOffers,
    isLoading: isLoadingOrders,
    lowestPrices,
    refreshOrders,
  } = useOrders();
  const {
    character: userCharacter,
    isRefreshing,
    refreshCharacter,
  } = useCharacter();

  const tabsRef = useRef<HTMLDivElement>(null);

  const [showError, setShowError] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderType, setOrderType] = useState(OrderType.None);
  const [orderPrice, setOrderPrice] = useState('');
  const [tabIndex, setTabIndex] = useState(0);

  const {
    isOpen: isAllowanceModalOpen,
    onClose: onCloseAllowanceModal,
    onOpen: onOpenAllowanceModal,
  } = useDisclosure();
  const {
    isOpen: isConfirmationModalOpen,
    onClose: onCloseConfirmationModal,
    onOpen: onOpenConfirmationModal,
  } = useDisclosure();

  const { goldToken: goldTokenAddress, items: itemsAddress } =
    useComponentValue(UltimateDominionConfig, singletonEntity) ?? {
      goldToken: null,
      items: null,
    };

  // Redirect to home if synced, but missing other requirements
  useEffect(() => {
    if (!isConnected) {
      navigate(HOME_PATH);
      window.location.reload();
      return;
    }

    if (!isSynced) return;

    if (!delegatorAddress) {
      navigate(HOME_PATH);
      return;
    }

    if (!userCharacter?.locked && !isRefreshing) {
      navigate(CHARACTER_CREATION_PATH);
      return;
    }
  }, [
    userCharacter,
    delegatorAddress,
    isConnected,
    isRefreshing,
    isSynced,
    navigate,
  ]);

  // Reset showError state when any of the form fields change
  useEffect(() => {
    setShowError(false);
  }, [orderPrice]);

  const selectedItem = useMemo(() => {
    const armor = armorTemplates.find(
      armor => armor.tokenId === selectedItemId,
    );
    if (armor) return armor;

    const spell = spellTemplates.find(
      spell => spell.tokenId === selectedItemId,
    );
    if (spell) return spell;

    const weapon = weaponTemplates.find(
      weapon => weapon.tokenId === selectedItemId,
    );
    if (weapon) return weapon;

    return null;
  }, [armorTemplates, selectedItemId, spellTemplates, weaponTemplates]);

  const userItemBalance = useMemo(() => {
    if (!(userCharacter && selectedItem)) return '0';

    const tokenOwnersEntity = encodeEntity(
      { owner: 'address', tokenId: 'uint256' },
      {
        owner: userCharacter.owner as `0x${string}`,
        tokenId: BigInt(selectedItem.tokenId),
      },
    );

    const itemOwner = getComponentValue(ItemsOwners, tokenOwnersEntity);
    return itemOwner ? itemOwner.balance.toString() : '0';
  }, [ItemsOwners, selectedItem, userCharacter]);

  const invalidOrderPrice = useMemo(() => {
    return !(parseEther(orderPrice) > BigInt('0'));
  }, [orderPrice]);

  const insufficientGold = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Selling) return false;
    return parseEther(orderPrice) > BigInt(userCharacter.goldBalance);
  }, [orderPrice, orderType, userCharacter]);

  const onCreateOrder = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        setIsCreatingOrder(true);

        if (!userCharacter) throw new Error('Character not found.');
        if (!selectedItem) throw new Error('Item not found.');
        if (!goldTokenAddress || !itemsAddress) {
          throw new Error('Token contracts not found.');
        }

        if (invalidOrderPrice) {
          setShowError(true);
          return;
        }

        if (insufficientGold) {
          setShowError(true);
          return;
        }

        if (
          orderType === OrderType.Buying &&
          goldAllowance < parseEther(orderPrice)
        ) {
          onOpenAllowanceModal();
          return;
        }

        if (orderType === OrderType.Selling && !itemsAllowance) {
          onOpenAllowanceModal();
          return;
        }

        if (orderType === OrderType.Selling && Number(userItemBalance) < 1) {
          throw new Error(
            `You do not have enough ${selectedItem.name} to sell.`,
          );
        }

        const _order = {
          consideration: {
            amount:
              orderType === OrderType.Selling
                ? parseEther(orderPrice)
                : BigInt('1'),
            identifier:
              orderType === OrderType.Selling
                ? 0n
                : BigInt(selectedItem.tokenId),
            recipient: userCharacter.owner as Address,
            token: (orderType === OrderType.Selling
              ? goldTokenAddress
              : itemsAddress) as Address,
            tokenType:
              orderType === OrderType.Selling
                ? TokenType.ERC20
                : TokenType.ERC1155,
          },
          offer: {
            amount:
              orderType === OrderType.Buying
                ? parseEther(orderPrice)
                : BigInt('1'),
            identifier:
              orderType === OrderType.Buying
                ? 0n
                : BigInt(selectedItem.tokenId),
            token: (orderType === OrderType.Buying
              ? goldTokenAddress
              : itemsAddress) as Address,
            tokenType:
              orderType === OrderType.Buying
                ? TokenType.ERC20
                : TokenType.ERC1155,
          },
          offerer: userCharacter.owner as Address,
          signature: '' as Address,
        };

        const { error, success } = await createOrder(_order);

        if (error && !success) {
          throw new Error(error);
        }

        renderSuccess('Order placed successfully!');
        refreshCharacter();
        refreshOrders();
        onCloseAllowanceModal();
        onOpenConfirmationModal();
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to create order.', e);
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [
      createOrder,
      goldAllowance,
      goldTokenAddress,
      insufficientGold,
      invalidOrderPrice,
      itemsAddress,
      itemsAllowance,
      onCloseAllowanceModal,
      onOpenAllowanceModal,
      onOpenConfirmationModal,
      orderPrice,
      orderType,
      refreshCharacter,
      refreshOrders,
      renderError,
      renderSuccess,
      selectedItem,
      userCharacter,
      userItemBalance,
    ],
  );

  const onScrollToTabs = useCallback(() => {
    setTabIndex(orderType === OrderType.Buying ? 0 : 1);
    tabsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderType]);

  useEffect(() => {
    if (searchParams.get('orderType') === OrderType.Buying) {
      setOrderType(OrderType.Buying);
      setTabIndex(0);
    } else if (searchParams.get('orderType') === OrderType.Selling) {
      setOrderType(OrderType.Selling);
      setTabIndex(1);
    }
  }, [searchParams]);

  const forSaleItems = useMemo(() => {
    if (!selectedItem) return [];
    return activeOrders
      .filter(
        order =>
          order.offer.tokenType === TokenType.ERC1155 &&
          order.offer.identifier === selectedItem.tokenId,
      )
      .sort((a, b) => {
        return Number(
          parseEther(b.consideration.amount) -
            parseEther(a.consideration.amount),
        );
      });
  }, [activeOrders, selectedItem]);

  const goldOfferItems = useMemo(() => {
    if (!selectedItem) return [];
    return activeOrders
      .filter(
        order =>
          order.offer.tokenType === TokenType.ERC20 &&
          order.consideration.tokenType === TokenType.ERC1155 &&
          order.consideration.identifier === selectedItem.tokenId,
      )
      .sort((a, b) => {
        return Number(parseEther(b.offer.amount) - parseEther(a.offer.amount));
      });
  }, [activeOrders, selectedItem]);

  const myListings = useMemo(() => {
    if (!selectedItem) return [];
    return activeOrders.filter(
      order =>
        (order.offerer === userCharacter?.owner &&
          order.offer.identifier === selectedItem.tokenId) ||
        (order.consideration.recipient === userCharacter?.owner &&
          order.consideration.identifier === selectedItem.tokenId),
    );
  }, [activeOrders, selectedItem, userCharacter]);

  if (isLoadingItemTemplates || isLoadingOrders) {
    return (
      <VStack>
        <Button
          alignSelf="start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(MARKETPLACE_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Marketplace
        </Button>
        <HStack h="100%" justifyContent="center" w="100%">
          <Spinner size="xl" />
        </HStack>
      </VStack>
    );
  }

  if (!userCharacter) {
    return (
      <VStack>
        <Button
          alignSelf="start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(MARKETPLACE_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Marketplace
        </Button>
        <Text mt={12}>An erro occurred</Text>
      </VStack>
    );
  }

  if (selectedItem == null) {
    return (
      <VStack>
        <Button
          alignSelf="start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(MARKETPLACE_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Marketplace
        </Button>
        <Text>Item not found</Text>
      </VStack>
    );
  }

  return (
    <VStack>
      <HStack justify="space-between" w="100%">
        <Button
          alignSelf="start"
          leftIcon={<IoMdArrowRoundBack />}
          my={4}
          onClick={() => navigate(MARKETPLACE_PATH)}
          size="xs"
          variant="outline"
        >
          Back to Marketplace
        </Button>
        <Text size="sm">
          $GOLD Balance: {etherToFixedNumber(userCharacter.goldBalance)}
        </Text>
      </HStack>
      <Heading textAlign="center">{removeEmoji(selectedItem.name)}</Heading>
      <HStack alignItems="start" mt={12} spacing={12} w="100%">
        <Stack w="50%">
          <Text fontWeight="bold" mb={2} textAlign="center">
            Description
          </Text>
          <HStack align="center">
            <Avatar
              backgroundColor="transparent"
              borderRadius={0}
              h={14}
              name={' '}
              size="2xl"
            >
              {getEmoji(selectedItem.name)}
            </Avatar>
            <Text size="sm">{selectedItem.description}</Text>
          </HStack>
          <HStack alignItems="start" mt={8} spacing={8}>
            <VStack spacing={1} w="50%">
              <Text fontWeight="bold" mb={2} textAlign="center">
                Stats
              </Text>
              {selectedItem.itemType !== ItemType.Spell && (
                <>
                  <HStack w="100%">
                    <Text size="sm">Agility Modifier</Text>
                    <Spacer />
                    <Text>
                      {
                        (selectedItem as ArmorTemplate | WeaponTemplate)
                          .agiModifier
                      }
                    </Text>
                  </HStack>
                  <HStack w="100%">
                    <Text size="sm">Intelligence Modifier</Text>
                    <Spacer />
                    <Text>
                      {
                        (selectedItem as ArmorTemplate | WeaponTemplate)
                          .intModifier
                      }
                    </Text>
                  </HStack>
                  <HStack w="100%">
                    <Text size="sm">Strength Modifier</Text>
                    <Spacer />
                    <Text>
                      {
                        (selectedItem as ArmorTemplate | WeaponTemplate)
                          .strModifier
                      }
                    </Text>
                  </HStack>
                  <HStack w="100%">
                    <Text size="sm">HP Modifier</Text>
                    <Spacer />
                    <Text>
                      {
                        (selectedItem as ArmorTemplate | WeaponTemplate)
                          .hpModifier
                      }
                    </Text>
                  </HStack>
                </>
              )}
              {selectedItem.itemType === ItemType.Armor && (
                <HStack w="100%">
                  <Text size="sm">Armor Modifier</Text>
                  <Spacer />
                  <Text>{(selectedItem as ArmorTemplate).armorModifier}</Text>
                </HStack>
              )}
              {selectedItem.itemType !== ItemType.Armor && (
                <>
                  <HStack w="100%">
                    <Text size="sm">Min Damage</Text>
                    <Spacer />
                    <Text>
                      {
                        (selectedItem as SpellTemplate | WeaponTemplate)
                          .minDamage
                      }
                    </Text>
                  </HStack>
                  <HStack w="100%">
                    <Text size="sm">Max Damage</Text>
                    <Spacer />
                    <Text>
                      {
                        (selectedItem as SpellTemplate | WeaponTemplate)
                          .maxDamage
                      }
                    </Text>
                  </HStack>
                </>
              )}
            </VStack>

            <VStack spacing={1} w="50%">
              <Text fontWeight="bold" mb={2} textAlign="center">
                Requirements
              </Text>
              <HStack w="100%">
                <Text size="sm">Min Level</Text>
                <Spacer />
                <Text>{selectedItem.minLevel}</Text>
              </HStack>
              <HStack w="100%">
                <Text size="sm">Min Agility</Text>
                <Spacer />
                <Text>{selectedItem.statRestrictions.minAgility}</Text>
              </HStack>
              <HStack w="100%">
                <Text size="sm">Min Intelligence</Text>
                <Spacer />
                <Text>{selectedItem.statRestrictions.minIntelligence}</Text>
              </HStack>
              <HStack w="100%">
                <Text size="sm">Min Strength</Text>
                <Spacer />
                <Text>{selectedItem.statRestrictions.minStrength}</Text>
              </HStack>
            </VStack>
          </HStack>
        </Stack>
        <Divider orientation="vertical" />
        <Stack w="50%">
          <Text fontWeight="bold" mb={2} textAlign="center">
            Create a request
          </Text>
          <HStack w="100%">
            <Text size="sm">Lowest Item Price</Text>
            <Spacer />
            <Text>
              {lowestPrices[selectedItem.tokenId]
                ? `${etherToFixedNumber(lowestPrices[selectedItem.tokenId])} $GOLD`
                : 'N/A'}
            </Text>
          </HStack>
          <HStack w="100%">
            <Text size="sm">Highest $GOLD Offer</Text>
            <Spacer />
            <Text>
              {highestOffers[selectedItem.tokenId]
                ? `${etherToFixedNumber(highestOffers[selectedItem.tokenId])} $GOLD`
                : 'N/A'}
            </Text>
          </HStack>
          <Divider my={4} />
          <Text>Buying or selling?</Text>
          <HStack>
            <Button
              onClick={() => {
                const newSearchParams = new URLSearchParams();
                newSearchParams.set('orderType', OrderType.Buying);
                navigate(`?${newSearchParams}`);
                setOrderType(OrderType.Buying);
              }}
              size="sm"
              variant={orderType === OrderType.Buying ? 'solid' : 'outline'}
            >
              Buying
            </Button>
            <Button
              onClick={() => {
                const newSearchParams = new URLSearchParams();
                newSearchParams.set('orderType', OrderType.Selling);
                navigate(`?${newSearchParams}`);
                setOrderType(OrderType.Selling);
              }}
              size="sm"
              variant={orderType === OrderType.Selling ? 'solid' : 'outline'}
            >
              Selling
            </Button>
          </HStack>
          {orderType === OrderType.Buying &&
            (userCharacter.goldBalance === BigInt(0) ? (
              <Text mt={4} size="sm">
                You don&apos;t have any $GOLD in your inventory.
              </Text>
            ) : (
              <VStack alignItems="start" as="form" onSubmit={onCreateOrder}>
                {forSaleItems.length > 0 && (
                  <Text mt={4} size="sm">
                    Are you sure you want to make an offer for this item? There
                    are already items for sale, which you can{' '}
                    <Text
                      as="span"
                      color="blue"
                      cursor="pointer"
                      onClick={onScrollToTabs}
                      _hover={{
                        textDecoration: 'underline',
                      }}
                    >
                      view below
                    </Text>
                    .
                  </Text>
                )}
                <Text mt={4}>How much $GOLD are you offering?</Text>
                <FormControl isInvalid={showError && invalidOrderPrice}>
                  <InputGroup>
                    <InputLeftAddon>$GOLD</InputLeftAddon>
                    <Input
                      isDisabled={isCreatingOrder}
                      onChange={e => setOrderPrice(e.target.value)}
                      placeholder="0.00"
                      py={0}
                      type="number"
                      value={orderPrice}
                    />
                  </InputGroup>
                  {showError && invalidOrderPrice && (
                    <FormHelperText color="red">
                      Offer price must be greater than 0.
                    </FormHelperText>
                  )}
                  {showError && insufficientGold && (
                    <FormHelperText color="red">
                      You don&apos;t have enough $GOLD to make this offer.
                    </FormHelperText>
                  )}
                </FormControl>
                <Button
                  isLoading={isCreatingOrder}
                  size="sm"
                  type="submit"
                  w="100%"
                >
                  Make an Offer for {selectedItem.name}
                </Button>
              </VStack>
            ))}
          {orderType === OrderType.Selling &&
            (userItemBalance === '0' ? (
              <Text mt={4} size="sm">
                You don&apos;t have any {selectedItem.name} in your inventory.
              </Text>
            ) : (
              <VStack alignItems="start" as="form" onSubmit={onCreateOrder}>
                {goldOfferItems.length > 0 && (
                  <Text mt={4} size="sm">
                    Are you sure you want to put your item up for sale? There
                    are already offers for this item, which you can{' '}
                    <Text
                      as="span"
                      color="blue"
                      cursor="pointer"
                      onClick={onScrollToTabs}
                      _hover={{
                        textDecoration: 'underline',
                      }}
                    >
                      view below
                    </Text>
                    .
                  </Text>
                )}
                <Text mt={4}>How much $GOLD are you asking for?</Text>
                <FormControl isInvalid={showError && invalidOrderPrice}>
                  <InputGroup>
                    <InputLeftAddon>$GOLD</InputLeftAddon>
                    <Input
                      isDisabled={isCreatingOrder}
                      onChange={e => setOrderPrice(e.target.value)}
                      placeholder="0.00"
                      py={0}
                      type="number"
                      value={orderPrice}
                    />
                  </InputGroup>
                  {showError && invalidOrderPrice && (
                    <FormHelperText color="red">
                      Asking price must be greater than 0.
                    </FormHelperText>
                  )}
                </FormControl>
                <Button
                  isLoading={isCreatingOrder}
                  size="sm"
                  type="submit"
                  w="100%"
                >
                  List {selectedItem.name} for sale
                </Button>
              </VStack>
            ))}
        </Stack>
      </HStack>

      <Tabs index={tabIndex} mt={12} ref={tabsRef} variant="line" w="100%">
        <TabList>
          <Tab onClick={() => setTabIndex(0)}>{MarketplaceFilter.ForSale}</Tab>
          <Tab onClick={() => setTabIndex(1)}>
            {MarketplaceFilter.GoldOffers}
          </Tab>
          <Tab onClick={() => setTabIndex(2)}>
            {MarketplaceFilter.MyListings}
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Stack gap={2}>
              {forSaleItems.map((order, i) => (
                <OrderRow
                  key={`order-${i}`}
                  item={selectedItem}
                  order={order}
                  refreshOrders={refreshOrders}
                />
              ))}
            </Stack>
          </TabPanel>
          <TabPanel>
            <Stack gap={2}>
              {goldOfferItems.map((order, i) => (
                <OrderRow
                  key={`order-${i}`}
                  item={selectedItem}
                  order={order}
                  refreshOrders={refreshOrders}
                />
              ))}
            </Stack>
          </TabPanel>
          <TabPanel>
            <Stack gap={2}>
              {myListings.map((order, i) => (
                <OrderRow
                  key={`order-${i}`}
                  item={selectedItem}
                  order={order}
                  refreshOrders={refreshOrders}
                />
              ))}
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>
      <MarketplaceAllowanceModal
        isCreatingOrder={isCreatingOrder}
        isOpen={isAllowanceModalOpen}
        itemName={selectedItem.name}
        onClose={onCloseAllowanceModal}
        onCreateOrder={onCreateOrder}
        orderPrice={orderPrice}
        orderType={orderType}
      />
      <InfoModal
        heading="Listing created!"
        isOpen={isConfirmationModalOpen}
        onClose={() => {
          onScrollToTabs();
          setTabIndex(2);
          setOrderPrice('');
          onCloseConfirmationModal();
        }}
      >
        <VStack>
          <FaCheckCircle color="green" size={60} />
          <Text my={4}>
            {orderType === OrderType.Buying
              ? `Your offer of ${orderPrice} $GOLD for a ${selectedItem.name} has been placed.`
              : `Your listing of a ${selectedItem.name} for ${orderPrice} $GOLD has been created.`}{' '}
            You can view your listings on the{' '}
            <Text
              as="span"
              color="blue"
              onClick={() => {
                onScrollToTabs();
                setTabIndex(2);
                setOrderPrice('');
                onCloseConfirmationModal();
              }}
              _hover={{
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              &quot;My Listings&quot; tab
            </Text>{' '}
            below.
          </Text>
        </VStack>
      </InfoModal>
    </VStack>
  );
};
