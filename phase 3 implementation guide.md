# Phase 3 Implementation Guide: Command Executors

## Overview

This guide provides detailed implementation specifications for the command execution system. Claude Code should follow these patterns exactly.

---

## ⚠️ CRITICAL: MULTI-ACCOUNT SAFETY RULES

### The Problem
- 30+ accounts running simultaneously
- Each account on different VPS with dedicated residential proxy
- Commands from dashboard could trigger 30 accounts at once
- Tribal Wars detects coordinated automation patterns

### Golden Rules

1. **NEVER execute commands on multiple accounts simultaneously**
2. **Server must queue and stagger command execution**
3. **Each account must have independent timing jitter**
4. **Commands should appear as individual human actions, not coordinated bot activity**

---

## 0. SERVER-SIDE COMMAND QUEUE (IMPLEMENT FIRST!)

### File: `/server/state/commandQueue.js`

```javascript
/**
 * Command Queue System
 * Ensures only ONE command executes across ALL accounts at any time
 * Prevents IP correlation and coordinated action detection
 */

class CommandQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.lastExecutionTime = 0;
        
        // Minimum delay between ANY commands across ALL accounts
        this.MIN_GLOBAL_DELAY = 5000;  // 5 seconds minimum
        this.MAX_GLOBAL_DELAY = 15000; // 15 seconds maximum
        
        // Per-account cooldowns
        this.accountCooldowns = new Map(); // accountId -> lastCommandTime
        this.ACCOUNT_COOLDOWN = 30000; // 30 seconds between commands to same account
    }
    
    /**
     * Add command to queue with priority
     */
    enqueue(accountId, command, priority = 'normal') {
        const queueItem = {
            id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            accountId,
            command,
            priority, // 'high', 'normal', 'low'
            enqueuedAt: Date.now(),
            status: 'pending'
        };
        
        // Insert based on priority
        if (priority === 'high') {
            // Find first non-high priority item and insert before it
            const insertIndex = this.queue.findIndex(item => item.priority !== 'high');
            if (insertIndex === -1) {
                this.queue.push(queueItem);
            } else {
                this.queue.splice(insertIndex, 0, queueItem);
            }
        } else {
            this.queue.push(queueItem);
        }
        
        // Start processing if not already
        this.processNext();
        
        return queueItem.id;
    }
    
    /**
     * Process next command in queue with safety delays
     */
    async processNext() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        try {
            // Find next executable command (respecting account cooldowns)
            const nextItem = this.findNextExecutable();
            
            if (!nextItem) {
                // All commands are in cooldown, wait and retry
                const waitTime = this.getMinCooldownRemaining();
                console.log(`[Queue] All accounts in cooldown, waiting ${waitTime}ms`);
                setTimeout(() => {
                    this.isProcessing = false;
                    this.processNext();
                }, waitTime);
                return;
            }
            
            // Calculate delay since last execution
            const timeSinceLastExec = Date.now() - this.lastExecutionTime;
            const requiredDelay = this.getRandomDelay();
            
            if (timeSinceLastExec < requiredDelay) {
                const waitTime = requiredDelay - timeSinceLastExec;
                console.log(`[Queue] Waiting ${waitTime}ms before next command`);
                await this.sleep(waitTime);
            }
            
            // Execute the command
            console.log(`[Queue] Executing command for ${nextItem.accountId}: ${nextItem.command.type}`);
            nextItem.status = 'executing';
            
            const success = await this.executeCommand(nextItem);
            
            // Update tracking
            this.lastExecutionTime = Date.now();
            this.accountCooldowns.set(nextItem.accountId, Date.now());
            
            // Remove from queue
            this.queue = this.queue.filter(item => item.id !== nextItem.id);
            
            // Log result
            console.log(`[Queue] Command ${success ? 'succeeded' : 'failed'} for ${nextItem.accountId}`);
            
        } catch (error) {
            console.error('[Queue] Error processing command:', error);
        } finally {
            this.isProcessing = false;
            
            // Continue processing if more items
            if (this.queue.length > 0) {
                // Add small delay before checking next
                setTimeout(() => this.processNext(), 1000);
            }
        }
    }
    
    /**
     * Find next command that can be executed (not in cooldown)
     */
    findNextExecutable() {
        const now = Date.now();
        
        for (const item of this.queue) {
            const lastCommandTime = this.accountCooldowns.get(item.accountId) || 0;
            const timeSinceLastCommand = now - lastCommandTime;
            
            if (timeSinceLastCommand >= this.ACCOUNT_COOLDOWN) {
                return item;
            }
        }
        
        return null;
    }
    
    /**
     * Get minimum remaining cooldown across all queued accounts
     */
    getMinCooldownRemaining() {
        const now = Date.now();
        let minRemaining = this.ACCOUNT_COOLDOWN;
        
        for (const item of this.queue) {
            const lastCommandTime = this.accountCooldowns.get(item.accountId) || 0;
            const remaining = this.ACCOUNT_COOLDOWN - (now - lastCommandTime);
            if (remaining < minRemaining && remaining > 0) {
                minRemaining = remaining;
            }
        }
        
        return Math.max(minRemaining, 1000);
    }
    
    /**
     * Get random delay between commands (human-like variance)
     */
    getRandomDelay() {
        return this.MIN_GLOBAL_DELAY + 
               Math.random() * (this.MAX_GLOBAL_DELAY - this.MIN_GLOBAL_DELAY);
    }
    
    /**
     * Execute command via WebSocket
     */
    async executeCommand(queueItem) {
        const { sendToAccount } = require('../websocket');
        return sendToAccount(queueItem.accountId, queueItem.command);
    }
    
    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            pendingByAccount: this.queue.reduce((acc, item) => {
                acc[item.accountId] = (acc[item.accountId] || 0) + 1;
                return acc;
            }, {}),
            accountCooldowns: Object.fromEntries(
                Array.from(this.accountCooldowns.entries()).map(([id, time]) => [
                    id,
                    Math.max(0, this.ACCOUNT_COOLDOWN - (Date.now() - time))
                ])
            )
        };
    }
    
    /**
     * Cancel pending commands for an account
     */
    cancelForAccount(accountId) {
        const removed = this.queue.filter(item => item.accountId === accountId);
        this.queue = this.queue.filter(item => item.accountId !== accountId);
        return removed.length;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
const commandQueue = new CommandQueue();

module.exports = { commandQueue };
```

