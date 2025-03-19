# Ultimate Dominion - Application Flow

## Landing Page to Gameplay: A Complete User Journey

When you first arrive at Ultimate Dominion, you're greeted with an atmospheric welcome screen featuring a haunting description: "As you awaken, your eyes flutter open to the stark, eerie ambiance of a dimly lit cave." The screen sets the mood with text about confusion clouding your mind and the cold, hard ground beneath you offering no comfort. A simple "Play" button invites you to begin your journey.

After clicking "Play", you'll need to connect your wallet. Once connected, you'll see a "Delegate Account" screen that shows your connected wallet address (starting with 0x). The game explains that you need a session account - a private key stored in your browser's local storage - to play without confirming every transaction. If you don't have Garnet Holesky native tokens, the game will automatically send you some from a faucet. There's an important warning: "Do not deposit any funds into this account that you are not willing to lose."

After delegation is successful (indicated by a green success message), you'll enter the character creation interface. The screen is split into two main sections:

On the left side, you'll see "Who are you in this dark realm?" Here you can:
- Enter your character's name
- Upload a custom avatar image (or use the default pixel art avatar)
- Write a bio that fits a fantasy world setting (like "Sir Lancelot" or "A young wizard from the east")

On the right side, you'll find:
- Class selection buttons for Warrior, Rogue, or Mage
- Your character's stats including:
  - HP (Hit Points)
  - STR (Strength)
  - AGI (Agility)
  - INT (Intelligence)
- A "Roll Stats" button to randomize your attributes
- Starting equipment (like a Leather Vest and Rusty Axe)
- XP counter showing 0/300 XP

After creating your character, you'll see your character's profile with:
- Your unique blockchain address and Token ID
- Your character's name and class
- Current stats and level
- Equipment slots (0/5 initially)

The game board appears as a grid-based map labeled "Dark Cave" with coordinate spaces. Before you can start playing, you'll receive a message explaining that you need at least one weapon or spell equipped. The interface shows:
- Your character stats on the left panel
- The main game area in the center
- A grid-based map on the right
- A "Spawn" button to enter the game world
- Adventure Escrow balance for tracking your in-game currency

The interface includes your current HP displayed as both a fraction (20/20) and a percentage bar, along with empty equipment slots ready to be filled with items you'll find on your journey. A chat button in the bottom right corner allows for player communication.

## Application Flow Overview

```ascii
User Flow
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Landing   │────►│   Connect   │────►│  Character  │
│    Page    │     │   Wallet    │     │  Creation   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Game      │◄────│   Main      │────►│   Market    │
│   World     │     │    Hub      │     │    Place    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      └───────────┬──────┴────────────┬───────┘
                  ▼                    ▼
          ┌─────────────┐      ┌─────────────┐
          │   Social    │      │  Character  │
          │  Features   │      │ Management  │
          └─────────────┘      └─────────────┘
```

## Character and Inventory Management

Your character screen shows detailed information about your progress and capabilities:
- Experience progress (0/300 XP) with a visual level progress bar
- Adventure Escrow balance showing your $GOLD holdings
- Detailed stat breakdown showing Base, Bonus, and Total values for:
  - AGI (Agility)
  - INT (Intelligence)
  - STR (Strength)
- Available Ability Points for character advancement
- An "Edit Character" button for customization

The Items Inventory system is organized into categories:
- Armor (0/1 equipped) - Shows items like Leather Vest with detailed mods (STR +0 AGI -1 INT +0 ARM +2)
- Weapons & Spells (0/4 equipped) - Including items like the Rusty Axe with damage ranges
Each item shows specific requirements and modification values that affect your character's stats.

## Game Loop

```ascii
Game Loop Flow
┌─────────────────────────────────────────┐
│            Player Actions               │
├──────────┬────────────┬────────────────┤
│ Explore  │  Combat    │    Trade       │
│  World   │           │                │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│           State Updates                 │
├──────────┬────────────┬────────────────┤
│Character │ Inventory  │   Game World   │
│  Stats   │  Changes  │    State       │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│           Rewards & Progress            │
├──────────┬────────────┬────────────────┤
│Experience│  Items     │  Achievements  │
│  Gains   │  Drops     │   Unlocked    │
└──────────┴────────────┴────────────────┘
```

## World Exploration

