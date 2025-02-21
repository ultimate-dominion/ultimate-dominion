# Ultimate Dominion - Project Requirements Document (PRD)

## Overview

Ultimate Dominion is a blockchain-based text MMORPG that seamlessly combines traditional RPG mechanics with Web3 technology. Built on the MUD framework, it creates a decentralized gaming environment where players can own their in-game assets as NFTs and participate in a player-driven economy. The game aims to create an engaging, decentralized gaming experience that gives players true ownership of their in-game assets while providing deep RPG mechanics and meaningful player interactions.

## User Journey

The player's journey begins with a streamlined Web3 onboarding process. Upon entering the game, players connect their wallet through a delegation system that enables gas-less transactions. New players who lack Garnet Holesky tokens automatically receive them through a faucet system. To ensure security while maintaining convenience, players create a session account stored in their browser's local storage. Clear security warnings guide players in managing their funds responsibly.

Character creation forms the foundation of each player's unique journey. Players select from three distinct classes (Warrior, Rogue, or Mage), choose a name, and either upload a custom avatar or utilize the generated pixel art system. The character creation process includes writing a personal bio and rolling for initial stats across four primary attributes: HP, STR, AGI, and INT. Each new character receives starting equipment, including a Leather Vest and Rusty Axe, before being minted as an NFT on the blockchain.

The core gameplay loop centers around exploration, combat, and trading. Players navigate a grid-based map using intuitive compass controls, monitoring their coordinate position and the presence of other players. The turn-based combat system pits players against various monsters, while the robust marketplace and trading systems enable a dynamic player-driven economy. Progress is tracked through an extensive leaderboard system that recognizes achievements across multiple metrics.

## Game Systems Overview

```ascii
Game Systems Architecture
┌──────────────────────────────────────────────────────┐
│                  Core Systems                         │
├──────────┬─────────────┬───────────┬────────────────┤
│Character │  Combat     │ Inventory │    Market       │
│Creation  │  System     │ System    │    System      │
└──────────┴─────────────┴───────────┴────────────────┘
           │
┌──────────────────────────────────────────────────────┐
│                 Social Systems                        │
├──────────┬─────────────┬───────────┬────────────────┤
│  Guild   │   Trade     │   Chat    │  Achievements  │
│ System   │   System    │  System   │    System      │
└──────────┴─────────────┴───────────┴────────────────┘
           │
┌──────────────────────────────────────────────────────┐
│                 Game World                           │
├──────────┬─────────────┬───────────┬────────────────┤
│  Zones   │   Quests    │  Events   │    Economy     │
└──────────┴─────────────┴───────────┴────────────────┘
```

## Player Journey

```ascii
Player Progression Flow
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  New Player │────►│Basic Training│────►│World Access │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Combat    │◄────│  Character  │────►│  Resource   │
│Development  │     │Development  │     │ Collection  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      └───────────┬──────┴────────────┬───────┘
                  ▼                    ▼
          ┌─────────────┐      ┌─────────────┐
          │   Guild     │      │  Advanced   │
          │Activities   │      │  Content    │
          └─────────────┘      └─────────────┘
```

## Core Systems

### Character Progression

The character system forms the backbone of Ultimate Dominion's gameplay experience. Each character exists as a unique NFT, featuring three distinct classes that cater to different playstyles. The four primary stats (HP, STR, AGI, INT) influence combat effectiveness and character capabilities. Players manage five equipment slots and progress through levels by earning experience points, with 300 XP required per level. The ability points system allows for strategic character development, while detailed character bios and customization options enable personal expression.

### Combat Mechanics

Combat in Ultimate Dominion utilizes a strategic turn-based system that emphasizes player choice and tactical thinking. Players encounter a variety of monsters ranging from level 1 to 5, each with unique abilities such as the Fire Beetle's devastating Ember attack. The combat interface provides real-time health bar updates and detailed combat logs, allowing players to make informed decisions. Monster stats are visible during combat, enabling players to assess threats and plan their approach accordingly. Equipment choices directly influence available combat actions, adding another layer of strategic depth.

