# Ultimate Dominion - Backend Structure

## How Our Game Works Behind the Scenes

When you play Ultimate Dominion, a lot happens behind the scenes to make everything work smoothly. Think of it like a restaurant - you only see the dining room, but there's a whole kitchen working to make your meal. In our case, we use something called "serverless" technology. This means instead of having one big computer running everything, we have many small helpers that wake up when needed and go to sleep when they're done. This makes our game faster and more reliable.

## How The Pieces Fit Together

Our game has three main parts working together:

1. The front room (what you see in your browser)
2. The kitchen (where we process all the game actions)
3. The storage room (where we keep all the game data)

```ascii
+---------------------+        +----------------------+
|   Vercel Edge      |        |   Serverless API     |
|   Functions        |        |   Functions          |
|                   |        |                      |
| - Auth Checks     |  --->  | - Game Logic         |
| - Rate Limiting   |        | - Data Processing    |
| - Caching         |        | - State Management   |
+---------------------+        +----------------------+
           |                            |
           v                            v
+---------------------+        +----------------------+
|   MongoDB Atlas     |        |   MUD Framework      |
|   (Game State)     |        |   (Blockchain)       |
|                   |        |                      |
| - Player Data     |        | - Smart Contracts    |
| - Game Progress   |        | - World State        |
+---------------------+        +----------------------+
```

When you do something in the game, like attack a monster, your action goes through these steps:
1. You click the attack button in your browser
2. Our kitchen helper wakes up and figures out what should happen
3. The results are saved in our storage room
4. You see what happened on your screen

## How We Handle Game Actions

When you play the game, you might do things like:
- Move your character
- Fight monsters
- Buy items
- Trade with other players

For each of these actions, we have a special helper ready to handle it. These helpers live at different web addresses (we call them "routes") that look like this:

```ascii
/api
  /auth
    - connect-wallet    # Handle wallet connections
    - verify-session    # Check session validity
    - delegate         # Handle delegation setup
  
  /player
    - profile          # Get/update player info
    - inventory        # Manage player items
    - stats           # Handle player statistics
    
  /game
    - state           # Current game state
    - combat          # Handle battle actions
    - movement        # Process player movement
    
  /market
    - listings        # Market item listings
    - trades          # Handle item trades
    - offers          # Manage trade offers
```

Think of these routes like different counters in a store - one for buying items, one for trading, and so on. Each counter knows exactly how to handle its specific job.

## Data Flow

### Player Action Flow
```ascii
[Client Action] --> [Edge Function] --> [API Route] --> [Database/Blockchain]
      ↑                   |               |                    |
      +-------------------+---------------+--------------------+
                         Response Flow
```

Example of a player attacking a monster:
1. Client sends attack action
2. Edge function validates request
3. API route processes combat
4. Updates stored in MongoDB
5. Blockchain state updated if needed
6. Response sent back to client

## Serverless Functions

### Authentication Function
```javascript
// Example structure of auth function
export default async function handler(req, res) {
  // Validate request
  if (!isValidRequest(req)) {
    return res.status(400).json({ error: 'Invalid request' })
  }

  // Process authentication
  try {
    const authResult = await processAuth(req.body)
    return res.status(200).json(authResult)
  } catch (error) {
    return res.status(500).json({ error: 'Auth failed' })
  }
}
```

### State Management
```ascii
+-------------------+
|   State Layers    |
+-------------------+
       |
    Cache Layer
       |
    Game State
       |
  Persistent Store
```

## Database Structure

### MongoDB Collections
```ascii
Players
{
  _id: ObjectId,
  walletAddress: String,
  sessionAccount: String,
  profile: {
    name: String,
    class: String,
    level: Number,
    experience: Number
  },
  stats: {
    health: Number,
    strength: Number,
    agility: Number,
    intelligence: Number
  },
  inventory: [{
    itemId: String,
    quantity: Number,
    equipped: Boolean
  }]
}

Items
{
  _id: ObjectId,
  name: String,
  type: String,
  stats: {
    damage: Number,
    armor: Number,
    effects: [String]
  },
  requirements: {
    level: Number,
    class: [String]
  }
}

Market
{
  _id: ObjectId,
  sellerId: String,
  itemId: String,
  price: Number,
  listed: Date,
  status: String
}
```

## Caching Strategy

### Multi-Level Caching
```ascii
+------------------+
|   Edge Cache     |  TTL: 1-5 minutes
|   (Vercel)      |  - Static Assets
+------------------+  - API Responses
         ↓
+------------------+
|   Redis Cache    |  TTL: 5-30 minutes
|   (Upstash)     |  - Game State
+------------------+  - Player Sessions
         ↓
+------------------+
|   MongoDB        |  Persistent Storage
|   (Atlas)       |  - All Game Data
+------------------+
```

## Error Handling

### Error Flow
```ascii
[Error Occurs] --> [Log Error] --> [Format Response] --> [Send to Client]
       |              |                  |                     |
       v              v                  v                     v
   Capture Stack   Store in DB    Add Error Code     Show User Message
```

## Rate Limiting

### Request Limits
```ascii
+-------------------+----------------------+
| Endpoint Type     | Rate Limit          |
+-------------------+----------------------+
| Public API       | 100 requests/minute  |
| Auth Required    | 300 requests/minute  |
| Game Actions     | 60 requests/minute   |
| Market Actions   | 30 requests/minute   |
+-------------------+----------------------+
```

## Monitoring and Logging

### Logging Structure
```ascii
+------------------+
|   Log Levels     |
+------------------+
    ERROR: Critical failures
    WARN:  Potential issues
    INFO:  Normal operations
    DEBUG: Detailed info
```

## Security Measures

