# Quickbar Status & Navigation System - Implementation Brief

## Problem Statement

**Current Issues:**
1. Users run 3 tabs per Chrome profile (per account)
2. All tabs show "Connected" but unclear which is the ACTIVE tab
3. Server only listens to the LAST tab that connected
4. Other 2 tabs are "zombie tabs" - connected but not sending data
5. User doesn't know which tab to keep on village overview for data scraping

## Proposed Solution

Inject a **status bar into the game's native quickbar** showing:
- ✅ Which tab is MASTER (active, sending data)
- ✅ Which tabs are STANDBY (connected but passive)
- ✅ Quick navigation links
- ✅ Future-proof for more features

---

## Visual Design

### Current Quickbar Structure
```html
<table id="quickbar_outer">
  <tr>
    <td id="quickbar_contents">
      <ul class="menu quickbar">
        <li class="quickbar_item">...</li>
        <!-- Game's existing quickbar items -->
      </ul>
    </td>
  </tr>
</table>
```

### Modified Quickbar (Injected)
```
[🟢 MASTER TAB] [📍 Overview] [🏛️ Main] [⚔️ Barracks] | [existing items...]
```

OR for standby tabs:

```
[⚪ STANDBY] [📍 Overview] [🏛️ Main] [⚔️ Barracks] | [existing items...]
```

---

## Implementation Plan

### Part 1: Server Changes (server/state/accounts.js)

**Goal:** Track multiple connections per account

```javascript
// BEFORE (current):
account = {
  accountId,
  connection: ws,  // ← Only ONE connection stored
  sessionId,
  data: {...}
}

// AFTER (new):
account = {
  accountId,
  connections: [    // ← Array of connections
    { ws, sessionId, isMaster: true, connectedAt },
    { ws, sessionId, isMaster: false, connectedAt },
    { ws, sessionId, isMaster: false, connectedAt }
  ],
  data: {...}
}
```

**Logic:**
1. First tab to connect → `isMaster: true`
2. Additional tabs → `isMaster: false`
3. If master disconnects → promote oldest standby to master

### Part 2: Registration Response (server/websocket.js)

**Current Response:**
```javascript
ws.send({
  type: 'registered',
  sessionId: 'sess_12345'
});
```

**New Response:**
```javascript
ws.send({
  type: 'registered',
  sessionId: 'sess_12345',
  isMaster: true  // ← NEW: tells tab if it's master
});
```

### Part 3: Userscript Changes (userscript/tw-agent.user.js)

#### 3.1 Receive Master Status

```javascript
// Global state
let isMasterTab = false;

function handleRegistered(message) {
  sessionId = message.sessionId;
  isMasterTab = message.isMaster;  // ← NEW

  log(`Registered as ${isMasterTab ? 'MASTER' : 'STANDBY'} tab`);

  // Inject quickbar status
  injectQuickbarStatus();

  // Only master tab does periodic reporting
  if (isMasterTab) {
    scheduleReport();
  }
}
```

#### 3.2 Quickbar Injection Function

```javascript
function injectQuickbarStatus() {
  const quickbar = document.querySelector('#quickbar_contents ul.quickbar');
  if (!quickbar) return;

  // Remove old injected items (if re-injecting)
  const oldItems = quickbar.querySelectorAll('.tw-agent-injected');
  oldItems.forEach(item => item.remove());

  // 1. Status Badge
  const statusBadge = createQuickbarItem(
    isMasterTab ? '🟢 MASTER TAB' : '⚪ STANDBY',
    null,  // No href
    isMasterTab ? 'master-badge' : 'standby-badge'
  );

  // 2. Quick Nav Links
  const overviewLink = createQuickbarItem('📍 Áttekintés', '?screen=overview');
  const mainLink = createQuickbarItem('🏛️ Főhadiszállás', '?screen=main');
  const barracksLink = createQuickbarItem('⚔️ Barakk', '?screen=train');
  const rallyLink = createQuickbarItem('🎯 Gyülekezőhely', '?screen=place');

  // 3. Separator
  const separator = createQuickbarSeparator();

  // Insert at beginning
  quickbar.insertBefore(separator, quickbar.firstChild);
  quickbar.insertBefore(rallyLink, quickbar.firstChild);
  quickbar.insertBefore(barracksLink, quickbar.firstChild);
  quickbar.insertBefore(mainLink, quickbar.firstChild);
  quickbar.insertBefore(overviewLink, quickbar.firstChild);
  quickbar.insertBefore(statusBadge, quickbar.firstChild);
}

function createQuickbarItem(text, href, className = '') {
  const li = document.createElement('li');
  li.className = `quickbar_item tw-agent-injected ${className}`;

  if (href) {
    const link = document.createElement('a');
    link.href = '/game.php' + href;
    link.className = 'quickbar_link';
    link.textContent = text;
    li.appendChild(link);
  } else {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.padding = '5px 10px';
    span.style.fontWeight = 'bold';
    li.appendChild(span);
  }

  return li;
}

function createQuickbarSeparator() {
  const li = document.createElement('li');
  li.className = 'quickbar_item tw-agent-injected';
  li.innerHTML = '<span style="color: #8b6914; padding: 0 5px;">|</span>';
  return li;
}
```