### Economic Framework

The game's economy revolves around a dual-currency system featuring blockchain-based NFTs and an in-game $GOLD currency. Trading occurs through two primary channels: a General Store with fixed prices and a player-driven Marketplace. The General Store offers consistent pricing for common items (16-25 $GOLD) and rare items (60+ $GOLD), while the Marketplace enables players to create listings, track price histories, and engage in direct player-to-player trading. All transactions are managed through a secure Adventure Escrow balance system.

### World Design

The game world is built around a sophisticated grid-based map system that emphasizes exploration and strategic positioning. Players navigate using coordinate-based movement, with clear indicators for safety zones and monster spawn areas. The real-time world state updates ensure players always have accurate information about their surroundings and the presence of other players, creating opportunities for both cooperation and competition.

### Item Systems

The item system in Ultimate Dominion is carefully structured to provide depth and variety. Equipment is divided into three primary categories: Armor (1 slot), Weapons & Spells (4 slots), and Consumables. Each item features detailed attributes including stat modifications, level requirements, and equipment prerequisites. Weapons include specific damage ranges, while armor provides various defensive bonuses. The system supports different rarity levels with corresponding value scaling, creating a rich economy of items for players to collect and trade.

### Social Integration

Social features are woven throughout the game experience, fostering a strong community atmosphere. A real-time chat system enables fluid communication between players, while shared spaces encourage organic player interaction. The comprehensive leaderboard system tracks multiple achievement categories, including class-based rankings, total stats, level progression, and wealth accumulation. This multi-faceted approach to social features helps create a vibrant, engaging community.

## Game Economy

```ascii
Economic Flow
┌─────────────────────────────────────────┐
│            Resource Generation          │
├──────────┬────────────┬────────────────┤
│ Combat   │ Gathering  │    Crafting    │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│            Resource Sinks               │
├──────────┬────────────┬────────────────┤
│Equipment │  Skills    │   Consumables  │
│Upgrades  │  Training  │   & Services   │
└──────────┴────────────┴────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│            Player Economy              │
├──────────┬────────────┬────────────────┤
│  Market  │   Trade    │     Guild      │
│  Place   │  System    │   Treasury     │
└──────────┴────────────┴────────────────┘
```

## Technical Implementation

The game's technical architecture prioritizes performance and security while maintaining accessibility. The blockchain integration leverages the Garnet Network for NFT management and secure wallet delegation. The user interface employs a three-panel layout that efficiently presents character status, action areas, and world map information. Real-time updates ensure smooth combat transitions, world navigation, and marketplace interactions.

## Monetization Strategy

The monetization model centers on the in-game economy, with $GOLD serving as the primary currency. Revenue streams include marketplace listing fees and item trading fees. The General Store maintains a carefully balanced pricing structure that provides value while maintaining economic stability. Player-to-player trading creates additional economic activity and value circulation within the game ecosystem.

## Launch Specifications

The initial launch focuses on the Dark Cave starting zone, populated with carefully balanced monster types including Fire Beetles (Level 5), Golden Snakes (Level 2), Grey Ooze (Level 2), and Cave Goblins (Level 3). Starting equipment and basic consumables provide new players with the tools needed to begin their adventure. The balance requirements ensure appropriate difficulty scaling, fair starting stats, and reasonable progression rates through equipment slot limitations and stat modification ranges.

## Future Development

Looking ahead, Ultimate Dominion's development roadmap includes expanding beyond the Dark Cave with additional zones, introducing new monster varieties, and implementing new equipment types. Plans for enhanced social features, including a guild system and quest framework, will deepen player engagement. The development of crafting mechanics and advanced combat abilities will provide additional layers of gameplay depth. Each planned feature aims to enrich the player experience while maintaining the game's core balance and design principles.
