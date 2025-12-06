# Claude Code Implementation Prompt: TW Controller Dashboard

## 🎯 Project Overview

Build a **Tribal Wars Multi-Account Controller Dashboard** - a web-based control panel to manage 30+ game accounts simultaneously. The dashboard connects to game accounts via WebSocket and provides real-time monitoring, individual/bulk operations, and template-based automation.

---

## 📁 Project Structure

Create this exact file structure:

```
tw-dashboard/
├── package.json
├── .env.example
├── .gitignore
├── README.md
│
├── server/
│   ├── index.js                 # Main entry point
│   ├── config.js                # Configuration loader
│   │
│   ├── websocket/
│   │   ├── index.js             # WebSocket server setup
│   │   ├── handlers.js          # Message handlers
│   │   └── broadcaster.js       # Broadcast utilities
│   │
│   ├── state/
│   │   ├── index.js             # State manager exports
│   │   ├── accounts.js          # Account state management
│   │   ├── commandQueue.js      # Anti-detection command queue
│   │   ├── templates.js         # Template CRUD operations
│   │   └── settings.js          # Settings management
│   │
│   ├── services/
│   │   ├── templateExecutor.js  # Template execution logic
│   │   └── alertManager.js      # Alert handling
│   │
│   └── utils/
│       ├── logger.js            # Logging utility
│       ├── validation.js        # Input validation
│       └── timing.js            # Anti-detection timing
│
├── public/
│   ├── index.html
│   │
│   ├── css/
│   │   ├── variables.css        # CSS custom properties
│   │   ├── reset.css            # CSS reset
│   │   ├── tw-theme.css         # Tribal Wars styling
│   │   ├── layout.css           # Main layout
│   │   ├── components.css       # Reusable components
│   │   ├── cards.css            # Account cards
│   │   ├── modals.css           # Modal dialogs
│   │   ├── forms.css            # Form elements
│   │   └── responsive.css       # Media queries
│   │
│   ├── js/
│   │   ├── app.js               # Main application
│   │   ├── config.js            # Client configuration
│   │   ├── state.js             # Client-side state (Proxy-based reactivity)
│   │   ├── websocket.js         # WebSocket client
│   │   ├── router.js            # Tab navigation
│   │   │
│   │   ├── components/
│   │   │   ├── Component.js     # Base component class
│   │   │   ├── AccountCard.js   # Account card component
│   │   │   ├── DetailPanel.js   # Account detail panel
│   │   │   ├── Modal.js         # Modal base class
│   │   │   ├── BuildModal.js    # Build action modal
│   │   │   ├── AttackModal.js   # Attack action modal
│   │   │   ├── RecruitModal.js  # Recruitment modal
│   │   │   ├── ProgressBar.js   # Progress bar component
│   │   │   ├── Countdown.js     # Countdown timer
│   │   │   └── Toast.js         # Toast notifications
│   │   │
│   │   ├── tabs/
│   │   │   ├── Tab.js           # Base tab class
│   │   │   ├── AccountsTab.js   # Accounts tab
│   │   │   ├── BulkTab.js       # Bulk operations tab
│   │   │   ├── AlertsTab.js     # Alerts tab
│   │   │   ├── SettingsTab.js   # Settings tab
│   │   │   └── LogsTab.js       # Logs tab
│   │   │
│   │   ├── templates/
│   │   │   ├── BuildingTemplate.js   # Building template manager
│   │   │   └── RecruitTemplate.js    # Recruitment template manager
│   │   │
│   │   └── utils/
│   │       ├── dom.js           # DOM utilities
│   │       ├── format.js        # Formatting utilities
│   │       ├── twAssets.js      # TW CDN asset URLs
│   │       ├── sounds.js        # Sound manager
│   │       └── api.js           # API helpers
│   │
│   ├── assets/
│   │   └── sounds/
│   │       └── alert.mp3
│   │
│   └── favicon.ico
│
└── data/
    ├── accounts.json
    ├── templates.json
    ├── settings.json
    └── logs.json
```

---

## 🛠️ Technology Stack

### Backend
- **Node.js** (v18+)
- **Express.js** - HTTP server
- **ws** - WebSocket server
- **dotenv** - Environment variables
- **winston** - Logging

### Frontend
- **Vanilla JavaScript** (ES6+ modules)
- **CSS Custom Properties** - Theming
- **No frameworks** - Keep it simple and fast

### Data Storage
- **JSON files** - Simple file-based storage
- **In-memory state** - Fast access with periodic persistence

---

## 🎨 Visual Design Requirements

### Tribal Wars Theme (MANDATORY)

All UI must use authentic Tribal Wars styling:

