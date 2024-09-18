import {
  Avatar,
  Box,
  Button,
  Flex,
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
import { useState } from 'react';
import { IoIosArrowForward } from 'react-icons/io';
import { IoAdd, IoRemove } from 'react-icons/io5';
import { parseEther } from 'viem';

import { useAllowance } from '../contexts/AllowanceContext';
import { useMUD } from '../contexts/MUDContext';
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
  shopId,
}: {
  balance: string | null;
  characterId: Entity;
  item: ArmorTemplate | SpellTemplate | WeaponTemplate;
  itemIndex: string;
  orderType: OrderType;
  shopId: string;
  stock: string | null;
}): JSX.Element => {
  // const { renderError /* , renderSuccess */ } = useToast();
  const {
    systemCalls: { buy, sell },
  } = useMUD();

  const { goldAllowanceShops, itemsAllowanceShops } = useAllowance();

  const {
    isOpen: isAllowanceOpen,
    onOpen: onAllowanceOpen,
    onClose: onAllowanceClose,
  } = useDisclosure();

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [amount, setAmount] = useState(1);

  const { name, statRestrictions } = item;

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
          ></Text>
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
            {etherToFixedNumber(item.price)}
          </Text>
        </HStack>
        <ShopAllowanceModal
          isCompleting={false}
          isOpen={isAllowanceOpen}
          itemName={name}
          onClose={onAllowanceClose}
          onComplete={onAllowanceClose}
          orderPrice={(Number(item.price) * amount).toString()}
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
                <GridItem colSpan={2} textAlign="center">
                  <VStack>
                    {orderType == OrderType.Buying ? (
                      <Text>
                        Total Cost:{' '}
                        {etherToFixedNumber(item.price * BigInt(amount))} $GOLD
                      </Text>
                    ) : (
                      <Text>
                        Total to recieve:{' '}
                        {etherToFixedNumber(item.price * BigInt(amount))} $GOLD
                      </Text>
                    )}
                    <HStack>
                      <Button
                        disabled={amount <= 1}
                        onClick={() =>
                          setAmount(
                            amount > 0 && amount <= Number(stock)
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
                        onChange={e => setAmount(Number(e.target.value))}
                        p={2}
                        placeholder="0"
                        size="sm"
                        step={1}
                        w={10}
                      />
                      <Button
                        disabled={amount <= Number(stock || balance)}
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
                    <Text mt={3}>AMOUNT (MAX {stock || balance}) </Text>
                    {orderType == OrderType.Buying &&
                      goldAllowanceShops <
                        parseEther(
                          (Number(item.price) * amount).toString(),
                        ) && <Button onClick={onAllowanceOpen}>Approve</Button>}
                    {orderType == OrderType.Selling && !itemsAllowanceShops && (
                      <Button onClick={onAllowanceOpen}>Approve</Button>
                    )}
                    {orderType == OrderType.Buying &&
                      goldAllowanceShops >=
                        parseEther(
                          (Number(item.price) * amount).toString(),
                        ) && (
                        <Button
                          onClick={() =>
                            buy(
                              amount.toString(),
                              shopId,
                              itemIndex,
                              characterId,
                            )
                          }
                        >
                          Buy
                        </Button>
                      )}
                    {orderType == OrderType.Selling && itemsAllowanceShops && (
                      <Button
                        onClick={() =>
                          sell(
                            amount.toString(),
                            shopId,
                            itemIndex,
                            characterId,
                          )
                        }
                      >
                        Sell
                      </Button>
                    )}
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
