# Building Tab Feature Development

## Overview

Create a **Building Tab** feature that mirrors the existing Troops Tab architecture. This dedicated browser tab monitors the main building page (`screen=main`), extracts building data from the DOM, and reports it to the dashboard for display and upgrade actions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GAME BROWSER TABS                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Master Tab  │  │ Building Tab│  │ Troops Tab  │         │
│  │ (actions)   │  │ (main bld)  │  │ (training)  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         │   WebSocket    │                │                 │
│         └───────┬────────┴────────────────┘                 │
│                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     SERVER                              ││
│  │  account.data.buildingDetails = {                       ││
│  │    buildings: { main: {level, canBuild, cost}, ... },   ││
│  │    buildQueue: [...],                                   ││
│  │    lastUpdate: timestamp                                ││
│  │  }                                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                 │                                           │
│                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              DASHBOARD (DetailPanel)                    ││
│  │  ▼ Épületek (Buildings)       [collapsible sections]    ││
│  │    - Building grid with levels                          ││
│  │    - Build queue with timers                            ││
│  │  ▼ Fejlesztés (Upgrade)                                 ││
│  │    - Dropdown to select building                        ││
│  │    - Cost display (wood/stone/iron/pop)                 ││
│  │    - Upgrade button                                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Reference Implementation: Troops Tab

Follow the existing Troops Tab pattern documented in `TROOPS_TAB_DEV.md`:
- `userscript/tw-agent.user.js` - Search for `isTroopsTab`, `isTrainingPage()`, `scrapeTrainingPageTroops()`, `sendTroopReport()`
- `server/websocket.js` - Search for `handleTroopReport`, `troopReport`
- `server/public/js/components/DetailPanel.js` - Search for `createTroopsSection`

---

## Implementation Checklist

### Phase 1: Userscript
- [x] Add `isBuildingTab` flag (like `isTroopsTab`)
- [x] Add `isMainBuildingPage()` function checking for `screen=main`
- [ ] Add "Épületek" navigation button to quickbar opening `screen=main` in new tab
- [x] Detect if on main building page → register as `tabType: 'building'`
- [x] Create `scrapeBuildingPageData()` to extract from DOM:
  - Buildings and levels from `BuildingMain.buildings` JS variable
  - Build queue from `#build_queue` table
  - Upgrade costs/requirements from building rows
  - Can-build status and resource forecasts
- [x] Create `sendBuildingReport()` function
- [x] Create `startBuildingReporting()` function (periodic every 30s)

### Phase 2: Server
- [x] Add `buildingReport` case in `handleMessage()` switch
- [x] Create `handleBuildingReport()` function
- [x] Store data in `account.data.buildingDetails`
- [x] Broadcast `buildingUpdate` to dashboards

### Phase 3: Dashboard
- [x] Update `createBuildingsSection()` in DetailPanel.js
- [x] Make section collapsible (like troops section)
- [x] Show building grid with levels and icons
- [x] Add build queue display with countdown timers
- [ ] Add dropdown to select building for upgrade
- [x] Show upgrade costs (wood/stone/iron), time, population
- [ ] Add "Upgrade" button (disabled if insufficient resources)
- [ ] Send upgrade command via WebSocket when clicked

### Phase 4: Auto-Open Missing Tabs
- [x] Create `handleOpenTab()` function in userscript
- [x] Handle `openTab` WebSocket message to open new tabs
- [x] Add `handleTabOpened()` server handler for confirmation
- [x] Add `openTabForAccount()` utility function in websocket.js
- [x] Add API endpoint `/api/commands/open-tab` to trigger tab opening

---

## Key Data Source: BuildingMain.buildings

The game page (`screen=main`) contains a JavaScript variable with all building data. Located in the DOM at `<script>` tag around line 641 of the page:

```javascript
BuildingMain.buildings = {
  "main": {
    "id": "main",
    "level": "20",
    "level_next": 21,
    "max_level": 30,
    "wood": 9155,
    "stone": 10311,
    "iron": 7120,
    "pop": 17,
    "build_time": 11482,
    "can_build": true,
    "error": "ma ekkor: 20:39 lesz elég nyersanyag",
    "forecast": { "available": "future", "when": 1765395593 },
    "name": "Főhadiszállás",
    "image": "buildings/main.png"
  },
  "barracks": {
    "id": "barracks",
    "level": "17",
    "level_next": 18,
    "max_level": 25,
    "wood": 10170,
    "stone": 11298,
    "iron": 4577,
    "pop": 15,
    "build_time": 13281,
    "can_build": true,
    "name": "Barakk"
  },
  // ... other buildings: stable, garage, smith, market, wood, stone, iron, farm, storage, hide, wall, etc.
}
```