```css
/* CSS Variables - Put in variables.css */
:root {
    /* Backgrounds */
    --tw-bg-dark: #3e2415;
    --tw-bg-medium: #5d4330;
    --tw-bg-light: #f4e4bc;
    --tw-bg-header: #c1a264;
    --tw-bg-input: #f8f4e8;
    --tw-bg-row-odd: #fff5da;
    --tw-bg-row-even: #f0e2be;
    
    /* Borders */
    --tw-border-dark: #2d1a0e;
    --tw-border-medium: #5d4330;
    --tw-border-gold: #dca;
    --tw-border-light: #c9a96e;
    
    /* Text */
    --tw-text-dark: #3e2415;
    --tw-text-light: #f4e4bc;
    --tw-text-header: #542c0f;
    --tw-text-link: #0000cc;
    
    /* Buttons */
    --tw-btn-green: #5d7e1e;
    --tw-btn-green-hover: #6d9122;
    --tw-btn-green-border: #3d5a0f;
    --tw-btn-red: #8b0000;
    --tw-btn-red-hover: #a50000;
    --tw-btn-brown: #5d4330;
    
    /* Status */
    --status-online: #5cb85c;
    --status-offline: #888888;
    --status-warning: #f0ad4e;
    --status-danger: #d9534f;
    --status-busy: #5bc0de;
    
    /* Spacing */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
    --spacing-xl: 32px;
    
    /* Border radius */
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 12px;
    
    /* Shadows */
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.2);
    --shadow-md: 0 4px 6px rgba(0,0,0,0.3);
    --shadow-lg: 0 10px 20px rgba(0,0,0,0.4);
    
    /* Transitions */
    --transition-fast: 150ms ease;
    --transition-normal: 250ms ease;
}
```

### TW CDN Assets

```javascript
// utils/twAssets.js
const TW_CDN = 'https://dshu.innogamescdn.com/asset/2a2f957f/graphic';

export const ASSETS = {
    // Backgrounds
    mainBg: `${TW_CDN}/index/main_bg.jpg`,
    headerBg: `${TW_CDN}/screen/tableheader_bg3.png`,
    contentBg: `${TW_CDN}/popup/content_background.png`,
    
    // Resources
    wood: `${TW_CDN}/holz.png`,
    stone: `${TW_CDN}/lehm.png`,
    iron: `${TW_CDN}/eisen.png`,
    population: `${TW_CDN}/face.png`,
    
    // Units
    unit: (name) => `${TW_CDN}/unit/unit_${name}.png`,
    
    // Buildings
    building: (name) => `${TW_CDN}/buildings/${name}.png`,
    
    // Icons
    attack: `${TW_CDN}/command/attack.png`,
    support: `${TW_CDN}/command/support.png`,
    return: `${TW_CDN}/command/return.png`,
};

export const UNITS = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

export const BUILDINGS = ['main', 'barracks', 'stable', 'garage', 'smith', 'market', 'wood', 'stone', 'iron', 'farm', 'storage', 'wall', 'hide', 'statue', 'place', 'snob', 'church', 'watchtower'];
```

---

## 📊 Data Structures

### Account State

```javascript
// Full account object structure
const accountSchema = {
    // Identity
    accountId: String,      // "hu97_12345"
    playerId: Number,
    playerName: String,
    world: String,          // "hu97"
    worldSpeed: Number,     // 1.6
    
    // Village (single village per account)
    village: {
        id: Number,
        name: String,
        x: Number,
        y: Number,
        points: Number
    },
    
    // Resources
    resources: {
        wood: Number,
        stone: Number,
        iron: Number,
        storage: Number,
        population: Number,
        populationMax: Number,
        productionWood: Number,
        productionStone: Number,
        productionIron: Number
    },
    
    // Troops (all unit types)
    troops: {
        spear: Number, sword: Number, axe: Number, archer: Number,
        spy: Number, light: Number, marcher: Number, heavy: Number,
        ram: Number, catapult: Number, knight: Number, snob: Number
    },
    
    // Buildings (all building types)
    buildings: {
        main: Number, barracks: Number, stable: Number, garage: Number,
        smith: Number, market: Number, place: Number, statue: Number,
        wood: Number, stone: Number, iron: Number, farm: Number,
        storage: Number, wall: Number, hide: Number
    },
    
    // Queues
    buildingQueue: [{
        building: String,
        level: Number,
        completesAt: Number  // timestamp
    }],
    
    recruitmentQueue: {
        barracks: [{ unit: String, amount: Number, completesAt: Number }],
        stable: [{ unit: String, amount: Number, completesAt: Number }],
        garage: [{ unit: String, amount: Number, completesAt: Number }]
    },
    
    // Commands
    incoming: [{
        id: String,
        type: String,       // "attack" | "support"
        originCoords: String,
        originPlayer: String,
        arrivalTime: Number,
        size: String        // "small" | "medium" | "large"
    }],
    
    outgoing: [{
        id: String,
        type: String,
        targetCoords: String,
        arrivalTime: Number
    }],
    
    // Status
    status: String,         // "online" | "offline" | "busy"
    lastUpdate: Number,
    gameSocketConnected: Boolean,
    
    // User data
    isFavorite: Boolean,
    notes: String,
    
    // Template progress
    buildingTemplateId: String,
    buildingTemplateStep: Number
};
```

### Building Template (SEQUENTIAL ORDER!)