### Updated Routes Using Queue

```javascript
// In /server/routes/commands.js

const { commandQueue } = require('../state/commandQueue');

router.post('/send-troops', async (req, res) => {
    // ... validation code ...
    
    const actionId = generateActionId();
    const command = {
        type: 'sendTroops',
        actionId,
        targetCoords,
        troops,
        sendType,
        executeAt
    };
    
    // QUEUE the command instead of sending directly!
    const queueId = commandQueue.enqueue(accountId, command, 'normal');
    
    res.json({
        success: true,
        actionId,
        queueId,
        message: 'Command queued for execution',
        queuePosition: commandQueue.queue.findIndex(q => q.id === queueId) + 1
    });
});

// Queue status endpoint
router.get('/queue/status', (req, res) => {
    res.json(commandQueue.getStatus());
});

// Cancel commands for account
router.delete('/queue/:accountId', (req, res) => {
    const cancelled = commandQueue.cancelForAccount(req.params.accountId);
    res.json({ cancelled });
});
```

---

---

## 1. USERSCRIPT EXECUTORS

### File: `/userscript/tw-agent.user.js`

### 1.0 Anti-Detection Timing System (CRITICAL!)

```javascript
// ============ ANTI-DETECTION TIMING SYSTEM ============
// Each account must behave independently with unique timing patterns

/**
 * Account-specific timing fingerprint
 * Generated once per session, creates unique behavior pattern per account
 */
const TIMING_FINGERPRINT = {
    // Base delays unique to this account instance
    baseDelay: 200 + Math.floor(Math.random() * 300),      // 200-500ms base
    actionVariance: 0.3 + Math.random() * 0.4,              // 30-70% variance
    typingSpeed: 50 + Math.floor(Math.random() * 100),      // 50-150ms per char
    scrollBehavior: Math.random() > 0.5 ? 'smooth' : 'auto',
    
    // Session-specific patterns
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    sessionStart: Date.now(),
    actionsThisSession: 0,
    
    // Fatigue simulation (humans slow down over time)
    getFatigueMultiplier() {
        const minutesActive = (Date.now() - this.sessionStart) / 60000;
        // Slight slowdown after 30 mins, more after 60 mins
        if (minutesActive > 60) return 1.3 + Math.random() * 0.2;
        if (minutesActive > 30) return 1.1 + Math.random() * 0.15;
        return 1.0;
    }
};

/**
 * Get human-like delay with account-specific variance
 */
function getHumanDelay(baseMs = 200, maxMs = 500) {
    const variance = TIMING_FINGERPRINT.actionVariance;
    const fatigue = TIMING_FINGERPRINT.getFatigueMultiplier();
    
    // Calculate delay with variance
    const range = maxMs - baseMs;
    const randomFactor = 0.5 + Math.random(); // 0.5x to 1.5x
    const delay = (baseMs + range * Math.random()) * randomFactor * fatigue;
    
    // Add occasional "thinking pause" (5% chance of longer delay)
    if (Math.random() < 0.05) {
        return delay + 1000 + Math.random() * 2000; // Extra 1-3 seconds
    }
    
    return Math.floor(delay);
}

/**
 * Simulate human typing with variable speed
 */
async function humanType(input, value) {
    const chars = value.toString().split('');
    input.focus();
    input.value = '';
    
    for (const char of chars) {
        input.value += char;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Variable typing speed per character
        const charDelay = TIMING_FINGERPRINT.typingSpeed * (0.5 + Math.random());
        await sleep(charDelay);
    }
    
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(getHumanDelay(100, 300));
}

/**
 * Track action to prevent rapid consecutive actions
 */
let lastActionTime = 0;
const MIN_ACTION_INTERVAL = 2000; // Minimum 2 seconds between major actions

async function waitForSafeActionWindow() {
    const timeSinceLastAction = Date.now() - lastActionTime;
    
    if (timeSinceLastAction < MIN_ACTION_INTERVAL) {
        const waitTime = MIN_ACTION_INTERVAL - timeSinceLastAction + getHumanDelay(500, 1500);
        console.log(`[TW-Agent] Waiting ${waitTime}ms for safe action window`);
        await sleep(waitTime);
    }
    
    lastActionTime = Date.now();
    TIMING_FINGERPRINT.actionsThisSession++;
}

/**
 * Random micro-movements to simulate human behavior
 * Call occasionally during longer operations
 */
async function simulateHumanPresence() {
    // Occasionally scroll slightly
    if (Math.random() < 0.3) {
        const scrollAmount = (Math.random() - 0.5) * 50;
        window.scrollBy({ top: scrollAmount, behavior: TIMING_FINGERPRINT.scrollBehavior });
        await sleep(getHumanDelay(200, 400));
    }
    
    // Occasionally move focus
    if (Math.random() < 0.1) {
        document.body.focus();
        await sleep(getHumanDelay(100, 200));
    }
}
```

### 1.1 Core Executor Utilities (Add These First)

```javascript
// ============ EXECUTOR UTILITIES ============

/**
 * Navigate to a game screen
 * @param {string} screen - Screen name (e.g., 'place', 'main', 'barracks')
 * @param {object} params - Additional URL parameters
 */
async function navigateTo(screen, params = {}) {
    const baseUrl = `${window.location.origin}/game.php`;
    const villageId = game_data.village.id;
    
    const urlParams = new URLSearchParams({
        village: villageId,
        screen: screen,
        ...params
    });
    
    const targetUrl = `${baseUrl}?${urlParams.toString()}`;
    
    // Check if already on the page
    if (window.location.href.includes(`screen=${screen}`)) {
        return true;
    }
    
    // Navigate
    window.location.href = targetUrl;
    
    // Return false to indicate navigation happened (page will reload)
    return false;
}

/**
 * Check if currently on a specific screen
 */
function isOnScreen(screen) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('screen') === screen;
}

/**
 * Wait for an element to appear in DOM
 */
async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await sleep(100);
    }
    
    throw new Error(`Element ${selector} not found within ${timeout}ms`);
}

/**
 * Human-like delay between actions
 */
function humanDelay(min = 100, max = 300) {
    return sleep(min + Math.random() * (max - min));
}

/**
 * Fill an input field with human-like behavior
 */
async function fillInput(input, value) {
    if (!input) return false;
    
    // Clear existing value
    input.value = '';
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    await humanDelay(50, 100);
    
    // Type value
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await humanDelay(50, 150);
    
    return true;
}

/**
 * Click an element with human-like behavior
 */
async function clickElement(element) {
    if (!element) return false;
    
    // Scroll into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await humanDelay(100, 200);
    
    // Click
    element.click();
    await humanDelay(100, 200);
    
    return true;
}

/**
 * Store pending command for execution after page navigation
 */
function storePendingCommand(command) {
    GM_setValue('pendingCommand', JSON.stringify(command));
}

/**
 * Get and clear pending command
 */
function getPendingCommand() {
    const cmd = GM_getValue('pendingCommand', null);
    if (cmd) {
        GM_setValue('pendingCommand', null);
        return JSON.parse(cmd);
    }
    return null;
}
```

