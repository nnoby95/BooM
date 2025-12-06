# Phase 1 Completed - Server Infrastructure

## Project Overview

**TW Controller** - A system to control 30+ Tribal Wars accounts from a single dashboard. The system consists of three components:

1. **Central Server** (Node.js + Express + WebSocket) - COMPLETED in Phase 1
2. **Userscript** (Tampermonkey) - TODO in Phase 2
3. **Dashboard** (Web UI) - Basic version COMPLETED in Phase 1

## What Phase 1 Accomplished

Phase 1 built the complete server infrastructure that will:
- Accept WebSocket connections from userscripts running in 30+ browsers
- Authenticate connections via API key
- Store latest state from all accounts in memory
- Route commands from dashboard to specific userscripts
- Serve dashboard UI
- Provide REST API for dashboard to fetch data and send commands

## File Structure Created

```
/d:/TW/Multy/
├── PROJECT_BRIEF.md          # Full architecture and specifications
├── DEVLOG.md                 # Development log (updated continuously)
├── phase1_completed.md       # This file - Phase 1 documentation
├── server/
│   ├── package.json          # Dependencies: express, ws
│   ├── index.js              # Main entry point - Express + WebSocket server
│   ├── websocket.js          # WebSocket connection handler
│   ├── routes/
│   │   └── api.js            # REST API endpoints
│   ├── state/
│   │   └── accounts.js       # In-memory account state management
│   ├── utils/
│   │   └── logger.js         # Logging utility
│   └── public/               # Dashboard static files
│       ├── index.html        # Dashboard HTML
│       ├── css/
│       │   └── styles.css    # Dashboard styling
│       └── js/
│           └── app.js        # Dashboard JavaScript
└── userscript/               # Empty - Phase 2
```

## Implementation Details

### 1. server/index.js - Main Entry Point

**Purpose**: Creates Express app, HTTP server, and initializes WebSocket server

**Key Features**:
- Express middleware for JSON and URL-encoded bodies
- Request logging middleware
- API routes mounted at `/api`
- Static file serving from `public/` directory
- Error handling middleware
- Graceful shutdown handlers (SIGTERM, SIGINT)

**Server Configuration**:
- PORT: 3000 (default, configurable via env)
- HOST: 0.0.0.0 (listens on all interfaces)
- WebSocket path: `/ws`

**Endpoints**:
- `http://localhost:3000` - Dashboard
- `ws://localhost:3000/ws` - WebSocket for userscripts
- `http://localhost:3000/api/*` - REST API endpoints

### 2. server/websocket.js - WebSocket Handler

**Purpose**: Handles WebSocket connections from userscripts

**Configuration**:
- API Key: `dev-secret-key-change-in-production` (configurable via env: TW_API_KEY)
- Ping interval: 30 seconds (keeps connections alive)

**Message Handlers**:

1. **register** - Authenticate and register new account
   - Validates API key
   - Validates required fields (accountId, world, villageId)
   - Registers account in state with WebSocket connection
   - Returns sessionId

2. **report** - Data report from userscript
   - Updates account data in state
   - Stores resources, troops, buildings, queues, incomings, outgoings

3. **commandResult** - Command execution result
   - Logs success/failure of commands
   - TODO: Store for dashboard to retrieve

4. **error** - Error report from userscript
   - Logs errors for debugging
   - TODO: Store for dashboard to display

5. **pong** - Response to ping
   - Confirms connection is alive

**Connection Management**:
- Tracks authenticated accounts
- Marks accounts as disconnected on close
- Cleans up resources on disconnect
- Automatic ping/pong to detect dead connections

### 3. server/state/accounts.js - State Management

**Purpose**: In-memory storage for all connected accounts

**Data Structure**:
```javascript
Map: accountId -> {
  accountId: string
  connection: WebSocket
  sessionId: string (generated)
  registeredAt: timestamp
  lastUpdate: timestamp
  status: 'connected' | 'disconnected'
  data: {
    world: string
    villageId: number
    villageName: string
    coords: string (e.g., "500|400")
    playerName: string
    resources: { wood, clay, iron, storage, population }
    buildings: { main, barracks, stable, ... }
    troops: { spear, sword, axe, light, ... }
    incomings: [{ id, arrivalTime, originCoords, originVillage, type, size }]
    outgoings: [{ id, arrivalTime, targetCoords, type, returning }]
    buildingQueue: [{ building, level, completesAt }]
    recruitmentQueue: { barracks: {unit, amount, completesAt}, ... }
  }
}
```

