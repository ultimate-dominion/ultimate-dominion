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

/**
 * Walk the widget DOM and surgically hide crypto-facing UI.
 *
 * Hides: "PAY" label, chain selector (dashed border), entire "TO" section,
 *        wallet addresses, and the directional arrow between sections.
 * Keeps: amount input, preset buttons, Purchase Gold button.
 */
function hideCryptoElements(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim() ?? '';
    if (!text) continue;

    // "PAY" label — hide just the label, keep the rest of the section
    if (text === 'PAY') {
      const el = node.parentElement;
      if (el) el.style.display = 'none';
      continue;
    }

    // "TO" label — hide the entire bordered section
    if (text === 'TO') {
      let el: HTMLElement | null = node.parentElement;
      for (let i = 0; i < 8 && el && el !== root; i++) {
        const cs = getComputedStyle(el);
        if (cs.borderRadius && cs.borderRadius !== '0px' && el.offsetHeight > 30) {
          el.style.display = 'none';
          break;
        }
        el = el.parentElement;
      }
      continue;
    }

    // Wallet address (0x…) — walk up to bordered container and hide
    if (/^0x[a-fA-F0-9]/.test(text)) {
      let el: HTMLElement | null = node.parentElement;
      for (let i = 0; i < 6 && el && el !== root; i++) {
        const cs = getComputedStyle(el);
        if (cs.borderRadius && cs.borderRadius !== '0px') {
          el.style.display = 'none';
          break;
        }
        el = el.parentElement;
      }
      continue;
    }
  }

  // Hide chain selector — containers with dashed/dotted border (holds chain icon)
  const allEls = root.querySelectorAll<HTMLElement>('div, span');
  for (const el of allEls) {
    try {
      const cs = getComputedStyle(el);
      if (
        (cs.borderStyle?.includes('dashed') || cs.borderStyle?.includes('dotted')) &&
        el.offsetHeight > 0 &&
        el.offsetHeight < 80
      ) {
        el.style.display = 'none';
      }
    } catch { /* skip */ }
  }

  // Hide the directional arrow SVG between sections
  root.querySelectorAll('svg').forEach(svg => {
    const parent = svg.parentElement;
    if (!parent || parent === root) return;
    const rect = parent.getBoundingClientRect();
    if (rect.height < 50 && rect.height > 10) {
      const t = parent.textContent?.trim() ?? '';
      if (!t || t.length < 3) {
        parent.style.display = 'none';
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
    const timers = [200, 500, 1000, 2000, 4000].map(ms => setTimeout(run, ms));

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
