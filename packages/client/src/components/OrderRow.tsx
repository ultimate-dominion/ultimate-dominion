import {
  Avatar,
  Button,
  Flex,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { BiPurchaseTagAlt } from 'react-icons/bi';
import { MdOutlineCancelPresentation } from 'react-icons/md';
import { Address } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';

export const OrderRow = ({
  from,
  orderHash,
  consideration,
  offer,
  offerItem,
  emoji,
  considerationItem,
}: {
  from: string;
  orderHash: string;
  consideration: number;
  considerationItem: string;
  offer: number;
  offerItem: string;
  emoji: string;
  recipient: string;
}): JSX.Element => {
  const { character: userCharacter } = useCharacter();

  const {
    network: { worldContract },
  } = useMUD();

  return (
    <Flex
      border="2px solid"
      borderColor="grey400"
      borderRadius={2}
      justify="space-between"
      w="100%"
    >
      <Flex>
        <Avatar
          borderRadius={0}
          size="lg"
          name={' '}
          backgroundColor={'grey300'}
        >
          {emoji}
        </Avatar>
        <VStack align="start" justify="center" ml={4}>
          <HStack w="100%">
            <Text size={{ base: '2xs', lg: 'sm' }}>From: {from}</Text>
            {/* <Center>
              {entityClass == StatsClasses.Warrior && <GiAxeSword size={15} />}
              {entityClass == StatsClasses.Rogue && <GiRogue size={15} />}
              {entityClass == StatsClasses.Mage && <FaHatWizard size={15} />}
            </Center> */}
          </HStack>
          <Text size={{ base: '3xs', sm: '2xs', lg: 'sm' }}>
            {consideration} {considerationItem} x {offer} {offerItem}
          </Text>
        </VStack>
      </Flex>
      <HStack>
        <HStack w={{ base: '130px', sm: '215px', md: '300px', lg: '450px' }}>
          {/* <Text
            display={{ base: 'none', lg: 'block' }}
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(floor).toLocaleString()}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {level}
          </Text>
          <Text
            fontWeight={500}
            size={{ base: 'xs', lg: 'md' }}
            textAlign="center"
            w="100%"
          >
            {Number(high).toLocaleString()}
          </Text> */}
        </HStack>
        <Stack display={{ base: 'none', md: 'block' }} w="50px">
          {from == userCharacter?.owner ? (
            <Button
              p={3}
              variant="ghost"
              backgroundColor="red"
              color="white"
              onClick={() => {
                worldContract.write.UD__cancelOrder([orderHash as Address]);
              }}
            >
              <MdOutlineCancelPresentation />
            </Button>
          ) : (
            <Button
              p={3}
              variant="solid"
              onClick={() => {
                worldContract.write.UD__fulfillOrder([orderHash as Address]);
              }}
            >
              <BiPurchaseTagAlt />
            </Button>
          )}
        </Stack>
      </HStack>
    </Flex>
  );
};
