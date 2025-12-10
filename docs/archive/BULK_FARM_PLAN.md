# Bulk Farm Feature - Implementation Plan

## Overview
Add a "Bulk Farm" feature that allows starting the Farm Bot on multiple connected accounts simultaneously with:
- Staggered starts (10-15 seconds between each)
- Randomized settings per account (±1-3 on interval and delay)
- Continue on failure with logging
- Professional UI in a new feature box

---

## Architecture

### System Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD (Browser)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Bulk Farm Feature Box                    │    │
│  │  ┌──────────────────┐  ┌───────────────────────┐    │    │
│  │  │ Account List     │  │ Settings              │    │    │
│  │  │ ☑ Account1       │  │ Interval: [15] min    │    │    │
│  │  │ ☑ Account2       │  │ Delay: ±[2] min       │    │    │
│  │  │ ☐ Account3 (off) │  │ Template: [A ▼]       │    │    │
│  │  └──────────────────┘  └───────────────────────┘    │    │
│  │                                                       │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ Progress / Queue Status                      │    │    │
│  │  │ Starting: 2/5 accounts...                    │    │    │
│  │  │ ✅ Account1 - Started (15min, ±3min)        │    │    │
│  │  │ ✅ Account2 - Started (14min, ±2min)        │    │    │
│  │  │ ⏳ Account3 - Queued (in 12s)               │    │    │
│  │  │ ❌ Account4 - Failed (No master tab)        │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                       │    │
│  │  [🚜 Start All]  [⏹ Stop All]                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVER                                 │
│  ┌───────────────────┐    ┌───────────────────────────┐    │
│  │ routes/bulkFarm.js│    │ services/bulkFarmService.js│    │
│  │ POST /start       │───►│ Queue accounts            │    │
│  │ POST /stop        │    │ Stagger starts (10-15s)   │    │
│  │ GET /status       │    │ Randomize settings        │    │
│  └───────────────────┘    │ Track progress            │    │
│                            │ Log failures              │    │
│                            └───────────┬───────────────┘    │
│                                        │                     │
│                                        ▼                     │
│                            ┌───────────────────────────┐    │
│                            │ services/farmBot.js       │    │
│                            │ (existing - reuse)        │    │
│                            │ .start(accountId, opts)   │    │
│                            └───────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### NEW FILES

#### 1. `server/public/js/components/BulkFarmTab.js`
Frontend component for Bulk Farm feature.

```javascript
// Structure:
class BulkFarmTab extends Component {
  constructor() {
    this.state = {
      selectedAccounts: new Set(),
      settings: { intervalMinutes: 15, randomDelayMinutes: 2, template: 'A' },
      operation: null, // { id, status, queue, started, failed }
      isStarting: false
    };
  }

  // Methods:
  - render()                 // Main render
  - renderAccountList()      // Checkbox list of accounts
  - renderSettings()         // Settings inputs
  - renderProgress()         // Queue/progress display
  - handleSelectAll()        // Select/deselect all
  - handleStartAll()         // Start bulk operation
  - handleStopAll()          // Stop bulk operation
  - updateProgress(data)     // WebSocket handler
}
```

#### 2. `server/public/css/bulk-farm.css`
Styles for Bulk Farm UI - follows existing farm.css patterns.

#### 3. `server/routes/bulkFarm.js`
API endpoints for bulk farm operations.

```javascript
// Endpoints:
POST /api/bulk-farm/start
  Body: {
    accountIds: string[],
    settings: { intervalMinutes, randomDelayMinutes, template },
    staggerSeconds: { min: 10, max: 15 },
    randomizeRange: { min: 1, max: 3 }
  }
  Response: { success, operationId, queued: number }

POST /api/bulk-farm/stop
  Body: { operationId? } // Stop all or specific operation
  Response: { success, stopped: number }

GET /api/bulk-farm/status
  Response: { operation, accounts: [...status] }

GET /api/bulk-farm/log
  Response: { logs: [...] }
```

#### 4. `server/services/bulkFarmService.js`
Handles the bulk farm queue and staggered execution.

```javascript
class BulkFarmService {
  constructor() {
    this.currentOperation = null;
    this.logs = [];
  }

  // Methods:
  - start(accountIds, settings, options)
    // 1. Validate accounts are connected
    // 2. Create operation with queue
    // 3. Process queue with stagger

  - processQueue()
    // 1. Take next account from queue
    // 2. Randomize settings (±1-3)
    // 3. Call farmBot.start()
    // 4. Log result (success/fail)
    // 5. Schedule next after stagger delay

  - stop()
    // Clear queue, stop all farms

  - randomizeSettings(base, range)
    // interval: base ± random(range)
    // delay: base ± random(range)

  - addLog(accountId, type, message, data)
    // Store for UI display
}
```

---

### MODIFIED FILES

#### 1. `server/public/index.html`
- Add feature box: `<div class="feature-box" data-feature="bulk-farm">Bulk Farm</div>`
- Add feature content container: `<div id="feature-bulk-farm" class="feature-content">...</div>`
- Add CSS link: `<link rel="stylesheet" href="/css/bulk-farm.css?v=1001">`
- Add JS script: `<script src="/js/components/BulkFarmTab.js?v=1001"></script>`