```javascript
// CRITICAL: Building templates are SEQUENTIAL BUILD ORDERS, NOT target levels!
const buildingTemplateSchema = {
    id: String,
    name: String,
    createdAt: Number,
    updatedAt: Number,
    
    // Sequential steps (parsed from rawInput)
    steps: [{
        building: String,   // "main", "barracks", "wood", etc.
        level: Number       // Target level for this step
    }],
    
    // Original input string for editing
    rawInput: String,       // "MINES 1; main 2; farm 2; MINES 2; ..."
    
    // Calculated metadata
    totalSteps: Number,
    finalLevels: Object,    // { main: 20, barracks: 15, ... }
    estimatedPoints: Number,
    
    // Smart rules
    rules: {
        autoStorage: Boolean,   // Auto upgrade storage when full
        autoFarm: Boolean       // Auto upgrade farm when no population
    }
};

// Template parser function
function parseTemplate(rawInput) {
    const steps = [];
    const parts = rawInput.split(';').map(p => p.trim()).filter(Boolean);
    
    for (const part of parts) {
        const match = part.match(/^(\w+)\s+(\d+)$/i);
        if (!match) continue;
        
        const [, building, level] = match;
        const lvl = parseInt(level);
        
        if (building.toUpperCase() === 'MINES') {
            // MINES X expands to wood, stone, iron all to level X
            steps.push({ building: 'wood', level: lvl });
            steps.push({ building: 'stone', level: lvl });
            steps.push({ building: 'iron', level: lvl });
        } else {
            steps.push({ building: building.toLowerCase(), level: lvl });
        }
    }
    
    return steps;
}
```

### Recruitment Template

```javascript
const recruitmentTemplateSchema = {
    id: String,
    name: String,
    type: String,           // "offensive" | "defensive" | "mixed" | "other"
    createdAt: Number,
    updatedAt: Number,
    
    // Target unit counts
    targets: {
        spear: Number, sword: Number, axe: Number, archer: Number,
        spy: Number, light: Number, marcher: Number, heavy: Number,
        ram: Number, catapult: Number, knight: Number, snob: Number
    },
    
    // Calculated
    totalUnits: Number,
    farmSpace: Number
};
```

### Settings

```javascript
const settingsSchema = {
    // Connection
    serverUrl: String,
    apiKey: String,
    
    // Anti-detection timing
    timing: {
        minGlobalDelay: Number,     // 5000 (5 sec)
        maxGlobalDelay: Number,     // 15000 (15 sec)
        accountCooldown: Number,    // 30000 (30 sec)
        reportInterval: Number,     // 60000 (60 sec)
        reportJitter: Number        // 10000 (±10 sec)
    },
    
    // Alert settings
    alerts: {
        soundEnabled: Boolean,
        notificationsEnabled: Boolean,
        flashTitle: Boolean,
        soundFile: String,
        volume: Number              // 0.0 - 1.0
    },
    
    // Display settings
    display: {
        theme: String,              // "tribal-wars" | "dark" | "light"
        cardSize: String,           // "small" | "normal" | "large"
        sortBy: String,             // "name" | "world" | "points" | "lastUpdate"
        favoritesFirst: Boolean,
        hideOffline: Boolean,
        animations: Boolean
    },
    
    // Data
    logs: {
        retentionDays: Number
    }
};
```

---

## 🔧 Best Practices to Follow

### 1. Code Organization

```javascript
// ✅ DO: Use ES6 modules
// utils/format.js
export function formatNumber(num) {
    return num.toLocaleString('hu-HU');
}

export function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatTimestamp(ts) {
    return new Date(ts).toLocaleString('hu-HU');
}

// ✅ DO: Use named exports for utilities
// ✅ DO: Group related functions
```

### 2. Component Pattern

