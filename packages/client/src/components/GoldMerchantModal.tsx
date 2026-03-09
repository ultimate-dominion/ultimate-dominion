import {
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GiTwoCoins } from 'react-icons/gi';
import {
  type Address,
  encodeFunctionData,
  formatEther,
  parseAbi,
  parseEther,
} from 'viem';

import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { useGameConfig } from '../lib/gameStore';
import { etherToFixedNumber } from '../utils/helpers';

const MOONPAY_API_KEY = import.meta.env.VITE_MOONPAY_API_KEY || '';

// Uniswap V3 SwapRouter on Base
const SWAP_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481' as Address;
const WETH = '0x4200000000000000000000000000000000000006' as Address;
const POOL_FEE = 3000;

const swapRouterAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
]);

type PurchaseStep = 'idle' | 'moonpay' | 'waiting' | 'swapping' | 'done' | 'error';

export const GoldMerchantModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { ownerAddress, embeddedWalletClient } = useAuth();
  const { character } = useCharacter();
  const { network } = useMUD();
  const configValue = useGameConfig('UltimateDominionConfig');
  const goldTokenAddress = (configValue?.goldToken as string) ?? undefined;

  const [step, setStep] = useState<PurchaseStep>('idle');
  const [ethBalance, setEthBalance] = useState<bigint>(0n);
  const [goldReceived, setGoldReceived] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialBalanceRef = useRef<bigint>(0n);

  const formattedBalance = character
    ? Number(etherToFixedNumber(character.externalGoldBalance)).toLocaleString()
    : '0';

  // Cleanup polling on unmount/close
  useEffect(() => {
    if (!isOpen) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setStep('idle');
      setGoldReceived('');
      setErrorMsg('');
    }
  }, [isOpen]);

  // Build MoonPay URL
  const moonpayUrl = ownerAddress && MOONPAY_API_KEY
    ? `https://buy.moonpay.com?apiKey=${MOONPAY_API_KEY}&currencyCode=eth_base&walletAddress=${ownerAddress}&colorCode=%23C87A2A&theme=dark`
    : null;

  // Start MoonPay purchase flow
  const handleBuy = useCallback(() => {
    if (!moonpayUrl || !ownerAddress || !network?.publicClient) return;

    setStep('moonpay');

    // Record initial ETH balance to detect incoming funds
    network.publicClient.getBalance({ address: ownerAddress }).then(bal => {
      initialBalanceRef.current = bal;
      setEthBalance(bal);
    });
  }, [moonpayUrl, ownerAddress, network]);

  // After MoonPay completes, poll for incoming ETH
  const handleMoonpayDone = useCallback(() => {
    if (!ownerAddress || !network?.publicClient) return;
    setStep('waiting');

    pollRef.current = setInterval(async () => {
      try {
        const bal = await network.publicClient.getBalance({ address: ownerAddress });
        setEthBalance(bal);

        // If balance increased by > 0.0001 ETH, ETH has arrived
        if (bal > initialBalanceRef.current + parseEther('0.0001')) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setStep('swapping');
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
  }, [ownerAddress, network]);

  // Execute ETH → Gold swap via Uniswap V3
  const executeSwap = useCallback(async () => {
    if (!ownerAddress || !embeddedWalletClient || !goldTokenAddress || !network?.publicClient) return;

    try {
      setStep('swapping');
      const balance = await network.publicClient.getBalance({ address: ownerAddress });

      // Keep 0.001 ETH for gas, swap the rest
      const gasReserve = parseEther('0.001');
      const swapAmount = balance - gasReserve;

      if (swapAmount <= 0n) {
        setErrorMsg('Insufficient ETH to swap after gas reserve');
        setStep('error');
        return;
      }

      const calldata = encodeFunctionData({
        abi: swapRouterAbi,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: WETH,
          tokenOut: goldTokenAddress as Address,
          fee: POOL_FEE,
          recipient: ownerAddress,
          amountIn: swapAmount,
          amountOutMinimum: 1n, // Accept any output for small purchases
          sqrtPriceLimitX96: 0n,
        }],
      });

      const txHash = await embeddedWalletClient.sendTransaction({
        account: ownerAddress,
        to: SWAP_ROUTER,
        data: calldata,
        value: swapAmount,
        chain: embeddedWalletClient.chain,
      });

      // Wait for receipt
      const receipt = await network.publicClient.waitForTransactionReceipt({
        hash: txHash,
        pollingInterval: 200,
      });

      if (receipt.status === 'reverted') {
        setErrorMsg('Swap transaction reverted');
        setStep('error');
        return;
      }

      // Estimate Gold received from the amount swapped
      setGoldReceived(formatEther(swapAmount));
      setStep('done');
    } catch (err) {
      console.error('[GoldMerchant] Swap failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Swap failed');
      setStep('error');
    }
  }, [ownerAddress, embeddedWalletClient, goldTokenAddress, network]);

  // Auto-trigger swap when ETH arrives
  useEffect(() => {
    if (step === 'swapping' && ethBalance > initialBalanceRef.current + parseEther('0.0001')) {
      executeSwap();
    }
  }, [step, ethBalance, executeSwap]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent
        bg="#1C1814"
        border="1px solid #3A3228"
        borderRadius="xl"
        clipPath="none"
        mx={4}
        overflow="hidden"
      >
        <ModalHeader
          borderBottom="1px solid #2A2218"
          color="#E8DCC8"
          fontFamily="'Cormorant Garamond', Georgia, serif"
          fontSize="2xl"
          fontWeight={700}
          letterSpacing="0.02em"
          pb={4}
          pt={5}
          textAlign="center"
        >
          Gold Merchant
        </ModalHeader>
        <ModalCloseButton color="#8A7E6A" _hover={{ color: '#E8DCC8' }} />

        {/* Player info card */}
        {character && (
          <VStack
            bg="linear-gradient(180deg, #221E18 0%, #1C1814 100%)"
            borderBottom="1px solid #2A2218"
            px={8}
            py={5}
            spacing={2}
          >
            <VStack align="center" spacing={0}>
              <Text
                color="#E8DCC8"
                fontFamily="'Cormorant Garamond', Georgia, serif"
                fontSize="xl"
                fontWeight={700}
              >
                {character.name}
              </Text>
              <Text
                color="#6A6050"
                fontFamily="'Cormorant Garamond', Georgia, serif"
                fontSize="2xs"
                letterSpacing="0.1em"
                textTransform="uppercase"
              >
                Adventurer
              </Text>
            </VStack>
            <HStack
              bg="#1A1610"
              border="1px solid #2A2218"
              borderRadius="lg"
              px={4}
              py={2}
              spacing={2}
            >
              <GiTwoCoins color="#D4A54A" size={18} />
              <Text
                color="#D4A54A"
                fontFamily="mono"
                fontSize="lg"
                fontWeight={700}
              >
                {formattedBalance}
              </Text>
              <Text color="#6A6050" fontSize="xs" fontWeight={500}>
                gold
              </Text>
            </HStack>
          </VStack>
        )}

        <ModalBody p={6}>
          {step === 'idle' && (
            <VStack spacing={4}>
              {moonpayUrl ? (
                <Button
                  bg="#C87A2A"
                  color="#E8DCC8"
                  fontFamily="'Cormorant Garamond', Georgia, serif"
                  fontSize="lg"
                  fontWeight={700}
                  w="100%"
                  h="48px"
                  _hover={{ bg: '#D88A3A' }}
                  onClick={handleBuy}
                >
                  Purchase Gold
                </Button>
              ) : (
                <Text color="#8A7E6A" textAlign="center" fontSize="sm">
                  Gold Merchant is not available yet.
                </Text>
              )}
            </VStack>
          )}

          {step === 'moonpay' && moonpayUrl && (
            <VStack spacing={4}>
              <Box
                as="iframe"
                src={moonpayUrl}
                w="100%"
                h="500px"
                border="none"
                borderRadius="md"
                allow="accelerometer; autoplay; camera; gyroscope; payment"
              />
              <Button
                bg="#2A2218"
                color="#E8DCC8"
                fontFamily="'Cormorant Garamond', Georgia, serif"
                w="100%"
                h="40px"
                _hover={{ bg: '#3A3228' }}
                onClick={handleMoonpayDone}
              >
                I completed the purchase
              </Button>
            </VStack>
          )}

          {step === 'waiting' && (
            <VStack spacing={3} py={8}>
              <Text color="#E8DCC8" fontSize="lg" fontWeight={600}>
                Processing payment...
              </Text>
              <Text color="#8A7E6A" fontSize="sm" textAlign="center">
                Waiting for ETH to arrive. This usually takes 1-5 minutes.
              </Text>
              <Text color="#6A6050" fontSize="xs" fontFamily="mono">
                Balance: {formatEther(ethBalance)} ETH
              </Text>
            </VStack>
          )}

          {step === 'swapping' && (
            <VStack spacing={3} py={8}>
              <Text color="#E8DCC8" fontSize="lg" fontWeight={600}>
                Swapping for Gold...
              </Text>
              <Text color="#8A7E6A" fontSize="sm" textAlign="center">
                Payment received! Converting ETH to Gold.
              </Text>
            </VStack>
          )}

          {step === 'done' && (
            <VStack spacing={3} py={8}>
              <Text color="#D4A54A" fontSize="xl" fontWeight={700}>
                Gold acquired!
              </Text>
              {goldReceived && (
                <Text color="#8A7E6A" fontSize="sm">
                  Swapped ~{Number(goldReceived).toFixed(6)} ETH worth of Gold
                </Text>
              )}
              <Button
                bg="#C87A2A"
                color="#E8DCC8"
                fontFamily="'Cormorant Garamond', Georgia, serif"
                mt={2}
                _hover={{ bg: '#D88A3A' }}
                onClick={onClose}
              >
                Continue
              </Button>
            </VStack>
          )}

          {step === 'error' && (
            <VStack spacing={3} py={8}>
              <Text color="#E8DCC8" fontSize="lg" fontWeight={600}>
                Something went wrong
              </Text>
              <Text color="#8A7E6A" fontSize="sm" textAlign="center">
                {errorMsg || 'Please try again.'}
              </Text>
              <Button
                bg="#2A2218"
                color="#E8DCC8"
                fontFamily="'Cormorant Garamond', Georgia, serif"
                _hover={{ bg: '#3A3228' }}
                onClick={() => setStep('idle')}
              >
                Try Again
              </Button>
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
