import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react';
import { BuyWidget, darkTheme, ThirdwebProvider } from 'thirdweb/react';

import { useAuth } from '../contexts/AuthContext';
import { useGameConfig } from '../lib/gameStore';

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

export const GoldMerchantModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { thirdwebClient, thirdwebChain, ownerAddress, embeddedWallet } =
    useAuth();
  const configValue = useGameConfig('UltimateDominionConfig');
  const goldTokenAddress = (configValue?.goldToken as string) ?? undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent
        bg="#1C1814"
        border="1px solid #3A3228"
        clipPath="none"
        overflow="hidden"
      >
        <ModalHeader
          borderBottom="1px solid #3A3228"
          color="#E8DCC8"
          fontFamily="'Cormorant Garamond', Georgia, serif"
          fontSize="xl"
        >
          Gold Merchant
        </ModalHeader>
        <ModalCloseButton color="#8A7E6A" />
        <ModalBody p={0}>
          {goldTokenAddress && ownerAddress ? (
            <ThirdwebProvider>
              <BuyWidget
                client={thirdwebClient}
                chain={thirdwebChain}
                tokenAddress={goldTokenAddress}
                receiverAddress={ownerAddress}
                activeWallet={embeddedWallet ?? undefined}
                theme={merchantTheme}
              />
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