**Key Methods**:
- `register(accountId, ws, registrationData)` - Register new account
- `updateData(accountId, reportData)` - Update account data from report
- `disconnect(accountId)` - Mark account as disconnected
- `remove(accountId)` - Remove account completely
- `get(accountId)` - Get specific account
- `getAll()` - Get all accounts (without WebSocket connections)
- `getConnected()` - Get only connected accounts
- `getAllIncomings()` - Get all incoming attacks across all accounts, sorted by arrival time
- `sendToAccount(accountId, message)` - Send message to specific account's WebSocket
- `getStats()` - Get connection statistics

### 4. server/routes/api.js - REST API

**Purpose**: REST API endpoints for dashboard

**Endpoints**:

1. **GET /api/status**
   - Server health and connection count
   - Returns: status, timestamp, connections

2. **GET /api/accounts**
   - List all connected accounts with latest data
   - Returns: success, count, accounts[]

3. **GET /api/accounts/:id**
   - Get specific account details
   - Returns: success, account

4. **GET /api/alerts**
   - Get all incoming attacks across all accounts
   - Returns: success, count, incomings[] (sorted by arrival time)

5. **POST /api/commands/send-troops**
   - Queue a send troops command
   - Body: { accountId, targetCoords, troops, sendType, executeAt }
   - Generates actionId
   - Sends message to userscript via WebSocket
   - Returns: success, actionId, message

6. **POST /api/commands/build**
   - Queue a build building command
   - Body: { accountId, building, levels }
   - Returns: success, actionId, message

7. **POST /api/commands/recruit**
   - Queue a recruit troops command
   - Body: { accountId, building, units }
   - Returns: success, actionId, message

8. **POST /api/commands/refresh**
   - Request immediate data refresh from account
   - Body: { accountId }
   - Returns: success, message

### 5. server/utils/logger.js - Logging

**Purpose**: Centralized logging utility

**Log Levels**:
- DEBUG (0) - Detailed debug information
- INFO (1) - General informational messages (default)
- WARN (2) - Warning messages
- ERROR (3) - Error messages

**Format**: `[timestamp] [LEVEL] message {jsonData}`

**Usage**:
```javascript
logger.info('Message', { data: 'value' });
logger.error('Error occurred', { error: err.message });
```

### 6. server/public/ - Dashboard

**Purpose**: Web interface to monitor and control accounts

**Features Implemented**:
- Real-time account listing with status indicators
- Resource display (wood, clay, iron)
- Connection status indicator
- Account count display
- Alerts panel for incoming attacks
- Auto-refresh every 5 seconds
- Responsive grid layout

**Not Yet Implemented** (will be added later):
- Command panel UI (troops, build, recruit)
- Detailed account view
- Real-time WebSocket updates to dashboard
- Audio/visual notifications for new attacks

## WebSocket Message Protocol

### Messages FROM Userscript TO Server:

1. **register** - Initial connection
```json
{
  "type": "register",
  "apiKey": "dev-secret-key-change-in-production",
  "accountId": "player123",
  "world": "en115",
  "villageId": 12345,
  "villageName": "Village Name",
  "coords": "500|400",
  "playerName": "PlayerName"
}
```

2. **report** - Periodic data (~60s with jitter)
```json
{
  "type": "report",
  "timestamp": 1701234567890,
  "accountId": "player123",
  "villageId": 12345,
  "data": {
    "resources": { "wood": 15000, "clay": 12000, "iron": 8000, ... },
    "buildings": { "main": 20, "barracks": 21, ... },
    "troops": { "spear": 500, "sword": 200, ... },
    "incomings": [...],
    "outgoings": [...],
    "buildingQueue": [...],
    "recruitmentQueue": {...}
  }
}
```

3. **commandResult** - Command execution result
```json
{
  "type": "commandResult",
  "actionId": "cmd_abc123",
  "success": true,
  "message": "Attack sent successfully",
  "details": { "arrivalTime": 1701235000000 }
}
```

4. **error** - Error report
```json
{
  "type": "error",
  "actionId": "cmd_abc123",
  "error": "Not enough troops",
  "context": "sendTroops"
}
```

