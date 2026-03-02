import {
  Avatar,
  Box,
  Button,
  FormControl,
  FormHelperText,
  Heading,
  HStack,
  Image,
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
import {
  encodeAddressKey,
  encodeCompositeKey,
  encodeUint256Key,
  getTableValue,
  useGameConfig,
} from '../lib/gameStore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FaCheckCircle } from 'react-icons/fa';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Address, parseEther } from 'viem';
import { InfoModal } from '../components/InfoModal';
import { MarketplaceAllowanceModal } from '../components/MarketplaceAllowanceModal';
import { OrderRow } from '../components/OrderRow';
import { Pagination } from '../components/Pagination';
import { PolygonalCard } from '../components/PolygonalCard';
import { MarketplaceIconSvg } from '../components/SVGs';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useAuth } from '../contexts/AuthContext';
import { useMUD } from '../contexts/MUDContext';
import { useOrders } from '../contexts/OrdersContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { CHARACTER_CREATION_PATH, HOME_PATH } from '../Routes';
import { etherToFixedNumber, getEmoji, removeEmoji } from '../utils/helpers';
import { getItemImage } from '../utils/itemImages';
import {
  type ArmorTemplate,
  ItemType,
  MarketplaceFilter,
  OrderType,
  type SpellTemplate,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';

const ITEMS_PER_PAGE = 10;

export const MarketplaceItem = (): JSX.Element => {
  const { renderWarning } = useToast();
  const navigate = useNavigate();
  const { itemId: selectedItemId } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated: isConnected, isConnecting } = useAuth();

  const {
    delegatorAddress,
    isSynced,
    systemCalls: { createOrder },
  } = useMUD();
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isLoadingItemTemplates,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const {
    activeOrders,
    highestOffers,
    isLoading: isLoadingOrders,
    lowestPrices,
    refreshOrders,
  } = useOrders();
  const {
    character: userCharacter,
    equippedArmor,
    equippedSpells,
    equippedWeapons,
    isRefreshing,
    refreshCharacter,
  } = useCharacter();
  const tabsRef = useRef<HTMLDivElement>(null);

  const createOrderTx = useTransaction({
    actionName: 'create listing',
    showSuccessToast: true,
    successMessage: 'Listing created!',
  });

  const [showError, setShowError] = useState(false);
  const [orderType, setOrderType] = useState(OrderType.None);
  const [orderPrice, setOrderPrice] = useState('');
  const [tabIndex, setTabIndex] = useState(0);

  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);

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

  const configValue = useGameConfig('UltimateDominionConfig');
  const goldTokenAddress = configValue?.goldToken ?? null;
  const itemsAddress = configValue?.items ?? null;

  // Redirect to home if synced, but missing other requirements
  useEffect(() => {
    if (isConnecting) return;

    if (!isConnected) {
      navigate(HOME_PATH);
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
    isConnecting,
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

    const consumable = consumableTemplates.find(
      consumable => consumable.tokenId === selectedItemId,
    );
    if (consumable) return consumable;

    const spell = spellTemplates.find(
      spell => spell.tokenId === selectedItemId,
    );
    if (spell) return spell;

    const weapon = weaponTemplates.find(
      weapon => weapon.tokenId === selectedItemId,
    );
    if (weapon) return weapon;

    return null;
  }, [
    armorTemplates,
    consumableTemplates,
    selectedItemId,
    spellTemplates,
    weaponTemplates,
  ]);

  const userItemBalance = useMemo(() => {
    if (!(userCharacter && selectedItem)) return '0';

    const compositeKey = encodeCompositeKey(
      encodeAddressKey(userCharacter.owner as `0x${string}`),
      encodeUint256Key(BigInt(selectedItem.tokenId)),
    );

    const itemOwner = getTableValue('ItemsOwners', compositeKey);
    return itemOwner ? itemOwner.balance.toString() : '0';
  }, [selectedItem, userCharacter]);

  const invalidOrderPrice = useMemo(() => {
    return !(parseEther(orderPrice) > BigInt('0'));
  }, [orderPrice]);

  const insufficientGold = useMemo(() => {
    if (!userCharacter) return false;
    if (orderType === OrderType.Selling) return false;
    return parseEther(orderPrice) > BigInt(userCharacter.externalGoldBalance);
  }, [orderPrice, orderType, userCharacter]);

  const onCreateOrder = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!userCharacter) return;
      if (!selectedItem) return;
      if (!goldTokenAddress || !itemsAddress) return;

      if (invalidOrderPrice) {
        setShowError(true);
        return;
      }

      if (insufficientGold) {
        setShowError(true);
        return;
      }

      const equippedItemTokenIds = [
        ...equippedArmor,
        ...equippedSpells,
        ...equippedWeapons,
      ].map(equippedItem => equippedItem.tokenId);

      const isItemEquipped = equippedItemTokenIds.includes(
        selectedItem.tokenId,
      );

      if (
        userItemBalance === '1' &&
        isItemEquipped &&
        orderType === OrderType.Selling
      ) {
        renderWarning(
          `You cannot sell an item that is currently equipped. Please unequip the ${selectedItem.name} first.`,
        );
        return;
      }

      if (orderType === OrderType.Selling && Number(userItemBalance) < 1) {
        return;
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

      const result = await createOrderTx.execute(async () => {
        const { error, success } = await createOrder(_order);
        if (error && !success) throw new Error(error);
      });

      if (result !== undefined) {
        refreshCharacter();
        refreshOrders();
        onCloseAllowanceModal();
        onOpenConfirmationModal();
      }
    },
    [
      createOrder,
      createOrderTx,
      equippedArmor,
      equippedSpells,
      equippedWeapons,
      goldTokenAddress,
      insufficientGold,
      invalidOrderPrice,
      itemsAddress,
      onOpenConfirmationModal,
      orderPrice,
      orderType,
      refreshCharacter,
      refreshOrders,
      renderWarning,
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

  useEffect(() => {
    if (tabIndex === -1) return;
    setPage(1);
  }, [tabIndex]);

  const forSaleItems = useMemo(() => {
    if (!selectedItem) return [];
    return activeOrders
      .filter(
        order =>
          order.offer.tokenType === TokenType.ERC1155 &&
          order.offer.identifier === selectedItem.tokenId,
      )
      .sort((a, b) => {
        return Number(a.consideration.amount - b.consideration.amount);
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
        return Number(b.offer.amount - a.offer.amount);
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
      <HStack h="100%" justifyContent="center" w="100%">
        <Spinner size="xl" />
      </HStack>
    );
  }

  if (!userCharacter) {
    return (
      <VStack>
        <Text mt={12}>An error occurred.</Text>
      </VStack>
    );
  }

  if (selectedItem == null) {
    return (
      <VStack>
        <Text>Item not found</Text>
      </VStack>
    );
  }

  return (
    <PolygonalCard clipPath="polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)">
      <Helmet>
        <title>{`${removeEmoji(selectedItem.name)} | Ultimate Dominion`}</title>
      </Helmet>
      <VStack>
        <HStack
          bgColor="blue500"
          h={{ base: '100px', md: '66px' }}
          px="20px"
          width="100%"
        >
          <Stack
            alignItems="center"
            direction={{ base: 'column', md: 'row' }}
            spacing={{ base: 2, md: 4 }}
          >
            <HStack>
              <MarketplaceIconSvg />
              <Heading color="white">{removeEmoji(selectedItem.name)}</Heading>
            </HStack>
            <Text color="yellow">
              <Text
                as="span"
                display={{ base: 'none', md: 'inline-block' }}
                mr={2}
              >
                -{' '}
              </Text>
              $GOLD Balance:{' '}
              {etherToFixedNumber(userCharacter.externalGoldBalance)}
            </Text>
          </Stack>
        </HStack>
        {getItemImage(removeEmoji(selectedItem.name)) ? (
          <Image
            src={getItemImage(removeEmoji(selectedItem.name))}
            alt={removeEmoji(selectedItem.name)}
            boxSize="112px"
            objectFit="contain"
            display={{ base: 'flex', lg: 'none' }}
            mt={4}
          />
        ) : (
          <Avatar
            backgroundColor="transparent"
            borderRadius={0}
            display={{ base: 'flex', lg: 'none' }}
            h={14}
            mt={4}
            name={' '}
            size="2xl"
          >
            {getEmoji(selectedItem.name)}
          </Avatar>
        )}
        <Stack
          alignItems="start"
          direction={{ base: 'column-reverse', lg: 'row' }}
          mt={{ base: 4, lg: 12 }}
          px={{ base: 0, sm: 6 }}
          spacing={12}
          w="100%"
        >
          <Stack p={{ base: 4, sm: 0 }} w={{ base: '100%', lg: '50%' }}>
            <Text fontWeight="bold" mb={2} textAlign="center">
              Description
            </Text>
            <HStack align="center">
              {getItemImage(removeEmoji(selectedItem.name)) ? (
                <Image
                  src={getItemImage(removeEmoji(selectedItem.name))}
                  alt={removeEmoji(selectedItem.name)}
                  boxSize="112px"
                  objectFit="contain"
                  display={{ base: 'none', lg: 'flex' }}
                />
              ) : (
                <Avatar
                  backgroundColor="transparent"
                  borderRadius={0}
                  display={{ base: 'none', lg: 'flex' }}
                  h={14}
                  name={' '}
                  size="2xl"
                >
                  {getEmoji(selectedItem.name)}
                </Avatar>
              )}
              <Text size="sm" textAlign={{ base: 'center', lg: 'start' }}>
                {selectedItem.description}
              </Text>
            </HStack>
            <Stack
              alignItems="start"
              direction={{ base: 'column', sm: 'row' }}
              mt={8}
              spacing={8}
            >
              <VStack spacing={1} w={{ base: '100%', sm: '50%' }}>
                <Text fontWeight="bold" mb={2} textAlign="center">
                  Stats
                </Text>
                {selectedItem.itemType !== ItemType.Spell && (
                  <>
                    <HStack w="100%">
                      <Text size="sm">Agility Modifier</Text>
                      <Spacer />
                      <Text>
                        {(
                          selectedItem as ArmorTemplate | WeaponTemplate
                        ).agiModifier.toString()}
                      </Text>
                    </HStack>
                    <HStack w="100%">
                      <Text size="sm">Intelligence Modifier</Text>
                      <Spacer />
                      <Text>
                        {(
                          selectedItem as ArmorTemplate | WeaponTemplate
                        ).intModifier.toString()}
                      </Text>
                    </HStack>
                    <HStack w="100%">
                      <Text size="sm">Strength Modifier</Text>
                      <Spacer />
                      <Text>
                        {(
                          selectedItem as ArmorTemplate | WeaponTemplate
                        ).strModifier.toString()}
                      </Text>
                    </HStack>
                    <HStack w="100%">
                      <Text size="sm">HP Modifier</Text>
                      <Spacer />
                      <Text>
                        {(
                          selectedItem as ArmorTemplate | WeaponTemplate
                        ).hpModifier.toString()}
                      </Text>
                    </HStack>
                  </>
                )}
                {selectedItem.itemType === ItemType.Armor && (
                  <HStack w="100%">
                    <Text size="sm">Armor Modifier</Text>
                    <Spacer />
                    <Text>
                      {(selectedItem as ArmorTemplate).armorModifier.toString()}
                    </Text>
                  </HStack>
                )}
                {selectedItem.itemType !== ItemType.Armor &&
                  selectedItem.itemType !== ItemType.Consumable && (
                    <>
                      <HStack w="100%">
                        <Text size="sm">Min Damage</Text>
                        <Spacer />
                        <Text>
                          {(
                            selectedItem as SpellTemplate | WeaponTemplate
                          ).minDamage.toString()}
                        </Text>
                      </HStack>
                      <HStack w="100%">
                        <Text size="sm">Max Damage</Text>
                        <Spacer />
                        <Text>
                          {(
                            selectedItem as SpellTemplate | WeaponTemplate
                          ).maxDamage.toString()}
                        </Text>
                      </HStack>
                    </>
                  )}
              </VStack>

              <VStack spacing={1} w={{ base: '100%', sm: '50%' }}>
                <Text fontWeight="bold" mb={2} textAlign="center">
                  Requirements
                </Text>
                <HStack w="100%">
                  <Text size="sm">Min Level</Text>
                  <Spacer />
                  <Text>{selectedItem.minLevel.toString()}</Text>
                </HStack>
                <HStack w="100%">
                  <Text size="sm">Min Agility</Text>
                  <Spacer />
                  <Text>
                    {selectedItem.statRestrictions.minAgility.toString()}
                  </Text>
                </HStack>
                <HStack w="100%">
                  <Text size="sm">Min Intelligence</Text>
                  <Spacer />
                  <Text>
                    {selectedItem.statRestrictions.minIntelligence.toString()}
                  </Text>
                </HStack>
                <HStack w="100%">
                  <Text size="sm">Min Strength</Text>
                  <Spacer />
                  <Text>
                    {selectedItem.statRestrictions.minStrength.toString()}
                  </Text>
                </HStack>
              </VStack>
            </Stack>
          </Stack>
          <Stack p={{ base: 4, sm: 0 }} w={{ base: '100%', lg: '50%' }}>
            <Text fontWeight="bold" mb={2} textAlign="center">
              Create a request
            </Text>
            <HStack w="100%">
              <Text size="sm">Lowest Item Price</Text>
              <Spacer />
              <Text>
                {lowestPrices[selectedItem.tokenId.toString()]
                  ? `${etherToFixedNumber(lowestPrices[selectedItem.tokenId.toString()])} $GOLD`
                  : 'N/A'}
              </Text>
            </HStack>
            <HStack w="100%">
              <Text size="sm">Highest $GOLD Offer</Text>
              <Spacer />
              <Text>
                {highestOffers[selectedItem.tokenId.toString()]
                  ? `${etherToFixedNumber(highestOffers[selectedItem.tokenId.toString()])} $GOLD`
                  : 'N/A'}
              </Text>
            </HStack>
            <Box
              backgroundColor="rgba(196,184,158,0.08)"
              boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
              h="6px"
              my={4}
              w="100%"
            />
            <Text>Buying or selling?</Text>
            <HStack>
              <Button
                bgColor={orderType === OrderType.Buying ? 'grey500' : undefined}
                color={orderType === OrderType.Buying ? 'white' : undefined}
                onClick={() => {
                  const newSearchParams = new URLSearchParams();
                  newSearchParams.set('orderType', OrderType.Buying);
                  navigate(`?${newSearchParams}`);
                  setOrderType(OrderType.Buying);
                }}
                size="sm"
                variant="white"
              >
                Buying
              </Button>
              <Button
                bgColor={
                  orderType === OrderType.Selling ? 'grey500' : undefined
                }
                color={orderType === OrderType.Selling ? 'white' : undefined}
                onClick={() => {
                  const newSearchParams = new URLSearchParams();
                  newSearchParams.set('orderType', OrderType.Selling);
                  navigate(`?${newSearchParams}`);
                  setOrderType(OrderType.Selling);
                }}
                size="sm"
                variant="white"
              >
                Selling
              </Button>
            </HStack>
            {orderType === OrderType.Buying &&
              (userCharacter.externalGoldBalance === BigInt(0) ? (
                <Text mt={4} size="sm">
                  You don&apos;t have any $GOLD in your inventory.
                </Text>
              ) : (
                <VStack alignItems="start" as="form" onSubmit={onCreateOrder}>
                  {forSaleItems.length > 0 && (
                    <Text mt={4} size="sm">
                      Are you sure you want to make an offer for this item?
                      There are already items for sale, which you can{' '}
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
                        isDisabled={createOrderTx.isLoading}
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
                    fontSize={{ base: 'xs', sm: 'sm' }}
                    isLoading={createOrderTx.isLoading}
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
                        isDisabled={createOrderTx.isLoading}
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
                    fontSize={{ base: 'xs', sm: 'sm' }}
                    isLoading={createOrderTx.isLoading}
                    size="sm"
                    type="submit"
                    w="100%"
                  >
                    List {selectedItem.name} for sale
                  </Button>
                </VStack>
              ))}
          </Stack>
        </Stack>

        <Tabs index={tabIndex} mt={12} ref={tabsRef} variant="line" w="100%">
          <TabList justifyContent={{ base: 'center', lg: 'start' }}>
            <Tab
              fontSize={{ base: 'xs', sm: 'sm', lg: 'md' }}
              onClick={() => setTabIndex(0)}
            >
              {MarketplaceFilter.ForSale}
            </Tab>
            <Tab
              fontSize={{ base: 'xs', sm: 'sm', lg: 'md' }}
              onClick={() => setTabIndex(1)}
            >
              {MarketplaceFilter.GoldOffers}
            </Tab>
            <Tab
              fontSize={{ base: 'xs', sm: 'sm', lg: 'md' }}
              onClick={() => setTabIndex(2)}
            >
              {MarketplaceFilter.MyListings}
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel p={0}>
              <Stack gap={0}>
                <Box
                  bgColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="5px"
                  w="100%"
                />
                {forSaleItems
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map((order, i) => (
                    <>
                      <OrderRow
                        key={`order-${i}`}
                        item={selectedItem}
                        order={order}
                        refreshOrders={refreshOrders}
                      />
                      <Box
                        bgColor="rgba(196,184,158,0.08)"
                        boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                        h="5px"
                        w="100%"
                      />
                    </>
                  ))}
                {forSaleItems.length === 0 && (
                  <Text mt={8} textAlign="center" w="100%">
                    No items for sale.
                  </Text>
                )}
              </Stack>
            </TabPanel>
            <TabPanel p={0}>
              <Stack gap={0}>
                <Box
                  bgColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="5px"
                  w="100%"
                />
                {goldOfferItems
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map((order, i) => (
                    <>
                      <OrderRow
                        key={`order-${i}`}
                        item={selectedItem}
                        order={order}
                        refreshOrders={refreshOrders}
                      />
                      <Box
                        bgColor="rgba(196,184,158,0.08)"
                        boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                        h="5px"
                        w="100%"
                      />
                    </>
                  ))}
                {goldOfferItems.length === 0 && (
                  <Text mt={8} textAlign="center" w="100%">
                    No offers for this item.
                  </Text>
                )}
              </Stack>
            </TabPanel>
            <TabPanel p={0}>
              <Stack gap={0}>
                <Box
                  bgColor="rgba(196,184,158,0.08)"
                  boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                  h="5px"
                  w="100%"
                />
                {myListings
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map((order, i) => (
                    <>
                      <OrderRow
                        key={`order-${i}`}
                        item={selectedItem}
                        order={order}
                        refreshOrders={refreshOrders}
                      />
                      <Box
                        bgColor="rgba(196,184,158,0.08)"
                        boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                        h="5px"
                        w="100%"
                      />
                    </>
                  ))}
                {myListings.length === 0 && (
                  <Text mt={8} textAlign="center" w="100%">
                    You have no listings for this item.
                  </Text>
                )}
              </Stack>
            </TabPanel>

            <HStack
              justify="center"
              mt={{ base: 0, lg: 5 }}
              mb={5}
              visibility={forSaleItems.length > 0 ? 'visible' : 'hidden'}
              w="100%"
            >
              <Pagination
                length={
                  tabIndex === 0
                    ? forSaleItems.length
                    : tabIndex === 1
                      ? goldOfferItems.length
                      : myListings.length
                }
                page={page}
                pageLimit={pageLimit}
                perPage={ITEMS_PER_PAGE}
                setPage={setPage}
                setPageLimit={setPageLimit}
              />
            </HStack>
          </TabPanels>
        </Tabs>

        <MarketplaceAllowanceModal
          completeMessage="Allowance was successful! You can now complete your listing."
          isCompleting={createOrderTx.isLoading}
          isOpen={isAllowanceModalOpen}
          itemName={selectedItem.name}
          onClose={onCloseAllowanceModal}
          onComplete={onCreateOrder}
          orderPrice={orderPrice ? parseEther(orderPrice) : BigInt(0)}
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
    </PolygonalCard>
  );
};
