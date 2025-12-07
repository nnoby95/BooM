# Claude Code Memory - TW Controller Project

> **READ THIS FIRST** - This is Claude's memory file. Contains everything needed to work efficiently.
> This file is automatically read at the start of every session.

---

## Documentation Structure

```
d:\TW\Multy\
├── CLAUDE.md              ← YOU ARE HERE (auto-read every session)
├── DEVLOG.md              ← Chronological development history
├── FARMBOT_DEV.md         ← Farm Bot feature development
├── PROJECT_BRIEF.md       ← Project overview & goals
├── QUICKBAR_STATUS_BRIEF.md ← Quickbar feature brief
└── docs/archive/          ← Old/completed documentation
```

### File Usage Guide
| File | When to Read | When to Update |
|------|--------------|----------------|
| `CLAUDE.md` | Every session (auto) | Infrastructure changes, new patterns, new issues |
| `DEVLOG.md` | Check recent work | After completing features/fixes |
| `{FEATURE}_DEV.md` | Working on that feature | During feature development |

---

## Current Feature Status

| Feature | Status | Dev Log | Notes |
|---------|--------|---------|-------|
| Farm Bot | **IN PROGRESS** | [FARMBOT_DEV.md](./FARMBOT_DEV.md) | UI in sidebar, modal done, testing needed |
| Dashboard Layout | **COMPLETE** | - | v1.4.0 with feature navigation boxes |
| Debug Tab | **COMPLETE** | - | Real-time log viewer for all accounts |
| Templates | **COMPLETE** | - | Building & recruitment templates |
| Quickbar Status | PLANNED | [QUICKBAR_STATUS_BRIEF.md](./QUICKBAR_STATUS_BRIEF.md) | Not started |

---

## Development Rules

### Rule 1: Feature Development Logs
For complex features, create `{FEATURE}_DEV.md` with:
- Architecture decisions & TODO checkboxes
- Problems encountered and solutions
- Code snippets and line numbers

### Rule 2: ALWAYS Deploy to Correct Path
```
LOCAL: server/public/*  →  SERVER: /root/tw-controller/public/
LOCAL: server/routes/*  →  SERVER: /root/tw-controller/routes/
LOCAL: server/services/* → SERVER: /root/tw-controller/services/
```
**NEVER deploy to `/root/tw-controller/server/public/`** (wrong path!)

### Rule 3: Verify Every Deployment
```bash
ssh root@172.236.201.97 "curl -sk 'https://localhost:3000/path/to/file' | grep 'UNIQUE_STRING'"
```

### Rule 4: Cache Busting Required
When changing JS files:
1. Deploy the JS file
2. Update `?v=XXX` in index.html
3. Deploy index.html
4. Tell user to hard refresh (Ctrl+Shift+R)

### Rule 5: Professional Conduct - NO SELF-DECISIONS
**CRITICAL:** Act professionally. Work calmly and methodically.
- **NEVER** implement logic or features by your own decision
- **NEVER** add "improvements" or "fallbacks" not in the reference code
- **ALWAYS** follow reference implementations EXACTLY when provided
- **ALWAYS** propose changes first and wait for user approval
- If you think something could be better → propose it, don't just do it

---

## Project Context

**Project:** TW Controller - Multi-account Tribal Wars management system
**Server:** 172.236.201.97:3000 (HTTPS)
**Tech Stack:** Node.js, Express (HTTPS), WebSocket (WSS), Tampermonkey userscript

### Current Version
v1.4.0 - Dashboard Feature Navigation & Debug Tab

---

## CRITICAL: Server Project Structure

The server has a DIFFERENT structure than the local project!

### Local Project Structure (Windows)
```
d:\TW\Multy\
├── server/
│   ├── index.js           ← Local server entry (NOT used on production)
│   ├── public/            ← Local dashboard files
│   │   ├── js/components/
│   │   ├── css/
│   │   └── index.html
│   ├── routes/
│   ├── services/
│   ├── state/
│   └── utils/
└── userscript/
    └── tw-agent.user.js
```

