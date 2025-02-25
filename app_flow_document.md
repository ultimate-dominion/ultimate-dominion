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

Ultimate Dominion is a game where you explore dungeons, fight monsters, and trade with other players. You start by making a character and choosing a class like Warrior, Rogue, Mage, or Druid. As you play, you'll get better equipment, learn new skills, and become stronger.

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

The wallet connection screen is where you connect your wallet to the game. You'll see your connected account address and a session account address that's generated for gameplay. There's also information about the delegation process and a button to complete it.

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

When you create your character, you'll choose a class, customize your appearance, set your character's name and bio, and review your starting stats and items. You'll also upload an avatar and confirm your character creation.

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

The game interface is where you'll spend most of your time playing the game. You'll see your character's stats, equipment, and consumables, as well as the game world and a map display.

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

The character dashboard shows your character's progress, including their XP, level, and stats. You'll also see your character's info, including their avatar, class, and equipment.

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

The inventory system shows all the items you have, including armor, weapons, and spells. You'll see the item's name, mods, and requirements.

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

The marketplace is where you can buy and sell items with other players. You'll see a list of items, including their level, price, and offers.

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

The general store is where you can buy items from the shopkeeper. You'll see a list of items, including their price and quantity.

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

The leaderboard shows how players are doing compared to each other. You'll see a list of players, including their total stats, level, and gold.

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

The create listing modal is where you can create a new listing for an item. You'll see a list of items, including their mods and requirements.

### Combat System
```ascii
+--------------------------------------------------+
|  Combat Screen                                  |
+--------------------------------------------------+
| [Character Info]  |  [Battlefield]  |  [Map]     |
| HP: 20/20        |                  |            |
| AGI: 4           |                  |            |
| INT: 10          |                  |            |
| STR: 7           |                  |            |
|                  |  [Monster Info]  |            |
|                  |  HP: 10/10      |            |
|                  |  AGI: 2         |            |
|                  |  INT: 5         |            |
|                  |  STR: 3         |            |
| [Action Buttons] |                  |            |
+--------------------------------------------------+
```

The combat system is where you'll fight monsters. You'll see your character's info, the battlefield, and a map of the area.

## User Interaction Flows

### Trading Flow

The trading flow is where you can buy and sell items with other players. You'll start by accessing the marketplace, where you can view items for sale and create new listings from your inventory. You can make offers on items and accept or reject offers on your listings.

### Character Progression

Character progression is where you'll gain experience points and level up. You'll start by gaining XP through activities, and when you reach a certain amount, you'll level up and unlock ability points. You can distribute these points across your stats, and equipment will provide stat modifiers.

### Economy System

The economy system is where you'll earn gold through activities. You can trade items in the marketplace, purchase from the general store, and participate in dynamic pricing based on supply and demand. There are also transaction fees and market mechanics.

## Game Flow Sequence

1. **Initial Launch**

The game starts with the initial launch, where you'll land on the welcome screen. You'll see atmospheric text that sets the scene, and a play button that prompts wallet connection.

2. **Wallet Connection**

Next, you'll connect your wallet to the game. You'll see your connected account address and a session account address that's generated for gameplay. There's also information about the delegation process and a button to complete it.

3. **Character Creation**

After wallet connection, you'll create your character. You'll choose a class, customize your appearance, set your character's name and bio, and review your starting stats and items.

4. **Game Entry**

Finally, you'll enter the game world. You'll load into the game, see tutorial messages, equip your starting items, and begin gameplay.

## User Interaction Points

### Critical Path

The critical path is where you'll start the game, connect your wallet, create your character, and enter the game world.

### Key Decision Points

There are several key decision points in the game. The first is wallet connection, where you'll accept delegation and understand the security implications. The second is character creation, where you'll choose a class and customize your appearance. The third is game entry, where you'll equip your starting items and begin gameplay.

## Technical Considerations

### Wallet Integration

Wallet integration is where you'll connect your wallet to the game. You'll need to secure the delegation process, distribute tokens, and manage sessions.

### Character Data

Character data is where you'll store your character's info, including their stats, equipment, and inventory. You'll need to store this data on the blockchain and locally.

### Game State

Game state is where you'll synchronize the game state with the blockchain. You'll need to update the game state in real-time and manage player positions.

### User Experience

User experience is where you'll create a clear and intuitive UI layout. You'll need to provide responsive controls, error handling, and recovery.
