# TW Controller - Developer Handoff Document

> **Welcome!** This document contains everything you need to continue development on the TW Controller project.
> Read this ENTIRE document before making any changes.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Communication Flow](#communication-flow)
6. [Dashboard Layout & Features](#dashboard-layout--features)
7. [Development Workflow](#development-workflow)
8. [Code Patterns & Conventions](#code-patterns--conventions)
9. [Styling Guide](#styling-guide)
10. [Existing Documentation](#existing-documentation)
11. [Deployment Guide](#deployment-guide)
12. [Common Issues & Solutions](#common-issues--solutions)

---

## Project Overview

### What is TW Controller?

TW Controller is a **multi-account management system** for the browser game **Tribal Wars** (specifically the Hungarian version: klanhaboru.hu). It allows players to:

- Monitor multiple game accounts from a single dashboard
- See real-time resources, troops, buildings, incoming attacks
- Execute commands (build, recruit, attack, support) remotely
- Run automated farming across multiple accounts

### How It Works (High Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Game Tabs)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Account 1   │  │ Account 2   │  │ Account 3   │  ... (30 tabs)  │
│  │ Userscript  │  │ Userscript  │  │ Userscript  │                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
└─────────┼────────────────┼────────────────┼────────────────────────┘
          │                │                │
          │ WebSocket (WSS)│                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NODE.JS SERVER (Linode VPS)                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Express + WebSocket Server (HTTPS/WSS on port 3000)         │   │
│  │ - Receives data reports from userscripts                     │   │
│  │ - Stores account state in memory                             │   │
│  │ - Sends commands to userscripts                              │   │
│  │ - Serves dashboard static files                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │
          │ REST API + WebSocket
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DASHBOARD (Browser UI)                         │
│  - TW-themed interface                                              │
│  - Account cards grid                                               │
│  - Detail panel sidebar                                             │
│  - Feature navigation boxes                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Userscript** | `userscript/tw-agent.user.js` | Runs in game tabs via Tampermonkey, scrapes data, executes commands |
| **Server** | `server/` (local) → `/root/tw-controller/` (production) | Node.js backend, WebSocket hub, REST API |
| **Dashboard** | `server/public/` | Browser UI for monitoring and control |

---

## System Architecture

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TIER 1: USERSCRIPT                        │
│                                                                   │
│  Tampermonkey script running in each game browser tab            │
│                                                                   │
│  Responsibilities:                                                │
│  • Scrape game data (resources, troops, buildings, commands)     │
│  • Send periodic reports to server (every 30-60 seconds)         │
│  • Execute commands received from server (build, recruit, etc.)  │
│  • Intercept game's WebSocket for real-time events               │
│  • Handle tab coordination (master/slave system)                 │
│                                                                   │
│  Key Functions:                                                   │
│  • scrapeResources(), scrapeTroops(), scrapeBuildings()          │
│  • scrapeIncomings() - returns { attacks, supports }             │
│  • scrapeBuildingPageData() - detailed building info             │
│  • handleBuild(), handleRecruit(), handleSendTroops()            │
│  • handleNavigate(), handleOpenTab()                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (WSS)
                              │ wss://YOUR_SERVER:3000/ws
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        TIER 2: SERVER                            │
│                                                                   │
│  Node.js + Express + WebSocket Server (HTTPS)                    │
│                                                                   │
│  Responsibilities:                                                │
│  • Authenticate userscript connections (API key)                 │
│  • Store account state in memory (Map structure)                 │
│  • Route commands from dashboard to userscripts                  │
│  • Broadcast updates to dashboard clients                        │
│  • Serve static dashboard files                                  │
│                                                                   │
│  Key Files:                                                       │
│  • websocket.js - Message routing, command handlers              │
│  • state/accounts.js - Account state management                  │
│  • routes/api.js - REST API endpoints                            │
│  • services/farmBot.js - Farm automation                         │
│  • services/bulkFarmService.js - Multi-account farming           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TIER 3: DASHBOARD                          │
│                                                                   │
│  Single-page web application (vanilla JS, no framework)          │
│                                                                   │
│  Responsibilities:                                                │
│  • Display account cards with real-time data                     │
│  • Show detailed account info in sliding panel                   │
│  • Provide UI for commands (modals for build/attack/recruit)     │
│  • Feature navigation (bulk features, per-account features)      │
│                                                                   │
│  Key Files:                                                       │
│  • public/index.html - Main HTML structure                       │
│  • public/js/app.js - Main app, WebSocket client                 │
│  • public/js/components/*.js - UI components                     │
│  • public/css/*.css - TW-themed styling                          │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Tab Coordination (Master/Slave System)

When a user has multiple game tabs open for the same account:

```
Account: hu97_PlayerName
├── Tab 1 (MASTER) ← Commands go here, periodic reports sent
├── Tab 2 (SLAVE)  ← Standby, promoted if master disconnects
└── Tab 3 (SLAVE)  ← Standby
```

- **Master tab**: Executes commands, sends reports
- **Slave tabs**: Wait in standby, auto-promoted if master disconnects
- **wasMaster flag**: When navigating pages, tab reclaims master status

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Runtime** | Node.js | 20.x |
| **Web Framework** | Express | 5.x |
| **WebSocket** | ws | 8.x |
| **Process Manager** | PM2 | Latest |
| **HTTPS** | Self-signed certs | - |
| **Frontend** | Vanilla JS | ES6+ |
| **Userscript** | Tampermonkey | 5.x |
| **Styling** | CSS3 | Custom TW theme |

### No Build Process

The dashboard uses **vanilla JavaScript** with no build tools (no Webpack, no React, no TypeScript). Files are served directly by Express. This keeps deployment simple.

---

## Project Structure

### Local Development Structure (Windows)

```
d:\TW\Multy\
├── CLAUDE.md                 ← Claude's memory file (READ FIRST!)
├── DEVLOG.md                 ← Development history log
├── HANDOFF.md                ← This file
├── BUILDING_TAB_DEV.md       ← Building feature documentation
├── FARMBOT_DEV.md            ← Farm bot feature documentation
├── BULK_FARM_PLAN.md         ← Bulk farm planning
├── PROJECT_BRIEF.md          ← Project overview
│
├── server/                   ← SERVER CODE (deploy to production)
│   ├── index.js              ← Express server entry (LOCAL ONLY)
│   ├── websocket.js          ← WebSocket handlers
│   ├── routes/
│   │   ├── api.js            ← REST API endpoints
│   │   ├── farm.js           ← Farm bot endpoints
│   │   ├── bulkFarm.js       ← Bulk farm endpoints
│   │   └── debug.js          ← Debug log endpoints
│   ├── services/
│   │   ├── farmBot.js        ← Farm automation service
│   │   ├── bulkFarmService.js← Multi-account farming
│   │   └── debugLog.js       ← Debug log storage
│   ├── state/
│   │   ├── accounts.js       ← Account state (Map)
│   │   └── commandQueue.js   ← Command queue
│   ├── utils/
│   │   └── logger.js         ← Logging utility
│   └── public/               ← DASHBOARD FILES
│       ├── index.html        ← Main HTML
│       ├── js/
│       │   ├── app.js        ← Main app logic
│       │   └── components/
│       │       ├── Component.js      ← Base component class
│       │       ├── AccountCard.js    ← Account cards
│       │       ├── DetailPanel.js    ← Detail sidebar (LARGEST FILE)
│       │       ├── Modal.js          ← Modal base
│       │       ├── BuildModal.js     ← Build dialog
│       │       ├── AttackModal.js    ← Attack/support dialog
│       │       ├── RecruitModal.js   ← Recruitment dialog
│       │       ├── BulkFarmTab.js    ← Bulk farm UI
│       │       └── DebugTab.js       ← Debug log viewer
│       └── css/
│           ├── variables.css         ← CSS variables, TW colors
│           ├── tw-theme.css          ← Base TW styling
│           ├── components.css        ← Reusable components
│           ├── cards.css             ← Account cards + detail panel
│           ├── farm.css              ← Farm bot styling
│           ├── bulk-farm.css         ← Bulk farm styling
│           ├── building.css          ← Building section styling
│           └── debug.css             ← Debug tab styling
│
└── userscript/
    └── tw-agent.user.js      ← TAMPERMONKEY USERSCRIPT
```

### Production Server Structure (Linux)

**IMPORTANT: Production has DIFFERENT structure!**

```
/root/tw-controller/          ← PM2 runs from HERE
├── index.js                  ← Server entry point
├── websocket.js
├── cert.pem                  ← SSL certificate
├── key.pem                   ← SSL private key
├── routes/
├── services/
├── state/
├── utils/
└── public/                   ← Dashboard files served from HERE
    ├── index.html
    ├── js/
    └── css/
```

### Deployment Path Mapping

| Local Path | Production Path |
|------------|-----------------|
| `server/public/*` | `/root/tw-controller/public/` |
| `server/routes/*` | `/root/tw-controller/routes/` |
| `server/services/*` | `/root/tw-controller/services/` |
| `server/state/*` | `/root/tw-controller/state/` |
| `server/websocket.js` | `/root/tw-controller/websocket.js` |
| `server/index.js` | **NOT USED** - production has its own |

**NEVER deploy to `/root/tw-controller/server/public/`** - that's wrong!

---

## Communication Flow

### Data Flow: Userscript → Server → Dashboard

```
1. USERSCRIPT scrapes game data
   └─► { resources, troops, buildings, incomings, ... }

2. USERSCRIPT sends "report" message via WebSocket
   └─► { type: "report", accountId: "hu97_Player", data: {...} }

3. SERVER receives in websocket.js handleReport()
   └─► accountState.updateData(accountId, data)

4. SERVER broadcasts "accountUpdate" to dashboards
   └─► { type: "accountUpdate", account: {...} }

5. DASHBOARD receives, updates AccountCard + DetailPanel
```

### Command Flow: Dashboard → Server → Userscript

```
1. USER clicks button in Dashboard (e.g., "Build")
   └─► DetailPanel.handleBuildClick()

2. DASHBOARD sends POST to REST API
   └─► POST /api/commands/build { accountId, building, level }

3. SERVER routes/api.js receives request
   └─► accountState.sendToAccount(accountId, { type: "build", ... })

4. USERSCRIPT receives command via WebSocket
   └─► handleBuild() executes in game page

5. USERSCRIPT sends result back
   └─► { type: "commandResult", success: true/false }
```

### WebSocket Message Types

#### From Userscript to Server:
```javascript
{ type: "register", accountId, world, villageId, apiKey }  // Initial connection
{ type: "report", accountId, data: {...} }                  // Periodic data report
{ type: "troopReport", accountId, troops, recruitInfo }     // Troops tab data
{ type: "buildingReport", accountId, buildings, queue }     // Building tab data
{ type: "commandResult", actionId, success, message }       // Command result
{ type: "farmProgress", actionId, current, total }          // Farm progress
{ type: "farmComplete", actionId, farmed, duration }        // Farm finished
{ type: "farmError", actionId, error }                      // Farm error
```

#### From Server to Userscript:
```javascript
{ type: "registered", sessionId, isMaster }                 // Registration confirmed
{ type: "build", building, level, actionId }                // Build command
{ type: "recruitTroops", building, units, actionId }        // Recruit command
{ type: "sendTroops", coords, units, isSupport, actionId }  // Attack/support
{ type: "navigate", screen }                                // Navigate to page
{ type: "openTab", tabType }                                // Open new tab
{ type: "startFarm", template, actionId }                   // Start farming
{ type: "stopFarm" }                                        // Stop farming
{ type: "masterStatusChanged", isMaster, reason }           // Master/slave change
```

---

## Dashboard Layout & Features

### Feature Navigation System

The dashboard has a **feature navigation bar** at the top with clickable boxes:

```
┌────────────────────────────────────────────────────────────────────┐
│  TW Vezérlő - Központi Panel                    ✓ Csatlakozva  7 │
├────────┬────────┬────────┬────────┬────────┬────────┬────────┬────┤
│ Fiókok │  Bulk  │   P1   │   P1   │   P1   │   P1   │   P2   │Debug│
│        │  Farm  │ empty  │ empty  │ empty  │ empty  │ empty  │    │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┴────┘
         ▲                                            ▲
         │                                            │
    BULK FEATURES (P1)                        PER-VILLAGE (P2)
    - Affect multiple accounts                - Affect single account
    - Bulk Farm, Bulk Build, etc.            - Statistics, Notes
```

### Feature Box Categories

| Priority | Box Position | Type | Description |
|----------|--------------|------|-------------|
| **P1** | Boxes 2-6 | **BULK FEATURES** | Operations across multiple accounts simultaneously |
| **P2** | Boxes 7-9 | **PER-VILLAGE FEATURES** | Operations for individual villages |

### P1 - Bulk Features (Multi-Account)

These features operate on **multiple selected accounts at once**:

- **Bulk Farm** (implemented) - Start farming on multiple accounts
- **Bulk Build** (planned) - Queue buildings on multiple accounts
- **Bulk Recruit** (planned) - Queue troops on multiple accounts
- **Bulk Attack** (planned) - Send attacks from multiple accounts
- **Bulk Support** (planned) - Send support from multiple accounts

### P2 - Per-Village Features (Single Account)

These features operate on **individual villages** (accessed via detail panel):

- **Statistics** (planned) - Village statistics and history
- **Notes** (planned) - Per-village notes

### Account Cards

Each connected account shows as a card:

```
┌─────────────────────────────────────┐
│ hu97_PlayerName              ☆  ●  │  ← Header: name, favorite, status
├─────────────────────────────────────┤
│ 🏰 Village Name                     │
│ 📍 525|515 | hu97                   │
├─────────────────────────────────────┤
│ 🪵 1,287  ████████░░               │  ← Resources with bars
│ 🧱 2,702  ████████████░            │
│ ⚙️ 2,970  ██████████░░░            │
│ 👥 1,363  ████████░░░░             │
├─────────────────────────────────────┤
│ ⚔️ Bejövő:                     [0] │  ← Incoming attacks (green=0, red=N)
├─────────────────────────────────────┤
│                   Frissítve: 2mp    │  ← Last update time
└─────────────────────────────────────┘
```

### Detail Panel (Sidebar)

Clicking a card opens the **detail panel** on the right:

```
┌─────────────────────────────────────────────────────────────────┐
│ hu97_PlayerName - Village Name                              ✕   │
├─────────┬───────────┬───────────────────────────────────────────┤
│ Actions │ Navigation│                                           │
│ ┌─────┐ │ ┌───────┐ │  Falu Információk                        │
│ │Építés│ │ │Áttekin│ │  Név: Village Name                       │
│ └─────┘ │ │  tés  │ │  Koordináták: 525|515                     │
│ ┌─────┐ │ └───────┘ │  ...                                      │
│ │Támad│ │ ┌───────┐ │                                           │
│ │  ás │ │ │Főépül │ │  Nyersanyagok                             │
│ └─────┘ │ │  et   │ │  🪵 Fa: 773 / 7,893  (+450/h)            │
│ ┌─────┐ │ └───────┘ │  ...                                      │
│ │Támog│ │ ┌───────┐ │                                           │
│ │ atás│ │ │Kaszár │ │  Bejövő Támadások                         │
│ └─────┘ │ │  nya  │ │  ⚔️ Bejövő támadások: [0]                │
│ ┌─────┐ │ └───────┘ │                                           │
│ │Tobor│ │ ...       │  ▼ 🎖️ Csapatok (Összesen: 1,234)         │
│ │ zás │ │           │    [Collapsible troop sections...]        │
│ └─────┘ │           │                                           │
│ ┌─────┐ │           │  ▼ 🏛️ Épületek                            │
│ │Farm │ │           │    [Building grid with levels...]         │
│ └─────┘ │           │                                           │
└─────────┴───────────┴───────────────────────────────────────────┘
  80px       80px              Scrollable content area
```

---

## Development Workflow

### Adding a New Feature (Step-by-Step)

#### 1. Plan the Feature

Create a `{FEATURE}_DEV.md` file with:
- Architecture decisions
- Checklist of implementation steps
- Data structures
- UI mockups (ASCII art is fine)

#### 2. Implement Userscript Changes (if needed)

Location: `userscript/tw-agent.user.js`

```javascript
// Add scraping function
function scrapeNewFeatureData() {
  // Extract from DOM
  return { ... };
}

// Add to periodic report
function sendReport() {
  const report = {
    ...existingData,
    newFeature: scrapeNewFeatureData()  // Add here
  };
  ws.send(JSON.stringify({ type: 'report', data: report }));
}

// Add command handler
function handleNewFeatureCommand(message) {
  const { param1, param2, actionId } = message;
  // Execute in game
  sendCommandResult(actionId, true, 'Success');
}

// Register in message switch
case 'newFeatureCommand':
  handleNewFeatureCommand(message);
  break;
```

#### 3. Implement Server Changes

Location: `server/websocket.js`

```javascript
// Add message handler in switch statement
case 'newFeatureReport':
  handleNewFeatureReport(ws, message, context);
  break;

// Add handler function
function handleNewFeatureReport(ws, message, context) {
  const { accountId, data } = message;
  const account = accountState.get(accountId);
  if (account) {
    account.data.newFeature = data;
    broadcastToDashboards('newFeatureUpdate', { accountId, data });
  }
}
```

#### 4. Implement Dashboard UI

**For P1 (Bulk Feature):**

Create new tab component: `server/public/js/components/NewFeatureTab.js`

```javascript
class NewFeatureTab extends Component {
  constructor(container) {
    super(container);
  }

  render() {
    this.container.innerHTML = '';
    // Build UI
  }
}
```

Add to `index.html`:
```html
<script src="/js/components/NewFeatureTab.js"></script>
```

Add feature box in `index.html`:
```html
<div class="feature-box" data-feature="new-feature">New Feature</div>
```

Add content container:
```html
<div id="feature-new-feature" class="feature-content">
  <div id="new-feature-tab-container"></div>
</div>
```

Initialize in `app.js`:
```javascript
const newFeatureTab = new NewFeatureTab(
  document.getElementById('new-feature-tab-container')
);
```

**For P2 (Per-Village Feature):**

Add section to `DetailPanel.js`:
```javascript
createNewFeatureSection(data) {
  const section = this.createElement('div', { className: 'detail-section' });
  // Build section UI
  return section;
}
```

Call in `render()`:
```javascript
if (account.data.newFeature) {
  body.appendChild(this.createNewFeatureSection(account.data.newFeature));
}
```

#### 5. Add Styling

Create CSS file if needed: `server/public/css/new-feature.css`

Add to `index.html`:
```html
<link rel="stylesheet" href="/css/new-feature.css?v=1001">
```

#### 6. Deploy and Test

```bash
# Deploy files
scp server/public/js/components/NewFeatureTab.js root@YOUR_SERVER:/root/tw-controller/public/js/components/

# Update cache version in index.html
# Deploy index.html

# If backend changes, restart PM2
ssh root@YOUR_SERVER "pm2 restart tw-controller"
```

### Deployment Commands

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Deploy single file
scp server/public/js/components/DetailPanel.js root@YOUR_SERVER:/root/tw-controller/public/js/components/

# Deploy CSS
scp server/public/css/cards.css root@YOUR_SERVER:/root/tw-controller/public/css/

# Deploy HTML
scp server/public/index.html root@YOUR_SERVER:/root/tw-controller/public/

# Deploy backend (requires PM2 restart)
scp server/websocket.js root@YOUR_SERVER:/root/tw-controller/
ssh root@YOUR_SERVER "pm2 restart tw-controller"

# Check deployment
ssh root@YOUR_SERVER "curl -sk 'https://localhost:3000/js/components/DetailPanel.js' | head -20"

# Check PM2 status
ssh root@YOUR_SERVER "pm2 status"

# View logs
ssh root@YOUR_SERVER "pm2 logs tw-controller --lines 50 --nostream"
```

### Cache Busting

**IMPORTANT**: Browsers cache JS/CSS files aggressively!

When updating frontend files:
1. Deploy the file
2. Update version in `index.html`:
   ```html
   <script src="/js/components/DetailPanel.js?v=1010"></script>
   ```
3. Deploy `index.html`
4. Tell user to hard refresh (Ctrl+Shift+R)

---

## Code Patterns & Conventions

### Component Pattern (Dashboard)

All UI components extend `Component` base class:

```javascript
class MyComponent extends Component {
  constructor(container) {
    super(container);
    // Initialize state
  }

  render() {
    this.container.innerHTML = '';
    // Build UI using createElement helper
  }

  // Use createElement helper (NOT document.createElement directly)
  createSomething() {
    const div = this.createElement('div', {
      className: 'my-class',
      onClick: () => this.handleClick()
    });

    const button = this.createElement('button', {
      className: 'btn',
      disabled: false
    }, 'Button Text');

    div.appendChild(button);
    return div;
  }
}
```

### WebSocket Message Pattern

```javascript
// Sending from userscript
ws.send(JSON.stringify({
  type: 'report',
  accountId: accountId,
  data: { ... }
}));

// Receiving on server
function handleMessage(ws, message, context, updateContext) {
  switch (message.type) {
    case 'report':
      handleReport(ws, message, context);
      break;
  }
}

// Broadcasting to dashboards
function broadcastToDashboards(type, data) {
  const message = JSON.stringify({ type, ...data });
  for (const client of wss.clients) {
    if (client.isDashboard) {
      client.send(message);
    }
  }
}
```

### REST API Pattern

```javascript
// routes/api.js
router.post('/commands/build', async (req, res) => {
  try {
    const { accountId, building, level } = req.body;

    // Validate
    if (!accountId || !building) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Send command
    const success = accountState.sendToAccount(accountId, {
      type: 'build',
      building,
      level,
      actionId: `build_${Date.now()}`
    });

    if (!success) {
      return res.status(404).json({ error: 'Account not connected' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Hungarian Language

The game uses Hungarian. Common terms:

| English | Hungarian |
|---------|-----------|
| Village | Falu |
| Resources | Nyersanyagok |
| Wood | Fa |
| Clay | Agyag |
| Iron | Vas |
| Population | Lakosság |
| Troops | Csapatok |
| Buildings | Épületek |
| Incoming | Bejövő |
| Attack | Támadás |
| Support | Támogatás |
| Recruit | Toborzás |
| Build | Építés |
| Accounts | Fiókok |
| Connected | Csatlakozva |

---

## Styling Guide

### TW Theme System

The dashboard uses a custom **Tribal Wars theme** that mimics the game's look:

#### CSS Variables (`variables.css`)

```css
:root {
  /* TW Colors */
  --tw-bg-light: #f5f0e1;
  --tw-bg-medium: #d4c4a0;
  --tw-bg-dark: #5d4330;
  --tw-bg-header: #c4a762;

  /* Borders */
  --tw-border-light: #d4c4a0;
  --tw-border-medium: #8b7355;
  --tw-border-dark: #5d4330;
  --tw-border-gold: #c4a762;

  /* Text */
  --tw-text-dark: #3d3428;
  --tw-text-light: #f5f0e1;
  --tw-text-header: #3d3428;

  /* Buttons */
  --tw-btn-green: #5d7e1e;
  --tw-btn-red: #8b0000;
}
```

#### Using TW Icons

Icons come from the game's CDN. Pattern:
```
https://dshu.innogamescdn.com/asset/{hash}/graphic/{type}/{name}.webp
```

Examples:
```javascript
// Unit icons
const spearIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/unit/unit_spear.webp';
const swordIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/unit/unit_sword.webp';

// Building icons
const mainIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/buildings/main.webp';
const barracksIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/buildings/barracks.webp';

// Resource icons
const woodIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/holz.webp';
const clayIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/lehm.webp';
const ironIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/eisen.webp';

// Attack icon
const attackIcon = 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/unit/att.webp';
```

#### TW Textures

Background textures:
```css
.element {
  background: url('https://dshu.innogamescdn.com/asset/2a2f957f/graphic/popup/content_background.png');
  background-repeat: repeat;
}

.header {
  background: url('https://dshu.innogamescdn.com/asset/2a2f957f/graphic/screen/tableheader_bg3.png');
  background-repeat: repeat-x;
}
```

#### Creating TW-Style Buttons

```css
.tw-button {
  background: linear-gradient(to bottom, #f5f0e1 0%, #d4c4a0 50%, #c4b490 100%);
  border: 1px solid #8b7355;
  border-radius: 4px;
  color: #3d3428;
  font-weight: 700;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 2px rgba(0, 0, 0, 0.2);
}

.tw-button:hover {
  background: linear-gradient(to bottom, #fffae8 0%, #e4d4b0 50%, #d4c4a0 100%);
}
```

#### Creating Collapsible Sections

```javascript
createCollapsibleSection(title, icon, content) {
  const section = this.createElement('div', { className: 'collapsible-section' });

  const header = this.createElement('div', {
    className: 'collapsible-header expanded',
    onClick: () => this.toggleSection(section)
  });

  const toggle = this.createElement('span', { className: 'collapsible-toggle' }, '▼');
  const titleEl = this.createElement('span', { className: 'collapsible-title' }, title);

  header.appendChild(toggle);
  if (icon) {
    const iconEl = this.createElement('img', {
      className: 'collapsible-header-icon',
      src: icon
    });
    header.appendChild(iconEl);
  }
  header.appendChild(titleEl);

  const contentEl = this.createElement('div', { className: 'collapsible-content' });
  contentEl.appendChild(content);

  section.appendChild(header);
  section.appendChild(contentEl);

  return section;
}
```

---

## Existing Documentation

### Documentation Files

| File | Purpose | When to Read |
|------|---------|--------------|
| `CLAUDE.md` | Claude's memory file | **EVERY SESSION** (auto-read) |
| `DEVLOG.md` | Development history | Check recent work |
| `HANDOFF.md` | This file | Initial onboarding |
| `BUILDING_TAB_DEV.md` | Building feature docs | Working on buildings |
| `FARMBOT_DEV.md` | Farm bot docs | Working on farming |
| `BULK_FARM_PLAN.md` | Bulk farm planning | Working on bulk farm |
| `PROJECT_BRIEF.md` | Project overview | Understanding goals |
| `QUICKBAR_STATUS_BRIEF.md` | Quickbar feature | Future reference |

### Key Reference in CLAUDE.md

- **Current Feature Status** table
- **Development Rules** (deployment paths, verification, cache busting)
- **Quick Reference** commands
- **Common Issues & Solutions**
- **Recent Session Notes**

---

## Deployment Guide

### Your Server Setup

You will need to set up your own server. Steps:

1. **Get a VPS** (Linode, DigitalOcean, etc.)
   - Ubuntu 22.04 LTS recommended
   - Smallest plan is fine (1GB RAM)

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

3. **Install PM2**
   ```bash
   sudo npm install -g pm2
   ```

4. **Upload project files**
   ```bash
   # From local machine
   scp -r server/* root@YOUR_SERVER:/root/tw-controller/
   ```

5. **Generate SSL certificates**
   ```bash
   cd /root/tw-controller
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

6. **Install dependencies**
   ```bash
   cd /root/tw-controller
   npm install
   ```

7. **Start with PM2**
   ```bash
   pm2 start index.js --name tw-controller
   pm2 save
   pm2 startup
   ```

8. **Update userscript**
   Change the WebSocket URL in `tw-agent.user.js`:
   ```javascript
   const WS_URL = 'wss://YOUR_SERVER_IP:3000/ws';
   ```

### Updating CLAUDE.md for Your Server

Update these sections in `CLAUDE.md`:

```markdown
### SSH to Server
ssh root@YOUR_SERVER_IP

### Deploy Dashboard Files
scp server/public/js/components/DetailPanel.js root@YOUR_SERVER_IP:/root/tw-controller/public/js/components/
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Changes not appearing | Wrong deploy path | Deploy to `/root/tw-controller/public/` NOT `/root/tw-controller/server/public/` |
| curl returns empty | Server uses HTTPS | Use `curl -sk https://...` not `curl http://...` |
| Browser shows old code | Caching | Update `?v=` in index.html AND hard refresh (Ctrl+Shift+R) |
| WebSocket not connecting | HTTPS/WSS mismatch | Server uses WSS (secure WebSocket), not WS |
| "Farm stalled" errors | FarmGod not loading | Check if game page has FarmGod script |
| Userscript not connecting | API key mismatch | Check `CONFIG.apiKey` in websocket.js matches userscript |
| Commands not executing | Not master tab | Only master tab executes commands |
| Incoming attacks flickering | DOM updates | Server has 3-minute memory in accounts.js |

### Debugging Commands

```bash
# Check PM2 status
ssh root@YOUR_SERVER "pm2 status"

# View logs (last 50 lines)
ssh root@YOUR_SERVER "pm2 logs tw-controller --lines 50 --nostream"

# Check what server is serving
ssh root@YOUR_SERVER "curl -sk 'https://localhost:3000/js/components/DetailPanel.js' | head -20"

# Find file on server
ssh root@YOUR_SERVER "find /root -name 'DetailPanel.js' 2>/dev/null"

# Restart server
ssh root@YOUR_SERVER "pm2 restart tw-controller"

# Check server memory usage
ssh root@YOUR_SERVER "pm2 monit"
```

---

## Final Checklist

Before starting development:

- [ ] Read this entire document
- [ ] Read `CLAUDE.md` (it's auto-read each session anyway)
- [ ] Set up your own development server
- [ ] Update `CLAUDE.md` with your server IP
- [ ] Update userscript with your server URL
- [ ] Test connection (userscript → server → dashboard)
- [ ] Understand the P1 (bulk) vs P2 (per-village) feature distinction
- [ ] Familiarize yourself with TW icon URLs and styling

### Golden Rules

1. **ALWAYS deploy to correct paths** - see mapping table above
2. **ALWAYS update cache versions** when changing frontend files
3. **ALWAYS restart PM2** after backend changes
4. **ALWAYS verify deployment** with curl before telling user it's done
5. **ALWAYS use TW icons** from game CDN
6. **ALWAYS maintain TW styling** - don't break the theme
7. **NEVER implement features without user approval**
8. **NEVER add "improvements" not requested**

---

**Good luck! The codebase is well-organized and documented. Follow the patterns and you'll do great!**