```javascript
// components/Component.js - Base class
export class Component {
    constructor(container) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        this.state = {};
    }
    
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }
    
    render() {
        // Override in subclass
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
    
    // DOM helper
    $(selector) {
        return this.container.querySelector(selector);
    }
    
    $$(selector) {
        return this.container.querySelectorAll(selector);
    }
}

// components/AccountCard.js - Example component
import { Component } from './Component.js';
import { ASSETS } from '../utils/twAssets.js';
import { formatNumber, formatTime } from '../utils/format.js';

export class AccountCard extends Component {
    constructor(container, account) {
        super(container);
        this.account = account;
        this.render();
    }
    
    update(account) {
        this.account = account;
        this.render();
    }
    
    render() {
        const { account } = this;
        const statusClass = account.status === 'online' ? 'online' : 
                           account.status === 'busy' ? 'busy' : 'offline';
        
        this.container.innerHTML = `
            <div class="account-card ${statusClass} ${account.isFavorite ? 'favorite' : ''}" 
                 data-account-id="${account.accountId}">
                <div class="card-header">
                    <span class="account-name">${account.world}_${account.playerName}</span>
                    <button class="favorite-btn ${account.isFavorite ? 'active' : ''}" 
                            data-action="toggle-favorite">⭐</button>
                    <span class="status-dot ${statusClass}"></span>
                </div>
                <div class="card-body">
                    <div class="village-info">
                        <span class="village-name">🏰 ${account.village.name}</span>
                        <span class="coords">📍 ${account.village.x}|${account.village.y}</span>
                        <span class="points">⭐ ${formatNumber(account.village.points)} pont</span>
                    </div>
                    <div class="resources">
                        ${this.renderResources()}
                    </div>
                    ${this.renderIncoming()}
                    ${this.renderBuildingQueue()}
                </div>
                <div class="card-footer">
                    <span class="last-update">Frissítve: ${this.getTimeAgo()}</span>
                </div>
            </div>
        `;
        
        this.bindEvents();
    }
    
    renderResources() {
        const { resources } = this.account;
        const storagePercent = Math.max(resources.wood, resources.stone, resources.iron) / resources.storage * 100;
        
        return `
            <div class="resource-row">
                <img src="${ASSETS.wood}" alt="Wood" class="resource-icon">
                <span class="resource-value">${formatNumber(resources.wood)}</span>
                <div class="resource-bar">
                    <div class="resource-fill wood" style="width: ${resources.wood / resources.storage * 100}%"></div>
                </div>
            </div>
            <!-- Stone and Iron similar -->
        `;
    }
    
    renderIncoming() {
        const { incoming } = this.account;
        if (!incoming || incoming.length === 0) return '';
        
        return `
            <div class="incoming-alert">
                ⚔️ ${incoming.length} bejövő támadás!
            </div>
        `;
    }
    
    renderBuildingQueue() {
        const { buildingQueue } = this.account;
        if (!buildingQueue || buildingQueue.length === 0) return '';
        
        const current = buildingQueue[0];
        const remaining = Math.max(0, current.completesAt - Date.now()) / 1000;
        
        return `
            <div class="building-queue">
                <img src="${ASSETS.building(current.building)}" alt="${current.building}">
                <span>${current.building} ${current.level}</span>
                <span class="countdown" data-target="${current.completesAt}">${formatTime(remaining)}</span>
            </div>
        `;
    }
    
    getTimeAgo() {
        const seconds = Math.floor((Date.now() - this.account.lastUpdate) / 1000);
        if (seconds < 60) return `${seconds} mp`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} perce`;
        return `${Math.floor(seconds / 3600)} órája`;
    }
    
    bindEvents() {
        this.$('.favorite-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.emit('toggle-favorite', this.account.accountId);
        });
        
        this.$('.account-card')?.addEventListener('click', () => {
            this.emit('select', this.account.accountId);
        });
    }
    
    emit(event, data) {
        this.container.dispatchEvent(new CustomEvent(event, { 
            detail: data, 
            bubbles: true 
        }));
    }
}
```

### 3. State Management

```javascript
// state.js - Simple reactive state with Proxy
class StateManager {
    constructor(initialState = {}) {
        this.listeners = new Map();
        this.state = this.createProxy(initialState);
    }
    
    createProxy(obj, path = '') {
        return new Proxy(obj, {
            set: (target, prop, value) => {
                const oldValue = target[prop];
                target[prop] = value;
                
                const fullPath = path ? `${path}.${prop}` : prop;
                this.notify(fullPath, value, oldValue);
                
                return true;
            },
            get: (target, prop) => {
                const value = target[prop];
                if (value && typeof value === 'object') {
                    return this.createProxy(value, path ? `${path}.${prop}` : prop);
                }
                return value;
            }
        });
    }
    
    subscribe(path, callback) {
        if (!this.listeners.has(path)) {
            this.listeners.set(path, new Set());
        }
        this.listeners.get(path).add(callback);
        
        // Return unsubscribe function
        return () => this.listeners.get(path).delete(callback);
    }
    
    notify(path, newValue, oldValue) {
        // Notify exact path listeners
        this.listeners.get(path)?.forEach(cb => cb(newValue, oldValue, path));
        
        // Notify parent path listeners (for nested updates)
        const parts = path.split('.');
        while (parts.length > 1) {
            parts.pop();
            const parentPath = parts.join('.');
            this.listeners.get(parentPath)?.forEach(cb => cb(newValue, oldValue, path));
        }
        
        // Notify wildcard listeners
        this.listeners.get('*')?.forEach(cb => cb(newValue, oldValue, path));
    }
    
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }
    
    set(path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        const parent = parts.reduce((obj, key) => obj[key], this.state);
        parent[last] = value;
    }
}

// Create global state
export const state = new StateManager({
    accounts: {},
    templates: {
        building: [],
        recruitment: []
    },
    settings: {},
    alerts: [],
    logs: [],
    ui: {
        activeTab: 'accounts',
        selectedAccount: null,
        isDetailPanelOpen: false,
        filters: {
            search: '',
            world: 'all',
            status: 'all'
        },
        sort: {
            by: 'name',
            favoritesFirst: true
        }
    }
});

