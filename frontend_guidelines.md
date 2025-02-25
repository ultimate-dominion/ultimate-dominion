# Ultimate Dominion - Frontend Guidelines

## Design Philosophy

Ultimate Dominion's design focuses on creating an immersive medieval fantasy experience while keeping the interface clean and intuitive. We use a dark theme with accent colors to create a mystical atmosphere, and maintain consistent spacing and typography to ensure everything is easy to read and use.

## Color Palette

### Primary Colors
```ascii
+------------------+----------------------+------------------+
|    Navy Blue     |     Royal Blue      |    Steel Blue   |
|    #0A0F2D      |      #1A237E        |     #4A5568     |
| Main Background  |    Primary Actions  | Secondary Text   |
+------------------+----------------------+------------------+
```

### Secondary Colors
```ascii
+------------------+----------------------+------------------+
|    Gold          |     Bronze          |    Silver       |
|    #FFD700      |      #CD7F32        |     #C0C0C0     |
| Special Actions  |    Achievements     |  Disabled State  |
+------------------+----------------------+------------------+
```

### Status Colors
```ascii
+------------------+----------------------+------------------+
|    Success       |     Warning         |     Danger      |
|    #48BB78      |      #F6AD55        |     #E53E3E     |
|  Positive Events | Caution Required    | Critical Actions |
+------------------+----------------------+------------------+
```

### UI Element Colors
```ascii
+------------------+----------------------+------------------+
|    Background    |     Surface         |    Border       |
|    #1A1F3D      |      #2D3748        |     #4A5568     |
| Card Background  |    Input Fields     |  Separators     |
+------------------+----------------------+------------------+
```

## Typography

### Main Fonts
```ascii
Primary Font: 'MedievalSharp'
Used for: Headings, Important Labels
Example: "Ultimate Dominion"

Secondary Font: 'Roboto'
Used for: Body Text, UI Elements
Example: "Health Points: 100/100"

Monospace Font: 'Fira Code'
Used for: Statistics, Numerical Values
Example: "DMG: 15-20"
```

### Font Sizes
```ascii
Headings:
H1: 2.5rem (40px)  - Main Titles
H2: 2rem   (32px)  - Section Headers
H3: 1.5rem (24px)  - Subsection Headers
H4: 1.25rem (20px) - Card Titles

Body Text:
Large: 1.125rem (18px) - Important Information
Regular: 1rem (16px)   - Standard Text
Small: 0.875rem (14px) - Secondary Information
Tiny: 0.75rem (12px)   - Tooltips
```

## Icons and Visual Elements

### Game-Specific Icons
```ascii
⚔️ Combat Actions
🛡️ Defense/Armor
💰 Currency/Gold
📦 Inventory Items
🏃 Movement/Speed
🗡️ Weapons
🪄 Magic/Spells
❤️ Health/Life
⚡ Energy/Mana
```

### UI Icons
```ascii
← Back/Previous
→ Next/Forward
+ Add/Create
✓ Confirm/Success
✕ Close/Cancel
⚙️ Settings
🔍 Search
⟳ Refresh
⋮ More Options
```

### Status Icons
```ascii
✨ New Item/Feature
⭐ Favorite/Special
⚠️ Warning
❌ Error
✅ Success
🔒 Locked
🔓 Unlocked
```

## Component Design

### Buttons
```ascii
+------------------+
|    Primary       |    Background: #1A237E
|    Button        |    Text: White
+------------------+    Hover: Lighten 10%

+------------------+
|    Secondary     |    Background: #4A5568
|    Button        |    Text: White
+------------------+    Hover: Lighten 10%

+------------------+
|    Danger        |    Background: #E53E3E
|    Button        |    Text: White
+------------------+    Hover: Lighten 10%
```

### Input Fields
```ascii
+------------------+
|  Input Field     |    Background: #2D3748
|                  |    Border: #4A5568
+------------------+    Focus: #1A237E

+------------------+
|  Search Field    |    Background: #2D3748
|  🔍             |    Icon Color: #4A5568
+------------------+    
```

### Cards
```ascii
+------------------+
|    Card Title    |    Background: #1A1F3D
|                  |    Border: #4A5568
|    Content       |    Shadow: 0 2px 4px rgba(0,0,0,0.1)
|                  |
+------------------+
```

## Layout Guidelines

### Grid System
```ascii
Desktop Layout (1200px+)
+--------+--------+--------+
|   1/3  |   1/3  |   1/3  |
+--------+--------+--------+

Tablet Layout (768px - 1199px)
+--------+--------+
|   1/2  |   1/2  |
+--------+--------+

Mobile Layout (<768px)
+----------------+
|      Full      |
+----------------+
```

### Spacing Scale
```ascii
4px  - Minimal spacing
8px  - Default spacing
16px - Component spacing
24px - Section spacing
32px - Large section spacing
48px - Page spacing
```

## Animation Guidelines

### Transitions
- Duration: 200ms
- Timing: ease-in-out
- Use for: Hover states, expanding/collapsing elements

### Loading States
```ascii
+------------------+
|    Loading...    |
|    ◐ ◓ ◑ ◒      |
+------------------+
```

## Accessibility Guidelines

### Color Contrast
- Minimum contrast ratio: 4.5:1
- Large text contrast ratio: 3:1
- Use color blind safe palette

### Focus States
```ascii
+------------------+
|    Focused       |    Border: 2px solid #1A237E
|    Element       |    Outline: none
+------------------+    Ring: 0 0 0 3px rgba(26,35,126,0.5)
```

## Responsive Design

### Breakpoints
```ascii
Mobile: < 768px
Tablet: 768px - 1199px
Desktop: >= 1200px
```

### Mobile-First Approach
- Design for mobile first
- Progressively enhance for larger screens
- Keep touch targets at least 44x44px

## Performance Guidelines

### Image Optimization
- Use WebP format with PNG fallback
- Lazy load images below the fold
- Implement responsive images

### Loading States
- Show skeleton screens for content
- Implement progressive loading
- Cache frequently used assets

## Best Practices

### Component Structure
- Keep components small and focused
- Use composition over inheritance
- Implement proper error boundaries

### State Management
- Use Zustand for global state
- Keep local state in components
- Implement proper loading states

### Code Style
- Use TypeScript for type safety
- Follow ESLint configuration
- Implement proper error handling