### 1.2 Send Troops Executor

```javascript
// ============ SEND TROOPS EXECUTOR ============

/**
 * Execute send troops command
 * Flow: Rally Point → Fill Form → Confirm → Report Result
 */
async function executeSendTroops(command) {
    const { actionId, targetCoords, troops, sendType, executeAt } = command;
    
    try {
        // Step 1: Ensure we're on rally point
        if (!isOnScreen('place')) {
            // Store command and navigate
            storePendingCommand({ ...command, step: 'fillForm' });
            navigateTo('place');
            return; // Page will reload
        }
        
        // Step 2: Check if on confirmation page
        const confirmBtn = document.getElementById('troop_confirm_submit');
        if (confirmBtn) {
            // We're on confirmation page
            return await handleTroopConfirmation(command);
        }
        
        // Step 3: Fill the attack form
        await fillTroopForm(targetCoords, troops, sendType);
        
        // Step 4: Click attack/support button
        const attackBtn = document.getElementById('target_attack');
        const supportBtn = document.getElementById('target_support');
        const submitBtn = sendType === 'support' ? supportBtn : attackBtn;
        
        if (!submitBtn) {
            throw new Error('Submit button not found');
        }
        
        // Store command for confirmation page
        storePendingCommand({ ...command, step: 'confirm' });
        
        await clickElement(submitBtn);
        
    } catch (error) {
        sendCommandResult(actionId, false, error.message);
    }
}

/**
 * Fill the troop sending form
 */
async function fillTroopForm(targetCoords, troops, sendType) {
    // Parse coordinates
    const [x, y] = targetCoords.split('|');
    
    // Fill target coordinates
    const inputX = document.getElementById('inputx') || document.querySelector('input[name="x"]');
    const inputY = document.getElementById('inputy') || document.querySelector('input[name="y"]');
    
    if (!inputX || !inputY) {
        throw new Error('Coordinate inputs not found');
    }
    
    await fillInput(inputX, x);
    await humanDelay(100, 200);
    await fillInput(inputY, y);
    await humanDelay(100, 200);
    
    // Fill troop counts
    const unitOrder = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
    
    for (const unit of unitOrder) {
        const count = troops[unit] || 0;
        if (count > 0) {
            const input = document.getElementById(`unit_input_${unit}`) || 
                         document.querySelector(`input[name="${unit}"]`);
            if (input) {
                await fillInput(input, count.toString());
                await humanDelay(50, 150);
            }
        }
    }
}

/**
 * Handle the confirmation page
 */
async function handleTroopConfirmation(command) {
    const { actionId, executeAt } = command;
    
    try {
        const confirmBtn = document.getElementById('troop_confirm_submit');
        
        if (!confirmBtn) {
            throw new Error('Confirm button not found');
        }
        
        // If timed send, wait until executeAt
        if (executeAt) {
            const now = Date.now();
            const delay = executeAt - now - 100; // 100ms buffer
            
            if (delay > 0) {
                console.log(`[TW-Agent] Waiting ${delay}ms for timed send...`);
                await sleep(delay);
            }
        }
        
        // Click confirm
        await clickElement(confirmBtn);
        
        // Wait for result
        await sleep(500);
        
        // Parse arrival time from resulting page
        const arrivalTime = parseArrivalTime();
        
        sendCommandResult(actionId, true, 'Troops sent successfully', {
            arrivalTime: arrivalTime
        });
        
    } catch (error) {
        sendCommandResult(actionId, false, error.message);
    }
}

/**
 * Parse arrival time from command confirmation
 */
function parseArrivalTime() {
    // Look for the arrival time in the command info
    // Selectors may vary by TW version
    const arrivalElement = document.querySelector('.command-container .arrival, .arrive_time');
    
    if (arrivalElement) {
        // Parse the time string to timestamp
        // This depends on the server's time format
        return arrivalElement.textContent.trim();
    }
    
    return null;
}
```

### 1.3 Build Building Executor

```javascript
// ============ BUILD BUILDING EXECUTOR ============

/**
 * Execute build building command
 * Flow: HQ → Find Building → Click Build → Report Result
 */
async function executeBuildBuilding(command) {
    const { actionId, building, levels = 1 } = command;
    
    try {
        // Step 1: Ensure we're on main building (HQ)
        if (!isOnScreen('main')) {
            storePendingCommand({ ...command, step: 'build' });
            navigateTo('main');
            return;
        }
        
        // Step 2: Find the building row
        const buildingRow = findBuildingRow(building);
        
        if (!buildingRow) {
            throw new Error(`Building ${building} not found in HQ`);
        }
        
        // Step 3: Check if buildable
        const buildLink = buildingRow.querySelector('a.btn-build, a[class*="order_button"], .build_button a');
        
        if (!buildLink) {
            // Check for "not enough resources" or "max level"
            const errorCell = buildingRow.querySelector('.inactive, .not_enough_res');
            if (errorCell) {
                throw new Error('Cannot build: not enough resources or max level reached');
            }
            throw new Error('Build button not found');
        }
        
        // Step 4: Click build
        await clickElement(buildLink);
        
        // Step 5: Wait and verify
        await sleep(1000);
        
        // Check for success message or queue update
        const queue = scrapeBuildingQueue();
        const lastItem = queue[queue.length - 1];
        
        sendCommandResult(actionId, true, `Started building ${building}`, {
            building: building,
            level: lastItem?.level,
            completesAt: lastItem?.completesAt
        });
        
    } catch (error) {
        sendCommandResult(actionId, false, error.message);
    }
}

/**
 * Find building row in HQ
 */
function findBuildingRow(buildingName) {
    // Try multiple selectors for compatibility
    const selectors = [
        `#main_buildrow_${buildingName}`,
        `tr[id*="${buildingName}"]`,
        `.buildrow_${buildingName}`
    ];
    
    for (const selector of selectors) {
        const row = document.querySelector(selector);
        if (row) return row;
    }
    
    // Fallback: search by building image
    const buildingImg = document.querySelector(`img[src*="/${buildingName}."]`);
    if (buildingImg) {
        return buildingImg.closest('tr');
    }
    
    return null;
}
```

### 1.4 Recruit Troops Executor

```javascript
// ============ RECRUIT TROOPS EXECUTOR ============

