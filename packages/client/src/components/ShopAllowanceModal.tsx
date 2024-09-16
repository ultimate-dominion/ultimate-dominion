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
  Text,
  VStack,
} from '@chakra-ui/react';
import { useComponentValue } from '@latticexyz/react';
import { singletonEntity } from '@latticexyz/store-sync/recs';
import { useCallback, useEffect, useState } from 'react';
import { Address, erc20Abi, formatEther, parseEther } from 'viem';
import { useAccount, useWalletClient } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ERC_1155_ABI } from '../utils/constants';
import { ConnectWalletButton } from './ConnectWalletButton';

export const ShopAllowanceModal = ({
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
    network: { publicClient },
    components: { UltimateDominionConfig },
  } = useMUD();

  const { goldToken } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { goldToken: null };

  const { items: itemsContract } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { items: null };

  const [goldAllowance, setGoldAllowance] = useState<string>('0');
  const [isApprovingGold, setIsApprovingGold] = useState(false);
  const [goldErrorMessage, setGoldErrorMessage] = useState<string | null>(null);

  const [itemsApproved, setItemsApproved] = useState(false);
  const [isApprovingItems, setIsApprovingItems] = useState(false);

  const { shop: shopAddress } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { shop: null };

  // Reset errorMessage state when any of the form fields change
  useEffect(() => {
    setGoldErrorMessage(null);
  }, [goldAllowance]);

  useEffect(() => {
    if (isOpen) {
      if (shopAddress && externalWalletClient) {
        (async () => {
          const _itemsApproved = !!(await publicClient.readContract({
            address: itemsContract as Address,
            abi: ERC_1155_ABI,
            functionName: 'isApprovedForAll',
            args: [externalWalletClient.account.address, shopAddress],
          })) as boolean;

          const _goldAllowance = await publicClient.readContract({
            address: goldToken as Address,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [
              externalWalletClient.account.address,
              shopAddress as Address,
            ],
          });

          setItemsApproved(_itemsApproved);
          setGoldAllowance(formatEther(_goldAllowance));
        })();
      }
    }
  }, [
    externalWalletClient,
    goldToken,
    isOpen,
    itemsContract,
    shopAddress,
    publicClient,
  ]);

  const onApproveGoldAllowance = useCallback(async () => {
    try {
      setIsApprovingGold(true);

      if (!externalWalletClient) {
        throw new Error('No external wallet client found.');
      }

      if (!shopAddress) {
        throw new Error('No shop address found.');
      }

      if (!goldAllowance || parseEther(goldAllowance) <= 0) {
        setGoldErrorMessage('Amount must be greater than 0.');
        return;
      }

      const { request } = await publicClient.simulateContract({
        address: goldToken as Address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [shopAddress as Address, parseEther(goldAllowance)],
      });

      const txHash = await externalWalletClient.writeContract(request);
      const { status } = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (status !== 'success') {
        throw new Error('Transaction failed.');
      }

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
    shopAddress,
    publicClient,
    renderError,
    renderSuccess,
  ]);

  const onSetApprovalForAllItems = useCallback(async () => {
    try {
      setIsApprovingItems(true);

      if (!externalWalletClient) {
        throw new Error('No external wallet client found.');
      }

      if (!shopAddress) {
        throw new Error('No shop address found.');
      }

      const { request } = await publicClient.simulateContract({
        address: itemsContract as Address,
        abi: ERC_1155_ABI,
        functionName: 'setApprovalForAll',
        args: [shopAddress, !itemsApproved],
      });

      const txHash = await externalWalletClient.writeContract(request);
      const { status } = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (status !== 'success') {
        throw new Error('Transaction failed.');
      }

      setItemsApproved(!itemsApproved);
      renderSuccess(
        `Item allowance successfully ${itemsApproved ? 'disallowed' : 'allowed'}!`,
      );
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error setting item allowance.', e);
    } finally {
      setIsApprovingItems(false);
    }
  }, [
    externalWalletClient,
    itemsApproved,
    itemsContract,
    shopAddress,
    publicClient,
    renderError,
    renderSuccess,
  ]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isConnected ? 'shop Allowances' : 'Connect Wallet'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {address && externalWalletClient && isConnected ? (
            <VStack p={4} spacing={10}>
              <VStack alignItems="start" spacing={4}>
                <HStack>
                  <FormControl isInvalid={!!goldErrorMessage}>
                    <FormLabel fontSize="xs">Set shop gold allowance</FormLabel>
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
                    onClick={onApproveGoldAllowance}
                    size="sm"
                  >
                    Allow
                  </Button>
                </HStack>
                <HStack>
                  <FormControl>
                    <FormLabel fontSize="xs">Set shop item approval</FormLabel>
                    <Button
                      isLoading={isApprovingItems}
                      onClick={onSetApprovalForAllItems}
                      size="sm"
                    >
                      {itemsApproved ? 'Disallow' : 'Allow'}
                    </Button>
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
