import {
  Avatar,
  Button,
  Divider,
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { IoMdArrowRoundBack } from 'react-icons/io';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Address, erc20Abi, parseEther } from 'viem';

import { MarketplaceAllowanceModal } from '../components/MarketplaceAllowanceModal';
import { OrderRow } from '../components/OrderRow';
import { useCharacter } from '../contexts/CharacterContext';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';
import { useOrders } from '../contexts/OrdersContext';
import { useToast } from '../hooks/useToast';
import { MARKETPLACE_PATH } from '../Routes';
import { ERC_1155_ABI } from '../utils/constants';
import { etherToFixedNumber, getEmoji, removeEmoji } from '../utils/helpers';
import {
  type ArmorTemplate,
  ItemType,
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

  const {
    components: { ItemsOwners, UltimateDominionConfig },
    network: { publicClient },
    systemCalls: { createOrder },
  } = useMUD();
  const {
    armorTemplates,
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
  const { character: userCharacter, refreshCharacter } = useCharacter();

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const [orderType, setOrderType] = useState(OrderType.None);
  const [orderPrice, setOrderPrice] = useState('');

  const { isOpen, onClose, onOpen } = useDisclosure();

  const { marketplace: marketplaceAddress, goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { marketplace: null, goldToken: null };

  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };

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

  const fetchAllowances = useCallback(async () => {
    let allowances = { goldAllowance: 0n, itemAllowance: false };
    try {
      const _goldAllowance = await publicClient.readContract({
        address: goldToken as Address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [userCharacter?.owner as Address, marketplaceAddress as Address],
      });

      const _itemAllowance = (await publicClient.readContract({
        address: itemsContract as Address,
        abi: ERC_1155_ABI,
        functionName: 'isApprovedForAll',
        args: [userCharacter?.owner as Address, marketplaceAddress as Address],
      })) as boolean;
      allowances = {
        goldAllowance: _goldAllowance,
        itemAllowance: _itemAllowance,
      };
      return allowances;
    } catch (e) {
      renderError((e as Error)?.message ?? 'Could not get allowances', e);
      return allowances;
    }
  }, [
    goldToken,
    itemsContract,
    marketplaceAddress,
    publicClient,
    renderError,
    userCharacter?.owner,
  ]);

  const onCreateOrder = useCallback(
    async (
      offerType: TokenType,
      considerationType: TokenType,
      amount: string,
      price: string,
    ) => {
      try {
        setIsCreatingOrder(true);

        if (!userCharacter) throw new Error('Character not found.');
        if (!selectedItem) throw new Error('Item not found.');
        if (!goldToken || !itemsContract) {
          throw new Error('Token contracts not found.');
        }

        const allowances = await fetchAllowances();

        if (
          offerType === TokenType.ERC20 &&
          (!allowances.goldAllowance ||
            allowances.goldAllowance < BigInt(price))
        ) {
          onOpen();
          throw new Error('Gold allowance is insufficient.');
        }

        if (offerType === TokenType.ERC1155 && !allowances.itemAllowance) {
          onOpen();
          throw new Error('Items allowance is off.');
        }

        if (
          offerType === TokenType.ERC1155 &&
          Number(amount) > Number(userItemBalance)
        ) {
          throw new Error(
            `You do not have enough ${selectedItem.name} to sell.`,
          );
        }

        const _order = {
          consideration: {
            amount:
              considerationType === TokenType.ERC20
                ? parseEther(price)
                : BigInt(price),
            identifier:
              considerationType === TokenType.ERC20
                ? 0n
                : BigInt(selectedItem.tokenId),
            recipient: userCharacter.owner as Address,
            token: (considerationType === TokenType.ERC20
              ? goldToken
              : itemsContract) as Address,
            tokenType: considerationType,
          },
          offer: {
            amount:
              offerType === TokenType.ERC20
                ? parseEther(amount)
                : BigInt(amount),
            identifier:
              offerType === TokenType.ERC20 ? 0n : BigInt(selectedItem.tokenId),
            token: (offerType === TokenType.ERC20
              ? goldToken
              : itemsContract) as Address,
            tokenType: offerType,
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
      } catch (e) {
        renderError((e as Error)?.message ?? 'Failed to create order.', e);
      } finally {
        setIsCreatingOrder(false);
      }
    },
    [
      createOrder,
      fetchAllowances,
      goldToken,
      itemsContract,
      onOpen,
      refreshCharacter,
      refreshOrders,
      renderError,
      renderSuccess,
      selectedItem,
      userCharacter,
      userItemBalance,
    ],
  );

  useEffect(() => {
    if (searchParams.get('orderType') === OrderType.Buying) {
      setOrderType(OrderType.Buying);
    } else if (searchParams.get('orderType') === OrderType.Selling) {
      setOrderType(OrderType.Selling);
    }
  }, [searchParams]);

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
          {orderType === OrderType.Buying && (
            <VStack alignItems="start" as="form">
              <Text mt={4}>How much $GOLD are you offering?</Text>
              <InputGroup>
                <InputLeftAddon>$GOLD</InputLeftAddon>
                <Input
                  isDisabled={isCreatingOrder}
                  min={0}
                  onChange={e => setOrderPrice(e.target.value)}
                  placeholder="0.00"
                  py={0}
                  type="number"
                  value={orderPrice}
                />
              </InputGroup>
              <Button
                isLoading={isCreatingOrder}
                onClick={() =>
                  onCreateOrder(
                    TokenType.ERC20,
                    TokenType.ERC1155,
                    orderPrice,
                    '1',
                  )
                }
                size="sm"
                w="100%"
              >
                Make an Offer for {selectedItem.name}
              </Button>
            </VStack>
          )}
          {orderType === OrderType.Selling &&
            (userItemBalance === '0' ? (
              <Text mt={4} size="sm">
                You don&apos;t have any {selectedItem.name} in your inventory.
              </Text>
            ) : (
              <>
                <Text mt={4}>How much $GOLD are you asking for?</Text>
                <InputGroup>
                  <InputLeftAddon>$GOLD</InputLeftAddon>
                  <Input
                    isDisabled={isCreatingOrder}
                    min={0}
                    onChange={e => setOrderPrice(e.target.value)}
                    placeholder="0.00"
                    py={0}
                    type="number"
                    value={orderPrice}
                  />
                </InputGroup>
                <Button
                  isLoading={isCreatingOrder}
                  onClick={() =>
                    onCreateOrder(
                      TokenType.ERC1155,
                      TokenType.ERC20,
                      '1',
                      orderPrice,
                    )
                  }
                  size="sm"
                  w="100%"
                >
                  List {selectedItem.name} for sale
                </Button>
              </>
            ))}
        </Stack>
      </HStack>

      <Tabs mt={12} variant="enclosed">
        <TabList>
          <Tab>Item Listings</Tab>
          <Tab>$GOLD Offers</Tab>
          <Tab>History</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Stack gap={2}>
              {activeOrders
                .filter(
                  order =>
                    order.offer.token == itemsContract &&
                    order.consideration.token == goldToken &&
                    order.offer.identifier == selectedItemId,
                )
                .filter(order => order.orderStatus == '1')
                .map((order, i) => (
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
              {activeOrders
                .filter(
                  order =>
                    order.offer.token == goldToken &&
                    order.consideration.token == itemsContract &&
                    order.consideration.identifier == selectedItemId,
                )
                .filter(order => order.orderStatus == '1')
                .map((order, i) => (
                  <OrderRow
                    key={`order-${i}`}
                    item={selectedItem}
                    order={order}
                    refreshOrders={refreshOrders}
                  />
                ))}
            </Stack>
          </TabPanel>
          <TabPanel>Coming soon...</TabPanel>
        </TabPanels>
      </Tabs>
      <MarketplaceAllowanceModal isOpen={isOpen} onClose={onClose} />
    </VStack>
  );
};
