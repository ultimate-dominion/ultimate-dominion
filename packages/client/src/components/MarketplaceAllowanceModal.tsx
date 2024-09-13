import {
  Button,
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
import { useCallback, useState } from 'react';
import { Address, erc20Abi, parseEther } from 'viem';
import { useAccount, useWalletClient } from 'wagmi';

import { useAllowance } from '../contexts/AllowanceContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { ERC_1155_ABI } from '../utils/constants';
import { OrderType } from '../utils/types';

export const MarketplaceAllowanceModal = ({
  isCreatingOrder,
  isOpen,
  itemName,
  onClose,
  onCreateOrder,
  orderPrice,
  orderType,
}: {
  isCreatingOrder: boolean;
  isOpen: boolean;
  itemName: string;
  onClose: () => void;
  onCreateOrder: (e: React.FormEvent) => void;
  orderPrice: string;
  orderType: OrderType;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { data: externalWalletClient } = useWalletClient();
  const { isConnected, address } = useAccount();
  const {
    network: { publicClient },
    components: { UltimateDominionConfig },
  } = useMUD();
  const { goldAllowance, itemsAllowance, refreshAllowances } = useAllowance();

  const { goldToken: goldTokenAddress, items: itemsAddress } =
    useComponentValue(UltimateDominionConfig, singletonEntity) ?? {
      goldToken: null,
      items: null,
    };

  const [isApprovingGold, setIsApprovingGold] = useState(false);
  const [isApprovingItems, setIsApprovingItems] = useState(false);

  const { marketplace: marketplaceAddress } = useComponentValue(
    UltimateDominionConfig,
    singletonEntity,
  ) ?? { marketplace: null };

  const onApproveGoldAllowance = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        setIsApprovingGold(true);

        if (!externalWalletClient) {
          throw new Error('No external wallet client found.');
        }

        if (!marketplaceAddress) {
          throw new Error('No Marketplace address found.');
        }

        if (!orderPrice || parseEther(orderPrice) <= 0) {
          throw new Error('Amount must be greater than 0.');
        }

        const { request } = await publicClient.simulateContract({
          address: goldTokenAddress as Address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [marketplaceAddress as Address, parseEther(orderPrice)],
        });

        const txHash = await externalWalletClient.writeContract(request);
        const { status } = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        if (status !== 'success') {
          throw new Error('Transaction failed.');
        }

        renderSuccess('Gold allowance successfully set!');
        refreshAllowances();
      } catch (e) {
        renderError(
          (e as Error)?.message ?? 'Error setting gold allowance.',
          e,
        );
      } finally {
        setIsApprovingGold(false);
      }
    },
    [
      externalWalletClient,
      goldTokenAddress,
      marketplaceAddress,
      orderPrice,
      publicClient,
      refreshAllowances,
      renderError,
      renderSuccess,
    ],
  );

  const onSetApprovalForAllItems = useCallback(async () => {
    try {
      setIsApprovingItems(true);

      if (!externalWalletClient) {
        throw new Error('No external wallet client found.');
      }

      if (!marketplaceAddress) {
        throw new Error('No Marketplace address found.');
      }

      const { request } = await publicClient.simulateContract({
        address: itemsAddress as Address,
        abi: ERC_1155_ABI,
        functionName: 'setApprovalForAll',
        args: [marketplaceAddress, true],
      });

      const txHash = await externalWalletClient.writeContract(request);
      const { status } = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (status !== 'success') {
        throw new Error('Transaction failed.');
      }

      renderSuccess('Items allowance successfully set!');
      refreshAllowances();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error setting item allowance.', e);
    } finally {
      setIsApprovingItems(false);
    }
  }, [
    externalWalletClient,
    itemsAddress,
    marketplaceAddress,
    publicClient,
    refreshAllowances,
    renderError,
    renderSuccess,
  ]);

  if (!(address && externalWalletClient && isConnected)) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Marketplace Allowances</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack p={4} spacing={10}>
              <Text textAlign="center">An error occured.</Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} variant="ghost">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  if (
    (goldAllowance >= BigInt(orderPrice) && orderType === OrderType.Buying) ||
    (itemsAllowance && orderType === OrderType.Selling)
  ) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Marketplace Allowances</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack as="form" onSubmit={onCreateOrder} p={4} spacing={10}>
              <Text textAlign="center">
                Allowance was successful! You can now complete your listing.
              </Text>
              <Button isLoading={isCreatingOrder} type="submit">
                Complete
              </Button>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} variant="ghost">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Marketplace Allowances</ModalHeader>
        <ModalCloseButton />
        <ModalBody py={8}>
          {orderType === OrderType.Buying && (
            <VStack as="form" onSubmit={onApproveGoldAllowance} spacing={10}>
              <Text alignSelf="start">
                In order to buy {itemName}, you must allow the marketplace to
                use {orderPrice} of your $GOLD.
              </Text>
              <Button isLoading={isApprovingGold} type="submit">
                Allow
              </Button>
            </VStack>
          )}
          {orderType === OrderType.Selling && (
            <VStack p={4} spacing={10}>
              <Text>
                In order to sell {itemName}, you must allow the marketplace to
                manage your items.
              </Text>
              <Button
                onClick={onSetApprovalForAllItems}
                isLoading={isApprovingItems}
              >
                Allow
              </Button>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
