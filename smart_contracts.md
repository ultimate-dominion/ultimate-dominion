# Smart Contracts in Ultimate Dominion

## Overview

Think of smart contracts as the rule book for our game. Just like how a board game has rules that everyone follows, our smart contracts are digital rules that make sure everyone plays fairly. These rules live on the blockchain, which means they can't be changed once they're set up - just like how you can't change the rules of chess in the middle of a game.

## The Big Picture

```ascii
+-------------------+        +-------------------+        +-------------------+
|    Game World     |        |    Characters     |        |      Items        |
|                   |        |                   |        |                   |
|  - Game Rules     | <----> |  - Player Stats   | <----> |  - Equipment      |
|  - World State    |        |  - Inventories    |        |  - Resources      |
|  - Events         |        |  - Actions        |        |  - Trading        |
+-------------------+        +-------------------+        +-------------------+
          ↑                           ↑                           ↑
          |                           |                           |
          v                           v                           v
+-------------------+        +-------------------+        +-------------------+
|     Combat        |        |     Market        |        |     Quests       |
|                   |        |                   |        |                   |
|  - Battles        |        |  - Buying        |        |  - Missions      |
|  - Rewards        |        |  - Selling       |        |  - Rewards       |
|  - Experience     |        |  - Trading       |        |  - Progress      |
+-------------------+        +-------------------+        +-------------------+
```

## How It All Works Together

Imagine our game as a big medieval town. Each part of the town has its own job, but they all work together:

### The World Contract (Town Hall)
This is like the town hall - it's in charge of everything. It:
- Keeps track of where everything is
- Makes sure all the other parts work together
- Handles big events that affect everyone

### Character Contracts (Citizen Registry)
Think of this as the town's citizen registry. It:
- Keeps track of each player's information
- Manages what players can do
- Records player achievements and progress

### Item Contracts (Town Market)
This is like the town's marketplace. It:
- Keeps track of who owns what
- Handles trading between players
- Makes sure items work properly

### Combat System (Training Grounds)
This is like the town's training grounds. It:
- Manages fights between players and monsters
- Calculates who wins and loses
- Hands out rewards after battles

## Contract Details

### World Contract
```ascii
WorldContract
+------------------------+
|       Properties       |
+------------------------+
| - gameState           |
| - worldTime           |
| - eventSchedule       |
+------------------------+
|       Functions       |
+------------------------+
| → startGame()         |
| → pauseGame()         |
| → triggerEvent()      |
| → updateState()       |
+------------------------+
```

The World Contract is like the game master in a board game. It:
1. Decides when the game starts and stops
2. Creates special events (like festivals or battles)
3. Makes sure everything is running smoothly

### Character Contract
```ascii
CharacterContract
+------------------------+
|       Properties       |
+------------------------+
| - level               |
| - experience          |
| - stats               |
| - inventory           |
+------------------------+
|       Functions       |
+------------------------+
| → levelUp()           |
| → gainExperience()    |
| → updateStats()       |
| → equipItem()         |
+------------------------+
```

The Character Contract is like your character sheet in a role-playing game. It:
1. Keeps track of how strong you are
2. Records what you've learned
3. Remembers what items you have

### Item Contract
```ascii
ItemContract
+------------------------+
|       Properties       |
+------------------------+
| - itemType            |
| - rarity              |
| - attributes          |
| - owner               |
+------------------------+
|       Functions       |
+------------------------+
| → createItem()        |
| → transferItem()      |
| → useItem()          |
| → destroyItem()       |
+------------------------+
```

The Item Contract is like a magical backpack. It:
1. Creates new items
2. Helps players trade items
3. Makes sure items work correctly when used

### Combat Contract
```ascii
CombatContract
+------------------------+
|       Properties       |
+------------------------+
| - activeBattles       |
| - combatStats         |
| - rewards             |
+------------------------+
|       Functions       |
+------------------------+
| → startBattle()       |
| → attack()            |
| → defendAction()      |
| → endBattle()         |
+------------------------+
```

The Combat Contract is like a referee in a sports match. It:
1. Makes sure fights are fair
2. Calculates damage and defense
3. Gives out prizes to winners

## How Players Interact

When you play the game, you're actually talking to these contracts. Here's what happens:

1. **Starting Out**
   ```ascii
   Player → Character Contract → World Contract
   [Join Game] → [Create Character] → [Enter World]
   ```

2. **Getting Items**
   ```ascii
   Player → Item Contract → Character Contract
   [Buy Item] → [Create Item] → [Add to Inventory]
   ```

3. **Fighting Monsters**
   ```ascii
   Player → Combat Contract → Character Contract
   [Start Fight] → [Calculate Results] → [Get Rewards]
   ```

## Safety Features

Just like a bank vault has security, our contracts have safety features:

1. **Checking Permission**
   - Makes sure you're allowed to do things
   - Prevents cheating
   - Protects your items

2. **Handling Errors**
   - Catches mistakes before they cause problems
   - Helps players if something goes wrong
   - Keeps the game running smoothly

3. **Saving Progress**
   - Records everything that happens
   - Can't be changed or deleted
   - Proves who owns what

## Making Changes

While the rules can't be changed during play, we can create new versions of the game with improvements:

1. **Updates**
   - Add new features
   - Fix problems
   - Make the game more fun

2. **Testing**
   - Try new things in a test world
   - Make sure everything works
   - Get player feedback

Remember: Everything in the game follows these rules automatically. You don't need to understand all the technical details - just like you don't need to know how a car engine works to drive a car. The contracts make sure everyone plays fairly and has fun!
