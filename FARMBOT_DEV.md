# Farm Bot Feature Development Log

**Created:** 2024-12-07
**Status:** In Development
**Version Target:** v1.4.0

---

## Overview

Implement an Auto Farm Bot function in the dashboard that automates farming for connected accounts. The farm bot will use FarmGod (Innogames' official farm assistant script) to execute farming operations.

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Settings Storage | Per-account | Each account can have different farm settings, with future bulk operations for all/selected accounts |
| Loop Timer | Server-side | Most reliable - survives tab/browser close, centralized scheduling |
| Notifications | Server-side | Centralized Discord/Telegram configuration |

---

## System Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Dashboard    │────▶│     Server      │────▶│   Userscript    │
│   (Farm UI)     │     │ (Farm Service)  │     │ (Farm Handler)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  Start/Stop Farm      │  Schedule & Timer     │  Open Farm Tab
        │  Configure Settings   │  Send Commands        │  Inject FarmGod
        │  View Status          │  Track Progress       │  Click Buttons
        │                       │  Send Notifications   │  Monitor Progress
        └───────────────────────┴───────────────────────┘
```

---

## Reference: NorbiOn_Farm.js Analysis

The standalone farm bot (`NorbiOn_Farm.js`, 1707 lines) has two main components:

### NorbiFarmEngine (Engine Tab)
- Creates UI panel on game page
- Settings: loop interval, random delays, Discord/Telegram notifications
- Opens new tab to farm page (`am_farm`)
- Injects farming code via `farmTab.eval()`
- Monitors for bot protection
- Handles loop scheduling

### NorbiFarmTabHandler (Farm Tab)
- Loads FarmGod script from Innogames CDN
- Clicks "Farm megtervezése" button to initialize
- Continuously clicks farm buttons (A/B) every 220ms
- Monitors progress bar ("176 / 176" format)
- Detects bot protection (7 methods)
- Reports results via localStorage
- Auto-closes on completion

### Key Technical Details
```javascript
// FarmGod Script URL
'https://media.innogamescdn.com/com_DS_HU/scripts/farmgod.js'

// Farm Page URL Pattern
'https://{subdomain}/game.php?village={villageId}&screen=am_farm'

// Farm Button Selectors
'a.farmGod_icon.farm_icon.farm_icon_a'  // Template A
'a.farmGod_icon.farm_icon.farm_icon_b'  // Template B

// Progress Bar
'#FarmGodProgessbar span.label'  // Shows "current / total"

// Bot Protection Detection
- #botprotection_quest
- .bot-protection-row
- .captcha
- Text: "Bot védelem"
- Text: "Botschutz"
- Text: "Bot protection"
```

---

## Implementation TODO

### Phase 1: Server-Side Farm Service - COMPLETED
- [x] Create `server/services/farmBot.js` - Main farm scheduling service
  - [x] Per-account farm settings storage
  - [x] Loop timer with random delay
  - [x] Start/Stop/Pause functionality
  - [x] Progress tracking
  - [x] Bot protection alert handling
- [x] Create `server/routes/farm.js` - Farm API endpoints
  - [x] POST /api/farm/start - Start farming for account
  - [x] POST /api/farm/stop - Stop farming for account
  - [x] GET /api/farm/status/:accountId - Get farm status
  - [x] PUT /api/farm/settings/:accountId - Update farm settings
  - [x] GET /api/farm/all - Get all farm statuses

### Phase 2: Userscript Farm Handler - COMPLETED
- [x] Add `handleStartFarm()` function to userscript
  - [x] Open farm tab (`am_farm` screen)
  - [x] Inject FarmGod script
  - [x] Wait for FarmGod to initialize
  - [x] Click "Farm megtervezése" button
  - [x] Start clicking farm buttons (A/B based on settings)
  - [x] Monitor progress bar
  - [x] Detect bot protection
  - [x] Report completion/errors to server
- [x] Add farm command handler in message switch

### Phase 3: Dashboard Farm UI - COMPLETED
- [x] Add Farm Bot section to DetailPanel
  - [x] Start/Stop toggle button
  - [x] Status indicator (Idle/Running/Paused/Error)
  - [x] Progress bar (current/total farms)
  - [x] Last run timestamp
  - [ ] Next scheduled run countdown (TODO)
- [x] Move Farm Bot to Actions sidebar
  - [x] Sidebar button with status dot indicator
  - [x] Click opens modal dialog
- [x] Farm Bot modal
  - [x] Template selection (A/B/Both) - REMOVED (FarmGod handles automatically)
  - [x] Status badge
  - [x] Progress bar (when running)
  - [x] Stats display
  - [x] Start/Stop buttons
  - [x] Loop interval settings (Intervallum input in minutes)
  - [x] Random delay settings (±perc random delay input)
- [x] Add `farm.css` styles
  - [x] Status dot animations
  - [x] Modal overlay and animations

### Phase 4: Notifications (Future)
- [ ] Discord webhook integration
- [ ] Telegram bot integration
- [ ] Bot protection alerts
- [ ] Farming completion summaries

---

## File Structure

```
server/
├── services/
│   └── farmBot.js          # Farm scheduling service (NEW)
├── routes/
│   └── farm.js             # Farm API routes (NEW)
├── state/
│   └── accounts.js         # Add farmSettings to account state
└── public/
    ├── js/components/
    │   └── DetailPanel.js  # Add Farm UI section
    └── css/
        └── farm.css        # Farm-specific styles (NEW)

userscript/
└── tw-agent.user.js        # Add handleStartFarm() function
```

---

## API Endpoints Design

### POST /api/farm/start
```json
Request:
{
  "accountId": "player123_hu99",
  "template": "A"  // A, B, or "both"
}

Response:
{
  "success": true,
  "message": "Farm started",
  "status": {
    "isRunning": true,
    "startedAt": "2024-12-07T10:00:00Z",
    "template": "A"
  }
}
```

### POST /api/farm/stop
```json
Request:
{
  "accountId": "player123_hu99"
}

Response:
{
  "success": true,
  "message": "Farm stopped"
}
```

### GET /api/farm/status/:accountId
```json
Response:
{
  "accountId": "player123_hu99",
  "isRunning": true,
  "isPaused": false,
  "currentProgress": { "current": 45, "total": 176 },
  "lastRun": "2024-12-07T09:30:00Z",
  "nextRun": "2024-12-07T10:00:00Z",
  "loopCount": 5,
  "totalFarmed": 880,
  "settings": {
    "intervalMinutes": 30,
    "randomDelayMinutes": 5,
    "template": "A",
    "enabled": true
  }
}
```

### PUT /api/farm/settings/:accountId
```json
Request:
{
  "intervalMinutes": 30,
  "randomDelayMinutes": 5,
  "template": "A",
  "enabled": true
}
```

---

## WebSocket Commands

### Server → Userscript
```json
{
  "type": "startFarm",
  "actionId": "farm_abc123",
  "template": "A"
}
```

### Userscript → Server
```json
{
  "type": "farmProgress",
  "actionId": "farm_abc123",
  "current": 45,
  "total": 176
}

{
  "type": "farmComplete",
  "actionId": "farm_abc123",
  "farmed": 176,
  "duration": 45000
}

{
  "type": "farmError",
  "actionId": "farm_abc123",
  "error": "botProtection",
  "message": "Bot protection detected"
}
```

---

## Development Log

### 2024-12-07 - Project Started
- Analyzed existing NorbiOn_Farm.js standalone bot (1707 lines)
- Discussed architecture options with user
- Decided on:
  - Per-account settings (with future bulk operations)
  - Server-side loop timer
  - Server-side notifications
- Created this development log file

### 2024-12-07 - Core Implementation Complete
**Files Created:**
- `server/services/farmBot.js` - Farm scheduling service with:
  - Session management per account
  - Start/Stop/Pause/Resume functionality
  - Progress tracking via WebSocket
  - Bot protection handling (pauses farm on detection)
  - Server-side loop timer with random delay
- `server/routes/farm.js` - REST API endpoints for farm control
- `server/public/css/farm.css` - Farm UI styling

**Files Modified:**
- `server/index.js` - Added farm routes
- `server/websocket.js` - Added farm message handlers (farmProgress, farmComplete, farmError)
- `userscript/tw-agent.user.js` - Added:
  - `handleStartFarm()` - Command handler
  - `checkFarmExecution()` - Detects farm page after navigation
  - `executeFarming()` - Main farming logic
  - `loadFarmGod()` - Loads FarmGod script from CDN
  - `startFarmClicking()` - Initializes farm buttons
  - `clickFarmButtons()` - Continuous click loop (220ms interval)
  - `getFarmProgress()` - Parses progress bar
  - `detectBotProtection()` - 7 detection methods
- `server/public/js/components/DetailPanel.js` - Added Farm Bot section with:
  - Template selector (A/B/Both)
  - Start/Stop buttons
  - Status badge (Idle/Active/Farming/Paused/Error)
  - Progress bar
  - Last run stats
- `server/public/index.html` - Added farm.css include

**Ready for Testing:**
- Dashboard shows Farm Bot section in detail panel
- Can start/stop farm from dashboard
- Progress updates in real-time via WebSocket
- Bot protection detection pauses farming

### 2024-12-07 - UI Refactoring: Move to Actions Sidebar
**Changes:**
- Moved Farm Bot from main content area to Actions (Műveletek) sidebar
- Added Farm button with status dot indicator (shows farming status at a glance)
- Click opens modal dialog instead of inline controls
- Modal features:
  - Template selector (A/B/Both) dropdown
  - Status badge with animations
  - Progress bar (visible when farming)
  - Stats display (last run, loop count, total farmed)
  - Start/Stop buttons

**Files Modified:**
- `server/public/js/components/DetailPanel.js`:
  - Added `createFarmSidebarButton()` method
  - Added `openFarmModal()` method
  - Added `closeFarmModal()` method
  - Added `loadFarmModalStatus()` method
  - Added `updateFarmModalUI()` method
  - Added `loadFarmButtonStatus()` method
  - Added `updateFarmButtonStatus()` method
  - Updated `handleFarmStart()` to get template from modal
  - Updated handlers to update both inline and modal UI

- `server/public/css/farm.css`:
  - Added `.farm-sidebar-btn` and `.farm-status-dot` styles
  - Added modal overlay styles (`.farm-modal-overlay`)
  - Added modal content styles (`.farm-modal-content`)
  - Added modal animations (fadeIn, slideIn)
  - Added responsive styles for modal

### 2024-12-07 - Major Refactor: Integrated NorbiOn_Farm.js Logic
**Problem:**
- The initial farm implementation was incomplete - it started FarmGod and clicked buttons but lacked:
  - Proper bot protection detection and handling
  - Pause/resume logic when captcha is detected
  - Robust progress monitoring
  - Error handling for edge cases

**Solution:**
- Extracted the battle-tested `NorbiFarmTabHandler` logic from `NorbiOn_Farm.js` (1707 lines)
- Adapted it to use WebSocket communication instead of localStorage
- Created comprehensive `FarmHandler` object in userscript

**New FarmHandler Features:**
```javascript
const FarmHandler = {
  // State management
  farmTimer: null,
  totalClicks: 0,
  isRunning: false,
  isPaused: false,
  startTime: null,
  recheckTimeout: null,
  actionId: null,
  lastProgress: { current: 0, total: 0 },
  noProgressCount: 0,

  // Methods
  start(actionId),           // Initialize and start farming
  clickFarmButton(),         // Click A or B farm button
  monitorProgress(),         // Parse progress bar, handle completion
  detectBotProtection(),     // 7 detection methods
  checkBotProtection(),      // Pause/resume with 10s timeout
  stop()                     // Cleanup and report
};
```

**Bot Protection Detection (7 methods):**
1. `#botprotection_quest` element
2. `.bot-protection-row` class
3. `.captcha` class
4. `#popup_box_bot_protection` element
5. Text: "Bot védelem" (Hungarian)
6. Text: "Botschutz" (German)
7. Text: "Bot protection" (English)

**Key Improvements:**
- Pause/resume on bot detection with 10-second recheck interval
- Hungarian locale support for thousands separators in progress bar
- Stall detection (22 seconds of no progress → error)
- Session storage for farm state persistence across page navigation
- Comprehensive WebSocket reporting (farmProgress, farmComplete, farmError)

**Files Modified:**
- `userscript/tw-agent.user.js`:
  - Replaced ~320 lines of incomplete farm code with ~540 lines of robust FarmHandler
  - Lines 1659-1981: New `FarmHandler` object
  - Updated `handleStartFarm()`, `checkFarmExecution()`, `executeFarming()`
  - Helper functions: `loadFarmGod()`, `loadFarmGodViaScript()`, `waitForFarmGod()`, `waitForThrobberToDisappear()`

---

## Problems & Solutions

| Date | Problem | Solution | Status |
|------|---------|----------|--------|
| 2024-12-07 | "Farm megtervezése" button not found | Wrong selector. Changed from `#am_widget_Farm .farm_options a.btn` to `input.btn.optionButton[value="Farm megtervezése"]` | Fixed |
| 2024-12-07 | Template A/B selection not needed | FarmGod automatically uses whichever button (A or B) is available. Removed template logic from click function | Fixed |
| 2024-12-07 | Need to wait for loading throbber | Added `waitForThrobberToDisappear()` function to wait for farm list to load | Fixed |
| 2024-12-07 | **INFINITE LOOP** - Farm tab keeps reloading | "Változtat" button click reloads page but `tw_farm_action` stays in URL → script detects farm tab again → clicks again → loop. **FIX**: Check if A/B farm buttons are ALREADY visible before clicking setup button. If visible, skip directly to FarmHandler.start() | Fixed v1.4.1 |

### 2024-12-07 - v1.4.1: Fixed Infinite Loop Bug
**Critical Bug Fixed:**
- Farm tab was stuck in infinite loop: clicking "Változtat" (setup/change) button → page reloads → `tw_farm_action` URL parameter persists → script detects farm tab again → clicks button again → infinite loop

**Root Cause:**
- The `executeFarming()` function always looked for and clicked the setup button without checking if A/B farm buttons were already visible

**Solution:**
- Added check at the START of `executeFarming()` for A/B farm buttons (`a.farmGod_icon.farm_icon.farm_icon_a/b`)
- If buttons are already visible, skip setup button and go directly to `FarmHandler.start()`
- Also added re-check in `findAndClickPlanButton()` loop for buttons appearing during retries

**Files Modified:**
- `userscript/tw-agent.user.js`:
  - Updated `executeFarming()` lines ~2097-2132: Added A/B button check before setup button
  - Version bumped to 1.4.1

### 2024-12-07 - UI Cleanup: Removed TEST button and Template Selection
**Changes:**
- Removed TEST button from Actions sidebar (was only for deployment verification)
- Removed A/B template selection from Farm modal (FarmGod handles this automatically)
- Simplified Farm modal UI - now only shows:
  - Interval settings (minutes)
  - Random delay settings (±minutes)
  - Status badge
  - Progress bar (when farming)
  - Stats display
  - Start/Stop buttons

**Files Modified:**
- `server/public/js/components/DetailPanel.js`:
  - Removed TEST button from `createActionsSidebar()`
  - Removed template selector from `openFarmModal()`
  - Updated `handleFarmStart()` to not send template
  - Updated `updateFarmModalUI()` to not reference template
- `server/public/index.html`: Updated cache version to v=1002

### 2024-12-07 - v1.5.5: WebSocket Debug Logging for Farm Tab
**Problem:**
- Farm tab opens, loads FarmGod, but stops working
- Can't capture console logs because tab closes/navigates too fast

**Solution:**
- Added `farmDebug()` helper function in userscript that sends debug messages via WebSocket
- Added `handleFarmDebug()` handler in websocket.js to log these messages
- Debug messages are logged to server console AND broadcast to dashboards
- Key debug points: starting, FarmGod loading, button search, button click, errors

**Files Modified:**
- `userscript/tw-agent.user.js`:
  - Added `farmDebug(actionId, message, data)` helper function (line ~1960)
  - Added debug calls at key points in `executeFarming()`:
    - Step 1: Loading FarmGod script
    - Step 2: Waiting for FarmGod to initialize
    - Step 3: Looking for button
    - Button found/not found status
    - List of all buttons on page if target not found
  - Version bumped to 1.5.5
- `server/websocket.js`:
  - Added case 'farmDebug' in message switch (line 169)
  - Added `handleFarmDebug()` function (line ~897)

---

## Notes

**Debug Tab vs Farm Bot**: The Debug Tab (v1.4.0) is a **separate dashboard feature**, not part of the Farm Bot. It was created to help debug farm operations by showing real-time WebSocket logs (farmDebug, farmProgress, farmComplete, farmError, botProtection), but it's a general-purpose debug tool for the entire dashboard. See DEVLOG.md v1.4.0 entry for Debug Tab implementation details.

- FarmGod is Innogames' official script, loaded from their CDN
- The farm page URL is `am_farm` screen in the game
- Progress bar shows "current / total" with possible thousands separator (Hungarian: space)
- Bot protection detection is critical - 7 different detection methods in original script
- Loop timing uses base interval ± random delay for human-like behavior