### Build Queue Structure

Located in `#build_queue` table:
```html
<table id="build_queue">
  <tr class="buildorder_stone">
    <td>Agyagbánya<br/>25. szint</td>
    <td><span class="timer" data-endtime="1765401199"></span></td>
    <td>ma ekkor: 22:13:19</td>
    <td><a class="btn btn-cancel" href="...">Visszavonás</a></td>
  </tr>
</table>
```

---

## Data Structures

### buildingReport Message (Userscript → Server)

```javascript
{
  type: 'buildingReport',
  accountId: 'hu97_PlayerName',
  buildings: {
    main: { 
      level: 20, 
      maxLevel: 30, 
      canBuild: true, 
      wood: 9155, 
      stone: 10311, 
      iron: 7120, 
      pop: 17, 
      buildTime: 11482,
      error: null,
      forecast: null
    },
    barracks: { 
      level: 17, 
      maxLevel: 25, 
      canBuild: false, 
      wood: 10170, 
      stone: 11298, 
      iron: 4577, 
      pop: 15, 
      buildTime: 13281,
      error: "ma ekkor: 20:39 lesz elég nyersanyag",
      forecast: { available: "future", when: 1765395593 }
    },
    stable: { level: 12, maxLevel: 20, canBuild: true, ... },
    garage: { level: 6, maxLevel: 15, canBuild: true, ... },
    smith: { level: 13, maxLevel: 20, canBuild: true, ... },
    market: { level: 2, maxLevel: 25, canBuild: true, ... },
    wood: { level: 25, maxLevel: 30, canBuild: false, ... },
    stone: { level: 24, maxLevel: 30, canBuild: false, ... },
    iron: { level: 23, maxLevel: 30, canBuild: false, ... },
    farm: { level: 23, maxLevel: 30, canBuild: false, ... },
    storage: { level: 22, maxLevel: 30, canBuild: true, ... },
    hide: { level: 4, maxLevel: 10, canBuild: true, ... },
    wall: { level: 12, maxLevel: 20, canBuild: true, ... }
  },
  buildQueue: [
    { 
      building: 'stone', 
      targetLevel: 25, 
      finishTime: 1765401199,
      remaining: '3:11:22'
    },
    { 
      building: 'iron', 
      targetLevel: 24, 
      finishTime: 1765412954,
      remaining: '6:27:17'
    }
  ],
  queueSlots: {
    used: 2,
    max: 2
  }
}
```

### buildingDetails Storage (Server)

```javascript
account.data.buildingDetails = {
  buildings: { ... },
  buildQueue: [ ... ],
  queueSlots: { used: 2, max: 2 },
  lastUpdate: Date.now()
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `userscript/tw-agent.user.js` | Building tab detection, scraping, quickbar button |
| `server/websocket.js` | Handle `buildingReport` message |
| `server/public/js/components/DetailPanel.js` | Enhanced buildings section with upgrade UI |
| `server/public/css/components.css` | Building tab styles (if needed) |

---

## Userscript Implementation Details

### 1. Add Building Tab Flag and Detection

```javascript
// Add near line 293 (after isTroopsTab declaration)
let isBuildingTab = false;
let buildingReportTimer = null;

