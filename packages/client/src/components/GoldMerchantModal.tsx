import {
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { GiTwoCoins } from 'react-icons/gi';

import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { API_URL } from '../utils/constants';
import { etherToFixedNumber } from '../utils/helpers';

const TIERS = [
  { tier: '1', gold: '~500', price: '$5' },
  { tier: '2', gold: '~1,000', price: '$10' },
  { tier: '3', gold: '~2,500', price: '$25' },
];

type ModalStep = 'idle' | 'creating' | 'error';

export const GoldMerchantModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { ownerAddress } = useAuth();
  const { character } = useCharacter();

  const [step, setStep] = useState<ModalStep>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const formattedBalance = character
    ? Number(etherToFixedNumber(character.externalGoldBalance)).toLocaleString()
    : '0';

  const handlePurchase = async (tier: string) => {
    if (!ownerAddress || !character) return;

    setStep('creating');
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/api/stripe/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.characterId,
          ownerAddress,
          tier,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setErrorMsg(data.error || 'Failed to start checkout');
        setStep('error');
        return;
      }

      // Redirect to Stripe hosted checkout
      window.location.href = data.url;
    } catch (err) {
      console.error('[GoldMerchant] Checkout error:', err);
      setErrorMsg('Could not connect to payment server');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('idle');
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
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
              <Text color="#8A7E6A" fontSize="sm" textAlign="center">
                Choose a Gold package. You'll be redirected to a secure checkout.
              </Text>
              <SimpleGrid columns={3} spacing={3} w="100%">
                {TIERS.map(({ tier, gold, price }) => (
                  <Button
                    key={tier}
                    bg="#2A2218"
                    border="1px solid #3A3228"
                    borderRadius="lg"
                    color="#E8DCC8"
                    display="flex"
                    flexDirection="column"
                    fontFamily="'Cormorant Garamond', Georgia, serif"
                    h="auto"
                    py={4}
                    _hover={{ bg: '#3A3228', borderColor: '#C87A2A' }}
                    onClick={() => handlePurchase(tier)}
                  >
                    <Text fontSize="lg" fontWeight={700} color="#D4A54A">
                      {gold}
                    </Text>
                    <Text fontSize="xs" color="#6A6050" mt={1}>
                      Gold
                    </Text>
                    <Text fontSize="md" fontWeight={700} color="#E8DCC8" mt={2}>
                      {price}
                    </Text>
                  </Button>
                ))}
              </SimpleGrid>
              <Text color="#6A6050" fontSize="2xs" textAlign="center">
                Gold amounts are approximate and depend on current market rates.
              </Text>
            </VStack>
          )}

          {step === 'creating' && (
            <VStack spacing={3} py={8}>
              <Text color="#E8DCC8" fontSize="lg" fontWeight={600}>
                Preparing checkout...
              </Text>
              <Text color="#8A7E6A" fontSize="sm" textAlign="center">
                Redirecting to secure payment page.
              </Text>
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
