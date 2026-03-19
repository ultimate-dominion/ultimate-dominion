import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { formatEther, parseEther } from 'viem';

import { useAllowance } from '../contexts/AllowanceContext';
import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { etherToFixedNumber } from '../utils/helpers';
import { SystemToAllow } from '../utils/types';

import { LootManagerAllowanceModal } from './LootManagerAllowanceModal';
import { PolygonalCard } from './PolygonalCard';

type AdventureEscrowModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AdventureEscrowModal: React.FC<AdventureEscrowModalProps> = ({
  isOpen,
  onClose,
}): JSX.Element => {
  const { renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { depositToEscrow, withdrawFromEscrow },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { authMethod } = useAuth();
  const { ensureGoldAllowance, goldLootManagerAllowance } = useAllowance();
  const { onSetIsMovementDisabled } = useMovement();

  const {
    isOpen: isAllowanceModalOpen,
    onOpen: onOpenAllowanceModal,
    onClose: onCloseAllowanceModal,
  } = useDisclosure();

  const depositTx = useTransaction({ actionName: 'deposit gold', showSuccessToast: false });
  const withdrawTx = useTransaction({ actionName: 'withdraw gold', showSuccessToast: false });

  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositErrorMessage, setDepositErrorMessage] = useState<string | null>(
    null,
  );

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawErrorMessage, setWithdrawErrorMessage] = useState<
    string | null
  >(null);

  // Reset errorMessage state when any of the form fields change
  useEffect(() => {
    setDepositErrorMessage(null);
    setWithdrawErrorMessage(null);
  }, [depositAmount, withdrawAmount]);

  useEffect(() => {
    if (isOpen) {
      setDepositAmount('');
      setWithdrawAmount('');

      refreshCharacter();
      onSetIsMovementDisabled(true);
    }

    return () => onSetIsMovementDisabled(false);
  }, [isOpen, onSetIsMovementDisabled, refreshCharacter]);

  const onDeposit = useCallback(async () => {
    if (!character) return;
    if (!delegatorAddress) return;

    if (!depositAmount || parseEther(depositAmount) <= 0) {
      setDepositErrorMessage('Amount must be greater than 0.');
      return;
    }

    if (parseEther(depositAmount) > character.externalGoldBalance) {
      setDepositErrorMessage('Insufficient Gold in external wallet.');
      return;
    }

    if (parseEther(depositAmount) > goldLootManagerAllowance) {
      if (authMethod === 'embedded') {
        const ok = await ensureGoldAllowance(SystemToAllow.LootManager, parseEther(depositAmount));
        if (!ok) return;
      } else {
        onOpenAllowanceModal();
        return;
      }
    }

    const result = await depositTx.execute(async () => {
      const { error, success } = await depositToEscrow(
        character.id,
        character.escrowGoldBalance,
        parseEther(depositAmount),
      );
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      await refreshCharacter();
      renderSuccess(`${depositAmount} Gold deposited successfully!`);
      onClose();
    }
  }, [
    authMethod,
    character,
    delegatorAddress,
    depositAmount,
    depositToEscrow,
    depositTx,
    ensureGoldAllowance,
    goldLootManagerAllowance,
    onClose,
    onOpenAllowanceModal,
    refreshCharacter,
    renderSuccess,
  ]);

  const onWithdraw = useCallback(async () => {
    if (!character) return;
    if (!delegatorAddress) return;

    if (!withdrawAmount || parseEther(withdrawAmount) <= 0) {
      setWithdrawErrorMessage('Amount must be greater than 0.');
      return;
    }

    if (parseEther(withdrawAmount) > character.escrowGoldBalance) {
      setWithdrawErrorMessage('Insufficient Gold in escrow.');
      return;
    }

    const result = await withdrawTx.execute(async () => {
      const { error, success } = await withdrawFromEscrow(
        character.id,
        character.escrowGoldBalance,
        parseEther(withdrawAmount),
      );
      if (error && !success) throw new Error(error);
      return true;
    });

    if (result !== undefined) {
      await refreshCharacter();
      renderSuccess(`${withdrawAmount} Gold withdrawn successfully!`);
      onClose();
    }
  }, [
    character,
    delegatorAddress,
    onClose,
    refreshCharacter,
    renderSuccess,
    withdrawAmount,
    withdrawFromEscrow,
    withdrawTx,
  ]);

  if (!character) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>Adventure Escrow</ModalHeader>
          <ModalCloseButton />
          <ModalBody px={{ base: 6, sm: 8 }}>
            <Text>An error occurred.</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>Adventure Escrow</ModalHeader>
        <ModalCloseButton />
        <ModalBody
          alignItems="center"
          px={{ base: 6, sm: 8 }}
          textAlign="center"
        >
          <Text size={{ base: 'xs', sm: 'md' }}>
            Spendable Gold:{' '}
            <Text as="span" fontWeight="bold">
              {etherToFixedNumber(character.externalGoldBalance)} Gold
            </Text>
          </Text>
          <Text mt={2} size={{ base: 'xs', sm: 'md' }}>
            Adventure Escrow balance:{' '}
            <Text as="span" fontWeight="bold">
              {etherToFixedNumber(character.escrowGoldBalance)} Gold
            </Text>
          </Text>
          <Text textAlign="center" fontSize="68px">
            💰
          </Text>
          <Text mt={4} size={{ base: 'xs', sm: 'sm' }}>
            Your Adventure Escrow is where Gold goes when you win battles.
            Leaving Gold in your escrow will help you level up faster, but in
            the Winding Dark, you run the risk of losing it all against other
            players.
          </Text>
          <HStack mt={8}>
            <FormControl isInvalid={!!depositErrorMessage}>
              <FormLabel fontSize="xs">Add Gold to Escrow</FormLabel>
              {!!depositErrorMessage && (
                <FormHelperText
                  color="red"
                  fontSize="xs"
                  mb={2}
                  textAlign="left"
                >
                  {depositErrorMessage}
                </FormHelperText>
              )}
              <InputGroup>
                <Input
                  isDisabled={depositTx.isLoading}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="Amount"
                  type="number"
                  value={depositAmount}
                />
                <InputRightElement>
                  <Button
                    h="100%"
                    mt={1}
                    onClick={() => {
                      setDepositAmount(
                        formatEther(character.externalGoldBalance),
                      );
                    }}
                    size="xs"
                    variant="ghost"
                  >
                    MAX
                  </Button>
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <Button
              alignSelf="end"
              isLoading={depositTx.isLoading}
              onClick={onDeposit}
              size="sm"
            >
              Deposit
            </Button>
          </HStack>
          <HStack mt={4}>
            <FormControl isInvalid={!!withdrawErrorMessage}>
              <FormLabel fontSize="xs">
                Take Gold from Escrow
              </FormLabel>
              {!!withdrawErrorMessage && (
                <FormHelperText
                  color="red"
                  fontSize="xs"
                  mb={2}
                  textAlign="left"
                >
                  {withdrawErrorMessage}
                </FormHelperText>
              )}
              <InputGroup>
                <Input
                  isDisabled={withdrawTx.isLoading}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="Amount"
                  type="number"
                  value={withdrawAmount}
                />
                <InputRightElement>
                  <Button
                    h="100%"
                    mt={1}
                    onClick={() => {
                      setWithdrawAmount(
                        formatEther(character.escrowGoldBalance),
                      );
                    }}
                    size="xs"
                    variant="ghost"
                  >
                    MAX
                  </Button>
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <Button
              alignSelf="end"
              isLoading={withdrawTx.isLoading}
              onClick={onWithdraw}
              size="sm"
            >
              Withdraw
            </Button>
          </HStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} size="sm" variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
      {authMethod !== 'embedded' && (
        <LootManagerAllowanceModal
          amount={depositAmount}
          heading="Allow Adventure Escrow"
          isOpen={isAllowanceModalOpen}
          message="In order to deposit Gold to your Adventure Escrow, you need to give permission to spend your Gold."
          onClose={onCloseAllowanceModal}
          successMessage="You can now deposit Gold to your Adventure Escrow."
        />
      )}
    </Modal>
  );
};