// Add detection function
function isMainBuildingPage() {
  const url = window.location.href;
  return url.includes('screen=main') && !url.includes('mode=');
}
```

### 2. Add Scraping Function

```javascript
function scrapeBuildingPageData() {
  try {
    if (!isMainBuildingPage()) {
      return null;
    }

    const result = {
      buildings: {},
      buildQueue: [],
      queueSlots: { used: 0, max: 2 }
    };

    // Method 1: Get buildings from BuildingMain.buildings JS variable
    if (unsafeWindow.BuildingMain && unsafeWindow.BuildingMain.buildings) {
      const buildings = unsafeWindow.BuildingMain.buildings;
      
      Object.keys(buildings).forEach(buildingId => {
        const b = buildings[buildingId];
        result.buildings[buildingId] = {
          level: parseInt(b.level) || 0,
          maxLevel: b.max_level || 30,
          canBuild: b.can_build === true,
          wood: b.wood || 0,
          stone: b.stone || 0,
          iron: b.iron || 0,
          pop: b.pop || 0,
          buildTime: b.build_time || 0,
          error: b.error || null,
          forecast: b.forecast || null,
          name: b.name || buildingId
        };
      });
    }

    // Method 2: Scrape build queue from #build_queue table
    const queueTable = document.querySelector('#build_queue');
    if (queueTable) {
      const rows = queueTable.querySelectorAll('tr.sortable_row, tr.lit.nodrag');
      rows.forEach(row => {
        const buildingClass = Array.from(row.classList).find(c => c.startsWith('buildorder_'));
        const building = buildingClass ? buildingClass.replace('buildorder_', '') : null;
        
        const timer = row.querySelector('.timer');
        const endtime = timer ? parseInt(timer.dataset.endtime) : null;
        
        const levelMatch = row.textContent.match(/(\d+)\.\s*szint/);
        const targetLevel = levelMatch ? parseInt(levelMatch[1]) : null;
        
        if (building && endtime) {
          result.buildQueue.push({
            building,
            targetLevel,
            finishTime: endtime * 1000, // Convert to milliseconds
            remaining: timer ? timer.textContent.trim() : ''
          });
        }
      });
      
      result.queueSlots.used = result.buildQueue.length;
    }

    log('Building page data scraped:', result);
    return result;
  } catch (err) {
    error('Failed to scrape building page data:', err);
    return null;
  }
}
```

### 3. Add Reporting Functions

```javascript
function sendBuildingReport() {
  if (!isConnected || !isBuildingTab) return;

  const buildingData = scrapeBuildingPageData();
  if (buildingData) {
    send('buildingReport', {
      accountId: scrapeAccountInfo()?.accountId,
      ...buildingData
    });
    log('Building report sent');
  }
}

function startBuildingReporting() {
  if (buildingReportTimer) {
    clearInterval(buildingReportTimer);
  }

  // Send initial report
  sendBuildingReport();

  // Set up periodic reporting (every 30 seconds)
  buildingReportTimer = setInterval(sendBuildingReport, 30000);
  log('Building reporting started (every 30s)');
}

function stopBuildingReporting() {
  if (buildingReportTimer) {
    clearInterval(buildingReportTimer);
    buildingReportTimer = null;
    log('Building reporting stopped');
  }
}
```

### 4. Add Quickbar Navigation Button

In `createStatusBarElements()` function, add after the Troops button:

```javascript
// Building Tab button - opens main building page in new tab
const buildingBtn = document.createElement('a');
buildingBtn.href = baseUrl + 'main';
buildingBtn.className = 'tw-agent-nav-link tw-agent-building-btn';
buildingBtn.title = 'Épületek tab megnyitása (új ablak)';
buildingBtn.target = '_blank';

const buildingImg = document.createElement('img');
buildingImg.src = graphicBase + 'buildings/main.png';
buildingBtn.appendChild(buildingImg);

const buildingText = document.createElement('span');
buildingText.textContent = 'Épületek';
buildingBtn.appendChild(buildingText);

navItemElements.push(buildingBtn);
```

### 5. Update Registration Handler

In `handleRegistered()` function, add Building Tab detection:

```javascript
// Detect if this is a Building Tab (on main building page)
isBuildingTab = isMainBuildingPage();
if (isBuildingTab) {
  log('BUILDING TAB detected - will report building data');
}

// Building Tab: start building reporting
if (isBuildingTab) {
  startBuildingReporting();
}
```

### 6. Update Status Badge

In `createStatusBarElements()`, update badge logic:

```javascript
if (isBuildingTab) {
  badgeClass = 'tw-agent-building-badge';
  dotClass = 'building';
  badgeText = 'BUILDING TAB';
} else if (isTroopsTab) {
  // ... existing troops tab logic
}
```

---

## Server Implementation Details

### Add Handler in websocket.js

```javascript
// In handleMessage() switch statement, add:
case 'buildingReport':
  handleBuildingReport(ws, message, context);
  break;

