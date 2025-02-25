# Ultimate Dominion - Backend Structure

## Overview

Ultimate Dominion uses a modern serverless architecture built on Vercel. This approach gives us automatic scaling, high availability, and fast response times. Instead of running a traditional server, we break our backend into small functions that run only when needed.

## System Architecture

### API Layer
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

## API Routes Structure

Our API routes are organized by feature and follow RESTful principles:

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

### Environment Variables
```ascii
# Required Variables
DATABASE_URL=mongodb+srv://...
REDIS_URL=redis://...
BLOCKCHAIN_RPC=https://...
JWT_SECRET=...

# Optional Variables
DEBUG_MODE=false
RATE_LIMIT_WINDOW=60000
CACHE_TTL=300
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
