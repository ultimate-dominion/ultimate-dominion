import {
  Avatar,
  Badge,
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
import { IoIosArrowBack } from 'react-icons/io';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Address, parseEther } from 'viem';
import { InfoModal } from '../components/InfoModal';
import { MarketplaceAllowanceModal } from '../components/MarketplaceAllowanceModal';
import { OrderRow } from '../components/OrderRow';
import { Pagination } from '../components/Pagination';
import { PolygonalCard } from '../components/PolygonalCard';
import { useAllowance } from '../contexts/AllowanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useOrders } from '../contexts/OrdersContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { CHARACTER_CREATION_PATH, HOME_PATH, MARKETPLACE_PATH } from '../Routes';
import { etherToFixedNumber, getEmoji, removeEmoji } from '../utils/helpers';
import { getItemImage } from '../utils/itemImages';
import {
  type ArmorTemplate,
  ItemType,
  MarketplaceFilter,
  OrderType,
  Rarity,
  RARITY_COLORS,
  RARITY_NAMES,
  type SpellTemplate,
  SystemToAllow,
  TokenType,
  type WeaponTemplate,
} from '../utils/types';

const ITEMS_PER_PAGE = 10;

export const MarketplaceItem = (): JSX.Element => {
  const { renderWarning } = useToast();
  const navigate = useNavigate();
  const { itemId: selectedItemId } = useParams();
  const [searchParams] = useSearchParams();
  const { authMethod, isAuthenticated: isConnected, isConnecting } = useAuth();
  const {
    ensureGoldAllowance,
    ensureItemsAllowance,
    goldMarketplaceAllowance,
    itemsMarketplaceAllowance,
  } = useAllowance();

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

      // Allowance check
      if (orderType === OrderType.Buying && goldMarketplaceAllowance < parseEther(orderPrice)) {
        if (authMethod === 'embedded') {
          const ok = await ensureGoldAllowance(SystemToAllow.Marketplace, parseEther(orderPrice));
          if (!ok) return;
        } else {
          onOpenAllowanceModal();
          return;
        }
      }
      if (orderType === OrderType.Selling && !itemsMarketplaceAllowance) {
        if (authMethod === 'embedded') {
          const ok = await ensureItemsAllowance(SystemToAllow.Marketplace);
          if (!ok) return;
        } else {
          onOpenAllowanceModal();
          return;
        }
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
      authMethod,
      createOrder,
      createOrderTx,
      ensureGoldAllowance,
      ensureItemsAllowance,
      equippedArmor,
      equippedSpells,
      equippedWeapons,
      goldMarketplaceAllowance,
      goldTokenAddress,
      insufficientGold,
      invalidOrderPrice,
      itemsAddress,
      itemsMarketplaceAllowance,
      onCloseAllowanceModal,
      onOpenAllowanceModal,
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

  const itemName = removeEmoji(selectedItem.name);
  const itemImage = getItemImage(itemName);
  const itemRarity = selectedItem.rarity;
  const rarityColor = itemRarity !== undefined ? RARITY_COLORS[itemRarity] : undefined;
  const rarityName = itemRarity !== undefined ? RARITY_NAMES[itemRarity] : undefined;
  const itemTypeLabel =
    selectedItem.itemType === ItemType.Weapon
      ? 'Weapon'
      : selectedItem.itemType === ItemType.Armor
        ? 'Armor'
        : selectedItem.itemType === ItemType.Spell
          ? 'Spell'
          : 'Consumable';

  // Build stat entries, filtering out zeros for cleaner display
  const statEntries: { label: string; value: string; isPositive: boolean }[] = [];
  if (selectedItem.itemType !== ItemType.Spell) {
    const typed = selectedItem as ArmorTemplate | WeaponTemplate;
    if (Number(typed.strModifier) !== 0)
      statEntries.push({ label: 'STR', value: `${Number(typed.strModifier) >= 0 ? '+' : ''}${typed.strModifier}`, isPositive: Number(typed.strModifier) > 0 });
    if (Number(typed.agiModifier) !== 0)
      statEntries.push({ label: 'AGI', value: `${Number(typed.agiModifier) >= 0 ? '+' : ''}${typed.agiModifier}`, isPositive: Number(typed.agiModifier) > 0 });
    if (Number(typed.intModifier) !== 0)
      statEntries.push({ label: 'INT', value: `${Number(typed.intModifier) >= 0 ? '+' : ''}${typed.intModifier}`, isPositive: Number(typed.intModifier) > 0 });
    if (Number(typed.hpModifier) !== 0)
      statEntries.push({ label: 'HP', value: `${Number(typed.hpModifier) >= 0 ? '+' : ''}${typed.hpModifier}`, isPositive: Number(typed.hpModifier) > 0 });
  }
  if (selectedItem.itemType === ItemType.Armor && Number((selectedItem as ArmorTemplate).armorModifier) !== 0)
    statEntries.push({ label: 'Armor', value: `+${(selectedItem as ArmorTemplate).armorModifier}`, isPositive: true });
  if (selectedItem.itemType !== ItemType.Armor && selectedItem.itemType !== ItemType.Consumable) {
    const typed = selectedItem as SpellTemplate | WeaponTemplate;
    statEntries.push({ label: 'Damage', value: `${typed.minDamage}–${typed.maxDamage}`, isPositive: true });
  }

  // Build requirement entries, filtering out zeros
  const reqEntries: { label: string; value: string }[] = [];
  if (Number(selectedItem.minLevel) > 0)
    reqEntries.push({ label: 'Level', value: selectedItem.minLevel.toString() });
  if (Number(selectedItem.statRestrictions.minStrength) > 0)
    reqEntries.push({ label: 'STR', value: selectedItem.statRestrictions.minStrength.toString() });
  if (Number(selectedItem.statRestrictions.minAgility) > 0)
    reqEntries.push({ label: 'AGI', value: selectedItem.statRestrictions.minAgility.toString() });
  if (Number(selectedItem.statRestrictions.minIntelligence) > 0)
    reqEntries.push({ label: 'INT', value: selectedItem.statRestrictions.minIntelligence.toString() });

  const lowestPrice = lowestPrices[selectedItem.tokenId.toString()];
  const highestOffer = highestOffers[selectedItem.tokenId.toString()];

  return (
    <PolygonalCard clipPath="polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)">
      <Helmet>
        <title>{`${itemName} | Ultimate Dominion`}</title>
      </Helmet>
      <VStack spacing={0}>
        {/* Back navigation */}
        <HStack w="100%" px={4} pt={3} pb={1}>
          <HStack
            as="button"
            color="#8A7E6A"
            cursor="pointer"
            onClick={() => navigate(MARKETPLACE_PATH)}
            spacing={1}
            _hover={{ color: '#E8DCC8' }}
          >
            <IoIosArrowBack size={14} />
            <Text size="sm">Marketplace</Text>
          </HStack>
        </HStack>

        {/* ── ITEM HERO ── */}
        <Stack
          align="center"
          direction={{ base: 'column', md: 'row' }}
          px={{ base: 4, md: 8 }}
          py={{ base: 4, md: 6 }}
          spacing={{ base: 4, md: 8 }}
          w="100%"
        >
          {/* Item Image */}
          <Box
            alignItems="center"
            bg="rgba(196,184,158,0.04)"
            border="1px solid"
            borderColor={rarityColor ?? '#3A3228'}
            borderRadius="12px"
            boxShadow={rarityColor ? `0 0 20px ${rarityColor}15, inset 0 0 30px rgba(0,0,0,0.3)` : 'inset 0 0 30px rgba(0,0,0,0.3)'}
            display="flex"
            flexShrink={0}
            h={{ base: '140px', md: '160px' }}
            justifyContent="center"
            w={{ base: '140px', md: '160px' }}
          >
            {itemImage ? (
              <Image
                src={itemImage}
                alt={itemName}
                boxSize={{ base: '100px', md: '120px' }}
                objectFit="contain"
                filter="drop-shadow(0 2px 8px rgba(0,0,0,0.4))"
              />
            ) : (
              <Avatar
                backgroundColor="transparent"
                borderRadius={0}
                h={{ base: '80px', md: '100px' }}
                name={' '}
                size="2xl"
                w={{ base: '80px', md: '100px' }}
              >
                <Text fontSize={{ base: '48px', md: '60px' }}>
                  {getEmoji(selectedItem.name)}
                </Text>
              </Avatar>
            )}
          </Box>

          {/* Item Info */}
          <VStack align={{ base: 'center', md: 'start' }} spacing={2} flex={1}>
            <Heading
              color="#E8DCC8"
              fontSize={{ base: '22px', md: '28px' }}
              letterSpacing="0.5px"
            >
              {itemName}
            </Heading>

            <HStack spacing={3} flexWrap="wrap" justify={{ base: 'center', md: 'start' }}>
              {rarityName && (
                <Badge
                  bg={`${rarityColor}20`}
                  border="1px solid"
                  borderColor={`${rarityColor}60`}
                  borderRadius="4px"
                  color={rarityColor}
                  fontSize="11px"
                  fontWeight={600}
                  letterSpacing="0.8px"
                  px={2}
                  py={0.5}
                  textTransform="uppercase"
                >
                  {rarityName}
                </Badge>
              )}
              <Text color="#8A7E6A" size="sm">{itemTypeLabel}</Text>
              {Number(userItemBalance) > 0 && (
                <Text color="#5A8A3E" size="sm" fontWeight={600}>
                  Owned: {userItemBalance}
                </Text>
              )}
            </HStack>

            {selectedItem.description && (
              <Text color="#8A7E6A" size="sm" mt={1} maxW="500px" textAlign={{ base: 'center', md: 'start' }}>
                {selectedItem.description}
              </Text>
            )}

            {/* Inline stat chips */}
            {statEntries.length > 0 && (
              <HStack spacing={2} mt={2} flexWrap="wrap" justify={{ base: 'center', md: 'start' }}>
                {statEntries.map(stat => (
                  <Box
                    key={stat.label}
                    bg="rgba(196,184,158,0.06)"
                    border="1px solid #3A3228"
                    borderRadius="6px"
                    px={3}
                    py={1}
                  >
                    <Text size="sm">
                      <Text as="span" color="#8A7E6A">{stat.label} </Text>
                      <Text
                        as="span"
                        color={stat.isPositive ? '#5A8A3E' : '#B83A2A'}
                        fontWeight={700}
                        fontFamily="'Fira Code', monospace"
                      >
                        {stat.value}
                      </Text>
                    </Text>
                  </Box>
                ))}
              </HStack>
            )}

            {/* Requirement chips */}
            {reqEntries.length > 0 && (
              <HStack spacing={2} mt={1} flexWrap="wrap" justify={{ base: 'center', md: 'start' }}>
                <Text color="#8A7E6A" size="xs">Requires:</Text>
                {reqEntries.map(req => (
                  <Text key={req.label} size="xs" color="#C87A2A" fontFamily="'Fira Code', monospace">
                    {req.label} {req.value}
                  </Text>
                ))}
              </HStack>
            )}
          </VStack>

          {/* Gold balance pill — desktop only */}
          <VStack
            align="end"
            display={{ base: 'none', lg: 'flex' }}
            flexShrink={0}
            spacing={1}
          >
            <Text color="#8A7E6A" size="xs" textTransform="uppercase" letterSpacing="1px">
              Your Balance
            </Text>
            <Text color="yellow" fontFamily="'Fira Code', monospace" fontWeight={700} fontSize="18px">
              {etherToFixedNumber(userCharacter.externalGoldBalance)} $GOLD
            </Text>
          </VStack>
        </Stack>

        {/* Gold balance — mobile only */}
        <HStack
          display={{ base: 'flex', lg: 'none' }}
          justify="center"
          pb={2}
        >
          <Text color="#8A7E6A" size="sm">Balance: </Text>
          <Text color="yellow" fontFamily="'Fira Code', monospace" fontWeight={600} size="sm">
            {etherToFixedNumber(userCharacter.externalGoldBalance)} $GOLD
          </Text>
        </HStack>

        {/* Divider */}
        <Box
          bgColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="4px"
          w="100%"
        />

        {/* ── TRADE PANEL ── */}
        <Stack
          direction={{ base: 'column', lg: 'row' }}
          px={{ base: 4, md: 8 }}
          py={6}
          spacing={{ base: 6, lg: 10 }}
          w="100%"
        >
          {/* Market price context */}
          <HStack spacing={6} flexWrap="wrap" justify={{ base: 'center', lg: 'start' }}>
            <VStack spacing={0} align={{ base: 'center', lg: 'start' }}>
              <Text color="#8A7E6A" size="xs" textTransform="uppercase" letterSpacing="0.5px">
                Lowest Price
              </Text>
              <Text
                color={lowestPrice ? '#E8DCC8' : '#8A7E6A'}
                fontFamily="'Fira Code', monospace"
                fontWeight={600}
              >
                {lowestPrice ? `${etherToFixedNumber(lowestPrice)} $GOLD` : '—'}
              </Text>
            </VStack>
            <Box
              bg="#3A3228"
              display={{ base: 'none', lg: 'block' }}
              h="36px"
              w="1px"
            />
            <VStack spacing={0} align={{ base: 'center', lg: 'start' }}>
              <Text color="#8A7E6A" size="xs" textTransform="uppercase" letterSpacing="0.5px">
                Best Offer
              </Text>
              <Text
                color={highestOffer ? '#E8DCC8' : '#8A7E6A'}
                fontFamily="'Fira Code', monospace"
                fontWeight={600}
              >
                {highestOffer ? `${etherToFixedNumber(highestOffer)} $GOLD` : '—'}
              </Text>
            </VStack>
          </HStack>

          {/* Spacer on desktop */}
          <Box flex={1} display={{ base: 'none', lg: 'block' }} />

          {/* Order form */}
          <VStack
            align={{ base: 'center', lg: 'end' }}
            spacing={3}
            w={{ base: '100%', lg: 'auto' }}
            minW={{ lg: '360px' }}
          >
            {/* Buy/Sell toggle */}
            <HStack
              bg="#14120F"
              border="1px solid #3A3228"
              borderRadius="8px"
              p="3px"
              w={{ base: '100%', lg: 'auto' }}
            >
              <Button
                bg={orderType === OrderType.Buying ? '#C87A2A' : 'transparent'}
                borderRadius="6px"
                color={orderType === OrderType.Buying ? '#E8DCC8' : '#8A7E6A'}
                flex={1}
                onClick={() => {
                  const newSearchParams = new URLSearchParams();
                  newSearchParams.set('orderType', OrderType.Buying);
                  navigate(`?${newSearchParams}`);
                  setOrderType(OrderType.Buying);
                }}
                size="sm"
                variant="unstyled"
                px={6}
                py={2}
                h="auto"
                _hover={{
                  bg: orderType === OrderType.Buying ? '#E8A840' : '#2E2820',
                  color: '#E8DCC8',
                }}
              >
                Buy
              </Button>
              <Button
                bg={orderType === OrderType.Selling ? '#C87A2A' : 'transparent'}
                borderRadius="6px"
                color={orderType === OrderType.Selling ? '#E8DCC8' : '#8A7E6A'}
                flex={1}
                onClick={() => {
                  const newSearchParams = new URLSearchParams();
                  newSearchParams.set('orderType', OrderType.Selling);
                  navigate(`?${newSearchParams}`);
                  setOrderType(OrderType.Selling);
                }}
                size="sm"
                variant="unstyled"
                px={6}
                py={2}
                h="auto"
                _hover={{
                  bg: orderType === OrderType.Selling ? '#E8A840' : '#2E2820',
                  color: '#E8DCC8',
                }}
              >
                Sell
              </Button>
            </HStack>

            {/* Buy flow */}
            {orderType === OrderType.Buying &&
              (userCharacter.externalGoldBalance === BigInt(0) ? (
                <Text size="sm" color="#8A7E6A" textAlign="center">
                  You don&apos;t have any $GOLD to place an offer.
                </Text>
              ) : (
                <VStack
                  align="stretch"
                  as="form"
                  onSubmit={onCreateOrder}
                  spacing={3}
                  w="100%"
                >
                  {forSaleItems.length > 0 && (
                    <Text size="sm" color="#8A7E6A">
                      Items are already listed for sale.{' '}
                      <Text
                        as="span"
                        color="#C87A2A"
                        cursor="pointer"
                        onClick={onScrollToTabs}
                        _hover={{ textDecoration: 'underline' }}
                      >
                        View listings
                      </Text>
                    </Text>
                  )}
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
                    Place Buy Offer
                  </Button>
                </VStack>
              ))}

            {/* Sell flow */}
            {orderType === OrderType.Selling &&
              (userItemBalance === '0' ? (
                <Text size="sm" color="#8A7E6A" textAlign="center">
                  You don&apos;t own this item.
                </Text>
              ) : (
                <VStack
                  align="stretch"
                  as="form"
                  onSubmit={onCreateOrder}
                  spacing={3}
                  w="100%"
                >
                  {goldOfferItems.length > 0 && (
                    <Text size="sm" color="#8A7E6A">
                      There are existing buy offers.{' '}
                      <Text
                        as="span"
                        color="#C87A2A"
                        cursor="pointer"
                        onClick={onScrollToTabs}
                        _hover={{ textDecoration: 'underline' }}
                      >
                        View offers
                      </Text>
                    </Text>
                  )}
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
                    List for Sale
                  </Button>
                </VStack>
              ))}

            {/* Prompt to select buy/sell if neither chosen */}
            {orderType === OrderType.None && (
              <Text size="sm" color="#8A7E6A" textAlign="center">
                Select Buy or Sell to get started.
              </Text>
            )}
          </VStack>
        </Stack>

        {/* ── MARKET ACTIVITY ── */}
        <Tabs index={tabIndex} ref={tabsRef} variant="line" w="100%">
          <Box
            bgColor="rgba(196,184,158,0.08)"
            boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
            h="4px"
            w="100%"
          />
          <TabList justifyContent={{ base: 'center', lg: 'start' }} px={{ base: 0, md: 4 }}>
            <Tab
              fontSize={{ base: 'xs', sm: 'sm', lg: 'md' }}
              onClick={() => setTabIndex(0)}
            >
              {MarketplaceFilter.ForSale}
              {forSaleItems.length > 0 && (
                <Badge
                  bg="rgba(200,122,42,0.15)"
                  borderRadius="full"
                  color="#C87A2A"
                  fontSize="10px"
                  ml={2}
                  px={2}
                >
                  {forSaleItems.length}
                </Badge>
              )}
            </Tab>
            <Tab
              fontSize={{ base: 'xs', sm: 'sm', lg: 'md' }}
              onClick={() => setTabIndex(1)}
            >
              {MarketplaceFilter.GoldOffers}
              {goldOfferItems.length > 0 && (
                <Badge
                  bg="rgba(200,122,42,0.15)"
                  borderRadius="full"
                  color="#C87A2A"
                  fontSize="10px"
                  ml={2}
                  px={2}
                >
                  {goldOfferItems.length}
                </Badge>
              )}
            </Tab>
            <Tab
              fontSize={{ base: 'xs', sm: 'sm', lg: 'md' }}
              onClick={() => setTabIndex(2)}
            >
              {MarketplaceFilter.MyListings}
              {myListings.length > 0 && (
                <Badge
                  bg="rgba(200,122,42,0.15)"
                  borderRadius="full"
                  color="#C87A2A"
                  fontSize="10px"
                  ml={2}
                  px={2}
                >
                  {myListings.length}
                </Badge>
              )}
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
                    <Box key={`order-${i}`}>
                      <OrderRow
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
                    </Box>
                  ))}
                {forSaleItems.length === 0 && (
                  <VStack py={10} spacing={2}>
                    <Text color="#8A7E6A" textAlign="center">
                      No one is selling this item yet.
                    </Text>
                    {Number(userItemBalance) > 0 && orderType !== OrderType.Selling && (
                      <Text
                        as="span"
                        color="#C87A2A"
                        cursor="pointer"
                        size="sm"
                        onClick={() => {
                          const newSearchParams = new URLSearchParams();
                          newSearchParams.set('orderType', OrderType.Selling);
                          navigate(`?${newSearchParams}`);
                          setOrderType(OrderType.Selling);
                        }}
                        _hover={{ textDecoration: 'underline' }}
                      >
                        Be the first to list yours
                      </Text>
                    )}
                  </VStack>
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
                    <Box key={`order-${i}`}>
                      <OrderRow
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
                    </Box>
                  ))}
                {goldOfferItems.length === 0 && (
                  <VStack py={10} spacing={2}>
                    <Text color="#8A7E6A" textAlign="center">
                      No buy offers for this item yet.
                    </Text>
                    {orderType !== OrderType.Buying && (
                      <Text
                        as="span"
                        color="#C87A2A"
                        cursor="pointer"
                        size="sm"
                        onClick={() => {
                          const newSearchParams = new URLSearchParams();
                          newSearchParams.set('orderType', OrderType.Buying);
                          navigate(`?${newSearchParams}`);
                          setOrderType(OrderType.Buying);
                        }}
                        _hover={{ textDecoration: 'underline' }}
                      >
                        Place the first offer
                      </Text>
                    )}
                  </VStack>
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
                    <Box key={`order-${i}`}>
                      <OrderRow
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
                    </Box>
                  ))}
                {myListings.length === 0 && (
                  <VStack py={10}>
                    <Text color="#8A7E6A" textAlign="center">
                      You have no active listings for this item.
                    </Text>
                  </VStack>
                )}
              </Stack>
            </TabPanel>

            <HStack
              justify="center"
              mt={{ base: 0, lg: 5 }}
              mb={5}
              visibility={
                (tabIndex === 0 ? forSaleItems.length : tabIndex === 1 ? goldOfferItems.length : myListings.length) > 0
                  ? 'visible'
                  : 'hidden'
              }
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

        {authMethod !== 'embedded' && (
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
        )}

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
