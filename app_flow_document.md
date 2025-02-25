# Ultimate Dominion - Application Flow Document

## Overview

This document details the complete user journey through Ultimate Dominion, from first launch to gameplay. Each section represents a key screen or interaction point in the game.

## Application Flow

```ascii
+----------------+     +-----------------+     +------------------+     +----------------+
|  Landing Page  |---->| Wallet Connect  |---->| Character Create |---->| Game Interface |
|  (Welcome)     |     | (Delegation)    |     | (Customization)  |     | (Main Game)    |
+----------------+     +-----------------+     +------------------+     +----------------+
```

## 1. Landing Page (Welcome Screen)
```ascii
+------------------------------------------+
|     WELCOME TO ULTIMATE DOMINION          |
|                                          |
|   +--------------------------------+     |
|   |        Story Text Box          |     |
|   |   "As you awaken..."          |     |
|   |                               |     |
|   +--------------------------------+     |
|                                          |
|   +--------------------------------+     |
|   |          [Play Button]         |     |
|   +--------------------------------+     |
+------------------------------------------+
```

**Description:**
- Atmospheric introduction text setting the scene
- Simple, focused interface with a single call to action
- Narrative establishes the dark fantasy setting
- Play button initiates the wallet connection process

## 2. Wallet Connection (Delegation Screen)
```ascii
+------------------------------------------+
|         Delegate Account                  |
|                                          |
|   +--------------------------------+     |
|   |     Connected Account:         |     |
|   |     0xaf82...116e             |     |
|   +--------------------------------+     |
|                                          |
|   +--------------------------------+     |
|   |     Session Account:           |     |
|   |     0xb94a...F931             |     |
|   +--------------------------------+     |
|                                          |
|   [Information about delegation]         |
|                                          |
|   [Delegate Button]                      |
+------------------------------------------+
```

**Key Features:**
- Clear display of connected wallet address
- Session account generation for gameplay
- Security warnings and information
- Automatic token distribution system
- Delegation process explanation

## 3. Character Creation
```ascii
+------------------------------------------+     +----------------------------------+
|    Character Creation                     |     |        Character Stats          |
|                                          |     |                                 |
|    +------------+                        |     |    Class Selection:             |
|    |            |  Name: [_______]       |     |    [Warrior] [Rogue] [Mage]    |
|    |  Avatar    |                        |     |                                 |
|    |            |  Bio:  [_______]       |     |    Stats:                       |
|    +------------+                        |     |    HP: 20                       |
|                                          |     |    STR: 7                       |
|    [Upload Avatar]                       |     |    AGI: 4                       |
|                                          |     |    INT: 10                      |
|    [Create Character]                    |     |                                 |
|                                          |     |    Starting Items:              |
+------------------------------------------+     |    - Leather Vest              |
                                                |    - Rusty Axe                  |
                                                +----------------------------------+
```

**Features:**
- Character customization options
- Class selection system
- Randomized starting stats
- Basic equipment loadout
- Character biography
- Avatar upload capability

## 4. Game Interface
```ascii
+------------------------+----------------------+------------------------+
|    Character Panel     |    Game World       |     Dark Cave         |
|                       |                      |                       |
| HP: 20/20            |                      |    [Map Display]      |
| AGI: 4               |                      |                       |
| INT: 10              |  Welcome Message     |    0 Players         |
| STR: 7               |                      |                       |
|                       |  Game Instructions   |                       |
| Level: 1             |                      |                       |
| XP: 0/300            |                      |                       |
|                       |                      |                       |
| Equipment Slots       |                      |                       |
| [___] [___] [___]    |                      |                       |
| [___] [___]          |                      |                       |
|                       |                      |                       |
| Consumables: 0        |                      |                       |
+------------------------+----------------------+------------------------+
```

**Interface Elements:**
- Character stats display
- Equipment management
- Game world view
- Mini-map system
- Player status indicators
- Inventory management
- Action buttons

## Game Interface Screens

### Character Dashboard
```ascii
+------------------+------------------+------------------+
|    XP/Level      |    Stats Panel   |  Character Info  |
| [=====] 0/300 XP | AGI: 4 (+0)     | +------------+   |
| Level 1 → 2      | INT: 10 (+0)    | |  Avatar    |   |
|                  | STR: 7 (+0)     | |            |   |
| $GOLD: 5.00      |                 | |  Class:    |   |
|                  | AP: 0           | |  Druid     |   |
|                  |                 | +------------+   |
| [Marketplace]    | HP: 20/20       | [Edit Character] |
| [Leaderboard]    |                 |                 |
+------------------+------------------+------------------+
```

### Inventory System
```ascii
+--------------------------------------------------+
|  Items Inventory                         Total: 2  |
+--------------------------------------------------+
| Armor (1) - 0/1 equipped                          |
| +----------------+                                 |
| |  Leather Vest  | x1                             |
| |  Mods: STR +0 AGI -1 INT +0 ARM +2             |
| |  Req: LVL 0 STR 0 AGI 0 INT 0                  |
| +----------------+                                 |
|                                                   |
| Weapons & Spells (1) - 0/4 equipped               |
| +----------------+                                 |
| |  Rusty Axe    | x1                             |
| |  Damage: 1-5                                    |
| +----------------+                                 |
+--------------------------------------------------+
```