#### 2. `server/public/js/app.js`
- Add `bulkFarmTab` variable
- Initialize `BulkFarmTab` component in `init()`
- Handle WebSocket messages for bulk farm progress
- Make globally accessible

#### 3. `server/index.js` (on server)
- Add route: `app.use('/api/bulk-farm', require('./routes/bulkFarm'));`

---

## Settings Randomization Algorithm

When user sets **15 min interval, ±2 min delay**, each account gets:

```javascript
function randomizeSettings(baseSettings, range = { min: 1, max: 3 }) {
  const variation = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  const sign = Math.random() > 0.5 ? 1 : -1;

  return {
    intervalMinutes: Math.max(5, baseSettings.intervalMinutes + (sign * variation)),
    randomDelayMinutes: Math.max(1, baseSettings.randomDelayMinutes + (sign * variation)),
    template: baseSettings.template
  };
}

// Example outputs:
// Account 1: { intervalMinutes: 14, randomDelayMinutes: 1, template: 'A' }
// Account 2: { intervalMinutes: 17, randomDelayMinutes: 4, template: 'A' }
// Account 3: { intervalMinutes: 16, randomDelayMinutes: 3, template: 'A' }
```

---

## Queue Processing Logic

```javascript
async processQueue() {
  if (this.queue.length === 0) {
    this.operation.status = 'complete';
    this.broadcast('bulkFarmComplete', this.operation);
    return;
  }

  const accountId = this.queue.shift();

  // Randomize settings for this account
  const settings = this.randomizeSettings(this.baseSettings);

  // Try to start farm
  const result = farmBot.start(accountId, settings);

  if (result.success) {
    this.operation.started.push({
      accountId,
      settings,
      startedAt: Date.now()
    });
    this.addLog(accountId, 'success', `Started with ${settings.intervalMinutes}min, ±${settings.randomDelayMinutes}min`);
  } else {
    this.operation.failed.push({
      accountId,
      error: result.error,
      failedAt: Date.now()
    });
    this.addLog(accountId, 'error', `Failed: ${result.error}`);
    // CONTINUE with others - don't stop!
  }

  // Broadcast progress
  this.broadcast('bulkFarmProgress', {
    operationId: this.operation.id,
    started: this.operation.started.length,
    failed: this.operation.failed.length,
    remaining: this.queue.length,
    lastAccount: accountId,
    lastResult: result.success ? 'success' : 'error'
  });

  // Schedule next with stagger
  if (this.queue.length > 0) {
    const staggerMs = this.getRandomStagger(); // 10-15 seconds
    setTimeout(() => this.processQueue(), staggerMs);
  }
}
```

---

## UI States

### Initial State (No operation)
- Show account list with checkboxes
- Show settings inputs
- "Start All" button enabled
- "Stop All" button disabled

### Starting State (Operation in progress)
- Account list disabled (grayed out)
- Settings inputs disabled
- Progress display visible with:
  - Overall progress: "Starting 3/7 accounts..."
  - Per-account status list
- "Start All" button disabled
- "Stop All" button enabled

### Complete State
- Show summary: "✅ Started 6/7 accounts (1 failed)"
- Failed accounts shown in red with reason
- Can start new operation

---

## Error Handling

| Error | Handling |
|-------|----------|
| Account disconnected | Skip, log, continue with others |
| No master tab | Skip, log, continue |
| Account already farming | Skip (already running), continue |
| Bot protection detected | Log warning, continue with others |

---

## Logging Format

Logs stored in memory (last 500) and displayed in Bulk Farm UI:

```javascript
{
  id: 'log_123456',
  timestamp: 1699999999999,
  operationId: 'bulk_123',
  accountId: 'hu97_Player1',
  type: 'success' | 'error' | 'warning' | 'info',
  message: 'Started with 16min, ±3min',
  data: { intervalMinutes: 16, randomDelayMinutes: 3 }
}
```

---

## Implementation Order

### Phase 1: Backend (Server)
1. [ ] Create `services/bulkFarmService.js` - Core logic
2. [ ] Create `routes/bulkFarm.js` - API endpoints
3. [ ] Update server `index.js` to register routes
4. [ ] Test API with curl

### Phase 2: Frontend (Dashboard)
5. [ ] Create `css/bulk-farm.css` - Styles
6. [ ] Create `js/components/BulkFarmTab.js` - Component
7. [ ] Update `index.html` - Add feature box and content
8. [ ] Update `app.js` - Initialize component, WebSocket handlers

### Phase 3: Integration & Deploy
9. [ ] Deploy backend files to server
10. [ ] Restart PM2
11. [ ] Deploy frontend files
12. [ ] Test full flow

---

## Test Plan

1. **Single account test**: Select 1 account, verify it starts
2. **Multiple accounts test**: Select 3 accounts, verify staggered starts
3. **Failure test**: Include disconnected account, verify others continue
4. **Stop test**: Start bulk operation, stop mid-way
5. **Settings randomization test**: Verify each account gets different settings
6. **UI responsiveness test**: Verify progress updates in real-time

---

## Notes

- Reuse existing `farmBot.start()` - don't reinvent the wheel
- Stagger is 10-15 seconds (random within range)
- Randomization is ±1-3 on both interval AND delay
- Logs persist only in memory (cleared on server restart)
- WebSocket broadcasts progress to all connected dashboards
