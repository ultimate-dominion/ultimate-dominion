import {
  Button,
  Divider,
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
import { Address, erc20Abi, formatEther, parseEther } from 'viem';
import { useAccount, useBalance, useWalletClient } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { shortenAddress } from '../utils/helpers';
import { ConnectWalletButton } from './ConnectWalletButton';
import { CopyText } from './CopyText';
const erc1155abi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'approved',
        type: 'bool',
      },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
    ],
    name: 'isApprovedForAll',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
export const WalletDetailsModal = ({
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
    burnerAddress,
    burnerBalance,
    network: { walletClient, worldContract, publicClient },
    components: { UltimateDominionConfig },
  } = useMUD();
  const { data: externalWalletBalance } = useBalance({
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

  const [depositAmount, setDepositAmount] = useState<string>('0');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositErrorMessage, setDepositErrorMessage] = useState<string | null>(
    null,
  );

  const [withdrawAmount, setWithdrawAmount] = useState<string>('0');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawErrorMessage, setWithdrawErrorMessage] = useState<
    string | null
  >(null);

  const [goldAllowance, setGoldAllowance] = useState<string>('0');
  const [isApprovingGold, setIsApprovingGold] = useState(false);
  const [goldErrorMessage, setGoldErrorMessage] = useState<string | null>(null);

  const [itemsApprovedInitial, setItemsApprovedInitial] = useState<
    boolean | null
  >(null);
  const [itemAllowed, setItemAllowed] = useState(false);
  const [isApprovingItems, setIsApprovingItems] = useState(false);

  // Reset errorMessage state when any of the form fields change
  useEffect(() => {
    setDepositErrorMessage(null);
    setWithdrawErrorMessage(null);
    setGoldErrorMessage(null);
  }, [depositAmount, withdrawAmount, goldAllowance]);

  useEffect(() => {
    if (isOpen) {
      setDepositAmount('0');
      setWithdrawAmount('0');
      setGoldAllowance('0');
      if (externalWalletClient && itemsApprovedInitial == null) {
        (async function () {
          const auction = await worldContract.read.UD__auctionHouseAddress();
          const t = await publicClient.readContract({
            address: itemsContract as Address,
            abi: erc1155abi,
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

  const onDeposit = useCallback(async () => {
    try {
      setIsDepositing(true);

      if (!(externalWalletBalance && externalWalletClient)) {
        throw new Error('No external wallet client found.');
      }

      if (!depositAmount || parseEther(depositAmount) <= 0) {
        setDepositErrorMessage('Amount must be greater than 0.');
        return;
      }

      if (parseEther(depositAmount) > externalWalletBalance.value) {
        setDepositErrorMessage('Insufficient funds in external wallet.');
        return;
      }

      await externalWalletClient.sendTransaction({
        to: burnerAddress,
        value: parseEther(depositAmount),
      });

      setDepositAmount('0');
      renderSuccess('Funds deposited successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error depositing funds.', e);
    } finally {
      setIsDepositing(false);
    }
  }, [
    burnerAddress,
    depositAmount,
    externalWalletBalance,
    externalWalletClient,
    renderError,
    renderSuccess,
  ]);

  const onWithdraw = useCallback(async () => {
    try {
      setIsWithdrawing(true);

      if (!withdrawAmount || parseEther(withdrawAmount) <= 0) {
        setWithdrawErrorMessage('Amount must be greater than 0.');
        return;
      }

      if (parseEther(withdrawAmount) > parseEther(burnerBalance)) {
        setWithdrawErrorMessage('Insufficient funds in session wallet.');
        return;
      }

      await walletClient.sendTransaction({
        to: address,
        value: parseEther(withdrawAmount),
      });

      setWithdrawAmount('0');
      renderSuccess('Funds withdrawn successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error withdrawing funds.', e);
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    address,
    burnerBalance,
    renderError,
    renderSuccess,
    walletClient,
    withdrawAmount,
  ]);
  const onGoldAllowance = useCallback(async () => {
    try {
      if (!(externalWalletBalance && externalWalletClient)) {
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
    externalWalletBalance,
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
      if (!(externalWalletBalance && externalWalletClient)) {
        throw new Error('No external wallet client found.');
      }

      setIsApprovingItems(true);
      const auction = await worldContract.read.UD__auctionHouseAddress();

      const { request } = await publicClient.simulateContract({
        address: itemsContract as Address,
        abi: erc1155abi,
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
    externalWalletBalance,
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
          {isConnected ? 'Wallet Details' : 'Connect Wallet'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {address && externalWalletClient && isConnected ? (
            <VStack p={4} spacing={10}>
              <VStack alignItems="start" spacing={4}>
                {burnerBalance === '0' && (
                  <>
                    <Text color="red" fontWeight={700} size="sm">
                      Your session wallet balance is 0. In order to play, you
                      must deposit funds into your session account.
                    </Text>
                    <Divider />
                  </>
                )}
                <Text>Connected Account:</Text>
                <CopyText text={address}>
                  <Text>{shortenAddress(address)}</Text>
                </CopyText>
                <Text size="sm">
                  Balance:{' '}
                  {externalWalletBalance
                    ? formatEther(externalWalletBalance.value)
                    : '0'}
                </Text>
                <Divider />
                <Text>Session Account:</Text>
                <CopyText text={burnerAddress}>
                  <Text>{shortenAddress(burnerAddress)}</Text>
                </CopyText>
                <Text size="sm">Balance: {burnerBalance}</Text>
                <Text fontWeight={700} size="sm">
                  Do not deposit any funds into this account that you are not
                  willing to lose. We recommend no more than 0.005 ETH at a
                  time.
                </Text>
                <HStack>
                  <FormControl isInvalid={!!depositErrorMessage}>
                    <FormLabel fontSize="xs">
                      Deposit to session wallet
                    </FormLabel>
                    {!!depositErrorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {depositErrorMessage}
                      </FormHelperText>
                    )}
                    <Input
                      isDisabled={isDepositing}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      value={depositAmount}
                    />
                  </FormControl>
                  <Button
                    alignSelf="end"
                    isLoading={isDepositing}
                    onClick={onDeposit}
                    size="sm"
                  >
                    Deposit
                  </Button>
                </HStack>
                <HStack>
                  <FormControl isInvalid={!!withdrawErrorMessage}>
                    <FormLabel fontSize="xs">
                      Withdraw from session wallet
                    </FormLabel>
                    {!!withdrawErrorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {withdrawErrorMessage}
                      </FormHelperText>
                    )}
                    <Input
                      isDisabled={isWithdrawing}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      value={withdrawAmount}
                    />
                  </FormControl>
                  <Button
                    alignSelf="end"
                    isLoading={isWithdrawing}
                    onClick={onWithdraw}
                    size="sm"
                  >
                    Withdraw
                  </Button>
                </HStack>
                <HStack>
                  <FormControl isInvalid={!!withdrawErrorMessage}>
                    <FormLabel fontSize="xs">
                      Set Auction House Gold Allowance
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
                  <FormControl isInvalid={!!withdrawErrorMessage}>
                    <FormLabel fontSize="xs">
                      Set Auction House Item Approval
                    </FormLabel>
                    {!itemsApprovedInitial ? (
                      <Skeleton>
                        <Switch></Switch>
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
