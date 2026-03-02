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
import { IoNavigate } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router-dom';
import { PolygonalCard } from '../components/PolygonalCard';
import { ShopHalf } from '../components/ShopHalf';
import { ShopSvg } from '../components/SVGs/ShopSvg';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMap } from '../contexts/MapContext';
import { useAuth } from '../contexts/AuthContext';
import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH, HOME_PATH } from '../Routes';
import { etherToFixedNumber } from '../utils/helpers';
import {
  type ArmorTemplate,
  type ConsumableTemplate,
  OrderType,
  type SpellTemplate,
  type WeaponTemplate,
} from '../utils/types';

export const Shop = (): JSX.Element => {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated: isConnected, isConnecting } = useAuth();

  const {
    delegatorAddress,
    isSynced,
    systemCalls: { endShopEncounter },
  } = useMUD();
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
    refreshCharacter,
  } = useCharacter();
  const { allShops, refreshEntities } = useMap();

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
  const [shopGoldAdjustment, setShopGoldAdjustment] = useState(0n);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTradeComplete = useCallback(
    (tokenId: string, amount: number, goldDelta: bigint, orderType: OrderType) => {
      if (orderType === OrderType.Selling) {
        setGoldAdjustment(prev => prev + goldDelta);
        setShopGoldAdjustment(prev => prev - goldDelta);
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
        setShopGoldAdjustment(prev => prev + goldDelta);
        setBuyable(prev =>
          prev.map(entry =>
            entry.item.tokenId === tokenId
              ? { ...entry, stock: (entry.stock ?? 0n) - BigInt(amount) }
              : entry,
          ),
        );
      }

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshCharacter();
        refreshEntities();
        setGoldAdjustment(0n);
        setShopGoldAdjustment(0n);
      }, 3000);
    },
    [refreshCharacter, refreshEntities],
  );

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

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

    refreshEntities();
  }, [
    delegatorAddress,
    isConnected,
    isConnecting,
    isRefreshing,
    isSynced,
    navigate,
    refreshEntities,
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
      // filter out the items this shop does not sell
      .filter(item => shop.sellableItems.includes(item.tokenId))
      // add back the balances of the item and itemIndexes
      .map(item => {
        const index = shop?.sellableItems.indexOf(item.tokenId).toString();
        const isEquipped = equippedItems.some(
          equippedItem => equippedItem.tokenId === item.tokenId,
        );
        return {
          balance: item.balance,
          index: index,
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
        <Text>Shop not found</Text>
      </VStack>
    );
  }

  if (!userCharacter) {
    return (
      <VStack>
        <Text>Character not found</Text>
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
            Leave Shop
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
                <Text>No Sellable Items</Text>
              </VStack>
            )}
          </PolygonalCard>
        </GridItem>
        <GridItem>
          <HStack bgColor="#1C1814" h="68px" px={6}>
            <Heading color="#E8DCC8" size={{ base: 'sm', md: 'md' }}>
              Shopkeeper&apos;s Inventory
            </Heading>
            <Spacer />
            <Text
              color="yellow"
              fontWeight={700}
              size={{ base: 'lg', md: 'xl' }}
            >
              {etherToFixedNumber(BigInt(shop.gold) + shopGoldAdjustment).toString()} $GOLD
            </Text>
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
    </Box>
  );
};