### Marketplace
```ascii
+--------------------------------------------------+
|  Marketplace - $GOLD Balance: 5.00                |
+--------------------------------------------------+
| [Search Bar]     [Filter: All ▼]    [Create List] |
|                                                   |
| Items: 2                 Level ▼  Price ▼  Offers |
| +----------------+        -----   -------  ------- |
| | Iron Sword    |          3     50 $GOLD   N/A   |
| | HP 0•STR 0•AGI 0•INT 0                          |
| +----------------+                                 |
| | Steel Breastplate |      3    100 $GOLD   N/A   |
| | HP 0•STR 0•AGI -3•INT 0                         |
| +----------------+                                 |
|           Page 1 of 1                             |
+--------------------------------------------------+
```

### General Store
```ascii
+--------------------------------------------------+
|  General Store                           🗡 0,0    |
+--------------------------------------------------+
| My Inventory         |    Shopkeeper's Inventory  |
| $GOLD: 5.00         |    $GOLD: 100.00           |
|                     |                             |
| [Search] [All ▼]    |    [Search] [All ▼]        |
|                     |                             |
| Leather Vest (1)    |    Beer (20)               |
| 25.00 $GOLD         |    16.80 $GOLD             |
|                     |                             |
| Rusty Axe (1)       |    Health Potion (20)      |
| 25.00 $GOLD         |    24.00 $GOLD             |
|                     |                             |
|                     |    Leather Vest (10)        |
|                     |    60.00 $GOLD             |
|                     |                             |
|     Page 1 of 1     |    Page 1 of 2  [>] [»]    |
+--------------------------------------------------+
```

### Leaderboard
```ascii
+--------------------------------------------------+
|  Leaderboard                                      |
+--------------------------------------------------+
| [Search]  [All] [Warrior] [Rogue] [Mage]         |
|                                                   |
| 16 Players    Total Stats ▼   Level ▼   $GOLD ▼  |
| +------------------------------------------------|
| 1. Just a guy 🦹                                  |
|    HP 27•STR 12•AGI 13•INT 5     30      4       |
| 2. ECWireless 🦹                                  |
|    HP 45•STR 24•AGI 21•INT 3     48     10       |
| 3. Pupcakes 🧙                                    |
|    HP 16•STR 7•AGI 9•INT 5       21      1       |
| +------------------------------------------------|
```

### Create Listing Modal
```ascii
+--------------------------------------------------+
|  Create Listing                              [X]  |
+--------------------------------------------------+
| [All Items] [Inventory]      Items: 26           |
|                                                  |
| [Search Bar]    [Filter: All ▼]                  |
|                                                  |
| +----------------+                               |
| | Leather Vest                                  |
| | Mods: STR +0 AGI -1 INT +0 ARM +2            |
| | Req: LVL 0 STR 0 AGI 0 INT 0                 |
| +----------------+                               |
|                                                  |
| [Close]                                          |
+--------------------------------------------------+
```

## User Interaction Flows

### Trading Flow
1. Player accesses Marketplace
2. Can view items for sale with filters and sorting
3. Can create new listings from inventory
4. Can make offers on items
5. Can accept/reject offers on their listings

### Character Progression
1. Gain XP through activities (0/300 shown)
2. Level up unlocks ability points
3. Distribute points across AGI/INT/STR
4. Equipment provides stat modifiers
5. Class selection affects base stats

### Economy System
1. Players earn $GOLD through activities
2. Can trade items in Marketplace
3. Can purchase from General Store
4. Dynamic pricing based on supply/demand
5. Transaction fees and market mechanics

## Game Flow Sequence

1. **Initial Launch**
   - Player lands on welcome screen
   - Atmospheric text sets the scene
   - Play button prompts wallet connection

2. **Wallet Connection**
   - Connect wallet (MetaMask or compatible)
   - Generate session account
   - Receive initial tokens if needed
   - Complete delegation process

3. **Character Creation**
   - Choose character class
   - Customize appearance
   - Set character name and bio
   - Review starting stats and items
   - Confirm character creation

4. **Game Entry**
   - Load into game world
   - Display tutorial messages
   - Equip starting items
   - Enable character spawning
   - Begin gameplay

## User Interaction Points

### Critical Path
```ascii
[Start] --> [Connect Wallet] --> [Create Character] --> [Enter Game]
   |             |                      |                    |
   v             v                      v                    v
Tutorial     Security            Class Selection        Equipment
Messages     Warnings           & Customization        Tutorial
```

### Key Decision Points
1. Wallet Connection
   - Accept delegation
   - Understand security implications
   - Receive initial tokens

2. Character Creation
   - Class selection impacts gameplay
   - Stat distribution affects abilities
   - Equipment loadout choices

3. Game Entry
   - Equipment setup required
   - Character spawning process
   - Initial movement tutorial

## Technical Considerations

1. **Wallet Integration**
   - Secure delegation process
   - Token distribution system
   - Session management

2. **Character Data**
   - Blockchain storage of character data
   - Local storage for preferences
   - Real-time stat updates

3. **Game State**
   - Synchronization with blockchain
   - Real-time player positions
   - Equipment management

4. **User Experience**
   - Clear tutorial messages
   - Intuitive UI layout
   - Responsive controls
   - Error handling and recovery