### Production Server Structure (Linux)
```
/root/tw-controller/
├── index.js               ← PM2 runs THIS (main entry point!)
├── public/                ← EXPRESS SERVES FROM HERE!
│   ├── js/components/     ← Dashboard JS files go here
│   ├── css/               ← CSS files go here
│   └── index.html         ← Main HTML
├── routes/
├── services/
├── state/
├── utils/
├── websocket.js
├── key.pem                ← SSL certificate
└── cert.pem               ← SSL certificate
```

### IMPORTANT DEPLOYMENT PATHS
| Local Path | Server Path |
|------------|-------------|
| `server/public/*` | `/root/tw-controller/public/` |
| `server/routes/*` | `/root/tw-controller/routes/` |
| `server/services/*` | `/root/tw-controller/services/` |
| `server/index.js` | NOT USED - server has its own index.js |

---

## Quick Reference

### SSH to Server
```bash
ssh root@172.236.201.97
```

### Restart Server
```bash
ssh root@172.236.201.97 "pm2 restart tw-controller"
```

### Deploy Dashboard Files (JS/CSS/HTML)
```bash
# Single file
scp server/public/js/components/DetailPanel.js root@172.236.201.97:/root/tw-controller/public/js/components/

# CSS
scp server/public/css/farm.css root@172.236.201.97:/root/tw-controller/public/css/

# HTML
scp server/public/index.html root@172.236.201.97:/root/tw-controller/public/
```

### Deploy Backend Files (routes/services)
```bash
scp server/routes/farm.js root@172.236.201.97:/root/tw-controller/routes/
scp server/services/farmBot.js root@172.236.201.97:/root/tw-controller/services/
```

### Verify Deployment
```bash
# Check if file has your changes (replace SEARCH_TERM)
ssh root@172.236.201.97 "grep 'SEARCH_TERM' /root/tw-controller/public/js/components/DetailPanel.js"

# Check what server actually serves (HTTPS!)
ssh root@172.236.201.97 "curl -sk 'https://localhost:3000/js/components/DetailPanel.js' | grep 'SEARCH_TERM'"
```

### Cache Busting
When updating JS files, also update the version in index.html:
```html
<script src="/js/components/DetailPanel.js?v=NEW_VERSION"></script>
```

---

## Architecture Overview

### System Flow
```
┌─────────────────┐     WebSocket (WSS)     ┌─────────────────┐
│   Dashboard     │◄──────────────────────►│     Server      │
│  (Browser UI)   │                         │  (Node.js/PM2)  │
└─────────────────┘                         └────────┬────────┘
                                                     │ WebSocket
                                                     ▼
                                            ┌─────────────────┐
                                            │   Userscript    │
                                            │ (Tampermonkey)  │
                                            │  in Game Tabs   │
                                            └─────────────────┘
```

### Communication
- **Dashboard ↔ Server**: REST API (`/api/*`) + WebSocket for real-time updates
- **Server ↔ Userscript**: WebSocket only (WSS on port 3000)
- **Server sends commands** to userscript (e.g., `startFarm`, `sendTroops`)
- **Userscript reports back** results (e.g., `farmProgress`, `farmComplete`, `farmError`)

---

## Key Files Reference

### Dashboard (Frontend)
| File | Purpose |
|------|---------|
| `server/public/index.html` | Main HTML, loads all JS/CSS |
| `server/public/js/components/DetailPanel.js` | Account detail sidebar (largest component) |
| `server/public/js/components/AccountCard.js` | Account cards in main grid |
| `server/public/js/app.js` | Main app initialization, WebSocket client |
| `server/public/css/tw-theme.css` | Tribal Wars theme styles |
| `server/public/css/farm.css` | Farm Bot specific styles |

### Server (Backend)
| File | Purpose |
|------|---------|
| `/root/tw-controller/index.js` | Express + HTTPS server entry (PRODUCTION) |
| `/root/tw-controller/websocket.js` | WebSocket server, message routing |
| `/root/tw-controller/routes/api.js` | REST API endpoints |
| `/root/tw-controller/routes/farm.js` | Farm Bot API endpoints |
| `/root/tw-controller/services/farmBot.js` | Farm scheduling service |
| `/root/tw-controller/state/accounts.js` | Account state management |

### Userscript
| File | Purpose |
|------|---------|
| `userscript/tw-agent.user.js` | Tampermonkey script, runs in game tabs |

