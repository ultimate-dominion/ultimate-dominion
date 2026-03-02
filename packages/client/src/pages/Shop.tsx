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
import { useCallback, useEffect, useMemo, useState } from 'react';
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
    systemCalls: { endWorldEncounter, triggerFragment },
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
  } = useCharacter();
  const { allShops, refreshEntities } = useMap();

  const shop = useMemo(() => {
    if (!(shopId && allShops)) return null;
    return allShops.find(shop => shop.shopId === shopId) ?? null;
  }, [allShops, shopId]);

  const [isLeaving, setIsLeaving] = useState(false);

  const onLeaveShop = useCallback(async () => {
    if (!userCharacter?.worldEncounter) {
      navigate(GAME_BOARD_PATH);
      return;
    }

    setIsLeaving(true);

    // Fire Fragment II for Tal's shop (9,9) from the client.
    // The on-chain ShopSystem.endShopEncounter path is broken — it calls
    // triggerFragment via World which hits MUD's prohibitDirectCallback.
    // External → World → system calls bypass that check.
    if (shop && userCharacter.id && shop.position.x === 9 && shop.position.y === 9) {
      triggerFragment(userCharacter.id, 2, 9, 9).catch(() => {});
    }

    // End the encounter directly via EncounterResolveSystem (same path
    // MapSystem uses). This bypasses ShopSystem.endShopEncounter which
    // reverts due to the triggerFragment prohibitDirectCallback issue.
    await endWorldEncounter(userCharacter.worldEncounter.encounterId);

    setIsLeaving(false);
    navigate(GAME_BOARD_PATH);
  }, [endWorldEncounter, navigate, shop, triggerFragment, userCharacter]);

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
            isLoading={isLeaving}
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
              {etherToFixedNumber(userCharacter.externalGoldBalance)} $GOLD
            </Text>
          </HStack>
          <PolygonalCard clipPath="none" h="calc(100% - 68px)">
            {userCharacter && shopId && sellable && sellable.length ? (
              <ShopHalf
                characterId={userCharacter.id}
                shop={shop}
                items={sellable}
                orderType={OrderType.Selling}
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
              {etherToFixedNumber(BigInt(shop.gold)).toString()} $GOLD
            </Text>
          </HStack>
          <PolygonalCard clipPath="none" h="calc(100% - 68px)">
            {userCharacter && shopId && buyable && buyable.length ? (
              <ShopHalf
                characterId={userCharacter.id}
                items={buyable}
                shop={shop}
                orderType={OrderType.Buying}
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
