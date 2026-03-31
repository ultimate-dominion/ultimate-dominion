import { useState } from 'react';
import { Box, Flex, Text, VStack, useBreakpointValue, IconButton } from '@chakra-ui/react';
import { COLORS } from '../components/pretext/theme';

// Lazy-ish imports — all in one chunk since this is a lab page
import { FloatingDamage } from '../components/pretext/FloatingDamage';
import { MonsterNameWeight } from '../components/pretext/MonsterNameWeight';
import { WorldEventTicker } from '../components/pretext/WorldEventTicker';
import { TypewriterNarrative } from '../components/pretext/TypewriterNarrative';
import { CanvasCombatLog } from '../components/pretext/CanvasCombatLog';
import { ItemTooltip } from '../components/pretext/ItemTooltip';
import { BossAsciiSplash } from '../components/pretext/BossAsciiSplash';
import { TextDestruction } from '../components/pretext/TextDestruction';
import { DeathScreen } from '../components/pretext/DeathScreen';
import { ZoneTransition } from '../components/pretext/ZoneTransition';
import { AncientMapView } from '../components/pretext/AncientMapView';
import { LoreFragment } from '../components/pretext/LoreFragment';
import { ChatBubbles } from '../components/pretext/ChatBubbles';

type Demo = {
  id: string;
  name: string;
  description: string;
  component: React.ComponentType;
  category: 'quick' | 'narrative' | 'spectacle' | 'experimental';
};

const DEMOS: Demo[] = [
  // Quick wins
  { id: 'floating-damage', name: 'Floating Damage', description: 'Object-pooled floating combat numbers', component: FloatingDamage, category: 'quick' },
  { id: 'monster-weight', name: 'Monster Names', description: 'Font weight encodes threat level', component: MonsterNameWeight, category: 'quick' },
  { id: 'event-ticker', name: 'World Ticker', description: 'Smooth-scrolling event marquee', component: WorldEventTicker, category: 'quick' },
  // Narrative + Combat
  { id: 'typewriter', name: 'Typewriter 2.0', description: 'Font-mixing narrative with variable speed', component: TypewriterNarrative, category: 'narrative' },
  { id: 'combat-log', name: 'Combat Log', description: 'Virtual-scrolled canvas log, 1000+ entries', component: CanvasCombatLog, category: 'narrative' },
  { id: 'item-tooltip', name: 'Item Tooltip', description: 'Multi-font instant tooltip', component: ItemTooltip, category: 'narrative' },
  // Spectacle
  { id: 'boss-splash', name: 'Boss Splash', description: 'Variable-weight ASCII art boss intro', component: BossAsciiSplash, category: 'spectacle' },
  { id: 'text-destroy', name: 'Text Destruction', description: 'Item name shatters into particles', component: TextDestruction, category: 'spectacle' },
  { id: 'death-screen', name: 'Death Screen', description: 'Dramatic epitaph typography', component: DeathScreen, category: 'spectacle' },
  { id: 'zone-transition', name: 'Zone Transition', description: 'Dark Souls-style zone name reveal', component: ZoneTransition, category: 'spectacle' },
  // Experimental
  { id: 'ancient-map', name: 'Ancient Map', description: 'Typographic terrain map', component: AncientMapView, category: 'experimental' },
  { id: 'lore-fragment', name: 'Lore Fragment', description: 'Illuminated manuscript page', component: LoreFragment, category: 'experimental' },
  { id: 'chat-bubbles', name: 'Chat Bubbles', description: 'Pre-measured tight message bubbles', component: ChatBubbles, category: 'experimental' },
];

const CATEGORY_LABELS: Record<string, string> = {
  quick: 'Quick Wins',
  narrative: 'Narrative + Combat',
  spectacle: 'Spectacle',
  experimental: 'Experimental',
};

const CATEGORY_ORDER = ['quick', 'narrative', 'spectacle', 'experimental'];

