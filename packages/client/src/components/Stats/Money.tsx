import { HStack, Spacer, Text } from '@chakra-ui/react';

export const Money = (): JSX.Element => {
  return (
    <HStack padding="5px" w="100%">
      <Text fontWeight="bold">2,00 $GOLD</Text>
      <Spacer></Spacer>
      <Text>190/345</Text>
    </HStack>
  );
};