// Usage example:
// state.subscribe('accounts', (accounts) => renderAccountCards(accounts));
// state.subscribe('ui.activeTab', (tab) => showTab(tab));
```

### 4. WebSocket Client

```javascript
// websocket.js
class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.handlers = new Map();
        this.pingInterval = null;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected');
                    this.reconnectAttempts = 0;
                    this.startPing();
                    resolve();
                };
                
                this.ws.onclose = (event) => {
                    console.log('❌ WebSocket closed:', event.code);
                    this.stopPing();
                    this.handleReconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            const { type, payload } = message;
            
            const handler = this.handlers.get(type);
            if (handler) {
                handler(payload);
            } else {
                console.warn('Unknown message type:', type);
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }
    
    on(type, handler) {
        this.handlers.set(type, handler);
    }
    
    send(type, payload) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        } else {
            console.warn('WebSocket not connected');
        }
    }
    
    handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnect attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => this.connect(), delay);
    }
    
    startPing() {
        this.pingInterval = setInterval(() => {
            this.send('ping', { timestamp: Date.now() });
        }, 30000);
    }
    
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const ws = new WebSocketClient('ws://localhost:3000/ws');
```

### 5. Anti-Detection Command Queue (Server-Side)

```javascript
// server/state/commandQueue.js
class CommandQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.lastCommandTime = 0;
        this.accountCooldowns = new Map();
        
        // Timing configuration
        this.config = {
            minGlobalDelay: 5000,   // 5 seconds
            maxGlobalDelay: 15000,  // 15 seconds
            accountCooldown: 30000  // 30 seconds per account
        };
    }
    
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    
    getRandomDelay() {
        const { minGlobalDelay, maxGlobalDelay } = this.config;
        return Math.floor(Math.random() * (maxGlobalDelay - minGlobalDelay)) + minGlobalDelay;
    }
    
    isAccountOnCooldown(accountId) {
        const lastCommand = this.accountCooldowns.get(accountId);
        if (!lastCommand) return false;
        return (Date.now() - lastCommand) < this.config.accountCooldown;
    }
    
    addCommand(command) {
        // command = { accountId, type, data, priority }
        return new Promise((resolve, reject) => {
            this.queue.push({
                ...command,
                resolve,
                reject,
                addedAt: Date.now()
            });
            
            // Sort by priority (lower = higher priority)
            this.queue.sort((a, b) => (a.priority || 5) - (b.priority || 5));
            
            // Start processing if not already
            if (!this.isProcessing) {
                this.processNext();
            }
        });
    }
    
    async processNext() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        // Find next command that's not on cooldown
        const commandIndex = this.queue.findIndex(cmd => 
            !this.isAccountOnCooldown(cmd.accountId)
        );
        
        if (commandIndex === -1) {
            // All accounts on cooldown, wait and retry
            const shortestWait = Math.min(
                ...Array.from(this.accountCooldowns.entries())
                    .map(([, time]) => this.config.accountCooldown - (Date.now() - time))
            );
            
            setTimeout(() => this.processNext(), Math.max(1000, shortestWait));
            return;
        }
        
        const command = this.queue.splice(commandIndex, 1)[0];
        
        // Wait for global delay
        const timeSinceLastCommand = Date.now() - this.lastCommandTime;
        const requiredDelay = this.getRandomDelay();
        
        if (timeSinceLastCommand < requiredDelay) {
            await this.sleep(requiredDelay - timeSinceLastCommand);
        }
        
        try {
            // Execute command
            const result = await this.executeCommand(command);
            
            // Update timing
            this.lastCommandTime = Date.now();
            this.accountCooldowns.set(command.accountId, Date.now());
            
            command.resolve(result);
            
        } catch (error) {
            command.reject(error);
        }
        
        // Process next command
        setTimeout(() => this.processNext(), 100);
    }
    
    async executeCommand(command) {
        // Send command to appropriate account via WebSocket
        // This will be implemented based on your account connection system
        console.log(`Executing command for ${command.accountId}:`, command.type);
        
        // Simulate command execution
        return { success: true, command };
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getQueueStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            cooldowns: Object.fromEntries(this.accountCooldowns)
        };
    }
}

export const commandQueue = new CommandQueue();
```

### 6. Building Template Executor

```javascript
// server/services/templateExecutor.js
import { commandQueue } from '../state/commandQueue.js';
import { accounts } from '../state/accounts.js';

// Building costs and requirements
const BUILDING_DATA = {
    main: { maxLevel: 30 },
    barracks: { maxLevel: 25, requires: { main: 3 } },
    stable: { maxLevel: 20, requires: { main: 10, barracks: 5, smith: 5 } },
    garage: { maxLevel: 15, requires: { main: 10, smith: 10 } },
    smith: { maxLevel: 20, requires: { main: 5, barracks: 1 } },
    market: { maxLevel: 25, requires: { main: 3, storage: 2 } },
    wood: { maxLevel: 30 },
    stone: { maxLevel: 30 },
    iron: { maxLevel: 30 },
    farm: { maxLevel: 30 },
    storage: { maxLevel: 30 },
    wall: { maxLevel: 20, requires: { barracks: 1 } },
    hide: { maxLevel: 10 },
    statue: { maxLevel: 1 },
    place: { maxLevel: 1 },
    snob: { maxLevel: 1, requires: { main: 20, market: 10, smith: 20 } }
};

class TemplateExecutor {
    constructor() {
        this.activeExecutions = new Map();
    }
    
    async executeForAccount(accountId, templateId, options = {}) {
        const account = accounts.get(accountId);
        const template = templates.get(templateId);
        
        if (!account || !template) {
            throw new Error('Account or template not found');
        }
        
        const { maxOperations = 2 } = options;
        const results = [];
        
        for (let i = 0; i < maxOperations; i++) {
            const result = await this.executeNextStep(account, template, options);
            results.push(result);
            
            if (result.status === 'completed' || result.status === 'blocked') {
                break;
            }
        }
        
        return results;
    }
    