export function PretextLab() {
  const [activeDemo, setActiveDemo] = useState(DEMOS[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, lg: false });

  const demo = DEMOS.find(d => d.id === activeDemo) || DEMOS[0];
  const DemoComponent = demo.component;

  const navContent = (
    <VStack align="stretch" spacing={0}>
      <Box px={4} py={3} borderBottom="1px solid" borderColor={COLORS.border}>
        <Text fontFamily="heading" fontSize="sm" color={COLORS.amber} letterSpacing="wider">
          PRETEXT LAB
        </Text>
        <Text fontSize="xs" color={COLORS.textMuted} fontFamily="mono">
          @chenglou/pretext demos
        </Text>
      </Box>

      {CATEGORY_ORDER.map(cat => (
        <Box key={cat}>
          <Text
            px={4}
            pt={3}
            pb={1}
            fontSize="10px"
            color={COLORS.textMuted}
            fontFamily="mono"
            letterSpacing="widest"
            textTransform="uppercase"
          >
            {CATEGORY_LABELS[cat]}
          </Text>
          {DEMOS.filter(d => d.category === cat).map(d => (
            <Box
              key={d.id}
              as="button"
              display="block"
              w="100%"
              textAlign="left"
              px={4}
              py={2}
              bg={d.id === activeDemo ? COLORS.bgHover : 'transparent'}
              borderLeft="2px solid"
              borderColor={d.id === activeDemo ? COLORS.amber : 'transparent'}
              cursor="pointer"
              _hover={{ bg: COLORS.bgHover }}
              onClick={() => {
                setActiveDemo(d.id);
                setMenuOpen(false);
              }}
            >
              <Text
                fontSize="sm"
                fontFamily="heading"
                color={d.id === activeDemo ? COLORS.textPrimary : COLORS.textBody}
              >
                {d.name}
              </Text>
              <Text fontSize="xs" color={COLORS.textMuted} noOfLines={1}>
                {d.description}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </VStack>
  );

  return (
    <Flex
      position="fixed"
      top={0}
      left={0}
      w="100vw"
      h="100vh"
      bg={COLORS.bg}
      overflow="hidden"
      zIndex={1000}
    >
      {/* Desktop sidebar */}
      {!isMobile && (
        <Box
          w="260px"
          minW="260px"
          h="100%"
          bg={COLORS.bgSecondary}
          borderRight="1px solid"
          borderColor={COLORS.border}
          overflowY="auto"
          css={{
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-thumb': { background: COLORS.border, borderRadius: '2px' },
          }}
        >
          {navContent}
        </Box>
      )}

      {/* Main content */}
      <Box flex={1} h="100%" position="relative" overflow="hidden">
        {/* Mobile header */}
        {isMobile && (
          <Flex
            h="48px"
            px={4}
            alignItems="center"
            justifyContent="space-between"
            borderBottom="1px solid"
            borderColor={COLORS.border}
            bg={COLORS.bgSecondary}
          >
            <Text fontFamily="heading" fontSize="sm" color={COLORS.amber}>
              {demo.name}
            </Text>
            <Box
              as="button"
              onClick={() => setMenuOpen(!menuOpen)}
              color={COLORS.textBody}
              fontSize="xl"
              cursor="pointer"
            >
              {menuOpen ? '\u2715' : '\u2630'}
            </Box>
          </Flex>
        )}

        {/* Mobile menu overlay */}
        {isMobile && menuOpen && (
          <Box
            position="absolute"
            top="48px"
            left={0}
            right={0}
            bottom={0}
            bg={COLORS.bgSecondary}
            zIndex={10}
            overflowY="auto"
          >
            {navContent}
          </Box>
        )}

        {/* Demo area */}
        <Box
          h={isMobile ? 'calc(100% - 48px)' : '100%'}
          p={isMobile ? 2 : 4}
        >
          <DemoComponent />
        </Box>
      </Box>
    </Flex>
  );
}
