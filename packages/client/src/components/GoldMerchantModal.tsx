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
  useState,
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

/** Force-hide an element, overriding any !important CSS from BuyWidget */
function hide(el: HTMLElement) {
  el.style.setProperty('display', 'none', 'important');
}

/** Known chain names BuyWidget might display */
const CHAIN_NAMES = ['Base', 'Ethereum', 'Polygon', 'Arbitrum', 'Optimism'];

/**
 * Walk the widget DOM and surgically hide crypto-facing UI.
 *
 * Hides: "PAY" label, chain selector, entire "TO" section,
 *        wallet addresses, and the directional arrow between sections.
 * Keeps: amount input, preset buttons, Purchase Gold button.
 */
function hideCryptoElements(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim() ?? '';
    if (!text) continue;

    // "PAY" label — hide the label and walk up to hide its row container
    if (text === 'PAY') {
      let el: HTMLElement | null = node.parentElement;
      if (el) hide(el);
      // Also hide the parent row (PAY label is usually in a wrapper div)
      if (el?.parentElement && el.parentElement !== root) {
        // Only hide if this row doesn't contain the amount input
        if (!el.parentElement.querySelector('input')) {
          hide(el.parentElement);
        }
      }
      continue;
    }

    // "TO" label — hide the entire section by walking up to root's direct child
    if (text === 'TO') {
      let el: HTMLElement | null = node.parentElement;
      for (let i = 0; i < 10 && el && el !== root; i++) {
        if (el.parentElement === root) {
          hide(el);
          break;
        }
        // Also try border-radius as a section boundary
        const cs = getComputedStyle(el);
        if (cs.borderRadius && cs.borderRadius !== '0px' && el.offsetHeight > 30) {
          hide(el);
          break;
        }
        el = el.parentElement;
      }
      continue;
    }

    // Wallet address (0x…) — hide container
    if (/^0x[a-fA-F0-9]/.test(text)) {
      let el: HTMLElement | null = node.parentElement;
      for (let i = 0; i < 6 && el && el !== root; i++) {
        if (el.parentElement === root) {
          hide(el);
          break;
        }
        const cs = getComputedStyle(el);
        if (cs.borderRadius && cs.borderRadius !== '0px') {
          hide(el);
          break;
        }
        el = el.parentElement;
      }
      continue;
    }

    // Chain name (e.g. "Base") — hide the chain selector container
    if (CHAIN_NAMES.includes(text)) {
      let el: HTMLElement | null = node.parentElement;
      for (let i = 0; i < 6 && el && el !== root; i++) {
        const cs = getComputedStyle(el);
        // Look for the bordered/dashed selector container
        if (
          (cs.borderStyle?.includes('dashed') || cs.borderStyle?.includes('dotted')) ||
          (cs.borderRadius && cs.borderRadius !== '0px' && el.offsetHeight < 80 && el.offsetHeight > 20)
        ) {
          hide(el);
          break;
        }
        el = el.parentElement;
      }
      continue;
    }
  }

  // Fallback: hide any remaining dashed/dotted border containers (chain selectors)
  root.querySelectorAll<HTMLElement>('div, span').forEach(el => {
    try {
      const cs = getComputedStyle(el);
      if (
        (cs.borderStyle?.includes('dashed') || cs.borderStyle?.includes('dotted')) &&
        el.offsetHeight > 0 &&
        el.offsetHeight < 80
      ) {
        hide(el);
      }
    } catch { /* skip */ }
  });

  // Hide the directional arrow SVG between sections
  root.querySelectorAll('svg').forEach(svg => {
    const parent = svg.parentElement;
    if (!parent || parent === root) return;
    const rect = parent.getBoundingClientRect();
    if (rect.height < 50 && rect.height > 10) {
      const t = parent.textContent?.trim() ?? '';
      if (!t || t.length < 3) {
        hide(parent);
      }
    }
  });
}

/**
 * Hook to observe and hide crypto UI from BuyWidget.
 * Uses callback ref + state so the effect re-runs when the container mounts.
 */
function useHideCryptoUI(isOpen: boolean) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || !container) return;

    const run = () => hideCryptoElements(container);

    // Run immediately + on delayed schedule (BuyWidget loads data async)
    run();
    const timers = [100, 300, 600, 1000, 2000, 4000].map(ms =>
      setTimeout(run, ms),
    );

    // Also observe DOM mutations for dynamic content updates
    const observer = new MutationObserver(run);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [isOpen, container]);

  return useCallback((node: HTMLDivElement | null) => setContainer(node), []);
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
  const widgetRef = useHideCryptoUI(isOpen);

  const formattedBalance = character
    ? Number(etherToFixedNumber(character.externalGoldBalance)).toLocaleString()
    : '0';

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
            <HStack spacing={3}>
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
            </HStack>
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

        <ModalBody p={0}>
          {goldTokenAddress && ownerAddress ? (
            <ThirdwebProvider>
              <WidgetErrorBoundary onClose={onClose}>
                <Box px={4} py={2} ref={widgetRef}>
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