The game world is represented by a grid-based map called the "Dark Cave". The interface provides:
- A coordinate system showing your current position (0,1)
- A compass rose for navigation with N, S, E, W directional buttons
- Player count indicator showing active players in the area
- A safety zone indicator for protected areas
- A chat button in the bottom right for communication

The main game screen is divided into three panels:
1. Character Status (Left)
2. Action Area (Center)
3. World Map (Right)

## Monster Encounters

The center panel displays two key sections:
- Monsters: Lists all nearby creatures with their levels
- Players: Shows other adventurers in your vicinity

You might encounter various creatures such as:
- Fire Beetle (Level 5)
- Golden Snake (Level 2)
- Grey Ooze (Level 2)
- Cave Goblin (Level 3)

Each monster is marked with a unique icon indicating its type. The game provides a helpful prompt: "To initiate a battle, click on a monster."

## Combat System

```ascii
Combat Flow
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Initiate   │────►│   Combat    │────►│  Calculate  │
│   Combat    │     │   Actions   │     │  Outcome    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │                   │                    │
      ▼                   ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Apply     │     │   Update    │     │  Distribute │
│   Effects   │     │   Stats     │     │   Rewards   │
└─────────────┘     └─────────────┘     └─────────────┘
```

When you engage in combat, the interface transforms into a "Battlefield" view showing:

Player Information:
- Your character's portrait and name
- Current HP as both a number (20/20) and health bar
- Key stats (AGI, INT, STR)
- Level indicator

Enemy Information:
- Monster's portrait and name
- Their current HP and level
- Visible stats (like AGI: 10, INT: 15)

Combat Actions:
- A "Choose your move!" prompt
- Available weapons or spells (like "Rusty Axe")
- Combat log showing actions and damage:
  - "Fire Beetle attacked you with Ember for 18 damage"
  - "You attacked Fire Beetle with Rusty Axe for 1 damage"

The battle system is turn-based, with health bars updating in real-time to show damage dealt and received. Your equipped items (shown in the left panel) determine your available combat actions.

## Shopping and Trading

The General Store interface is split into two sections:
- My Inventory: Shows your items and their individual prices
- Shopkeeper's Inventory: Displays available items like:
  - Beer (20 in stock, 16.80 $GOLD)
  - Health Potion (20 in stock, 24.00 $GOLD)
  - Leather Vest (10 in stock, 60.00 $GOLD)
  - Thunderwave (5 in stock, 60.00 $GOLD)
  - Rusty Axe (5 in stock, 60.00 $GOLD)

Both sections include search functionality and category filters to help find specific items.

## Trading System

```ascii
Market Flow
┌─────────────────────────────────────────┐
│            Market Actions               │
├──────────┬────────────┬────────────────┤
│  List    │  Browse    │    Trade       │
│  Item    │  Market    │    Items      │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│           Transaction Process           │
├──────────┬────────────┬────────────────┤
│ Validate │  Execute   │   Update       │
│  Trade   │  Trade     │  Inventories   │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│           Market Updates               │
├──────────┬────────────┬────────────────┤
│ Listing  │  Trade     │   Market       │
│ Updates  │  History   │   Analytics    │
└──────────┴────────────┴────────────────┘
```

## Marketplace System

The Marketplace provides a player-driven economy with several features:
- Current $GOLD balance display
- Search and filter options for items
- Three main tabs: "For Sale", "$GOLD Offers", and "My Listings"
- A "Create Listing" button for selling items

When creating a listing, you can:
- Switch between "All Items" and "Inventory" views
- See detailed item information including:
  - Mods and stat modifications
  - Level and stat requirements
  - Current market prices

Available items show important details:
- Level requirements
- Stat modifications (HP, STR, AGI, INT)
- Current lowest price
- Highest offer (if any)

## Leaderboard

The Leaderboard tracks player progress across multiple metrics:
- Total Stats
- Level
- $GOLD holdings

Players are ranked with detailed information:
- Character name and class icon
- Complete stat breakdown (HP, STR, AGI, INT)
- Level achievements
- Current $GOLD balance

The leaderboard can be filtered by class (Warrior, Rogue, Mage) or show all players, with each entry displaying the player's avatar and comprehensive stats.

Throughout your journey, helpful tooltips and messages guide you through each new feature, ensuring you understand how to progress in the game. The dark theme and pixel art style maintain the game's mysterious and adventurous atmosphere from start to finish.
