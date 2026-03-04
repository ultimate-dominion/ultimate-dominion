import {
  Box,
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
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { GiTwoCoins } from 'react-icons/gi';
import { BuyWidget, darkTheme, ThirdwebProvider } from 'thirdweb/react';

import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useGameConfig } from '../lib/gameStore';
import { etherToFixedNumber } from '../utils/helpers';

const merchantTheme = darkTheme({
  colors: {
    modalBg: '#1C1814',
    primaryButtonBg: '#C87A2A',
    primaryButtonText: '#E8DCC8',
    accentButtonBg: '#2A2218',
    accentButtonText: '#E8DCC8',
    accentText: '#C87A2A',
    borderColor: '#3A3228',
    secondaryText: '#8A7E6A',
    selectedTextBg: '#C87A2A',
    selectedTextColor: '#1C1814',
    separatorLine: '#3A3228',
    skeletonBg: '#2A2218',
    tertiaryBg: '#1C1814',
    tooltipBg: '#2A2218',
    tooltipText: '#E8DCC8',
  },
  fontFamily: "'Cormorant Garamond', Georgia, serif",
});

/**
 * Aggressive CSS overrides to strip crypto UI from BuyWidget.
 * Hides: PAY label + token/chain selector, TO label + address,
 * the directional arrow, and any wallet address displays.
 * These target the widget's internal DOM structure.
 */
const WIDGET_CSS_OVERRIDES = `
  /* Hide the "PAY" section header and token/chain selector */
  .gold-merchant-widget > div > div > div:first-child > div:first-child {
    display: none !important;
  }

  /* Hide the arrow between PAY and TO */
  .gold-merchant-widget > div > div > div:nth-child(2) {
    display: none !important;
  }

  /* Hide the "TO" section entirely (address display) */
  .gold-merchant-widget > div > div > div:nth-child(3) {
    display: none !important;
  }

  /* Fallback: hide anything with wallet/address data attributes */
  .gold-merchant-widget [data-testid="receiver-address"],
  .gold-merchant-widget [class*="receiverAddress"],
  .gold-merchant-widget [class*="walletAddress"] {
    display: none !important;
  }

  /* Make preset buttons more prominent */
  .gold-merchant-widget button[data-variant="outline"] {
    border: 1px solid #C87A2A !important;
    color: #E8DCC8 !important;
    font-weight: 600 !important;
    padding: 6px 16px !important;
    font-size: 14px !important;
  }
  .gold-merchant-widget button[data-variant="outline"]:hover {
    background: #C87A2A !important;
    color: #1C1814 !important;
  }
`;

/** Error boundary to catch Thirdweb BuyWidget render crashes */
class WidgetErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onClose: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GoldMerchant] BuyWidget crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <VStack p={6} spacing={3}>
          <Text color="#E8DCC8" fontSize="sm" textAlign="center">
            The Gold Merchant is temporarily unavailable.
          </Text>
          <Text color="#8A7E6A" fontSize="xs" textAlign="center">
            Please try again in a moment.
          </Text>
        </VStack>
      );
    }
    return this.props.children;
  }
}

export const GoldMerchantModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { thirdwebClient, thirdwebChain, ownerAddress, embeddedWallet } =
    useAuth();
  const { character } = useCharacter();
  const configValue = useGameConfig('UltimateDominionConfig');
  const goldTokenAddress = (configValue?.goldToken as string) ?? undefined;

  const formattedBalance = character
    ? Number(etherToFixedNumber(character.externalGoldBalance)).toLocaleString()
    : '0';

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent
        bg="#1C1814"
        border="1px solid #3A3228"
        clipPath="none"
        overflow="hidden"
      >
        <style>{WIDGET_CSS_OVERRIDES}</style>
        <ModalHeader
          borderBottom="1px solid #3A3228"
          color="#E8DCC8"
          fontFamily="'Cormorant Garamond', Georgia, serif"
          fontSize="xl"
          pb={3}
          textAlign="center"
        >
          Gold Merchant
        </ModalHeader>
        <ModalCloseButton color="#8A7E6A" />

        {/* Player info card */}
        {character && (
          <VStack
            bg="#221E18"
            borderBottom="1px solid #3A3228"
            px={6}
            py={4}
            spacing={3}
          >
            <VStack spacing={0}>
              <Text
                color="#E8DCC8"
                fontFamily="'Cormorant Garamond', Georgia, serif"
                fontSize="lg"
                fontWeight={700}
              >
                {character.name}
              </Text>
              <Text color="#6A6050" fontSize="2xs" letterSpacing="0.05em" textTransform="uppercase">
                Adventurer
              </Text>
            </VStack>
            <HStack spacing={2}>
              <GiTwoCoins color="#D4A54A" size={16} />
              <Text
                color="yellow"
                fontFamily="mono"
                fontSize="md"
                fontWeight={700}
              >
                {formattedBalance}
              </Text>
              <Text color="#6A6050" fontSize="xs">
                gold
              </Text>
            </HStack>
          </VStack>
        )}

        <ModalBody p={0}>
          {goldTokenAddress && ownerAddress ? (
            <ThirdwebProvider>
              <WidgetErrorBoundary onClose={onClose}>
                <Box className="gold-merchant-widget">
                  <BuyWidget
                    client={thirdwebClient}
                    chain={thirdwebChain}
                    tokenAddress={goldTokenAddress}
                    receiverAddress={ownerAddress}
                    activeWallet={embeddedWallet ?? undefined}
                    theme={merchantTheme}
                    title=""
                    buttonLabel="Purchase Gold"
                    showThirdwebBranding={false}
                    presetOptions={[10, 100, 1000]}
                    tokenEditable={false}
                  />
                </Box>
              </WidgetErrorBoundary>
            </ThirdwebProvider>
          ) : (
            <Text color="#8A7E6A" p={6} textAlign="center">
              Loading...
            </Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
