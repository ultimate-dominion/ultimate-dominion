import { Divider, HStack, Spacer, Stack, Text, VStack } from '@chakra-ui/react';
// eslint-disable-next-line import/no-named-as-default
import Typist from 'react-typist';

import { ShopHalf } from '../components/ShopHalf';

export const Shop = (): JSX.Element => {
  // const { armorTemplates, weaponTemplates } = useItems();
  return (
    <VStack mt={16}>
      <Typist avgTypingDelay={10} cursor={{ show: false }} stdTypingDelay={10}>
        <Text textAlign="center" w="100%">
          Hi, welcome to the shop. Please have a look at my wares. Let me know
          if you need any help.
        </Text>
      </Typist>
      <HStack border="2px solid" p={8} w="100%">
        <Spacer></Spacer>
        <Stack w="100%">
          <ShopHalf
            filterNames={['Weapon', 'Potion']}
            name="Character’s Inventory - 55 $GOLD"
            sortNames={['byStock', 'byPrice']}
          ></ShopHalf>
        </Stack>
        <Divider mx={8} border="1px solid black" orientation="vertical" />
        <Stack w="100%">
          <ShopHalf
            filterNames={['Weapon', 'Potion']}
            name="Basic Armory Inventory - 200 $GOLD"
            sortNames={['byStock', 'byPrice']}
          ></ShopHalf>
        </Stack>
        <Spacer></Spacer>
      </HStack>
    </VStack>
  );
};
