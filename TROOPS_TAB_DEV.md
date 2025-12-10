# Troops Tab Feature Development

## Overview
Dedicated browser tab for troop management that stays on the training page and reports troop data to the dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GAME BROWSER TABS                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Master Tab  │  │ Troops Tab  │  │ Standby Tab │         │
│  │ (actions)   │  │ (training)  │  │ (backup)    │         │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
│         │                │                                   │
│         │   WebSocket    │                                   │
│         └───────┬────────┘                                   │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     SERVER                               ││
│  │  account.data.troopDetails = {                          ││
│  │    troops: { spear: {inVillage, total}, ... },          ││
│  │    queue: { barracks: [...], stable: [...], ... },      ││
│  │    canRecruit: { spear: 102, ... },                     ││
│  │    lastUpdate: timestamp                                 ││
│  │  }                                                       ││
│  └─────────────────────────────────────────────────────────┘│
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              DASHBOARD (DetailPanel)                     ││
│  │  ▼ Összesen (88)         [collapsible sections]         ││
│  │  ▼ A faluban (65)                                        ││
│  │  ▼ Kiképzés (3 egység)                                   ││
│  │  ▼ Kiképezhető                                           ││
│  │  ▼ Toborzás [recruit form]                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Implementation Checklist

### Phase 1: Userscript
- [x] Add "Csapatok" button to quickbar (shift others right)
- [x] Handle click → open new tab to `screen=train&mode=train`
- [x] Detect if on training page → register as `tabType: 'troops'`
- [x] Scrape training page data:
  - Troops table: unit → {inVillage, total}
  - Queue tables: barracks, stable, garage
  - Can recruit: from (XX) links

### Phase 2: Server
- [x] Handle `troopReport` message in websocket.js
- [x] Store in `account.data.troopDetails`
- [x] Broadcast update to dashboard

### Phase 3: Dashboard
- [x] Update DetailPanel Csapatok section
- [x] Collapsible sections with +/- toggle
- [x] TW unit icons
- [x] Recruit form (sends command to Troops Tab)

## Data Structures

### troopReport Message (Userscript → Server)
```javascript
{
  type: 'troopReport',
  accountId: 'hu97_PlayerName',
  troops: {
    spear: { inVillage: 30, total: 81 },
    sword: { inVillage: 0, total: 50 },
    axe: { inVillage: 666, total: 736 },
    spy: { inVillage: 10, total: 61 },
    light: { inVillage: 50, total: 66 },
    ram: { inVillage: 15, total: 15 },
    catapult: { inVillage: 7, total: 7 }
  },
  queue: {
    barracks: [
      { unit: 'axe', count: 99, remaining: '8:20:29', completesAt: 'holnap 07:11' }
    ],
    stable: [
      { unit: 'light', count: 20, remaining: '3:05:34', completesAt: 'holnap 01:56' }
    ],
    garage: []
  },
  canRecruit: {
    spear: 102,
    sword: 58,
    axe: 93,
    spy: 61,
    light: 16,
    ram: 15,
    catapult: 7
  }
}
```

## Files Modified

| File | Changes |
|------|---------|
| `userscript/tw-agent.user.js` | Quickbar button, troops tab type, scraping |
| `server/websocket.js` | Handle troopReport message |
| `server/public/js/components/DetailPanel.js` | Collapsible troop sections |
| `server/public/css/components.css` | Collapsible section styles |

## Session Log

### 2024-12-09: Initial Implementation
- Created documentation
- Added quickbar button
- Implemented troops tab detection and scraping
- Updated DetailPanel with collapsible sections