    async executeNextStep(account, template, options = {}) {
        const currentStep = account.buildingTemplateStep || 0;
        
        // Check if template is completed
        if (currentStep >= template.steps.length) {
            return { status: 'completed', message: 'Sablon teljesítve!' };
        }
        
        const step = template.steps[currentStep];
        const currentLevel = account.buildings[step.building] || 0;
        
        // Check if already at or above target level
        if (currentLevel >= step.level) {
            // Skip to next step
            account.buildingTemplateStep = currentStep + 1;
            return { 
                status: 'skipped', 
                message: `${step.building} már ${currentLevel} szinten van`,
                nextStep: currentStep + 1
            };
        }
        
        // Check prerequisites
        const prereqs = BUILDING_DATA[step.building]?.requires;
        if (prereqs) {
            for (const [reqBuilding, reqLevel] of Object.entries(prereqs)) {
                if ((account.buildings[reqBuilding] || 0) < reqLevel) {
                    return {
                        status: 'blocked',
                        message: `Követelmény hiányzik: ${reqBuilding} ${reqLevel}`,
                        missing: { building: reqBuilding, level: reqLevel }
                    };
                }
            }
        }
        
        // Check resources (simplified - would need DSUtil for accurate costs)
        const cost = this.estimateCost(step.building, currentLevel + 1);
        const { resources } = account;
        
        if (resources.wood < cost.wood || 
            resources.stone < cost.stone || 
            resources.iron < cost.iron) {
            
            // Check if auto-storage should trigger
            if (options.autoStorage && this.shouldUpgradeStorage(account, cost)) {
                return this.executeStorageUpgrade(account);
            }
            
            return {
                status: 'blocked',
                message: 'Nincs elég nyersanyag',
                needed: cost,
                have: { wood: resources.wood, stone: resources.stone, iron: resources.iron }
            };
        }
        
        // Check population
        if (options.autoFarm && resources.population >= resources.populationMax - 5) {
            return this.executeFarmUpgrade(account);
        }
        
        // Check building queue
        if (account.buildingQueue.length >= 2) {
            return {
                status: 'blocked',
                message: 'Építési sor tele (2/2)'
            };
        }
        
        // Execute build command
        try {
            await commandQueue.addCommand({
                accountId: account.accountId,
                type: 'build',
                data: {
                    building: step.building,
                    level: currentLevel + 1
                },
                priority: 3
            });
            
            // Update step on success
            account.buildingTemplateStep = currentStep + 1;
            
            return {
                status: 'success',
                message: `${step.building} ${currentLevel + 1} elindítva`,
                building: step.building,
                level: currentLevel + 1,
                nextStep: currentStep + 1
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }
    
    estimateCost(building, level) {
        // Simplified cost estimation
        // In real implementation, use DSUtil.buildCost()
        const baseCosts = {
            main: { wood: 90, stone: 80, iron: 70 },
            barracks: { wood: 200, stone: 170, iron: 90 },
            wood: { wood: 50, stone: 60, iron: 40 },
            stone: { wood: 65, stone: 50, iron: 40 },
            iron: { wood: 75, stone: 65, iron: 70 },
            farm: { wood: 45, stone: 40, iron: 30 },
            storage: { wood: 60, stone: 50, iron: 40 }
        };
        
        const base = baseCosts[building] || { wood: 100, stone: 100, iron: 100 };
        const factor = Math.pow(1.26, level - 1);
        
        return {
            wood: Math.floor(base.wood * factor),
            stone: Math.floor(base.stone * factor),
            iron: Math.floor(base.iron * factor)
        };
    }
    
    shouldUpgradeStorage(account, neededCost) {
        const maxNeeded = Math.max(neededCost.wood, neededCost.stone, neededCost.iron);
        return maxNeeded > account.resources.storage * 0.95;
    }
    
    async executeStorageUpgrade(account) {
        const currentLevel = account.buildings.storage || 1;
        
        return commandQueue.addCommand({
            accountId: account.accountId,
            type: 'build',
            data: { building: 'storage', level: currentLevel + 1 },
            priority: 1 // High priority
        });
    }
    
    async executeFarmUpgrade(account) {
        const currentLevel = account.buildings.farm || 1;
        
        return commandQueue.addCommand({
            accountId: account.accountId,
            type: 'build',
            data: { building: 'farm', level: currentLevel + 1 },
            priority: 1 // High priority
        });
    }
}

export const templateExecutor = new TemplateExecutor();
```

---

## 🖥️ UI Implementation

### Main HTML Structure

```html
<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TW Controller</title>
    
    <!-- CSS -->
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/reset.css">
    <link rel="stylesheet" href="css/tw-theme.css">
    <link rel="stylesheet" href="css/layout.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/cards.css">
    <link rel="stylesheet" href="css/modals.css">
    <link rel="stylesheet" href="css/forms.css">
    <link rel="stylesheet" href="css/responsive.css">
</head>
<body>
    <div id="app">
        <!-- Navigation -->
        <nav class="main-nav">
            <div class="nav-brand">
                <img src="logo.png" alt="TW Controller" class="logo">
            </div>
            <div class="nav-tabs">
                <button class="nav-tab active" data-tab="accounts">Fiókok</button>
                <button class="nav-tab" data-tab="bulk">Tömeges Műveletek</button>
                <button class="nav-tab" data-tab="alerts">
                    Riasztások
                    <span class="badge" id="alert-count">0</span>
                </button>
                <button class="nav-tab" data-tab="settings">Beállítások</button>
                <button class="nav-tab" data-tab="logs">Napló</button>
            </div>
            <div class="nav-status">
                <span class="connection-status" id="connection-status">
                    <span class="status-dot"></span>
                    <span class="status-text">Kapcsolódás...</span>
                </span>
                <span class="online-count" id="online-count">0/0</span>
            </div>
        </nav>
        
        <!-- Main Content -->
        <main class="main-content">
            <!-- Accounts Tab -->
            <section class="tab-content active" id="tab-accounts">
                <div class="tab-header">
                    <div class="filters">
                        <input type="text" id="search" placeholder="Keresés..." class="search-input">
                        <select id="world-filter" class="filter-select">
                            <option value="all">Minden világ</option>
                        </select>
                        <select id="status-filter" class="filter-select">
                            <option value="all">Minden státusz</option>
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                        </select>
                    </div>
                    <div class="sort-options">
                        <label>
                            <input type="checkbox" id="favorites-first" checked>
                            Kedvencek elöl
                        </label>
                        <select id="sort-by" class="filter-select">
                            <option value="name">Név (A-Z)</option>
                            <option value="world">Világ</option>
                            <option value="points">Pontok</option>
                            <option value="lastUpdate">Frissítés ideje</option>
                        </select>
                        <label>
                            <input type="checkbox" id="hide-offline">
                            Offline elrejtése
                        </label>
                    </div>
                </div>
                <div class="accounts-grid" id="accounts-grid">
                    <!-- Account cards rendered here -->
                </div>
            </section>
            
            <!-- Bulk Operations Tab -->
            <section class="tab-content" id="tab-bulk">
                <!-- Bulk operations UI -->
            </section>
            
            <!-- Alerts Tab -->
            <section class="tab-content" id="tab-alerts">
                <!-- Alerts UI -->
            </section>
            
            <!-- Settings Tab -->
            <section class="tab-content" id="tab-settings">
                <!-- Settings UI -->
            </section>
            
            <!-- Logs Tab -->
            <section class="tab-content" id="tab-logs">
                <!-- Logs UI -->
            </section>
        </main>
        
        <!-- Detail Panel (slides in from right) -->
        <aside class="detail-panel" id="detail-panel">
            <!-- Account details rendered here -->
        </aside>
        
        <!-- Modal Container -->
        <div class="modal-overlay" id="modal-overlay">
            <div class="modal" id="modal">
                <!-- Modal content rendered here -->
            </div>
        </div>
        
        <!-- Toast Container -->
        <div class="toast-container" id="toast-container"></div>
    </div>
    
    <!-- JavaScript -->
    <script type="module" src="js/app.js"></script>
</body>
</html>
```

### Main App Entry Point

```javascript
// js/app.js
import { state } from './state.js';
import { ws } from './websocket.js';
import { initRouter } from './router.js';
import { AccountsTab } from './tabs/AccountsTab.js';
import { BulkTab } from './tabs/BulkTab.js';
import { AlertsTab } from './tabs/AlertsTab.js';
import { SettingsTab } from './tabs/SettingsTab.js';
import { LogsTab } from './tabs/LogsTab.js';
import { initSounds } from './utils/sounds.js';

class App {
    constructor() {
        this.tabs = {};
    }
    
    async init() {
        console.log('🚀 Initializing TW Controller...');
        
        // Initialize tabs
        this.tabs = {
            accounts: new AccountsTab('#tab-accounts'),
            bulk: new BulkTab('#tab-bulk'),
            alerts: new AlertsTab('#tab-alerts'),
            settings: new SettingsTab('#tab-settings'),
            logs: new LogsTab('#tab-logs')
        };
        
        // Initialize router
        initRouter(this.tabs);
        
        // Initialize sounds
        initSounds();
        
        // Setup WebSocket handlers
        this.setupWebSocket();
        
        // Connect to server
        try {
            await ws.connect();
            this.updateConnectionStatus(true);
        } catch (error) {
            console.error('Failed to connect:', error);
            this.updateConnectionStatus(false);
        }
        
        // Subscribe to state changes
        this.setupStateSubscriptions();
        
        console.log('✅ App initialized');
    }
    
    setupWebSocket() {
        ws.on('accounts:update', (accounts) => {
            Object.assign(state.state.accounts, accounts);
        });
        
        ws.on('account:update', ({ accountId, data }) => {
            if (state.state.accounts[accountId]) {
                Object.assign(state.state.accounts[accountId], data);
            } else {
                state.state.accounts[accountId] = data;
            }
        });
        
        ws.on('alert:incoming', (alert) => {
            state.state.alerts.unshift(alert);
            this.handleNewAlert(alert);
        });
        
        ws.on('command:result', (result) => {
            this.handleCommandResult(result);
        });
        
        ws.on('pong', ({ timestamp }) => {
            const ping = Date.now() - timestamp;
            document.querySelector('.status-text').textContent = `${ping}ms`;
        });
    }
    
    setupStateSubscriptions() {
        // Update account count
        state.subscribe('accounts', () => {
            const accounts = Object.values(state.state.accounts);
            const online = accounts.filter(a => a.status === 'online').length;
            document.getElementById('online-count').textContent = `${online}/${accounts.length}`;
        });
        
        // Update alert badge
        state.subscribe('alerts', (alerts) => {
            const activeAlerts = alerts.filter(a => !a.dismissed).length;
            const badge = document.getElementById('alert-count');
            badge.textContent = activeAlerts;
            badge.style.display = activeAlerts > 0 ? 'inline' : 'none';
        });
    }
    
    updateConnectionStatus(connected) {
        const status = document.getElementById('connection-status');
        const dot = status.querySelector('.status-dot');
        const text = status.querySelector('.status-text');
        
        if (connected) {
            dot.classList.add('online');
            dot.classList.remove('offline');
            text.textContent = 'Kapcsolódva';
        } else {
            dot.classList.add('offline');
            dot.classList.remove('online');
            text.textContent = 'Nincs kapcsolat';
        }
    }
    
    handleNewAlert(alert) {
        // Play sound if enabled
        if (state.state.settings?.alerts?.soundEnabled) {
            import('./utils/sounds.js').then(({ playAlert }) => playAlert());
        }
        
        // Show browser notification if enabled
        if (state.state.settings?.alerts?.notificationsEnabled) {
            this.showNotification(alert);
        }
        
        // Flash title if enabled
        if (state.state.settings?.alerts?.flashTitle) {
            this.flashTitle('⚔️ TÁMADÁS!');
        }
    }
    
    showNotification(alert) {
        if (Notification.permission === 'granted') {
            new Notification('TW Controller - Bejövő támadás!', {
                body: `${alert.originCoords} → ${alert.targetCoords}`,
                icon: '/favicon.ico'
            });
        }
    }
    
    flashTitle(message) {
        const originalTitle = document.title;
        let isFlashing = true;
        
        const flash = () => {
            if (!isFlashing) return;
            document.title = document.title === originalTitle ? message : originalTitle;
            setTimeout(flash, 1000);
        };
        
        flash();
        
        // Stop after 30 seconds
        setTimeout(() => {
            isFlashing = false;
            document.title = originalTitle;
        }, 30000);
    }
    
    handleCommandResult(result) {
        // Show toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${result.success ? 'success' : 'error'}`;
        toast.textContent = result.message;
        
        document.getElementById('toast-container').appendChild(toast);
        
        setTimeout(() => toast.remove(), 5000);
    }
}

// Start app
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
```

---

## ✅ Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Set up project structure
- [ ] Create package.json with dependencies
- [ ] Implement server with Express + WebSocket
- [ ] Create CSS variables and TW theme
- [ ] Build basic HTML skeleton
- [ ] Implement client-side state management
- [ ] Implement WebSocket client with reconnection

### Phase 2: Account Display
- [ ] Build AccountCard component
- [ ] Implement accounts grid with filtering
- [ ] Add sorting functionality
- [ ] Build DetailPanel component
- [ ] Implement favorites toggle
- [ ] Add real-time countdown timers

### Phase 3: Individual Actions
- [ ] Build Modal base component
- [ ] Implement BuildModal
- [ ] Implement AttackModal
- [ ] Implement SupportModal (similar to Attack)
- [ ] Implement RecruitModal
- [ ] Connect modals to command queue

### Phase 4: Templates
- [ ] Build template parser (with MINES expansion)
- [ ] Implement BuildingTemplate manager UI
- [ ] Implement RecruitmentTemplate manager UI
- [ ] Build template executor service
- [ ] Add template progress tracking per account

### Phase 5: Bulk Operations
- [ ] Build account selection UI
- [ ] Implement template-based bulk execution
- [ ] Add progress tracking with real-time updates
- [ ] Implement preview functionality

### Phase 6: Alerts & Logs
- [ ] Build AlertsTab with incoming attack display
- [ ] Implement sound alerts
- [ ] Add browser notifications
- [ ] Build LogsTab with filtering
- [ ] Implement log persistence

### Phase 7: Settings & Polish
- [ ] Build SettingsTab UI
- [ ] Implement settings persistence
- [ ] Add import/export functionality
- [ ] Final styling polish
- [ ] Responsive design testing
- [ ] Error handling improvements

---

## 🚀 Getting Started Commands

```bash
# Create project
mkdir tw-dashboard && cd tw-dashboard

# Initialize npm
npm init -y

# Install dependencies
npm install express ws dotenv winston uuid

# Create folder structure
mkdir -p server/{websocket,state,services,utils}
mkdir -p public/{css,js/{components,tabs,templates,utils},assets/sounds}
mkdir -p data

# Start development
node server/index.js
```

---

## 📝 Important Notes

1. **Hungarian UI**: All user-facing text must be in Hungarian
2. **TW Visual Style**: Use Tribal Wars colors, textures, and icons from CDN
3. **Sequential Templates**: Building templates are step-by-step orders, NOT target levels
4. **Anti-Detection**: Always use command queue with random delays
5. **Single Village**: Each account has only one village (no multi-village support needed)
6. **Real-time Updates**: Use WebSocket for all account data updates
7. **Error Handling**: Always provide user feedback for errors
8. **Persistence**: Save state to JSON files periodically

---

## 🎯 Success Criteria

The dashboard is complete when:

1. ✅ Can display 30+ accounts in real-time
2. ✅ Can execute individual build/attack/recruit commands
3. ✅ Can execute bulk operations with template-based automation
4. ✅ Shows incoming attack alerts with sound
5. ✅ Has full TW visual styling
6. ✅ Works on desktop browsers (Chrome, Firefox, Edge)
7. ✅ All text is in Hungarian
8. ✅ Commands are rate-limited for anti-detection

---

**Good luck with the implementation! 🏰⚔️**