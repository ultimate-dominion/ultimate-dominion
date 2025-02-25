# Ultimate Dominion - Technical Architecture

## How Our Game Works

Ultimate Dominion is built using three main parts that work together to create the game. Think of it like a three-story building, where each floor has its own special job but they all work together to make the game run smoothly.

## The Three Layers

### Top Floor: What Players See and Use
```ascii
+------------------------------------------------+
|                  PRESENTATION                    |
|  +--------------------+  +------------------+    |
|  |    React Client    |  |   Game Engine   |    |
|  | +----------------+ |  | +--------------+ |    |
|  | |  Components    | |  | | MUD Client   | |    |
|  | +----------------+ |  | +--------------+ |    |
|  | |  State (Zustand)| |  | | World State | |    |
|  | +----------------+ |  | +--------------+ |    |
|  +--------------------+  +------------------+    |
+------------------------------------------------+
```

The top floor is what players actually see and interact with. We built this using React, which helps us create smooth, responsive screens that update quickly. When you click a button or move your character, React makes sure everything happens instantly. We use something called Zustand to remember important information like your character's health or what items you're carrying.

### Middle Floor: The Brain of the Game
```ascii
+------------------------------------------------+
|               MIDDLEWARE/API                     |
|  +--------------------+  +------------------+    |
|  |    Express API     |  |   MUD Indexer   |    |
|  | +----------------+ |  | +--------------+ |    |
|  | |  Controllers   | |  | | Query Layer  | |    |
|  | +----------------+ |  | +--------------+ |    |
|  | |  Services      | |  | | Cache Layer  | |    |
|  | +----------------+ |  | +--------------+ |    |
|  +--------------------+  +------------------+    |
+------------------------------------------------+
```

The middle floor is like the brain of the game. When you do something like attack a monster or buy an item, this layer figures out what should happen next. We use Express to handle these decisions quickly. There's also a special part called the MUD Indexer that keeps track of everything that happens in the game world, making sure everyone sees the same thing.

### Bottom Floor: Where Everything is Stored
```ascii
+------------------------------------------------+
|                DATA LAYER                        |
|  +--------------------+  +------------------+    |
|  |   MUD Framework    |  |   Game State    |    |
|  | +----------------+ |  | +--------------+ |    |
|  | | Player Data    | |  | | World State  | |    |
|  | +----------------+ |  | +--------------+ |    |
|  | | Game Tables   | |  | | Contracts    | |    |
|  | +----------------+ |  | +--------------+ |    |
|  +--------------------+  +------------------+    |
+------------------------------------------------+
```

The bottom floor is where we keep all the important information. The MUD Framework stores everything from player data to game state in secure, efficient tables. When you do something in the game - like moving your character or trading items - MUD makes sure it happens correctly and keeps track of all the changes. This gives us the best of both worlds: the security of blockchain with the speed of modern gaming.

## How Players Move Through the Game

When you play Ultimate Dominion, here's how all these parts work together:

```ascii
[User Action] --> [React Component] --> [MUD Action] --> [Smart Contract]
     ^                                                          |
     |                                                         v
[UI Update] <-- [State Management] <-- [MUD Indexer] <-- [Blockchain]
```

Let's say you want to buy a sword from another player. First, the game screen (React) shows you the marketplace. When you click "Buy", the middle layer (Express) checks if you have enough gold. If you do, it tells the blockchain to transfer the sword to you. Once that's done, the MUD Indexer sees the change and tells React to update your screen to show your new sword.

## Different Places the Game Lives

### When You're Testing or Developing
```ascii
+-------------------+
| Local Environment |
|  localhost:5173   |
+-------------------+
         |
    +----+----+
    v         v
+-------+ +--------+
| API   | | Client |
| :8080 | | :5173  |
+-------+ +--------+
```

When we're building new features, everything runs on the developer's computer. This makes it easy to test things and fix problems quickly.

### When Players Are Actually Playing
```ascii
+----------------------+
|  Vercel (Frontend)   |
|  ultimate-dominion-* |
+----------------------+
           |
      +----+----+
      v         v
+---------+ +---------+
| Render  | |  MUD    |
|  API    | |Indexer  |
+---------+ +---------+
```

When the game is live, we use special services to make sure it runs smoothly for everyone. Vercel handles showing the game to players, while Render runs our brain layer, and MUD Indexer keeps track of everything happening in the game world.

## Keeping Players Safe