/**
 * Execute recruit troops command
 * Flow: Building Screen → Fill Units → Click Recruit → Report Result
 */
async function executeRecruitTroops(command) {
    const { actionId, building, units } = command;
    
    try {
        // Map building names to screen names
        const screenMap = {
            'barracks': 'barracks',
            'stable': 'stable',
            'workshop': 'garage',
            'garage': 'garage',
            'snob': 'snob'
        };
        
        const screenName = screenMap[building] || building;
        
        // Step 1: Ensure we're on the correct building screen
        if (!isOnScreen(screenName)) {
            storePendingCommand({ ...command, step: 'recruit' });
            navigateTo(screenName);
            return;
        }
        
        // Step 2: Fill unit inputs
        for (const [unit, amount] of Object.entries(units)) {
            if (amount <= 0) continue;
            
            const input = document.querySelector(`input[name="${unit}"]`) ||
                         document.getElementById(`${unit}_input`);
            
            if (input) {
                await fillInput(input, amount.toString());
                await humanDelay(100, 200);
            } else {
                console.warn(`[TW-Agent] Input for ${unit} not found`);
            }
        }
        
        // Step 3: Click recruit button
        const recruitBtn = document.querySelector('.btn-recruit') ||
                          document.querySelector('input[type="submit"][value*="Recruit"]') ||
                          document.querySelector('input.btn-recruit-confirm');
        
        if (!recruitBtn) {
            throw new Error('Recruit button not found');
        }
        
        await clickElement(recruitBtn);
        
        // Step 4: Wait and verify
        await sleep(1000);
        
        // Scrape updated queue
        const queue = scrapeRecruitmentQueue();
        
        sendCommandResult(actionId, true, `Started recruiting in ${building}`, {
            building: building,
            units: units,
            queue: queue[building]
        });
        
    } catch (error) {
        sendCommandResult(actionId, false, error.message);
    }
}
```

### 1.5 Command Handler Integration

```javascript
// ============ COMMAND HANDLER ============

/**
 * Main command router
 */
function handleCommand(command) {
    console.log('[TW-Agent] Received command:', command.type);
    
    switch (command.type) {
        case 'sendTroops':
            executeSendTroops(command);
            break;
            
        case 'buildBuilding':
            executeBuildBuilding(command);
            break;
            
        case 'recruitTroops':
            executeRecruitTroops(command);
            break;
            
        case 'requestRefresh':
            sendReport();
            break;
            
        case 'ping':
            send('pong', { timestamp: Date.now() });
            break;
            
        default:
            console.warn('[TW-Agent] Unknown command type:', command.type);
    }
}

/**
 * Send command result back to server
 */
function sendCommandResult(actionId, success, message, details = {}) {
    send('commandResult', {
        actionId: actionId,
        success: success,
        message: message,
        details: details
    });
}

/**
 * Check for pending commands on page load
 */
function checkPendingCommands() {
    const pending = getPendingCommand();
    
    if (pending) {
        console.log('[TW-Agent] Resuming pending command:', pending);
        
        // Small delay to let page fully load
        setTimeout(() => {
            handleCommand(pending);
        }, 1000);
    }
}

// Call this in init()
// checkPendingCommands();
```

---

## 2. SERVER COMMAND ROUTING

### File: `/server/routes/commands.js`

```javascript
const express = require('express');
const router = express.Router();
const { getAccounts, getAccountById } = require('../state/accounts');
const { sendToAccount } = require('../websocket');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate unique action ID
 */
function generateActionId() {
    return `cmd_${uuidv4().substring(0, 8)}`;
}

/**
 * POST /api/commands/send-troops
 * Send troops from one account to a target
 */
