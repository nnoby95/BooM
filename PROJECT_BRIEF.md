# Tribal Wars Multi-Account Controller

## Project Overview

Build a system to control 30+ Tribal Wars accounts from a single dashboard. The system consists of three components that communicate via WebSocket.

## Architecture

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│     VPS 1       │  │     VPS 2       │  │     VPS 3       │
│  10 Chrome      │  │  10 Chrome      │  │  10 Chrome      │
│  Profiles with  │  │  Profiles with  │  │  Profiles with  │
│  Userscripts    │  │  Userscripts    │  │  Userscripts    │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │ WebSocket (wss://)
                              ▼
                    ┌─────────────────────┐
                    │  Central Server     │
                    │  - WebSocket Hub    │
                    │  - REST API         │
                    │  - Dashboard UI     │
                    │  ~100-150MB RAM     │
                    └─────────────────────┘
```

## Components to Build

### 1. Central Server (Node.js)

**Location:** `/server/`

**Tech Stack:**
- Node.js with Express
- `ws` library for WebSocket
- SQLite for data persistence (optional, can start with in-memory)
- Serve static dashboard files

**Responsibilities:**
- Accept WebSocket connections from userscripts
- Authenticate connections via API key
- Store latest state from all accounts
- Route commands from dashboard to specific userscripts
- Serve dashboard UI
- REST API for dashboard to fetch data and send commands

**Server Structure:**
```
/server/
├── index.js              # Entry point
├── websocket.js          # WebSocket connection handler
├── routes/
│   ├── api.js            # REST endpoints for dashboard
│   └── commands.js       # Command routing logic
├── state/
│   └── accounts.js       # In-memory state management
├── utils/
│   └── logger.js         # Logging utility
├── public/               # Dashboard static files
│   ├── index.html
│   ├── css/
│   └── js/
└── package.json
```

**WebSocket Message Protocol:**

Messages are JSON with a `type` field.

**Incoming (Userscript → Server):**

```javascript
// On connection - register the account
{
  "type": "register",
  "apiKey": "your-secret-key",
  "accountId": "player123",
  "world": "en115",
  "villageId": 12345,
  "villageName": "Village Name",
  "coords": "500|400",
  "playerName": "PlayerName"
}

// Periodic data report (~60 seconds, with random jitter)
{
  "type": "report",
  "timestamp": 1701234567890,
  "accountId": "player123",
  "villageId": 12345,
  "data": {
    "resources": {
      "wood": 15000,
      "clay": 12000,
      "iron": 8000,
      "storage": 400000,
      "population": { "used": 240, "max": 300 }
    },
    "buildings": {
      "main": 20,
      "barracks": 21,
      "stable": 15,
      "workshop": 5,
      "church": 1,
      "snob": 1,
      "smith": 20,
      "place": 1,
      "market": 20,
      "wood": 30,
      "stone": 30,
      "iron": 30,
      "farm": 30,
      "storage": 30,
      "wall": 20
    },
    "troops": {
      "spear": 500,
      "sword": 200,
      "axe": 1000,
      "archer": 0,
      "spy": 50,
      "light": 300,
      "marcher": 0,
      "heavy": 100,
      "ram": 50,
      "catapult": 20,
      "knight": 1,
      "snob": 3
    },
    "incomings": [
      {
        "id": "command_123",
        "arrivalTime": 1701234600000,
        "originCoords": "501|401",
        "originVillage": "Enemy Village",
        "type": "attack",
        "size": "large"
      }
    ],
    "outgoings": [
      {
        "id": "command_456",
        "arrivalTime": 1701234700000,
        "targetCoords": "502|402",
        "type": "attack",
        "returning": false
      }
    ],
    "buildingQueue": [
      {
        "building": "barracks",
        "level": 22,
        "completesAt": 1701240000000
      }
    ],
    "recruitmentQueue": {
      "barracks": {
        "unit": "axe",
        "amount": 50,
        "completesAt": 1701238000000
      },
      "stable": {
        "unit": "light",
        "amount": 20,
        "completesAt": 1701239000000
      }
    }
  }
}

// Command execution result
{
  "type": "commandResult",
  "actionId": "cmd_abc123",
  "success": true,
  "message": "Attack sent successfully",
  "details": {
    "arrivalTime": 1701235000000
  }
}

// Error report
{
  "type": "error",
  "actionId": "cmd_abc123",
  "error": "Not enough troops",
  "context": "sendTroops"
}

// Pong response
{
  "type": "pong",
  "timestamp": 1701234567890
}
```

**Outgoing (Server → Userscript):**

```javascript
// Send troops command
{
  "type": "sendTroops",
  "actionId": "cmd_abc123",
  "targetCoords": "502|402",
  "troops": {
    "axe": 100,
    "light": 50
  },
  "sendType": "attack",
  "executeAt": null  // null = immediately, or timestamp for timed send
}

// Build building command
{
  "type": "buildBuilding",
  "actionId": "cmd_def456",
  "building": "barracks",  // building identifier
  "levels": 1              // how many levels to queue (usually 1)
}

// Recruit troops command
{
  "type": "recruitTroops",
  "actionId": "cmd_ghi789",
  "building": "barracks",  // barracks, stable, workshop, or snob
  "units": {
    "axe": 100,
    "light": 50
  }
}

// Request immediate data refresh
{
  "type": "requestRefresh"
}

// Ping to check connection
{
  "type": "ping"
}

// Acknowledge registration
{
  "type": "registered",
  "sessionId": "sess_xyz789"
}
```

**REST API Endpoints:**

```
GET  /api/accounts              # List all connected accounts with latest data
GET  /api/accounts/:id          # Get specific account details
GET  /api/accounts/:id/villages # Get all villages for account (future)
POST /api/commands/send-troops  # Queue a send troops command
POST /api/commands/build        # Queue a build command
POST /api/commands/recruit      # Queue a recruit command
GET  /api/alerts                # Get all incoming attacks across accounts
GET  /api/status                # Server health + connection count
```

---

### 2. Userscript (Tampermonkey)

**Location:** `/userscript/tw-agent.user.js`

**Tech Stack:**
- Vanilla JavaScript
- Tampermonkey GM_* APIs
- Native WebSocket

**Responsibilities:**
- Connect to central server via WebSocket
- Scrape game data from DOM (no extra HTTP requests to TW)
- Report data periodically (~60 sec with ±10 sec random jitter)
- Execute commands received from server
- Handle reconnection on disconnect

**Userscript Structure:**
```javascript
// ==UserScript==
// @name         TW Controller Agent
// @namespace    tw-controller
// @version      1.0.0
// @description  Tribal Wars account control agent
// @match        https://*.tribalwars.*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      your-server-domain.com
// ==/UserScript==

(function() {
  'use strict';
  
  // ============ CONFIGURATION ============
  const CONFIG = {
    serverUrl: 'wss://your-server:3000',
    apiKey: 'your-secret-key',
    reportInterval: 60000,      // Base interval: 60 seconds
    reportJitter: 10000,        // Random jitter: ±10 seconds
    reconnectDelay: 5000,       // Reconnect after 5 seconds
    maxReconnectDelay: 60000    // Max reconnect delay: 60 seconds
  };

  // ============ STATE ============
  let ws = null;
  let sessionId = null;
  let reconnectAttempts = 0;
  let reportTimer = null;

  // ============ CONNECTION LAYER ============
  // - connect()
  // - disconnect()
  // - reconnect()
  // - send(type, data)
  // - onMessage(handler)

  // ============ SCRAPERS ============
  // All scrapers read from DOM only, no HTTP requests
  
  // scrapeAccountInfo() - player name, world, etc.
  // scrapeVillageInfo() - current village id, name, coords
  // scrapeResources() - wood, clay, iron, storage, population
  // scrapeTroops() - troops in current village
  // scrapeIncomings() - incoming attacks/support
  // scrapeOutgoings() - outgoing commands
  // scrapeBuildingLevels() - current building levels
  // scrapeBuildingQueue() - buildings being constructed
  // scrapeRecruitmentQueue() - troops being trained
  // scrapeAll() - combines all above

  // ============ EXECUTORS ============
  // All executors interact with DOM to perform actions
  
  // sendTroops(targetCoords, troops, sendType, executeAt)
  //   - Navigate to rally point if needed
  //   - Fill form with target and troops
  //   - Handle confirmation page
  //   - For timed sends, wait until executeAt timestamp
  
  // buildBuilding(building, levels)
  //   - Navigate to HQ (main building) if needed
  //   - Find the building row
  //   - Click upgrade button
  //   - Return queue position and completion time
  
  // recruitTroops(building, units)
  //   - Navigate to correct building (barracks/stable/workshop)
  //   - Fill in unit amounts
  //   - Click recruit button
  //   - Return queue info and completion time
  
  // ============ COMMAND HANDLERS ============
  // handleCommand(command) - routes to appropriate executor

  // ============ MAIN LOOP ============
  // - On page load: connect, scrape, report
  // - Every ~60sec: scrape, report
  // - On command: execute, report result

})();
```

**Scraper Implementation Notes:**

Resource selectors (may vary by TW version/world):
```javascript
// Resources are typically in the header
wood: #wood
clay: #stone  
iron: #iron
storage: #storage (parse from tooltip or warehouse page)
population: #pop_current_label / #pop_max_label
```

Troop selectors:
```javascript
// On overview screen or rally point
// Look for unit icons with counts
// Class names like: unit-item-spear, unit-item-axe, etc.
// Or table rows in rally point with unit images
```

Incomings:
```javascript
// Incomings table: #incomings_table or .commands-container
// Each row has arrival time, origin, attack/support icon
// Parse countdown timer for arrival time
```

**Executor Implementation Notes:**

Send troops flow:
1. Check if on rally point page, if not navigate there
2. Wait for page load
3. Fill target coordinates input
4. Fill troop count inputs
5. Click "Attack" or "Support" button
6. Wait for confirmation page
7. Click confirm button
8. Parse result (success/failure, arrival time)
9. Report back to server

For timed/precise sends:
```javascript
async function sendTroopsAtTime(targetCoords, troops, sendType, executeAt) {
  // Prepare everything first
  await navigateToRallyPoint();
  await fillTroopForm(targetCoords, troops, sendType);
  
  // Wait until exact time to click confirm
  const now = Date.now();
  const delay = executeAt - now - 50; // 50ms buffer for execution
  
  if (delay > 0) {
    await sleep(delay);
  }
  
  // Click at precise moment
  await clickConfirm();
}
```

**Build Building Flow:**
```javascript
async function buildBuilding(building, levels = 1) {
  // 1. Navigate to HQ (main) if not there
  if (!isOnPage('main')) {
    await navigateTo('main');
    await waitForPageLoad();
  }
  
  // 2. Find building row in the build table
  const buildRow = findBuildingRow(building);
  
  // 3. Check if buildable (enough resources, requirements met)
  if (!isBuildable(buildRow)) {
    return { success: false, error: 'Cannot build - check resources/requirements' };
  }
  
  // 4. Click the upgrade link/button
  const upgradeBtn = buildRow.querySelector('.btn-build, a[class*="build"]');
  await humanizedClick(upgradeBtn);
  
  // 5. Parse result - new queue entry
  await waitForPageLoad();
  const queue = scrapeBuildingQueue();
  
  return { 
    success: true, 
    building: building,
    newLevel: queue[queue.length - 1].level,
    completesAt: queue[queue.length - 1].completesAt
  };
}
```

**Recruit Troops Flow:**
```javascript
async function recruitTroops(building, units) {
  // 1. Navigate to correct building
  // building: 'barracks' | 'stable' | 'workshop' | 'snob'
  if (!isOnPage(building)) {
    await navigateTo(building);
    await waitForPageLoad();
  }
  
  // 2. Fill in unit amounts
  for (const [unit, amount] of Object.entries(units)) {
    const input = document.querySelector(`input[name="${unit}"]`);
    if (input) {
      input.value = amount;
      // Trigger input event for any JS listeners
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await randomDelay(50, 150);
    }
  }
  
  // 3. Click recruit button
  const recruitBtn = document.querySelector('.btn-recruit, input[type="submit"]');
  await humanizedClick(recruitBtn);
  
  // 4. Parse result
  await waitForPageLoad();
  const queue = scrapeRecruitmentQueue();
  
  return {
    success: true,
    building: building,
    units: units,
    queue: queue[building]
  };
}
```

---

### 3. Dashboard (Web UI)

**Location:** `/server/public/`

**Tech Stack:**
- Vanilla HTML/CSS/JavaScript (keep it simple)
- Or lightweight framework if preferred (Alpine.js, Vue via CDN)
- WebSocket client to receive real-time updates

**Features:**

**Main Overview:**
- Grid/table showing all connected accounts
- Per account: name, world, village, resources summary, troop count, status
- Connection status indicator (green/red dot)
- Last update timestamp

**Alerts Panel:**
- List of all incoming attacks across all accounts
- Sorted by arrival time (soonest first)
- Click to expand details
- Audio/visual notification for new incomings

**Account Detail View:**
- Click account to see full details
- All resources with bars
- All troop counts
- Incoming/outgoing commands list

**Command Panel:**
- Dropdown to select source account
- Input for target coordinates
- Troop selector (input per unit type)
- Attack/Support toggle
- Optional: scheduled time input for precise sends
- Send button

**Building Panel:**
- Select account
- Show current building levels
- Show build queue with completion times
- Dropdown to select building to upgrade
- Build button

**Recruitment Panel:**
- Select account
- Select building (barracks/stable/workshop)
- Show current queue with completion times
- Unit inputs with max buttons
- Recruit button

**Layout Suggestion:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TW Controller                                            [Status: 28/30]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐ ┌───────────────────────────────────────────┐ │
│ │      ACCOUNTS             │ │              ALERTS                       │ │
│ │                           │ │                                           │ │
│ │  ● ACC-1  [500|400]       │ │  ⚔ Attack in 05:32                       │ │
│ │    W:15k C:12k I:8k       │ │    → ACC-3 from 501|401                  │ │
│ │    Troops: 2,450          │ │                                           │ │
│ │    Queue: Barracks 22     │ │  ⚔ Attack in 12:15                       │ │
│ │                           │ │    → ACC-7 from 499|399                  │ │
│ │  ● ACC-2  [501|401]       │ │                                           │ │
│ │    W:22k C:18k I:14k      │ │                                           │ │
│ │    Troops: 3,200          │ │                                           │ │
│ │    Queue: Axe x50 (02:15) │ │                                           │ │
│ │                           │ │                                           │ │
│ │  ○ ACC-3  [disconnected]  │ │                                           │ │
│ │                           │ │                                           │ │
│ └───────────────────────────┘ └───────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                              COMMANDS                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  [TROOPS]  [BUILD]  [RECRUIT]                                           │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │                                                                         │ │
│ │  TROOPS TAB:                                                            │ │
│ │  From: [ACC-1 ▼]  To: [_____|_____]  Type: [Attack ▼]  Time: [now ▼]   │ │
│ │  Spear[____] Sword[____] Axe[____] Light[____] Heavy[____] Ram[____]   │ │
│ │                                                              [SEND]     │ │
│ │                                                                         │ │
│ │  BUILD TAB:                                                             │ │
│ │  Account: [ACC-1 ▼]  Building: [Barracks ▼]  Current: Lv.21            │ │
│ │  Cost: W:5000 C:4500 I:3200  Time: 01:45:00              [BUILD]       │ │
│ │                                                                         │ │
│ │  RECRUIT TAB:                                                           │ │
│ │  Account: [ACC-1 ▼]  Building: [Barracks ▼]                            │ │
│ │  Axe[____][MAX] Lcav[____][MAX] Hcav[____][MAX]          [RECRUIT]     │ │
│ │  Queue: 50 Axe completing in 02:15                                      │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

### Phase 1: Foundation
1. Server: Basic Express + WebSocket server
2. Server: Account registration and state storage
3. Userscript: WebSocket connection + registration
4. Userscript: Basic resource scraper
5. Dashboard: Simple account list showing connected accounts

### Phase 2: Data Flow
1. Userscript: Full scraper (resources, troops, incomings)
2. Userscript: Periodic reporting with jitter
3. Server: Store and serve account data via REST
4. Dashboard: Display full account data
5. Dashboard: Real-time updates via WebSocket

### Phase 3: Commands
1. Server: Command routing to userscripts
2. Userscript: sendTroops executor
3. Userscript: buildBuilding executor
4. Userscript: recruitTroops executor
5. Dashboard: Command panel UI (troops)
6. Dashboard: Building panel UI
7. Dashboard: Recruitment panel UI
8. End-to-end test: all command types

### Phase 4: Polish
1. Dashboard: Alerts panel with notifications
2. Userscript: Reconnection handling
3. Server: Logging and error handling
4. Timed/precise sends for coordinated attacks

---

## Security Considerations

- API key authentication for userscript connections
- Server should only be accessible from known VPS IPs (firewall)
- Use WSS (WebSocket Secure) in production
- Never log sensitive data

## Anti-Detection Practices

- Random jitter on all timings (±10-20%)
- Don't execute actions on multiple accounts simultaneously
- Scrape DOM only, no extra HTTP requests to TW servers
- Add human-like delays between form fills and clicks
- Randomize action order when doing bulk operations

---

## File Structure

```
/tw-controller/
├── PROJECT_BRIEF.md          # This file
├── server/
│   ├── package.json
│   ├── index.js
│   ├── websocket.js
│   ├── routes/
│   │   ├── api.js
│   │   └── commands.js
│   ├── state/
│   │   └── accounts.js
│   ├── utils/
│   │   └── logger.js
│   └── public/
│       ├── index.html
│       ├── css/
│       │   └── styles.css
│       └── js/
│           ├── app.js
│           ├── websocket.js
│           └── commands.js
└── userscript/
    └── tw-agent.user.js
```

---

## Notes for Development

- Start with hardcoded config, make it configurable later
- Test with 1-2 accounts first before scaling to 30
- The game page DOM structure may vary between TW versions/markets
- Userscript may need adjustments per TW server (en, de, pl, etc.)
- Consider storing account-specific selector overrides in config

---

## Questions to Resolve During Development

1. Exact DOM selectors for the target TW server/world
2. Multi-village support (future feature)
3. Database persistence vs in-memory only
4. HTTPS/WSS certificate setup for production