### How We Protect Your Account
```ascii
[User Wallet] --> [Session Account] --> [Delegation] --> [Game Access]
      |               |                      |               |
      v               v                      v               v
[MetaMask]    [Local Storage]        [Smart Contract]  [Game State]
```

We use several steps to keep your account safe. When you connect your wallet (like MetaMask), we create a special game account just for playing. This way, your main wallet stays safe while you play.

## Making Sure Everything Works

### Checking the Game's Health
```ascii
+------------------+
|  Health Metrics  |
+------------------+
         |
    +----+----+
    v         v
+-------+ +--------+
| API   | | Client |
| Logs  | | Errors |
+-------+ +--------+
    |         |
    v         v
+------------------+
|  Alert System    |
+------------------+
```

We have special tools watching the game all the time. If something goes wrong, these tools let us know right away so we can fix it before it causes problems for players.

## Making the Game Better

### How We Add New Features
```ascii
[Requirement] --> [Design] --> [Implementation] --> [Testing] --> [Deploy]
      |             |              |                   |            |
      v             v              v                   v            v
  User Story    Technical     Development          Test Cases   Release
  Definition    Planning        Branch                          Process
```

When we want to add something new to the game, we follow a careful process. First, we plan what we want to add and how it should work. Then we build it, test it thoroughly, and finally add it to the game for everyone to enjoy.

## Making Sure the Game Runs Well

### Speed and Performance
```ascii
[Initial Load] --> [Asset Loading] --> [State Init] --> [Render]
      |                |                   |              |
      v                v                   v              v
 Code Split      Lazy Loading       Cache Layer     Optimized UI
```

We use several tricks to make the game run smoothly. We load only what's needed when it's needed, and we store information smartly so everything happens quickly.

## Saving Your Progress

### How We Keep Track of Everything
```ascii
[Game State] --> [Blockchain] --> [Indexer Cache] --> [API Cache]
      |              |                  |                  |
      v              v                  v                  v
 Local Cache    Transaction         Snapshot           Memory
                  History            Backup             Cache
```

Your progress is saved in multiple places to make sure nothing gets lost. The blockchain keeps track of important things like items and gold, while other systems remember where you are in the game and what you're doing.

## Planning for the Future

### How We'll Grow
```ascii
[Current] --> [Short Term] --> [Medium Term] --> [Long Term]
    |             |                |                |
    v             v                v                v
Base System   Performance      Feature         Platform
              Optimization    Expansion        Scaling
```

We've built Ultimate Dominion to grow over time. We start with the basics, then make things run better, add new features, and eventually make the game bigger and better for more players to enjoy.

## System Overview

Ultimate Dominion uses a modern web3 architecture combining serverless computing with blockchain technology:

1. **Frontend Layer**
   - React with TypeScript
   - Zustand for state management
   - Tailwind CSS for styling

2. **Backend Layer**
   - Vercel Edge Functions
   - Serverless API endpoints
   - Event-driven architecture

3. **Blockchain Layer (MUD Framework)**
   - Smart contracts for game logic
   - On-chain state management
   - Transaction processing

4. **Storage Layer (IPFS/Pinata)**
   - Decentralized file storage
   - Asset management
   - Metadata hosting

## Data Architecture

```ascii
+----------------+     +----------------+     +----------------+
|   Frontend     |     |   Backend     |     |   Blockchain   |
|                |     |               |     |                |
|  - UI State    |     | - API Routes  |     | - Game State  |
|  - User Input  | --> | - Processing  | --> | - Contracts   |
|  - Rendering   |     | - Validation  |     | - Transactions|
+----------------+     +----------------+     +----------------+
        ↑                     ↑                     ↑
        |                     |                     |
        v                     v                     v
+----------------+     +----------------+     +----------------+
|  Local Cache   |     |  Edge Cache   |     |    IPFS       |
|                |     |               |     |                |
|  - Session    |     | - API Results |     | - Assets      |
|  - UI State   |     | - Responses   |     | - Metadata    |
+----------------+     +----------------+     +----------------+
```

## State Management

### Blockchain State (MUD)
- Player data
- Item ownership
- Game mechanics
- Market transactions
- Combat results

### File Storage (IPFS)
- Game assets
- Character images
- Item artwork
- Metadata files

### Local State (Frontend)
- UI interactions
- Form data
- Temporary calculations
- Session information

### Edge Cache
- API responses
- Frequently accessed data
- Short-term state