router.post('/send-troops', async (req, res) => {
    try {
        const { accountId, targetCoords, troops, sendType = 'attack', executeAt = null } = req.body;
        
        // Validate required fields
        if (!accountId || !targetCoords || !troops) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: accountId, targetCoords, troops'
            });
        }
        
        // Validate coordinates format
        if (!/^\d{1,3}\|\d{1,3}$/.test(targetCoords)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinate format. Use xxx|yyy'
            });
        }
        
        // Check account exists and is connected
        const account = getAccountById(accountId);
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found or not connected'
            });
        }
        
        // Build command
        const actionId = generateActionId();
        const command = {
            type: 'sendTroops',
            actionId: actionId,
            targetCoords: targetCoords,
            troops: troops,
            sendType: sendType,
            executeAt: executeAt
        };
        
        // Send to userscript
        const sent = sendToAccount(accountId, command);
        
        if (!sent) {
            return res.status(503).json({
                success: false,
                error: 'Failed to send command to account'
            });
        }
        
        res.json({
            success: true,
            actionId: actionId,
            message: 'Command sent to account'
        });
        
    } catch (error) {
        console.error('Error in send-troops:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/commands/build
 * Queue a building upgrade
 */
router.post('/build', async (req, res) => {
    try {
        const { accountId, building, levels = 1 } = req.body;
        
        if (!accountId || !building) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: accountId, building'
            });
        }
        
        const account = getAccountById(accountId);
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found or not connected'
            });
        }
        
        const actionId = generateActionId();
        const command = {
            type: 'buildBuilding',
            actionId: actionId,
            building: building,
            levels: levels
        };
        
        const sent = sendToAccount(accountId, command);
        
        if (!sent) {
            return res.status(503).json({
                success: false,
                error: 'Failed to send command to account'
            });
        }
        
        res.json({
            success: true,
            actionId: actionId,
            message: 'Build command sent'
        });
        
    } catch (error) {
        console.error('Error in build:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/commands/recruit
 * Queue troop recruitment
 */
router.post('/recruit', async (req, res) => {
    try {
        const { accountId, building, units } = req.body;
        
        if (!accountId || !building || !units) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: accountId, building, units'
            });
        }
        
        // Validate building type
        const validBuildings = ['barracks', 'stable', 'workshop', 'garage', 'snob'];
        if (!validBuildings.includes(building)) {
            return res.status(400).json({
                success: false,
                error: `Invalid building. Must be one of: ${validBuildings.join(', ')}`
            });
        }
        
        const account = getAccountById(accountId);
        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'Account not found or not connected'
            });
        }
        
        const actionId = generateActionId();
        const command = {
            type: 'recruitTroops',
            actionId: actionId,
            building: building,
            units: units
        };
        
        const sent = sendToAccount(accountId, command);
        
        if (!sent) {
            return res.status(503).json({
                success: false,
                error: 'Failed to send command to account'
            });
        }
        
        res.json({
            success: true,
            actionId: actionId,
            message: 'Recruit command sent'
        });
        
    } catch (error) {
        console.error('Error in recruit:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/commands/pending/:accountId
 * Get pending commands for an account (for debugging)
 */
router.get('/pending/:accountId', (req, res) => {
    // This would require tracking pending commands in state
    // For now, return empty
    res.json({ pending: [] });
});

module.exports = router;
```

### Update websocket.js to export sendToAccount:

```javascript
// Add to websocket.js

const accountConnections = new Map(); // accountId -> WebSocket

/**
 * Send command to specific account
 */
function sendToAccount(accountId, command) {
    const ws = accountConnections.get(accountId);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn(`Cannot send to ${accountId}: not connected`);
        return false;
    }
    
    try {
        ws.send(JSON.stringify(command));
        return true;
    } catch (error) {
        console.error(`Error sending to ${accountId}:`, error);
        return false;
    }
}

// Export for use in routes
module.exports = {
    initWebSocket,
    sendToAccount
};
```

---

## 3. DASHBOARD COMMAND PANEL

### File: `/server/public/js/commands.js`

```javascript
// ============ COMMAND PANEL LOGIC ============

/**
 * Initialize command panel
 */
function initCommandPanel() {
    // Tab switching
    document.querySelectorAll('.command-tab').forEach(tab => {
        tab.addEventListener('click', () => switchCommandTab(tab.dataset.tab));
    });
    
    // Form submissions
    document.getElementById('troops-form')?.addEventListener('submit', handleSendTroops);
    document.getElementById('build-form')?.addEventListener('submit', handleBuild);
    document.getElementById('recruit-form')?.addEventListener('submit', handleRecruit);
    
    // Account selector changes
    document.querySelectorAll('.account-select').forEach(select => {
        select.addEventListener('change', updateAccountInfo);
    });
    
    // Unit "Max" buttons
    document.querySelectorAll('.btn-max').forEach(btn => {
        btn.addEventListener('click', () => setMaxUnits(btn.dataset.unit));
    });
}

/**
 * Switch between command tabs
 */
function switchCommandTab(tabName) {
    // Hide all panels
    document.querySelectorAll('.command-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.command-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected panel
    document.getElementById(`${tabName}-panel`)?.classList.add('active');
    document.querySelector(`.command-tab[data-tab="${tabName}"]`)?.classList.add('active');
}

/**
 * Handle send troops form submission
 */
async function handleSendTroops(e) {
    e.preventDefault();
    
    const form = e.target;
    const accountId = form.querySelector('[name="accountId"]').value;
    const targetCoords = form.querySelector('[name="targetCoords"]').value;
    const sendType = form.querySelector('[name="sendType"]').value;
    
    // Gather troop counts
    const troops = {};
    const unitInputs = form.querySelectorAll('.unit-input');
    unitInputs.forEach(input => {
        const count = parseInt(input.value) || 0;
        if (count > 0) {
            troops[input.name] = count;
        }
    });
    
    // Validate
    if (!accountId) {
        showNotification('Please select an account', 'error');
        return;
    }
    
    if (!targetCoords || !/^\d{1,3}\|\d{1,3}$/.test(targetCoords)) {
        showNotification('Invalid coordinates format (use xxx|yyy)', 'error');
        return;
    }
    
    if (Object.keys(troops).length === 0) {
        showNotification('Please select at least one unit', 'error');
        return;
    }
    
    // Optional timed send
    const timedInput = form.querySelector('[name="executeAt"]');
    let executeAt = null;
    if (timedInput?.value) {
        executeAt = new Date(timedInput.value).getTime();
    }
    
    // Send command
    setLoading(true);
    
    try {
        const response = await fetch('/api/commands/send-troops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId,
                targetCoords,
                troops,
                sendType,
                executeAt
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Command sent! Action ID: ${result.actionId}`, 'success');
            form.reset();
        } else {
            showNotification(result.error || 'Failed to send command', 'error');
        }
        
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Handle build form submission
 */
async function handleBuild(e) {
    e.preventDefault();
    
    const form = e.target;
    const accountId = form.querySelector('[name="accountId"]').value;
    const building = form.querySelector('[name="building"]').value;
    
    if (!accountId || !building) {
        showNotification('Please select account and building', 'error');
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch('/api/commands/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId, building })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Build command sent! Action ID: ${result.actionId}`, 'success');
        } else {
            showNotification(result.error || 'Failed to send build command', 'error');
        }
        
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Handle recruit form submission
 */
async function handleRecruit(e) {
    e.preventDefault();
    
    const form = e.target;
    const accountId = form.querySelector('[name="accountId"]').value;
    const building = form.querySelector('[name="building"]').value;
    
    // Gather unit counts
    const units = {};
    const unitInputs = form.querySelectorAll('.recruit-unit-input');
    unitInputs.forEach(input => {
        const count = parseInt(input.value) || 0;
        if (count > 0) {
            units[input.name] = count;
        }
    });
    
    if (!accountId || !building) {
        showNotification('Please select account and building', 'error');
        return;
    }
    
    if (Object.keys(units).length === 0) {
        showNotification('Please enter at least one unit count', 'error');
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch('/api/commands/recruit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId, building, units })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Recruit command sent! Action ID: ${result.actionId}`, 'success');
            form.reset();
        } else {
            showNotification(result.error || 'Failed to send recruit command', 'error');
        }
        
    } catch (error) {
        showNotification('Network error: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Update account info when selection changes
 */
function updateAccountInfo(e) {
    const accountId = e.target.value;
    const account = window.accountsData?.[accountId];
    
    if (!account) return;
    
    const panel = e.target.closest('.command-panel');
    
    // Update troop availability display
    if (account.data?.troops) {
        Object.entries(account.data.troops).forEach(([unit, count]) => {
            const availSpan = panel.querySelector(`.avail-${unit}`);
            if (availSpan) {
                availSpan.textContent = count.toLocaleString();
            }
        });
    }
    
    // Update building levels display
    if (account.data?.buildings) {
        Object.entries(account.data.buildings).forEach(([building, level]) => {
            const levelSpan = panel.querySelector(`.level-${building}`);
            if (levelSpan) {
                levelSpan.textContent = level;
            }
        });
    }
}

/**
 * Set max units for a unit type
 */
function setMaxUnits(unit) {
    const accountSelect = document.querySelector('#troops-form [name="accountId"]');
    const accountId = accountSelect?.value;
    const account = window.accountsData?.[accountId];
    
    if (!account?.data?.troops) return;
    
    const input = document.querySelector(`#troops-form [name="${unit}"]`);
    if (input) {
        input.value = account.data.troops[unit] || 0;
    }
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications') || createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

/**
 * Create notification container if not exists
 */
function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notifications';
    document.body.appendChild(container);
    return container;
}

/**
 * Set loading state
 */
function setLoading(loading) {
    document.body.classList.toggle('loading', loading);
    document.querySelectorAll('button[type="submit"]').forEach(btn => {
        btn.disabled = loading;
    });
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', initCommandPanel);
```

### File: `/server/public/index.html` (Command Panel Section)

```html
<!-- Add this to the existing index.html -->

<!-- COMMAND PANEL SECTION -->
<div class="command-section">
    <h2>Commands</h2>
    
    <!-- Tabs -->
    <div class="command-tabs">
        <button class="command-tab active" data-tab="troops">Send Troops</button>
        <button class="command-tab" data-tab="build">Build</button>
        <button class="command-tab" data-tab="recruit">Recruit</button>
    </div>
    
    <!-- TROOPS PANEL -->
    <div id="troops-panel" class="command-panel active">
        <form id="troops-form">
            <div class="form-row">
                <label>From Account:</label>
                <select name="accountId" class="account-select" required>
                    <option value="">Select account...</option>
                    <!-- Populated by JS -->
                </select>
            </div>
            
            <div class="form-row">
                <label>Target Coordinates:</label>
                <input type="text" name="targetCoords" placeholder="xxx|yyy" pattern="\d{1,3}\|\d{1,3}" required>
            </div>
            
            <div class="form-row">
                <label>Type:</label>
                <select name="sendType">
                    <option value="attack">Attack</option>
                    <option value="support">Support</option>
                </select>
            </div>
            
            <div class="form-row">
                <label>Scheduled Time (optional):</label>
                <input type="datetime-local" name="executeAt">
            </div>
            
            <div class="units-grid">
                <div class="unit-row">
                    <img src="/img/units/spear.png" alt="Spear" title="Spear">
                    <input type="number" name="spear" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-spear">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="spear">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/sword.png" alt="Sword" title="Sword">
                    <input type="number" name="sword" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-sword">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="sword">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/axe.png" alt="Axe" title="Axe">
                    <input type="number" name="axe" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-axe">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="axe">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/spy.png" alt="Spy" title="Spy">
                    <input type="number" name="spy" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-spy">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="spy">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/light.png" alt="Light Cavalry" title="Light Cavalry">
                    <input type="number" name="light" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-light">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="light">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/heavy.png" alt="Heavy Cavalry" title="Heavy Cavalry">
                    <input type="number" name="heavy" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-heavy">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="heavy">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/ram.png" alt="Ram" title="Ram">
                    <input type="number" name="ram" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-ram">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="ram">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/catapult.png" alt="Catapult" title="Catapult">
                    <input type="number" name="catapult" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-catapult">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="catapult">Max</button>
                </div>
                <div class="unit-row">
                    <img src="/img/units/snob.png" alt="Noble" title="Noble">
                    <input type="number" name="snob" class="unit-input" min="0" value="0">
                    <span class="avail">(<span class="avail-snob">0</span>)</span>
                    <button type="button" class="btn-max" data-unit="snob">Max</button>
                </div>
            </div>
            
            <button type="submit" class="btn-primary">Send Troops</button>
        </form>
    </div>
    
    <!-- BUILD PANEL -->
    <div id="build-panel" class="command-panel">
        <form id="build-form">
            <div class="form-row">
                <label>Account:</label>
                <select name="accountId" class="account-select" required>
                    <option value="">Select account...</option>
                </select>
            </div>
            
            <div class="form-row">
                <label>Building:</label>
                <select name="building" required>
                    <option value="">Select building...</option>
                    <option value="main">Headquarters</option>
                    <option value="barracks">Barracks</option>
                    <option value="stable">Stable</option>
                    <option value="garage">Workshop</option>
                    <option value="snob">Academy</option>
                    <option value="smith">Smithy</option>
                    <option value="market">Market</option>
                    <option value="wood">Timber Camp</option>
                    <option value="stone">Clay Pit</option>
                    <option value="iron">Iron Mine</option>
                    <option value="farm">Farm</option>
                    <option value="storage">Warehouse</option>
                    <option value="wall">Wall</option>
                </select>
            </div>
            
            <div class="building-info">
                <span>Current Level: <span class="current-level">-</span></span>
            </div>
            
            <button type="submit" class="btn-primary">Build</button>
        </form>
    </div>
    
    <!-- RECRUIT PANEL -->
    <div id="recruit-panel" class="command-panel">
        <form id="recruit-form">
            <div class="form-row">
                <label>Account:</label>
                <select name="accountId" class="account-select" required>
                    <option value="">Select account...</option>
                </select>
            </div>
            
            <div class="form-row">
                <label>Building:</label>
                <select name="building" required>
                    <option value="barracks">Barracks</option>
                    <option value="stable">Stable</option>
                    <option value="garage">Workshop</option>
                </select>
            </div>
            
            <div class="recruit-units" id="barracks-units">
                <h4>Barracks Units</h4>
                <div class="unit-row">
                    <label>Spear:</label>
                    <input type="number" name="spear" class="recruit-unit-input" min="0" value="0">
                </div>
                <div class="unit-row">
                    <label>Sword:</label>
                    <input type="number" name="sword" class="recruit-unit-input" min="0" value="0">
                </div>
                <div class="unit-row">
                    <label>Axe:</label>
                    <input type="number" name="axe" class="recruit-unit-input" min="0" value="0">
                </div>
                <div class="unit-row">
                    <label>Archer:</label>
                    <input type="number" name="archer" class="recruit-unit-input" min="0" value="0">
                </div>
            </div>
            
            <button type="submit" class="btn-primary">Recruit</button>
        </form>
    </div>
</div>

<!-- Notifications Container -->
<div id="notifications"></div>

<script src="/js/commands.js"></script>
```

### File: `/server/public/css/commands.css`

```css
/* Command Section Styles */
.command-section {
    background: #f4e4bc;
    border: 1px solid #603000;
    border-radius: 4px;
    padding: 15px;
    margin-top: 20px;
}

.command-tabs {
    display: flex;
    gap: 5px;
    margin-bottom: 15px;
    border-bottom: 2px solid #c1a264;
    padding-bottom: 10px;
}

.command-tab {
    padding: 8px 16px;
    background: #dfc896;
    border: 1px solid #c1a264;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    font-weight: bold;
    color: #5d4530;
}

.command-tab:hover {
    background: #c1a264;
}

.command-tab.active {
    background: #c1a264;
    border-bottom-color: #c1a264;
}

.command-panel {
    display: none;
    padding: 15px;
    background: #fff5da;
    border: 1px solid #dfc896;
    border-radius: 4px;
}

.command-panel.active {
    display: block;
}

.form-row {
    margin-bottom: 12px;
}

.form-row label {
    display: block;
    margin-bottom: 4px;
    font-weight: bold;
    color: #5d4530;
}

.form-row input,
.form-row select {
    width: 100%;
    padding: 8px;
    border: 1px solid #c1a264;
    border-radius: 4px;
    background: #fff;
}

.units-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 15px 0;
}

.unit-row {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px;
    background: #f0e2be;
    border-radius: 4px;
}

.unit-row img {
    width: 24px;
    height: 24px;
}

.unit-row input {
    width: 60px;
    padding: 4px;
    text-align: center;
}

.unit-row .avail {
    font-size: 11px;
    color: #666;
}

.btn-max {
    padding: 2px 6px;
    font-size: 10px;
    background: #dfc896;
    border: 1px solid #c1a264;
    border-radius: 3px;
    cursor: pointer;
}

.btn-max:hover {
    background: #c1a264;
}

.btn-primary {
    display: block;
    width: 100%;
    padding: 12px;
    margin-top: 15px;
    background: #7d510f;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
}

.btn-primary:hover {
    background: #5d3b0a;
}

.btn-primary:disabled {
    background: #999;
    cursor: not-allowed;
}

/* Notifications */
#notifications {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.notification {
    padding: 12px 20px;
    border-radius: 4px;
    color: #fff;
    font-weight: bold;
    animation: slideIn 0.3s ease;
}

.notification-success {
    background: #4caf50;
}

.notification-error {
    background: #f44336;
}

.notification-info {
    background: #2196f3;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

/* Loading State */
body.loading .command-panel {
    opacity: 0.6;
    pointer-events: none;
}
```

---

## 4. BEST PRACTICES FOR CLAUDE CODE

### 4.0 MULTI-ACCOUNT SAFETY PATTERNS (CRITICAL!)

#### Never Do This:
```javascript
// ❌ DANGEROUS: Sending to all accounts at once
accounts.forEach(acc => sendToAccount(acc.id, command));

// ❌ DANGEROUS: Small fixed delays
for (const acc of accounts) {
    sendToAccount(acc.id, command);
    await sleep(1000); // Only 1 second - still detectable!
}

// ❌ DANGEROUS: Bulk operations without queue
router.post('/attack-all', (req, res) => {
    const accounts = getAllAccounts();
    accounts.forEach(acc => sendAttack(acc, req.body.target));
});
```

#### Always Do This:
```javascript
// ✅ SAFE: Use the command queue
router.post('/send-troops', (req, res) => {
    const queueId = commandQueue.enqueue(req.body.accountId, command);
    res.json({ queued: true, queueId, position: commandQueue.queue.length });
});

// ✅ SAFE: Coordinated attacks with staggered timing
router.post('/coordinated-attack', async (req, res) => {
    const { accounts, targetCoords, troops, landingTime } = req.body;
    
    // Calculate individual send times based on distance
    const attackPlan = [];
    
    for (const accountId of accounts) {
        const account = getAccountById(accountId);
        const distance = calculateDistance(account.coords, targetCoords);
        const travelTime = calculateTravelTime(distance, troops);
        
        // When this account needs to send to land at landingTime
        const sendTime = landingTime - travelTime;
        
        // Add random jitter (±2-5 seconds) to avoid exact simultaneous sends
        const jitter = (Math.random() - 0.5) * 6000; // ±3 seconds
        
        attackPlan.push({
            accountId,
            sendTime: sendTime + jitter,
            priority: 'high' // Coordinated attacks get priority
        });
    }
    
    // Sort by send time
    attackPlan.sort((a, b) => a.sendTime - b.sendTime);
    
    // Queue each with executeAt timestamp
    for (const plan of attackPlan) {
        commandQueue.enqueue(plan.accountId, {
            type: 'sendTroops',
            actionId: generateActionId(),
            targetCoords,
            troops,
            sendType: 'attack',
            executeAt: plan.sendTime
        }, plan.priority);
    }
    
    res.json({
        success: true,
        planned: attackPlan.length,
        estimatedCompletion: attackPlan[attackPlan.length - 1]?.sendTime
    });
});
```

### 4.1 Report Timing (Userscript Side)

```javascript
// ============ STAGGERED REPORTING ============
// Each account reports at different intervals to avoid patterns

/**
 * Get account-specific report interval
 * Creates unique timing pattern per account
 */
function getReportInterval() {
    // Base interval: 55-70 seconds (varies per account)
    const baseInterval = 55000 + (hashAccountId() % 15000);
    
    // Add random jitter each time: ±10 seconds
    const jitter = (Math.random() - 0.5) * 20000;
    
    return baseInterval + jitter;
}

/**
 * Simple hash of account ID for consistent but unique base interval
 */
function hashAccountId() {
    const id = game_data.player.id.toString();
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Schedule next report with variable timing
 */
function scheduleNextReport() {
    const interval = getReportInterval();
    console.log(`[TW-Agent] Next report in ${Math.round(interval/1000)}s`);
    
    setTimeout(() => {
        sendReport();
        scheduleNextReport(); // Reschedule with new random interval
    }, interval);
}
```

### 4.2 Dashboard UI: Queue Status Display

```javascript
// Add to dashboard to show queue status
async function updateQueueStatus() {
    try {
        const response = await fetch('/api/commands/queue/status');
        const status = await response.json();
        
        const queueDisplay = document.getElementById('queue-status');
        if (!queueDisplay) return;
        
        queueDisplay.innerHTML = `
            <div class="queue-info">
                <span class="queue-count">${status.queueLength} commands queued</span>
                <span class="queue-processing">${status.isProcessing ? '⏳ Processing...' : '✓ Idle'}</span>
            </div>
            <div class="queue-accounts">
                ${Object.entries(status.pendingByAccount).map(([acc, count]) => 
                    `<span class="queue-account">${acc}: ${count}</span>`
                ).join('')}
            </div>
            <div class="queue-cooldowns">
                ${Object.entries(status.accountCooldowns)
                    .filter(([_, cd]) => cd > 0)
                    .map(([acc, cd]) => 
                        `<span class="cooldown">${acc}: ${Math.round(cd/1000)}s</span>`
                    ).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Failed to update queue status:', error);
    }
}

// Update every 2 seconds
setInterval(updateQueueStatus, 2000);
```

### 4.3 Implementation Order

1. **Command Queue FIRST** - Implement `/server/state/commandQueue.js` before anything else
2. **Anti-detection timing** - Add timing fingerprint to userscript
3. **One executor at a time** - Test each before moving to next
4. **Server routes with queue** - All routes must use commandQueue.enqueue()
5. **Dashboard UI last** - After server routes are tested

### 4.4 Testing Commands

```javascript
// Test sendTroops from browser console (on dashboard)
fetch('/api/commands/send-troops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        accountId: 'test-account',
        targetCoords: '500|500',
        troops: { axe: 10 },
        sendType: 'attack'
    })
}).then(r => r.json()).then(console.log);

// Test build command
fetch('/api/commands/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        accountId: 'test-account',
        building: 'barracks'
    })
}).then(r => r.json()).then(console.log);
```

### 4.3 Important Notes

1. **DOM selectors may vary** - Different TW servers/versions have different HTML
2. **Always test on actual game** - Mock data won't catch real issues
3. **Handle page navigation** - Commands that navigate must store state
4. **Rate limiting** - Don't spam commands, add delays
5. **Error handling** - Always report failures back to server

### 4.4 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Command lost after page reload | Use GM_setValue to persist pending commands |
| Button not found | Try multiple selectors, log DOM structure |
| Confirmation page not handled | Check for confirm button after main action |
| Timed send misses target | Account for network latency, add buffer |

### 4.5 Security Checklist

- [ ] Validate all input coordinates format
- [ ] Validate building names against whitelist
- [ ] Check account exists before sending commands
- [ ] Don't expose internal errors to clients
- [ ] Log all commands for debugging

---

## 5. QUICK REFERENCE

### Command Types

| Type | Required Fields | Optional |
|------|-----------------|----------|
| sendTroops | accountId, targetCoords, troops, sendType | executeAt |
| buildBuilding | accountId, building | levels |
| recruitTroops | accountId, building, units | - |

### Building Names

```
main, barracks, stable, garage, snob, smith, place, 
market, wood, stone, iron, farm, storage, wall, church
```

### Unit Names

```
spear, sword, axe, archer, spy, light, marcher, 
heavy, ram, catapult, knight, snob
```

---

## 6. MULTI-ACCOUNT SAFETY CHECKLIST

### Before Going Live:

- [ ] **Command Queue implemented** - All commands go through queue
- [ ] **5-15 second delays** between any commands across all accounts
- [ ] **30 second cooldown** per account between commands
- [ ] **Report jitter** - Each account reports at unique intervals (55-70s + random)
- [ ] **Timing fingerprint** - Each account has unique action timing patterns
- [ ] **No bulk operations** - Never trigger same action on multiple accounts simultaneously
- [ ] **Queue status visible** - Dashboard shows queue length and cooldowns

### Detection Patterns to Avoid:

| Pattern | Risk Level | How to Avoid |
|---------|------------|--------------|
| 30 accounts doing same action within 1 minute | 🔴 CRITICAL | Queue with 5-15s delays |
| All accounts reporting data at same time | 🔴 CRITICAL | Unique report intervals per account |
| Identical timing between actions | 🟡 HIGH | Random delays with variance |
| Perfect form filling (too fast) | 🟡 HIGH | Human typing simulation |
| Actions continuing during night hours | 🟡 HIGH | Consider activity schedules |
| Same user-agent/fingerprint | 🟡 HIGH | Each browser profile is unique |

### Safe Operational Limits:

| Metric | Safe Limit | Notes |
|--------|------------|-------|
| Commands per account per hour | 10-15 | Normal human activity level |
| Global commands per minute | 4-8 | Across ALL 30 accounts |
| Report frequency per account | 55-70 seconds | With ±10s jitter |
| Minimum delay between any commands | 5 seconds | Absolute minimum |
| Account cooldown after command | 30 seconds | Before same account can act again |

### Architecture Summary:

```
Dashboard → REST API → Command Queue → WebSocket → Userscript
                           ↓
                    [5-15s delays]
                    [Account cooldowns]
                    [Priority ordering]
                           ↓
              Only ONE command at a time globally
```

---

## 7. QUICK START FOR CLAUDE CODE

### Step 1: Create Command Queue
```bash
# Create file: /server/state/commandQueue.js
# Copy the CommandQueue class from section 0
```

### Step 2: Update Routes to Use Queue
```javascript
// In every command route, replace:
sendToAccount(accountId, command);

// With:
commandQueue.enqueue(accountId, command, 'normal');
```

### Step 3: Add Timing to Userscript
```javascript
// Add TIMING_FINGERPRINT at top of userscript
// Use getHumanDelay() instead of fixed delays
// Use humanType() instead of direct input.value =
```

### Step 4: Test with 2-3 Accounts First
```bash
# Before scaling to 30 accounts:
# - Verify queue processes correctly
# - Check delays are applied
# - Confirm no simultaneous actions
```

---

This guide should give Claude Code everything needed to implement Phase 3 correctly and SAFELY for multi-account operation!