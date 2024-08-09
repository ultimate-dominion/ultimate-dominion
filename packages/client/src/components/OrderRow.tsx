import {
  Avatar,
  Button,
  Flex,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import worldAbi from 'contracts/out/IWorld.sol/IWorld.abi.json';
import { useState } from 'react';
import { BiPurchaseTagAlt } from 'react-icons/bi';
import { FaTimes } from 'react-icons/fa';
import { Address } from 'viem';
import { useWalletClient } from 'wagmi';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';

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
  const { data: externalWalletClient } = useWalletClient();

  const {
    network: { publicClient, worldContract },
  } = useMUD();
  const { renderSuccess, renderError } = useToast();

  const [isCancelling, setIsCancelling] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const cancelOrder = async function () {
    if (!externalWalletClient) {
      renderError('Wallet not connected.');
      return;
    }
    try {
      setIsCancelling(true);
      const { request } = await publicClient.simulateContract({
        address: worldContract.address,
        abi: worldAbi,
        functionName: 'UD__cancelOrder',
        args: [orderHash as Address],
        account: externalWalletClient.account,
      });
      await externalWalletClient.writeContract(request);
      renderSuccess('Order canceled successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsCancelling(false);
    }
  };

  const fillOrder = async function () {
    if (!externalWalletClient) {
      renderError('Wallet not connected.');
      return;
    }
    try {
      setIsFilling(true);
      const { request } = await publicClient.simulateContract({
        address: worldContract.address,
        abi: worldAbi,
        functionName: 'UD__fulfillOrder',
        args: [orderHash as Address],
        account: externalWalletClient.account,
      });
      await externalWalletClient?.writeContract(request);
      renderSuccess('Order filled successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error cancelling order.', e);
    } finally {
      setIsFilling(false);
    }
  };
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
              isLoading={isCancelling}
              onClick={() => cancelOrder()}
            >
              <FaTimes />
            </Button>
          ) : (
            <Button
              p={3}
              variant="solid"
              isLoading={isFilling}
              onClick={() => fillOrder()}
            >
              <BiPurchaseTagAlt />
            </Button>
          )}
        </Stack>
      </HStack>
    </Flex>
  );
};