---

## Code Patterns

### DetailPanel Component Pattern
```javascript
// All methods use this.createElement() helper
createSomething() {
  const container = this.createElement('div', { className: 'my-class' });
  const button = this.createElement('button', {
    className: 'btn',
    onClick: () => this.handleClick()
  }, 'Button Text');
  container.appendChild(button);
  return container;
}
```

### WebSocket Message Pattern (Server → Userscript)
```javascript
// Server sends:
{ type: 'startFarm', actionId: 'farm_123', template: 'A' }

// Userscript responds:
{ type: 'farmProgress', actionId: 'farm_123', current: 50, total: 100 }
{ type: 'farmComplete', actionId: 'farm_123', farmed: 100, duration: 45000 }
{ type: 'farmError', actionId: 'farm_123', error: 'botProtection' }
```

### API Endpoint Pattern
```javascript
// POST /api/farm/start
{ accountId: 'hu97_PlayerName', template: 'A' }

// Response
{ success: true, status: { isRunning: true, ... } }
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Changes not appearing | Wrong deploy path | Deploy to `/root/tw-controller/public/` NOT `/root/tw-controller/server/public/` |
| curl returns empty | Server uses HTTPS | Use `curl -sk https://...` not `curl http://...` |
| Browser shows old code | Caching | Update `?v=` in index.html AND hard refresh |
| WebSocket not connecting | HTTPS/WSS mismatch | Server uses WSS (secure WebSocket) |
| "Farm stalled" errors | FarmGod not loading | Check if game page has FarmGod script |

---

## Troubleshooting Commands

```bash
# Check PM2 status
ssh root@172.236.201.97 "pm2 status"

# View recent logs
ssh root@172.236.201.97 "pm2 logs tw-controller --lines 50 --nostream"

# Check which file server is serving
ssh root@172.236.201.97 "curl -sk 'https://localhost:3000/js/components/DetailPanel.js' | head -20"

# Find all copies of a file
ssh root@172.236.201.97 "find /root -name 'DetailPanel.js' 2>/dev/null"

# Check PM2 config (where it runs from)
ssh root@172.236.201.97 "pm2 show tw-controller | grep -E '(script path|cwd)'"
```

---

## Important Notes

1. **HTTPS Only**: Server runs on HTTPS with self-signed cert (`key.pem`, `cert.pem`)
2. **PM2 Managed**: Server runs via PM2, always use `pm2 restart` not manual node
3. **No Hot Reload**: After deploying backend files (routes/services), restart PM2
4. **Frontend Hot**: Static files (JS/CSS/HTML) are served immediately, just cache bust
5. **Hungarian Locale**: Game uses Hungarian, progress bars may have space as thousands separator

---

## Session Workflow

### At Start of Session
1. ✅ This file (`CLAUDE.md`) is auto-read
2. Check "Current Feature Status" table above
3. If continuing a feature, read its `{FEATURE}_DEV.md`
4. If user mentions recent work, check `DEVLOG.md`

### During Development
1. Use TodoWrite for multi-step tasks
2. Deploy to correct paths (Rule 2)
3. Verify deployments work (Rule 3)
4. Update cache busting (Rule 4)

### At End of Session (if significant work done)
1. Update `DEVLOG.md` with completed work
2. Update `{FEATURE}_DEV.md` if working on a feature
3. Update "Current Feature Status" table if status changed
4. Add any new issues to "Common Issues & Solutions" table

---

## Recent Session Notes

*(Add notes here for context that should persist to next session)*

- **2024-12-07**: Fixed deployment path issue - was deploying to wrong `/server/public/` folder
- **2024-12-07**: Farm Bot UI moved to sidebar with modal, removed inline section
- **2024-12-07**: TEST button added for deployment verification (removed now)
- **2024-12-07**: **v1.4.0 - Dashboard Feature Navigation System**
  - New layout with feature navigation boxes at top
  - "Fiókok" (accounts) = first box, shows accounts grid + alerts
  - "Debug" = last box, shows real-time debug log viewer
  - 8 empty placeholder boxes for future features
  - Click box → shows that feature's content
  - Main panel has border, TW parchment theme
  - Debug Tab shows all farm logs from all connected accounts with filters