5. **pong** - Response to ping
```json
{
  "type": "pong",
  "timestamp": 1701234567890
}
```

### Messages FROM Server TO Userscript:

1. **registered** - Registration confirmation
```json
{
  "type": "registered",
  "sessionId": "sess_xyz789"
}
```

2. **sendTroops** - Send troops command
```json
{
  "type": "sendTroops",
  "actionId": "cmd_abc123",
  "targetCoords": "502|402",
  "troops": { "axe": 100, "light": 50 },
  "sendType": "attack",
  "executeAt": null
}
```

3. **buildBuilding** - Build building command
```json
{
  "type": "buildBuilding",
  "actionId": "cmd_def456",
  "building": "barracks",
  "levels": 1
}
```

4. **recruitTroops** - Recruit troops command
```json
{
  "type": "recruitTroops",
  "actionId": "cmd_ghi789",
  "building": "barracks",
  "units": { "axe": 100, "light": 50 }
}
```

5. **requestRefresh** - Request immediate data refresh
```json
{
  "type": "requestRefresh"
}
```

6. **ping** - Keep connection alive
```json
{
  "type": "ping"
}
```

## Testing Phase 1

**Server Startup Test**: ✓ Passed
```bash
cd d:\TW\Multy\server
npm start
# Output:
# [2025-12-04T13:54:01.521Z] [INFO] WebSocket server initialized on /ws
# [2025-12-04T13:54:01.620Z] [INFO] TW Controller Server started
# [2025-12-04T13:54:01.620Z] [INFO] HTTP: http://0.0.0.0:3000
# [2025-12-04T13:54:01.620Z] [INFO] WebSocket: ws://0.0.0.0:3000/ws
# [2025-12-04T13:54:01.620Z] [INFO] Dashboard: http://0.0.0.0:3000
```

**Manual Testing Checklist**:
- [x] Server starts without errors
- [x] Dashboard loads at http://localhost:3000
- [x] API endpoint /api/status returns correct response
- [x] API endpoint /api/accounts returns empty array (no connections yet)
- [ ] WebSocket connection from userscript (Phase 2)
- [ ] Data flow: userscript -> server -> dashboard (Phase 2)

## Known Issues & Solutions

| Issue | Solution | Date |
|-------|----------|------|
| Express 5 wildcard route `app.get('*')` threw PathError | Removed catch-all route; static middleware handles SPA routing | 2025-12-04 |

## Next Phase: Phase 2 - Userscript

The userscript needs to:

1. **Connection Layer**
   - Connect to WebSocket server
   - Authenticate with API key
   - Handle reconnection on disconnect
   - Maintain connection with pong responses

2. **Scrapers** (read from DOM only, no HTTP requests)
   - scrapeAccountInfo() - player name, world
   - scrapeVillageInfo() - village id, name, coords
   - scrapeResources() - wood, clay, iron, storage, population
   - scrapeTroops() - troops in current village
   - scrapeIncomings() - incoming attacks/support
   - scrapeOutgoings() - outgoing commands
   - scrapeBuildingLevels() - current building levels
   - scrapeBuildingQueue() - buildings being constructed
   - scrapeRecruitmentQueue() - troops being trained
   - scrapeAll() - combines all above

3. **Executors** (interact with DOM to perform actions)
   - sendTroops(targetCoords, troops, sendType, executeAt)
   - buildBuilding(building, levels)
   - recruitTroops(building, units)

4. **Reporting**
   - Report data every ~60 seconds with ±10 sec random jitter
   - Report immediately on connection
   - Report after executing commands

## Important Notes

- API key is hardcoded as `dev-secret-key-change-in-production` for development
- All state is in-memory (lost on server restart)
- No database persistence yet (can add later if needed)
- Dashboard updates every 5 seconds via polling (can add WebSocket later)
- Server listens on 0.0.0.0:3000 (all interfaces)
- No HTTPS/WSS yet (use in production)
- No rate limiting or abuse protection yet

## How to Resume from Context Loss

If context is lost, read these files in order:
1. **PROJECT_BRIEF.md** - Full architecture and specifications
2. **phase1_completed.md** - This file (Phase 1 details)
3. **DEVLOG.md** - Current state and TODO list
4. Check actual code files to see implementation details
