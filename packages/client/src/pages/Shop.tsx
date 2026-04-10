import {
  Box,
  Button,
  Grid,
  GridItem,
  Heading,
  HStack,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { GiTwoCoins } from 'react-icons/gi';
import { IoNavigate } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { PolygonalCard } from '../components/PolygonalCard';
import { RepairShopPanel } from '../components/RepairShopPanel';
import { ShopHalf } from '../components/ShopHalf';
import { ShopSvg } from '../components/SVGs/ShopSvg';
import { useCharacter } from '../contexts/CharacterContext';
import { useGoldMerchant } from '../contexts/GoldMerchantContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { useAuth } from '../contexts/AuthContext';
import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import { etherToFixedNumber } from '../utils/helpers';
import { preloadItemImages } from '../utils/itemImages';
import { useAllowance } from '../contexts/AllowanceContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  OrderType,
  Rarity,
  type SpellTemplate,
  SystemToAllow,
  type WeaponTemplate,
} from '../utils/types';

export const Shop = (): JSX.Element => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('ui');
  const { isAuthenticated: isConnected, isConnecting, authMethod } = useAuth();
  const { onOpen: onOpenGoldMerchant } = useGoldMerchant();

  const {
    delegatorAddress,
    isSynced,
    systemCalls: { endShopEncounter, sellBatch },
  } = useMUD();
  const { ensureItemsAllowance, itemsShopAllowance } = useAllowance();
  const { renderSuccess } = useToast();
  const sellAllTx = useTransaction({ actionName: 'sellAll', showSuccessToast: false });
  const {
    armorTemplates,
    consumableTemplates,
    isLoading: isItemsLoading,
    spellTemplates,
    weaponTemplates,
  } = useItems();
  const {
    character: userCharacter,
    equippedArmor,
    equippedSpells,
    equippedWeapons,
    inventoryArmor,
    inventoryConsumables,
    inventorySpells,
    inventoryWeapons,
    isRefreshing,
  } = useCharacter();
  const { allShops } = useMap();

  const shop = useMemo(() => {
    if (!(shopId && allShops)) return null;
    return allShops.find(shop => shop.shopId === shopId) ?? null;
  }, [allShops, shopId]);

  const onLeaveShop = useCallback(() => {
    // Call endShopEncounter to properly end the encounter on-chain.
    // Fragment II trigger for Tal's shop is handled on-chain by ShopSystem.
    if (userCharacter?.worldEncounter?.encounterId) {
      endShopEncounter(userCharacter.worldEncounter.encounterId).catch(() => {});
    }

    // Navigate immediately — keep fromShop fallback so GameBoard doesn't
    // redirect back to shop while the on-chain state propagates.
    navigate(GAME_BOARD_PATH, { state: { fromShop: true } });
  }, [endShopEncounter, navigate, userCharacter]);

  const [sellable, setSellable] = useState<
    Array<{
      balance: bigint | null;
      index: string;
      isEquipped: boolean;
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      stock: bigint | null;
    }>
  >([]);

  const [buyable, setBuyable] = useState<
    Array<{
      balance: bigint | null;
      index: string;
      isEquipped: boolean;
      item: ArmorTemplate | ConsumableTemplate | SpellTemplate | WeaponTemplate;
      stock: bigint | null;
    }>
  >([]);

  const [goldAdjustment, setGoldAdjustment] = useState(0n);

  // Clear optimistic gold adjustment when the reactive data catches up
  const prevGoldRef = useRef(userCharacter?.externalGoldBalance);
  useEffect(() => {
    if (userCharacter && prevGoldRef.current !== userCharacter.externalGoldBalance) {
      prevGoldRef.current = userCharacter.externalGoldBalance;
      setGoldAdjustment(0n);
    }
  }, [userCharacter?.externalGoldBalance]);

  const onTradeComplete = useCallback(
    (tokenId: string, amount: number, goldDelta: bigint, orderType: OrderType) => {
      if (orderType === OrderType.Selling) {
        setGoldAdjustment(prev => prev + goldDelta);
        setSellable(prev =>
          prev
            .map(entry =>
              entry.item.tokenId === tokenId
                ? { ...entry, balance: (entry.balance ?? 0n) - BigInt(amount) }
                : entry,
            )
            .filter(entry => (entry.balance ?? 0n) > 0n),
        );
        setBuyable(prev =>
          prev.map(entry =>
            entry.item.tokenId === tokenId
              ? { ...entry, stock: (entry.stock ?? 0n) + BigInt(amount) }
              : entry,
          ),
        );
      } else {
        setGoldAdjustment(prev => prev - goldDelta);
        setBuyable(prev =>
          prev.map(entry =>
            entry.item.tokenId === tokenId
              ? { ...entry, stock: (entry.stock ?? 0n) - BigInt(amount) }
              : entry,
          ),
        );
      }
    },
    [],
  );

  const handleSellAll = useCallback(async () => {
    if (!userCharacter || !shop) return;

    const toSell = sellable.filter(entry => {
      if (entry.isEquipped) return false;
      if (!entry.balance || entry.balance <= 0n) return false;
      const rarity = entry.item.rarity;
      return rarity !== undefined && rarity <= Rarity.Uncommon;
    });

    if (toSell.length === 0) return;

    if (!itemsShopAllowance) {
      if (authMethod === 'embedded') {
        const ok = await ensureItemsAllowance(SystemToAllow.Shop);
        if (!ok) return;
      } else {
        // External wallets need manual approval — fall back to individual sells
        return;
      }
    }

    const itemIds = toSell.map(entry => BigInt(entry.item.tokenId));
    const amounts = toSell.map(entry => entry.balance!);

    const result = await sellAllTx.execute(async () => {
      const { error, success } = await sellBatch(
        itemIds,
        amounts,
        shop.shopId,
        userCharacter.id,
      );
      if (error && !success) throw new Error(error);
      return success;
    });

    if (result !== undefined) {
      let totalGold = 0n;
      for (const entry of toSell) {
        totalGold += entry.balance! * ((entry.item.price * shop.priceMarkdown) / 10_000n);
      }
      setGoldAdjustment(prev => prev + totalGold);
      setSellable(prev =>
        prev.filter(entry => {
          if (entry.isEquipped) return true;
          const rarity = entry.item.rarity;
          if (rarity !== undefined && rarity <= Rarity.Uncommon) return false;
          return true;
        }),
      );
      renderSuccess(
        `Sold ${toSell.length} items for ${etherToFixedNumber(totalGold)} gold`,
      );
    }
  }, [
    ensureItemsAllowance,
    itemsShopAllowance,
    renderSuccess,
    sellAllTx,
    sellBatch,
    sellable,
    shop,
    userCharacter,
  ]);

  const sellAllCount = useMemo(() => {
    return sellable.filter(entry => {
      if (entry.isEquipped) return false;
      if (!entry.balance || entry.balance <= 0n) return false;
      const rarity = entry.item.rarity;
      return rarity !== undefined && rarity <= Rarity.Uncommon;
    }).length;
  }, [sellable]);

  const items = useMemo(
    () => [
      ...inventoryArmor,
      ...inventoryConsumables,
      ...inventorySpells,
      ...inventoryWeapons,
    ],
    [inventoryArmor, inventoryConsumables, inventorySpells, inventoryWeapons],
  );

  // Redirect to home if synced, but missing other requirements
  // Redirect to game board if character is not in the shop
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

    if (!userCharacter?.worldEncounter) {
      navigate(GAME_BOARD_PATH);
    }
  }, [
    delegatorAddress,
    isConnected,
    isConnecting,
    isRefreshing,
    isSynced,
    navigate,
    userCharacter,
  ]);

  useEffect(() => {
    if (isItemsLoading) return;
    if (!shop) return;

    const equippedItems = [
      ...equippedArmor,
      ...equippedSpells,
      ...equippedWeapons,
    ];

    const sellableInventory = items
      .map(item => {
        const isEquipped = equippedItems.some(
          equippedItem => equippedItem.tokenId === item.tokenId,
        );
        return {
          balance: item.balance,
          index: item.tokenId,
          isEquipped,
          item: item,
          stock: null,
        };
      });

    const buyableStock = [
      ...armorTemplates,
      ...consumableTemplates,
      ...spellTemplates,
      ...weaponTemplates,
    ]
      .filter(item => shop.buyableItems.includes(item.tokenId))
      // add back the stock and index of the item
      .map(item => {
        const index = shop?.buyableItems.indexOf(item.tokenId).toString();
        return {
          balance: null,
          index: index,
          isEquipped: false,
          item: item,
          stock: shop.stock[Number(index)],
        };
      });

    setSellable(sellableInventory);
    setBuyable(buyableStock);

    // Preload images for all shop items before components mount
    const allNames = [...sellableInventory, ...buyableStock].map(e => e.item.name);
    if (allNames.length > 0) preloadItemImages(allNames);
  }, [
    armorTemplates,
    consumableTemplates,
    equippedArmor,
    equippedSpells,
    equippedWeapons,
    isItemsLoading,
    items,
    shop,
    spellTemplates,
    weaponTemplates,
  ]);

  if (!shop) {
    return (
      <VStack>
        <Text>{t('shop.shopNotFound')}</Text>
      </VStack>
    );
  }

  if (!userCharacter) {
    return (
      <VStack>
        <Text>{t('shop.characterNotFound')}</Text>
      </VStack>
    );
  }

  const isTal = shop.position.x === 9 && shop.position.y === 9;
  const talVisitKey = `ud-shop-visited-${shop.shopId}`;
  const [showIntro, setShowIntro] = useState(() => {
    if (!isTal) return false;
    return !localStorage.getItem(talVisitKey);
  });

  useEffect(() => {
    if (showIntro && isTal) {
      localStorage.setItem(talVisitKey, '1');
    }
  }, [isTal, showIntro, talVisitKey]);

  return (
    <Box>
      <Helmet>
        <title>{shop.name}&apos;s Shop | Ultimate Dominion</title>
      </Helmet>
      <HStack bgColor="#1C1814" color="#E8DCC8" h="68px" px={6}>
        <ShopSvg />
        <Heading size={{ base: 'sm', md: 'md' }}>{shop.name}&apos;s Shop</Heading>
        <Spacer />
        <HStack spacing={4}>
          <HStack spacing={1}>
            <IoNavigate size={20} />
            <Text fontWeight={700} size={{ base: 'lg', md: 'xl' }}>
              {shop.position.x},{shop.position.y}
            </Text>
          </HStack>
          <Button
            bg="#2A2520"
            border="1px solid #3A3228"
            color="#C4B89E"
            fontFamily="Cinzel, serif"
            fontSize="xs"
            fontWeight={600}
            letterSpacing="0.05em"
            onClick={onLeaveShop}
            px={4}
            size="sm"
            textTransform="uppercase"
            _hover={{ bg: '#3A3228', color: '#E8DCC8' }}
          >
            {t('shop.leaveShop')}
          </Button>
        </HStack>
      </HStack>

      {showIntro && isTal && (
        <Box
          bg="linear-gradient(180deg, #1C1814 0%, #14120F 100%)"
          borderBottom="1px solid #2A2520"
          px={6}
          py={4}
        >
          <Text
            color="#C4B89E"
            fontFamily="Cinzel, serif"
            fontSize={{ base: 'sm', md: 'md' }}
            fontStyle="italic"
            lineHeight="tall"
          >
            A weathered figure looks up from behind stacks of salvaged gear.
            Scars run across his knuckles. He sizes you up with a glance that
            has measured a thousand adventurers before you.
          </Text>
          <Text
            color="#E8DCC8"
            fontSize={{ base: 'sm', md: 'md' }}
            fontWeight={600}
            mt={2}
          >
            &ldquo;Name&apos;s Tal. I trade in what the cave spits out and what
            fools leave behind. You need something, I probably have it. You want
            a fair price &mdash; well, you&apos;ll find I&apos;m fairer than
            most down here.&rdquo;
          </Text>
          <Text
            as="button"
            color="#8A7E6A"
            fontSize="xs"
            mt={2}
            onClick={() => setShowIntro(false)}
            _hover={{ color: '#C4B89E', textDecoration: 'underline' }}
          >
            [Continue]
          </Text>
        </Box>
      )}

      <Grid
        gap={4}
        mt={4}
        templateColumns={{ base: 'repeat(1, 1fr)', xl: 'repeat(2, 1fr)' }}
      >
        <GridItem>
          <HStack bgColor="#1C1814" h="68px" px={6}>
            <Heading color="#E8DCC8" size={{ base: 'sm', md: 'md' }}>
              My Inventory
            </Heading>
            <Spacer />
            <Text
              color="yellow"
              fontWeight={700}
              size={{ base: 'lg', md: 'xl' }}
            >
              {etherToFixedNumber(BigInt(userCharacter.externalGoldBalance) + goldAdjustment)} $GOLD
            </Text>
            <Button
              leftIcon={<GiTwoCoins />}
              ml={2}
              onClick={onOpenGoldMerchant}
              size="xs"
              variant="gold"
            >
              Get Gold
            </Button>
            {sellAllCount > 0 && (
              <Button
                bg="#3A2A1A"
                border="1px solid #5A4A3A"
                color="#C4B89E"
                fontFamily="Cinzel, serif"
                fontSize="xs"
                fontWeight={600}
                isLoading={sellAllTx.isLoading}
                letterSpacing="0.05em"
                ml={2}
                onClick={handleSellAll}
                px={4}
                size="sm"
                textTransform="uppercase"
                _hover={{ bg: '#5A4A3A', color: '#E8DCC8' }}
              >
                Sell All ({sellAllCount})
              </Button>
            )}
          </HStack>
          <PolygonalCard clipPath="none" h="calc(100% - 68px)">
            {userCharacter && shopId && sellable && sellable.length ? (
              <ShopHalf
                characterId={userCharacter.id}
                items={sellable}
                onTradeComplete={onTradeComplete}
                orderType={OrderType.Selling}
                shop={shop}
              />
            ) : (
              <VStack p={6}>
                <Text>{t('shop.noSellableItems')}</Text>
              </VStack>
            )}
          </PolygonalCard>
        </GridItem>
        <GridItem>
          <HStack bgColor="#1C1814" h="68px" px={6}>
            <Heading color="#E8DCC8" size={{ base: 'sm', md: 'md' }}>
              Shopkeeper&apos;s Inventory
            </Heading>
          </HStack>
          <PolygonalCard clipPath="none" h="calc(100% - 68px)">
            {userCharacter && shopId && buyable && buyable.length ? (
              <ShopHalf
                characterId={userCharacter.id}
                items={buyable}
                onTradeComplete={onTradeComplete}
                orderType={OrderType.Buying}
                shop={shop}
              />
            ) : (
              <VStack p={6}>
                <Text>No Buyable Items</Text>
              </VStack>
            )}
          </PolygonalCard>
        </GridItem>
      </Grid>

      <RepairShopPanel />
    </Box>
  );
};
