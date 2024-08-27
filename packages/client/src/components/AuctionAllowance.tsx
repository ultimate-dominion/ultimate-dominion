import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useState } from 'react';
import { Address, erc20Abi, parseEther } from 'viem';
import { useAccount, useBalance, useWalletClient } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ERC_1155ABI } from '../utils/constants';
import { ConnectWalletButton } from './ConnectWalletButton';
export const AuctionAllowance = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { data: externalWalletClient } = useWalletClient();
  const { isConnected, address } = useAccount();
  const {
    network: { walletClient, worldContract, publicClient },
    components: { UltimateDominionConfig },
  } = useMUD();
  useBalance({
    address: externalWalletClient?.account.address,
  });
  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };

  const [goldAllowance, setGoldAllowance] = useState<string>('100');
  const [isApprovingGold, setIsApprovingGold] = useState(false);
  const [goldErrorMessage, setGoldErrorMessage] = useState<string | null>(null);

  const [itemsApprovedInitial, setItemsApprovedInitial] = useState<
    boolean | null
  >(null);
  const [itemAllowed, setItemAllowed] = useState(false);
  const [isApprovingItems, setIsApprovingItems] = useState(false);

  // Reset errorMessage state when any of the form fields change
  useEffect(() => {
    setGoldErrorMessage(null);
  }, [goldAllowance]);

  useEffect(() => {
    if (isOpen) {
      setGoldAllowance('100');
      if (externalWalletClient && itemsApprovedInitial == null) {
        (async function () {
          const auction = await worldContract.read.UD__auctionHouseAddress();
          const t = await publicClient.readContract({
            address: itemsContract as Address,
            abi: ERC_1155ABI,
            functionName: 'isApprovedForAll',
            args: [externalWalletClient.account.address, auction as Address],
          });
          setItemAllowed(t as boolean);
          setItemsApprovedInitial(true);
        })();
      }
    }
  }, [
    externalWalletClient,
    isOpen,
    itemsApprovedInitial,
    itemsContract,
    publicClient,
    walletClient.account,
    worldContract.read,
  ]);

  const onGoldAllowance = useCallback(async () => {
    try {
      if (!externalWalletClient) {
        throw new Error('No external wallet client found.');
      }

      setIsApprovingGold(true);
      if (!goldAllowance || parseEther(goldAllowance) <= 0) {
        setGoldErrorMessage('Amount must be greater than 0.');
        return;
      }

      const auction = await worldContract.read.UD__auctionHouseAddress();

      const { request } = await publicClient.simulateContract({
        address: goldToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [auction, parseEther(goldAllowance)],
      });
      await externalWalletClient.writeContract(request);

      setGoldAllowance(goldAllowance);
      renderSuccess('Gold allowance successfully set!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error setting gold allowance.', e);
    } finally {
      setIsApprovingGold(false);
    }
  }, [
    externalWalletClient,
    goldAllowance,
    goldToken,
    publicClient,
    renderError,
    renderSuccess,
    worldContract.read,
  ]);
  const onItemsApproved = useCallback(async () => {
    try {
      if (!externalWalletClient) {
        throw new Error('No external wallet client found.');
      }

      setIsApprovingItems(true);
      const auction = await worldContract.read.UD__auctionHouseAddress();

      const { request } = await publicClient.simulateContract({
        address: itemsContract as Address,
        abi: ERC_1155ABI,
        functionName: 'setApprovalForAll',
        args: [auction as Address, !itemAllowed],
      });
      await externalWalletClient.writeContract(request);
      setItemAllowed(!itemAllowed);
      setIsApprovingItems(false);
      renderSuccess('Item allowance successfully set!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error setting item allowance.', e);
    } finally {
      setIsApprovingItems(false);
    }
  }, [
    externalWalletClient,
    itemAllowed,
    itemsContract,
    publicClient,
    renderError,
    renderSuccess,
    worldContract.read,
  ]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isConnected ? 'Auction House Allowances' : 'Connect Wallet'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {address && externalWalletClient && isConnected ? (
            <VStack p={4} spacing={10}>
              <VStack alignItems="start" spacing={4}>
                <HStack>
                  <FormControl isInvalid={!!goldErrorMessage}>
                    <FormLabel fontSize="xs">
                      Set Auction House gold allowance
                    </FormLabel>
                    {!!goldErrorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {goldErrorMessage}
                      </FormHelperText>
                    )}
                    <Input
                      isDisabled={isApprovingGold}
                      onChange={e => setGoldAllowance(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      value={goldAllowance}
                    />
                  </FormControl>
                  <Button
                    alignSelf="end"
                    isLoading={isApprovingGold}
                    onClick={onGoldAllowance}
                    size="sm"
                  >
                    Allow
                  </Button>
                </HStack>
                <HStack>
                  <FormControl>
                    <FormLabel fontSize="xs">
                      Set Auction House item approval
                    </FormLabel>
                    {!itemsApprovedInitial ? (
                      <Skeleton>
                        <Switch />
                      </Skeleton>
                    ) : (
                      <Switch
                        isDisabled={isApprovingItems}
                        onChange={onItemsApproved}
                        isChecked={itemAllowed}
                      ></Switch>
                    )}
                  </FormControl>
                </HStack>
              </VStack>
            </VStack>
          ) : (
            <VStack p={4} spacing={10}>
              <Text textAlign="center">Connect your wallet to play.</Text>
              <ConnectWalletButton />
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} size="sm">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