### Security Layers
```ascii
+------------------------+
|   Request Validation   |
|   - Input Sanitization|
|   - Schema Validation |
+------------------------+
           ↓
+------------------------+
|   Authentication      |
|   - Wallet Signature  |
|   - Session Token     |
+------------------------+
           ↓
+------------------------+
|   Authorization       |
|   - Role Checking     |
|   - Action Validation |
+------------------------+
```

## Deployment Process

### CI/CD Pipeline
```ascii
[Code Push] --> [Tests] --> [Build] --> [Deploy]
     |            |          |           |
     v            v          v           v
  GitHub      Jest Tests   Vercel     Production
  Actions                  Build      Environment
```

## Environment Configuration

### Environment Setup
```ascii
+-------------------+----------------------+----------------------+
| Environment       | Frontend            | Backend              |
+-------------------+----------------------+----------------------+
| LOCAL            | http://localhost:5173| http://localhost:8080|
| STAGING          | ultimate-dominion-   | ultimate-dominion-   |
|                  | staging.vercel.app   | api.onrender.com     |
| PRODUCTION       | ultimate-dominion.   | ultimate-dominion-   |
|                  | vercel.app          | api.onrender.com     |
+-------------------+----------------------+----------------------+
```

### Environment Variables
```ascii
# Frontend (.env.local, .env.staging, .env.production)
VITE_API_URL=http://localhost:8080
VITE_ENVIRONMENT=local
VITE_BLOCKCHAIN_RPC=http://localhost:8545

# Backend (.env, .env.staging, .env.production)
DATABASE_URL=mongodb+srv://...
REDIS_URL=redis://...
BLOCKCHAIN_RPC=https://...
JWT_SECRET=...
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### Deployment Configuration

#### Vercel (Frontend)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "packages/client/package.json",
      "use": "@vercel/static-build",
      "config": { "zeroConfig": true }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/packages/client/$1"
    }
  ]
}
```

#### Render (Backend)
```yaml
services:
  - type: web
    name: ultimate-dominion-api
    env: node
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
```

## Performance Optimization

### Response Time Targets
```ascii
+-------------------+----------------------+
| Action Type       | Target Response     |
+-------------------+----------------------+
| Edge Functions    | < 50ms              |
| API Routes        | < 200ms             |
| Database Queries  | < 100ms             |
| Blockchain Calls  | < 2000ms            |
+-------------------+----------------------+
```

## Scaling Strategy

### Auto-Scaling Rules
```ascii
+-------------------+----------------------+
| Component         | Scaling Trigger     |
+-------------------+----------------------+
| Edge Functions    | Request Volume      |
| API Functions     | CPU Usage           |
| Database         | Connection Count    |
| Cache            | Memory Usage        |
+-------------------+----------------------+
```

## Backup and Recovery

### Backup Schedule
```ascii
+-------------------+----------------------+
| Data Type         | Backup Frequency    |
+-------------------+----------------------+
| Game State        | Every 10 minutes    |
| Player Data       | Every hour          |
| Market Data       | Every 30 minutes    |
| Full Database     | Daily               |
+-------------------+----------------------+
```

## Development Guidelines

When working on the backend, follow these principles:
1. Write stateless functions that can run anywhere
2. Use TypeScript for type safety
3. Keep functions small and focused
4. Cache aggressively but carefully
5. Log everything important
6. Handle errors gracefully
7. Test thoroughly before deployment

Remember that in a serverless environment:
- Functions should be quick to start
- Cold starts can affect performance
- State must be stored externally
- Each function runs in isolation
- Resources are automatically managed

## Different Places the Game Lives

Our game has three different homes:

### Your Computer (Local Development)
This is where we build and test new features. It's like a workshop where we can try things out without affecting the real game. Everything runs on your own computer, so it's fast and easy to fix problems.

### Testing World (Staging)
Before we add new things to the real game, we test them here. It's like a dress rehearsal for a play - everything works just like the real game, but it's okay if something goes wrong because real players aren't using it yet.

### The Real Game (Production)
This is where everyone plays. It's like opening night at the theater - everything needs to work perfectly. We have extra security and backup systems to make sure nothing goes wrong.

## Keeping Track of Everything

We use different tools to watch how the game is running:

### Health Checks
Just like a doctor checks your health, we have tools that check if every part of the game is working properly. They look for things like:
- Is the game responding quickly?
- Can players log in?
- Is the item shop working?
- Are the monsters behaving correctly?

### Saving Your Progress

We keep your game progress safe in several places:
- Quick storage for things that change often (like your current health)
- Permanent storage for important things (like your items and gold)
- Special blockchain storage for things that need to be extra secure

## Making the Game Better

We're always working to make the game better. Here's how we do it:

### Testing New Features
Before adding anything new to the game, we:
1. Build it in our workshop (local development)
2. Test it in our practice world (staging)
3. Make sure it works perfectly
4. Add it to the real game

### Keeping the Game Fast
We use several tricks to keep the game running smoothly:
- Store frequently used information close by
- Load only what's needed when it's needed
- Use multiple helpers to handle lots of players at once

## Backup Plans

Just like you might save your game progress, we keep backups of everything important:
- Your character information
- All items in the game
- Player trades and marketplace data
- Game world state

We make copies of this information regularly, so if something goes wrong, we can quickly fix it without losing anyone's progress.

## Growing Bigger

As more people play Ultimate Dominion, we need to make sure the game can handle everyone playing at once. Our system is built to grow automatically:
- Add more helpers when lots of people are playing
- Use bigger storage when we need it
- Keep everything running smoothly no matter how many players join

Remember, all of this happens automatically behind the scenes. You don't need to worry about any of it - just enjoy playing the game!
