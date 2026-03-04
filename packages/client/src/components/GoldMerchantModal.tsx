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

/** Large number pattern: 5+ digits, optional decimals, no $ prefix */
const LARGE_NUM_RE = /^\d{5,}(\.\d+)?$/;

/** Format a number with commas and 2 decimal places */
function fmtNum(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Find and format large numbers anywhere in the widget DOM.
 * Checks: text nodes, input values, leaf element textContent.
 * Uses an overlay for inputs so the widget's internal value stays numeric.
 */
function formatLargeNumbers(root: HTMLElement) {
  // 1. Text nodes via TreeWalker
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let tNode: Node | null;
  while ((tNode = walker.nextNode())) {
    const text = tNode.textContent?.trim() ?? '';
    if (!LARGE_NUM_RE.test(text)) continue;
    if (tNode.parentElement?.closest('button')) continue;
    const num = parseFloat(text);
    if (isNaN(num)) continue;
    const formatted = fmtNum(num);
    if (tNode.textContent !== formatted) {
      tNode.textContent = formatted;
    }
  }

  // 2. Input elements — overlay formatted display
  root.querySelectorAll<HTMLInputElement>('input').forEach(input => {
    const val = input.value?.trim() ?? '';
    if (!LARGE_NUM_RE.test(val)) return;
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const formatted = fmtNum(num);
    const parent = input.parentElement;
    if (!parent) return;
    let overlay = parent.querySelector('[data-gm-fmt]') as HTMLElement | null;
    if (!overlay) {
      overlay = document.createElement('span');
      overlay.setAttribute('data-gm-fmt', '');
      Object.assign(overlay.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
        font: 'inherit',
        color: 'inherit',
        zIndex: '1',
      });
      parent.style.position = 'relative';
      input.style.setProperty('color', 'transparent', 'important');
      parent.appendChild(overlay);
    }
    overlay.textContent = formatted;
  });

  // 3. Leaf elements — elements with no child elements whose text looks numeric
  root.querySelectorAll<HTMLElement>('*').forEach(el => {
    if (el.children.length > 0) return; // not a leaf
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return; // handled above
    if (el.closest('button')) return; // skip preset buttons
    if (el.hasAttribute('data-gm-fmt')) return; // skip our overlays
    const text = el.textContent?.trim() ?? '';
    if (!LARGE_NUM_RE.test(text)) return;
    const num = parseFloat(text);
    if (isNaN(num)) return;
    const formatted = fmtNum(num);
    if (el.textContent !== formatted) {
      el.textContent = formatted;
    }
  });
}

/**
 * Walk the widget DOM and surgically hide crypto-facing UI, then
 * format large token amounts with commas and 2 decimal places.
 *
 * Strategy:
 * 1. Hide "PAY" label text
 * 2. Hide chain selector by matching chain name text ("Base") and walking up
 * 3. Find the arrow SVG, then hide it + all siblings after it (the TO section)
 *    — only stops at the main Purchase button (not small copy/icon buttons)
 * 4. Hide any remaining wallet addresses
 * 5. Format large numbers (token amounts) with commas + 2dp
 */
function hideCryptoElements(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim() ?? '';
    if (!text) continue;

    // "PAY" label — hide the label element
    if (text === 'PAY' || text === 'Pay' || text === 'pay') {
      const el = node.parentElement;
      if (el) hide(el);
      continue;
    }

    // "TO" label — directly hide its container and walk up to section
    if (text === 'TO' || text === 'To') {
      let el: HTMLElement | null = node.parentElement;
      if (el) hide(el);
      // Also walk up to hide the entire TO section container
      for (let i = 0; i < 8 && el && el !== root; i++) {
        el = el.parentElement;
        if (el && el !== root && el.nextElementSibling) {
          // Check if this is a section-level element (has siblings)
          // and the next sibling is the purchase button area
          const nextTag = el.nextElementSibling?.tagName?.toLowerCase();
          const nextText = el.nextElementSibling?.textContent ?? '';
          if (nextTag === 'button' || nextText.includes('Purchase')) {
            hide(el);
            break;
          }
        }
      }
      continue;
    }

    // Chain name — hide the chain selector row (walk up a few levels)
    if (text === 'Base' || text === 'Ethereum' || text === 'Polygon' ||
        text === 'Arbitrum' || text === 'Optimism') {
      let el: HTMLElement | null = node.parentElement;
      // Walk up 3 levels to get the chain selector row container
      for (let i = 0; i < 3 && el && el !== root; i++) {
        el = el.parentElement;
      }
      if (el && el !== root) hide(el);
      continue;
    }

    // Wallet address (0x…) — hide the immediate container
    if (/^0x[a-fA-F0-9]/.test(text)) {
      const el = node.parentElement;
      if (el) hide(el);
      continue;
    }

  }

  // Format large numbers — search ALL elements, not just TreeWalker text nodes
  formatLargeNumbers(root);

  // Find the arrow SVG between PAY and TO sections, then hide it + the TO section
  root.querySelectorAll('svg').forEach(svg => {
    const parent = svg.parentElement;
    if (!parent || parent === root) return;
    const rect = parent.getBoundingClientRect();
    // Arrow is a small container (< 50px tall) with minimal/no text
    if (rect.height >= 50 || rect.height <= 5) return;
    const t = parent.textContent?.trim() ?? '';
    if (t.length > 3) return;

    // Walk up to find the section level (where element has siblings)
    let sectionParent: HTMLElement | null = parent;
    while (sectionParent && sectionParent !== root) {
      if (sectionParent.nextElementSibling || sectionParent.previousElementSibling) {
        break;
      }
      sectionParent = sectionParent.parentElement!;
    }

    if (!sectionParent || sectionParent === root) return;

    // Hide the arrow container
    hide(sectionParent);

    // Hide all siblings after the arrow (TO section, etc.)
    // Only stop at the MAIN purchase button (large button with "Purchase" text)
    let sibling = sectionParent.nextElementSibling;
    while (sibling) {
      const el = sibling as HTMLElement;
      const isPurchaseButton =
        (el.tagName?.toLowerCase() === 'button' &&
          (el.textContent?.includes('Purchase') || el.offsetHeight > 40)) ||
        (el.querySelector('button') &&
          el.textContent?.includes('Purchase'));
      if (isPurchaseButton) break;
      hide(el);
      sibling = sibling.nextElementSibling;
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
