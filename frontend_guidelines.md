# Ultimate Dominion Frontend Guidelines

## Design Philosophy

Ultimate Dominion's visual design embodies a dark fantasy aesthetic while maintaining modern usability principles. The interface draws inspiration from classic RPGs while incorporating contemporary design elements to create an immersive yet intuitive experience. Every visual element serves to enhance the game's mysterious atmosphere while ensuring clear information hierarchy and user feedback.

## Color Palette

### Primary Colors
Our primary color palette centers around deep, rich blues that form the foundation of our interface. The primary blue (#1a237e) serves as our main action color, while darker shades (#0d1117) create depth in our backgrounds. This creates a sense of depth while maintaining readability.

### Secondary Colors
Accent colors are carefully chosen to provide clear visual feedback and hierarchy:
- Success Green (#4CAF50): Used for positive actions, successful transactions, and health bars
- Warning Amber (#FFA000): Highlights important information and intermediate states
- Error Red (#D32F2F): Indicates critical errors and dangerous actions
- Info Blue (#2196F3): Used for informational messages and subtle highlights

### Neutral Colors
A sophisticated grayscale palette provides structure and readability:
- Background Dark (#121212): Main application background
- Surface Dark (#1E1E1E): Card and modal backgrounds
- Border Gray (#323232): Subtle divisions and containers
- Text Light (#E0E0E0): Primary text color
- Text Muted (#9E9E9E): Secondary and inactive text

### Special Effect Colors
Magical and special effects utilize a unique palette:
- Arcane Purple (#9C27B0): Magical abilities and effects
- Divine Gold (#FFD700): Rare items and special achievements
- Poison Green (#00FF00): Status effects and environmental hazards
- Fire Orange (#FF5722): Fire-based abilities and effects

## Typography

### Primary Font: "MedievalSharp"
Our primary display font embodies the fantasy theme while maintaining readability. It's used for:
- Main headings
- Character names
- Location titles
- Important statistics

### Secondary Font: "Roboto Mono"
A monospace font that provides clarity for:
- Combat numbers
- Coordinate displays
- Resource counts
- System messages

### Body Font: "Inter"
Our main text font ensures optimal readability while maintaining the game's aesthetic:
- Interface text
- Descriptions
- Chat messages
- Menu items

Font sizes follow a consistent scale:
- Headings: 24px/1.5
- Subheadings: 18px/1.4
- Body text: 16px/1.5
- Small text: 14px/1.4
- Micro text: 12px/1.3

## Icons and Visual Elements

### Game Icons
Character and item icons follow a consistent 32x32 pixel art style, maintaining clarity even at small sizes. Each icon type has specific characteristics:

Character Classes:
- Warrior: Bold, angular shapes with metallic elements
- Rogue: Sharp, asymmetrical designs with dark elements
- Mage: Flowing, magical patterns with glowing effects

Equipment Categories:
- Weapons: Distinctive silhouettes for easy recognition
- Armor: Layered designs showing protection level
- Consumables: Simple, clear shapes with color coding

### Interface Icons
UI elements use a custom icon set based on geometric shapes:
- Navigation: Simple arrows and directional indicators
- Actions: Clear, symbolic representations
- Status Effects: Color-coded with distinctive shapes
- System Icons: Minimal, modern design for clarity

## Layout Principles

The interface follows a consistent grid system based on 8px units. The three-panel layout provides clear separation of concerns:

Left Panel (Character Information):
- Fixed width of 320px
- Vertical organization of stats and equipment
- Collapsible sections for additional information

Center Panel (Main Action Area):
- Flexible width with minimum 640px
- Clear action space for combat and interaction
- Prominent feedback area for system messages

Right Panel (World Map):
- Fixed width of 320px
- Grid-based coordinate system
- Minimal, clear representation of game world

## Interactive Elements

### Buttons
Buttons follow a consistent hierarchy:
- Primary: Solid blue background with white text
- Secondary: Outlined style with blue border
- Danger: Red background for destructive actions
- Disabled: Reduced opacity with gray background

### Input Fields
Form elements maintain consistency:
- Dark backgrounds with light text
- Subtle borders that highlight on focus
- Clear error states with red outlines
- Helper text in muted colors

### Cards and Containers
Information containers use consistent styling:
- Subtle background gradient for depth
- Soft edge glow for emphasis
- Consistent padding (16px)
- Rounded corners (4px)

## Animation and Transitions

Animations serve to enhance user feedback without causing distraction:
- Button hover: Subtle glow effect (0.2s ease)
- Panel transitions: Smooth slide (0.3s ease-in-out)
- Combat effects: Quick, impactful movements (0.15s ease)
- Status changes: Fade transitions (0.2s ease)

## Responsive Design

The interface adapts to different screen sizes while maintaining functionality:
- Desktop (1920px+): Full three-panel layout
- Laptop (1366px): Compressed panels with maintained functionality
- Tablet (1024px): Collapsible panels with touch-friendly targets
- Mobile: Not supported in initial release

## Accessibility

Design considerations ensure broad usability:
- Minimum contrast ratio of 4.5:1 for text
- Clear focus indicators for keyboard navigation
- Alternative text for all icons and images
- Scalable text sizes for readability
- Color-blind friendly status indicators

## Loading States and Feedback

User feedback is clear and consistent:
- Loading spinners: Animated blue circular indicator
- Progress bars: Green fill with percentage
- Success states: Green checkmark with fade
- Error states: Red X with shake animation
- Network states: Yellow pulse for processing

## Frontend Architecture Overview

```ascii
Frontend Architecture
┌──────────────────────────────────────────────────┐
│                  App Shell                        │
├──────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │   Header    │ │   Router    │ │   Footer    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ │
├──────────────────────────────────────────────────┤
│                  Core Features                    │
├──────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │   Wallet    │ │   Game UI   │ │   Market    │ │
│ │ Connection  │ │             │ │    Place    │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ │
├──────────────────────────────────────────────────┤
│                Shared Components                  │
├──────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │   Buttons   │ │   Modals    │ │   Forms     │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ │
└──────────────────────────────────────────────────┘
```

## Component Architecture

```ascii
Component Structure
┌──────────────────────────────────────────┐
│              Smart Components            │
├──────────┬────────────┬─────────────────┤
│ Pages    │ Features   │ Layout          │
│ - Home   │ - Wallet   │ - MainLayout    │
│ - Game   │ - Combat   │ - GameLayout    │
│ - Market │ - Trade    │ - AuthLayout    │
└──────────┴────────────┴─────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│           Shared Components              │
├──────────┬────────────┬─────────────────┤
│   UI     │ Forms      │ Feedback        │
│Elements  │Components  │Components       │
└──────────┴────────────┴─────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│              Base Components             │
├──────────┬────────────┬─────────────────┤
│Typography │  Buttons   │     Icons       │
└──────────┴────────────┴─────────────────┘
```

## State Management

```ascii
State Flow
┌─────────────────────────────────────────┐
│            Blockchain State             │
├──────────┬────────────┬────────────────┤
│  MUD     │  Wagmi     │ Contract Data  │
│  Store   │  Hooks     │                │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│             Local State                 │
├──────────┬────────────┬────────────────┤
│  React   │  Context   │    Storage     │
│  Query   │           │                │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│            UI State                     │
├──────────┬────────────┬────────────────┤
│Component │   Forms    │   Navigation   │
│  State   │   State    │     State     │
└──────────┴────────────┴────────────────┘
```

This comprehensive guide ensures consistency across all aspects of the Ultimate Dominion interface, creating a cohesive and immersive player experience while maintaining modern usability standards.