// Add handler function:
function handleBuildingReport(ws, message, context) {
  if (!context.accountId) {
    logger.warn('Building report from unauthenticated client');
    return;
  }

  const { buildings, buildQueue, queueSlots } = message;

  // Store in account data
  const buildingDetails = {
    buildings: buildings || {},
    buildQueue: buildQueue || [],
    queueSlots: queueSlots || { used: 0, max: 2 },
    lastUpdate: Date.now()
  };

  // Update account state
  accountState.updateData(context.accountId, { buildingDetails });

  logger.info('Building report received', {
    accountId: context.accountId,
    buildingCount: Object.keys(buildings || {}).length,
    queueItems: buildQueue?.length || 0
  });

  // Broadcast to dashboards
  broadcastToDashboards('buildingUpdate', {
    accountId: context.accountId,
    buildingDetails
  });

  // Log to debug log
  debugLog.addLog(context.accountId, 'buildingReport', 'Building data received', {
    buildingCount: Object.keys(buildings || {}).length,
    queueItems: buildQueue?.length || 0
  });
}
```

---

## Dashboard UI Implementation

### Enhanced createBuildingsSection() in DetailPanel.js

The buildings section should:
1. Be collapsible (like troops section)
2. Show building grid with icons and levels
3. Display build queue with countdown timers
4. Include upgrade dropdown and button
5. Show costs and requirements

Key features:
- Building icons: `https://dshu.innogamescdn.com/asset/fa5daa46/graphic/buildings/{building}.png`
- Hungarian building names (Főhadiszállás, Barakk, Istálló, etc.)
- Green highlight for buildings that can be upgraded
- Red/disabled for buildings that can't be upgraded
- Countdown timers for build queue items

---

## UI Style Requirements

- Match existing TW brown theme (`server/public/css/tw-theme.css`)
- Use collapsible sections like Troops Tab
- Dropdown menu styled like existing components
- Hungarian language for all labels
- Building icons from game CDN

---

## Testing Checklist

1. [ ] Open game in browser with userscript installed
2. [ ] Click "Épületek" button in quickbar
3. [ ] Verify new tab opens to `screen=main`
4. [ ] Verify "BUILDING TAB" badge shows in status bar
5. [ ] Check server logs for `buildingReport` messages
6. [ ] Open dashboard and select account
7. [ ] Verify DetailPanel shows building data
8. [ ] Verify build queue displays with timers
9. [ ] Test upgrade dropdown selection
10. [ ] Test upgrade button sends command
11. [ ] Verify periodic reporting (every 30s)

---

## Session Log

### [Date]: Initial Documentation
- Created BUILDING_TAB_DEV.md documentation
- Defined architecture and data structures
- Listed implementation checklist

### 2024-12-10: Phase 1-3 Implementation
- **Userscript**: Added Building Tab detection and scraping
  - `isBuildingTab` flag and `buildingReportTimer`
  - `isMainBuildingPage()` detection function
  - `scrapeBuildingPageData()` - extracts from `BuildingMain.buildings` + build queue
  - `sendBuildingReport()`, `startBuildingReporting()`, `stopBuildingReporting()`
  - Status badge with orange/brown "BUILDING TAB" style
  - Tab title shows "Buildings - VillageName"
- **Server**: Added buildingReport handler in websocket.js
  - `handleBuildingReport()` stores in `account.data.buildingDetails`
  - Broadcasts `buildingUpdate` to dashboards
  - Logs to debug log
- **Dashboard**: Enhanced Buildings section in DetailPanel.js
  - Collapsible section with TW main building icon
  - Building grid with TW icons and level badges
  - Build queue with countdown timers
  - Upgradeable buildings section showing costs
  - Created building.css with TW theme styling

### 2024-12-10: Phase 4 Implementation - Auto-Open Tabs
- **Userscript**: Added `handleOpenTab()` command handler
  - Opens new browser tabs for building/troops/overview screens
  - Only master tab handles the command (avoids duplicates)
  - Sends `tabOpened` confirmation back to server
- **Server**: Added tab management
  - `handleTabOpened()` handler for confirmation messages
  - `openTabForAccount()` utility function to send openTab commands
  - Broadcasts `tabOpened` to dashboards
- **API**: Added `/api/commands/open-tab` endpoint
  - POST with `accountId` and `tabType` (building/troops/overview)
  - Triggers master tab to open new browser tab
- **Deployed**: All files deployed to production server

