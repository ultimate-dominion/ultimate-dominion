# Ultimate Dominion - Frontend Guidelines

Design system, component patterns, and UI conventions for the game client.

> **Status Key**: `[IMPLEMENTED]` = in code, `[PLANNED]` = designed but not built

---

## Design System

### Color Palette

**Primary (Blue)**:
| Token | Hex | Usage |
|-------|-----|-------|
| blue.300 | #1633B6 | Accent, links |
| blue.400 | #0A2187 | Interactive elements |
| blue.500 | #0C1539 | Dark backgrounds |
| blue.600 | #131832 | Deepest backgrounds |

**Grey**:
| Token | Hex | Usage |
|-------|-----|-------|
| grey.100 | #D0D0D0 | Light text |
| grey.200 | #A8ADB2 | Secondary text |
| grey.300 | #A2A9B0 | Borders, dividers |
| grey.400 | #7E848A | Muted text |
| grey.500 | #3D4247 | Dark text on light |

**Rarity Colors** `[IMPLEMENTED]`:
| Rarity | Hex | Display |
|--------|-----|---------|
| Worn | #9d9d9d | Grey |
| Common | #ffffff | White |
| Uncommon | #1eff00 | Green |
| Rare | #0070dd | Blue |
| Epic | #a335ee | Purple |
| Legendary | #ff8000 | Orange |

**Semantic**:
- Green: #008F07 (success, healing, gold gain)
- Red: #AF0D08 (error, damage, danger)
- Yellow: #EFD31C (warnings, XP, level-up)

**Backgrounds**:
- Body: #A2A9B0
- Card/panel: dark blue gradient (blue.500 to blue.600)
- Modal overlay: blackAlpha.600

---

### Typography

| Role | Font | Source |
|------|------|--------|
| Body & Headings | Inter | @fontsource/inter |
| Stats & Numbers | Fira Code | @fontsource/fira-code |
| Fallback | -apple-system, BlinkMacSystemFont, sans-serif | System |

**Text Sizes** (custom Chakra tokens):

| Token | Size |
|-------|------|
| 4xs | 6px |
| 3xs | 8px |
| 2xs | 10px |
| xs | 12px |
| sm | 14px |
| md | 16px |
| lg | 18px |
| xl | 24px |
| 2xl | 32px |

**Convention**: Use Fira Code (`fontFamily="mono"`) for all numeric displays — HP, gold, XP, stats, coordinates, item quantities.

---

### Component Variants

**Button** variants:
| Variant | Usage |
|---------|-------|
| `dark` | Primary actions |
| `gold` | Gold-related actions (buy, sell) |
| `outline` | Secondary actions |
| `blue` | Navigation, info |
| `white` | Light backgrounds |

**Progress** variants:
| Variant | Usage |
|---------|-------|
| `filling` | Default progress bar |
| `filled` | Completed state |
| `maxed` | Max level/XP |
| `timer` | Countdown timers |

**Modal** styling:
- Custom clip-path polygon (40px corner cutouts)
- Dark theme (blue.500/blue.600 backgrounds)
- Full-screen on mobile (`size="full"` at `base` breakpoint)

**Input/Textarea**:
- Neumorphic inset shadow style
- `outline` variant for form fields

---

## Layout Patterns

### Game Board (Main Game View) `[IMPLEMENTED]`

4-panel grid layout:
```
+------------------+------------------+
|    MapPanel      |   StatsPanel     |
|  (exploration)   | (character info) |
+------------------+------------------+
|  ActionsPanel    |   EventPanel     |
|  (combat/shop)   |  (game log)      |
+------------------+------------------+
```

- Grid uses `auto` height to fill viewport
- Mobile: single-column stack, Stats panel becomes a drawer

### PolygonalCard

Custom card component with clipped corners (polygon clip-path). Used for character display, item cards, and modals. Supports dark mode via `useColorModeValue`.

---

## Responsive Design

### Breakpoints (Chakra UI defaults)

| Token | Width | Target |
|-------|-------|--------|
| `base` | 0px | Mobile |
| `sm` | 640px | Large phone |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Ultra-wide |

### Mobile Adaptations `[IMPLEMENTED]`

- GameBoard: auto height, single-column stack
- MapPanel: compass resized for small screens
- StatsPanel: drawer on mobile (slide from right)
- Modals: full-screen at `base` breakpoint
- Grids: responsive columns (`templateColumns={{ base: "1fr", md: "1fr 1fr" }}`)
- Touch targets: minimum 44px for all interactive elements

### Responsive Patterns

```tsx
// Responsive props (preferred)
<Box px={{ base: 2, md: 4, lg: 6 }} />
<Text fontSize={{ base: "sm", md: "md" }} />

// Conditional rendering
<Box display={{ base: "none", md: "block" }} />

// useBreakpointValue hook (for non-style logic)
const columns = useBreakpointValue({ base: 1, md: 2, lg: 3 });
```

---

## Authentication UI

### Dual-Path Flow `[IMPLEMENTED]`

**Embedded wallet (Google sign-in)**:
- Single "Sign in with Google" button
- Wallet created invisibly — no crypto terminology
- No delegation step required

**External wallet (MetaMask)**:
- "Connect Wallet" button (only visible when `window.ethereum` detected)
- Delegation flow: "Authorize & Play" (not "delegate" in UI)
- Allowance modals labeled "Permissions" (not "allowance")

### Crypto Abstraction `[IMPLEMENTED]`

All blockchain terminology replaced with game-friendly language:

| Crypto Term | Game Term |
|-------------|-----------|
| Wallet | Account |
| Delegation | Authorize |
| Allowance | Permission |
| $GOLD token | Gold |
| Transaction | Action |
| Mint | Create |
| Burn | Destroy |
| Smart contract | Game system |

---

## Accessibility `[IMPLEMENTED]`

- `aria-label` on all icon-only buttons
- `role="alert"` on error messages
- `focus-visible` styles on all interactive elements
- Keyboard shortcut hints in battle UI (`[1-4]`)
- Character creation step indicator
- Item requirement per-stat breakdown on hover

---

## Animation Guidelines

**Framer Motion** for all animations:

| Context | Animation |
|---------|-----------|
| Page transitions | Fade in/out |
| Modal entry | Scale + fade |
| Combat actions | Slide + shake |
| Level-up | Golden card reveal |
| Loot drops | Scale bounce |
| Loading | Spinner (Chakra) |

**Performance**: Prefer `transform` and `opacity` animations. Avoid animating `width`, `height`, or layout-triggering properties.

---

## Conventions

### File Organization

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts (Auth, MUD, Battle)
├── hooks/          # Custom hooks
├── pages/          # Route-level components
├── theme.ts        # Chakra UI theme configuration
├── mud/            # MUD client setup and system calls
└── utils/          # Pure utility functions
```

### Component Patterns

- Use Chakra layout primitives (`Box`, `Flex`, `VStack`, `HStack`, `Grid`) over raw HTML
- Prefer Chakra's responsive props over media queries
- Use `useDisclosure` for modal/drawer state
- Use `useToast` for transient user feedback
- Wrap async actions with loading states and error toasts

### Naming

- Components: PascalCase (`StatsPanel.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Contexts: PascalCase with `Context` suffix (`BattleContext.tsx`)
- Constants: UPPER_SNAKE_CASE
- Types/Interfaces: PascalCase

---

*Last updated: March 9, 2026*