#### 3.3 Styling

```javascript
function injectQuickbarStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Master badge - green glow */
    .master-badge {
      background: linear-gradient(to bottom, #2d5016, #1a3009) !important;
      border: 2px solid #4caf50 !important;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
    }

    .master-badge span {
      color: #4caf50 !important;
      font-weight: bold;
      text-shadow: 0 0 5px rgba(76, 175, 80, 0.8);
    }

    /* Standby badge - gray */
    .standby-badge {
      background: linear-gradient(to bottom, #3a3a3a, #1a1a1a) !important;
      border: 2px solid #777 !important;
    }

    .standby-badge span {
      color: #999 !important;
    }
  `;
  document.head.appendChild(style);
}
```

### Part 4: Command Execution (Prevent Duplicates)

**Problem:** If 3 tabs are connected, all receive commands

**Solution:** Only MASTER tab executes commands

```javascript
function handleSendTroops(message) {
  // Only master tab executes
  if (!isMasterTab) {
    log('Ignoring command - not master tab');
    return;
  }

  log('Send troops command:', message);
  executeSendTroops(message);
}

function handleBuildBuilding(message) {
  if (!isMasterTab) return;
  executeBuildBuilding(message);
}

function handleRecruitTroops(message) {
  if (!isMasterTab) return;
  executeRecruitTroops(message);
}
```

**Exception:** Manual refresh button works on ANY tab

```javascript
// Add to quickbar
const refreshBtn = createQuickbarItem('🔄 Frissítés', null, 'refresh-btn');
refreshBtn.addEventListener('click', () => {
  // ANY tab can refresh manually
  navigateToOverview();
  setTimeout(() => {
    scrapeAndSend();
  }, 1000);
});
```

---

## User Workflow

### Setup (One-time)
1. Open 3 tabs for one account (e.g., hu97_norbitheking)
2. First tab → Shows "🟢 MASTER TAB" (keep on overview)
3. Second tab → Shows "⚪ STANDBY" (use for manual play)
4. Third tab → Shows "⚪ STANDBY" (use for manual play)

### Daily Use
1. **Master tab:** Leave on village overview
   - Automatically scrapes data every 60 seconds
   - Executes commands from dashboard
   - Shows green badge

2. **Standby tabs:** Use for manual gameplay
   - Can navigate anywhere (barracks, market, etc.)
   - Won't interfere with automation
   - Can click "🔄 Frissítés" to force data refresh
   - Shows gray badge

### If Master Tab Closes
- Server detects disconnect
- Promotes oldest STANDBY tab to MASTER
- New master tab updates badge from gray → green
- User sees which tab is now active

---

## Benefits

✅ **Clear visual feedback** - Always know which tab is active
✅ **No zombie tabs** - All tabs have a purpose
✅ **No command duplicates** - Only master executes
✅ **Quick navigation** - Built-in nav links
✅ **Native look** - Uses game's existing quickbar
✅ **Future-proof** - Easy to add more features
✅ **Manual override** - Refresh button on any tab

---

## Files to Modify

1. **server/state/accounts.js**
   - Change `connection` to `connections` array
   - Add `isMaster` flag logic
   - Handle master promotion on disconnect

2. **server/websocket.js**
   - Return `{ sessionId, isMaster }` in registration response
   - Send commands to master tab only

3. **userscript/tw-agent.user.js**
   - Add `isMasterTab` global state
   - Add `injectQuickbarStatus()` function
   - Add `injectQuickbarStyles()` function
   - Guard command execution with master check
   - Add manual refresh button

---

## Testing Plan

1. Open 3 tabs for same account
2. Verify badges:
   - Tab 1: 🟢 MASTER TAB
   - Tab 2: ⚪ STANDBY
   - Tab 3: ⚪ STANDBY
3. Send command from dashboard → only master tab executes
4. Close master tab → verify standby promoted to master
5. Click refresh button on standby tab → verify data updates
6. Click nav links → verify navigation works

---

## Future Enhancements

- **Tab sync indicator:** Show if tabs are on same page
- **Manual master switch:** Click to make any tab master
- **Tab activity log:** Show last action time per tab
- **Multi-village support:** Badge shows which village is active
- **Notification center:** Show alerts in quickbar

---

## Status

- ❌ Not implemented yet - this is just the brief
- ⏳ Waiting for approval before implementation
- 📝 All changes documented above
