import { Divider, HStack, Spacer, Stack, Text, VStack } from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { encodeEntity } from '@latticexyz/store-sync/recs';
import { useParams } from 'react-router-dom';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { ShopHalf } from '../components/ShopHalf';
import { useItems } from '../contexts/ItemsContext';
import { useMUD } from '../contexts/MUDContext';

export const Shop = (): JSX.Element => {
  const { shopId } = useParams();
  const { armorTemplates, weaponTemplates } = useItems();

  const {
    components: { Shops },
  } = useMUD();
  const items = [...armorTemplates, ...weaponTemplates];
  const shop = useComponentValue(
    Shops,
    encodeEntity({ mobId: 'uint256' }, { mobId: BigInt(shopId || 1) }),
  );

  const buyable = items.filter(item =>
    shop
      ? shop.buyableItems
          .map(item => item.toString())
          .indexOf(item.tokenId.toString()) > -1
      : false,
  );
  const sellable = items.filter(item =>
    shop
      ? shop.sellableItems
          .map(item => item.toString())
          .indexOf(item.tokenId.toString()) > -1
      : false,
  );

  return (
    <VStack mt={16}>
      <Typist avgTypingDelay={10} cursor={{ show: false }} stdTypingDelay={10}>
        <Text textAlign="center" w="100%">
          Hello, and welcome to my shop! Please have a look at my wares. Let me
          know if you need any help.
        </Text>
      </Typist>
      <HStack border="2px solid" mt={8} p={8} w="100%">
        <Spacer />
        {shopId ? (
          <Stack w="100%">
            {sellable && sellable.length > 0 ? (
              <ShopHalf
                items={sellable}
                name="Character’s Inventory - 55 $GOLD"
              />
            ) : (
              <Text>No Data</Text>
            )}
          </Stack>
        ) : (
          <Stack>
            <Text>No Data</Text>
          </Stack>
        )}
        <Divider border="1px solid black" mx={8} orientation="vertical" />
        <Stack w="100%">
          {buyable && buyable.length > 0 ? (
            <ShopHalf
              items={buyable}
              name="Shopkeeper's Inventory - 55 $GOLD"
            />
          ) : (
            <Text>No Data</Text>
          )}
        </Stack>
        <Spacer />
      </HStack>
    </VStack>
  );
};
