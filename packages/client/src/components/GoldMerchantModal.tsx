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
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react';
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

/** Text content that identifies crypto UI sections to hide */
const HIDE_TEXTS = ['PAY', 'TO'];
const HIDE_PATTERNS = [/^0x[a-fA-F0-9]/]; // wallet addresses

/**
 * Walk the widget DOM and hide sections containing crypto jargon.
 * Hides the closest container div for matched elements.
 */
function hideCryptoElements(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim() ?? '';
    const shouldHide =
      HIDE_TEXTS.includes(text) ||
      HIDE_PATTERNS.some(p => p.test(text));
    if (!shouldHide) continue;

    // Walk up to find the nearest section container (a div with padding)
    let el: HTMLElement | null = node.parentElement;
    // For "PAY"/"TO" labels, hide the grandparent container (the whole section)
    if (HIDE_TEXTS.includes(text)) {
      // Go up to the bordered section container
      for (let i = 0; i < 4 && el; i++) {
        if (el.style.borderRadius || el.style.border) break;
        el = el.parentElement;
      }
    }
    if (el && el !== root) {
      el.style.display = 'none';
    }
  }

  // Also hide the directional arrow (svg inside a standalone div between sections)
  root.querySelectorAll('svg').forEach(svg => {
    const parent = svg.parentElement;
    if (!parent) return;
    // The arrow is in a small centered container between PAY and TO sections
    const rect = parent.getBoundingClientRect();
    if (rect.height < 50 && rect.height > 10) {
      const text = parent.textContent?.trim() ?? '';
      if (!text || text.length < 3) {
        parent.style.display = 'none';
      }
    }
  });
}

/** Hook to observe and clean up BuyWidget DOM as it renders */
function useHideCryptoUI(containerRef: React.RefObject<HTMLElement | null>) {
  const cleanup = useCallback(() => {
    if (!containerRef.current) return;
    hideCryptoElements(containerRef.current);
  }, [containerRef]);

  useEffect(() => {
    if (!containerRef.current) return;
    // Run immediately
    cleanup();
    // Re-run whenever the widget re-renders (async data loads)
    const observer = new MutationObserver(cleanup);
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [cleanup, containerRef]);
}

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
  const widgetRef = useRef<HTMLDivElement>(null);
  useHideCryptoUI(widgetRef);

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
                <Box ref={widgetRef}>
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
