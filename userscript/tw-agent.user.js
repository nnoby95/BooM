// ==UserScript==
// @name         TW Controller Agent
// @namespace    tw-controller
// @version      1.5.8
// @description  Tribal Wars account control agent
// @author       TW Controller
// @match        https://*.tribalwars.*/game.php*
// @match        https://*.tribalwars.*/game.php
// @match        https://*.klanhaboru.hu/game.php*
// @match        https://*.klanhaboru.hu/game.php
// @connect      localhost
// @connect      127.0.0.1
// @connect      192.168.2.235
// @connect      91.165.174.36
// @connect      172.236.201.97
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  // ============================================================
  // GAME WEBSOCKET INTERCEPTOR
  // Runs immediately at document-start to catch game's Socket.IO connection
  // ============================================================

  let gameWebSocket = null;
  const gameEventQueue = [];

  // Save original WebSocket constructor
  const OriginalWebSocket = window.WebSocket;

  // Override WebSocket constructor
  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);

    // Check if this is Tribal Wars game socket
    if (url.includes('socket.io') &&
        (url.includes('klanhaboru.hu') || url.includes('tribalwars'))) {

      console.log('[TW-Agent] 🎯 Game WebSocket detected!', url);
      gameWebSocket = ws;

      // Attach listeners
      ws.addEventListener('open', () => {
        console.log('[TW-Agent] ✅ Game WebSocket connected');
        forwardGameEvent('gameSocketStatus', { connected: true });
      });

      ws.addEventListener('close', () => {
        console.log('[TW-Agent] ❌ Game WebSocket disconnected');
        gameWebSocket = null;
        forwardGameEvent('gameSocketStatus', { connected: false });
      });

      ws.addEventListener('message', (event) => {
        handleGameSocketMessage(event.data);
      });
    }

    return ws;
  };

  // Preserve WebSocket prototype
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  /**
   * Handle incoming game WebSocket messages
   */
  function handleGameSocketMessage(rawData) {
    // Skip ping/pong
    if (rawData === '2' || rawData === '3' || rawData === '0' || rawData === '40') {
      return;
    }

    // Parse Socket.IO event messages (start with "42")
    if (rawData.startsWith('42')) {
      try {
        const jsonStr = rawData.substring(2);
        const parsed = JSON.parse(jsonStr);

        if (Array.isArray(parsed) && parsed.length >= 1) {
          const eventName = parsed[0];
          const eventData = parsed[1] || {};
          processGameEvent(eventName, eventData);
        }
      } catch (error) {
        // Invalid JSON - ignore
      }
    }
  }

  /**
   * Process specific game events
   */
  function processGameEvent(eventName, eventData) {
    console.log('[TW-Agent] 📨 Game Event:', eventName, eventData);

    switch (eventName) {
      // INCOMING COMMANDS (attacks/support TO your village)
      case 'command/incoming':
      case 'incoming':
      case 'command_incoming':
        forwardIncomingCommand(eventData);
        break;

      // OUTGOING COMMANDS (attacks/support FROM your village)
      case 'command/sent':
      case 'command/outgoing':
      case 'outgoing':
      case 'command_sent':
        forwardOutgoingCommand(eventData);
        break;

      // GENERIC COMMAND - Need to determine direction
      case 'command':
        // Check if it's incoming or outgoing based on target village
        const currentVillageId = unsafeWindow.game_data?.village?.id;
        const targetVillageId = eventData.target_village_id || eventData.village_id;
        const originVillageId = eventData.origin_village_id || eventData.start_village_id;

        if (currentVillageId && targetVillageId) {
          if (targetVillageId === currentVillageId) {
            // Target is YOUR village = INCOMING attack
            console.log('[TW-Agent] ✅ Detected INCOMING command (target matches your village)');
            forwardIncomingCommand(eventData);
          } else if (originVillageId === currentVillageId) {
            // Origin is YOUR village = OUTGOING command
            console.log('[TW-Agent] ✅ Detected OUTGOING command (origin matches your village)');
            forwardOutgoingCommand(eventData);
          } else {
            console.log('[TW-Agent] ⚠️ Unknown command direction, ignoring');
          }
        } else {
          console.log('[TW-Agent] ⚠️ Cannot determine command direction, logging all data:');
          console.log('currentVillageId:', currentVillageId);
          console.log('targetVillageId:', targetVillageId);
          console.log('originVillageId:', originVillageId);
          console.log('eventData:', eventData);
        }
        break;

      case 'resources':
      case 'resources/update':
        forwardGameEvent('resourceUpdate', {
          wood: eventData.wood,
          clay: eventData.stone || eventData.clay,
          iron: eventData.iron,
          storage: eventData.storage || eventData.storage_max,
          population: eventData.pop || eventData.population,
          populationMax: eventData.pop_max || eventData.population_max
        });
        break;

      case 'building':
      case 'building/complete':
        forwardGameEvent('buildingUpdate', {
          event: eventName,
          building: eventData.building,
          level: eventData.level || eventData.new_level,
          completesAt: eventData.complete_at
        });
        break;

      case 'recruitment':
      case 'recruitment/complete':
        forwardGameEvent('recruitmentUpdate', {
          event: eventName,
          building: eventData.building,
          unit: eventData.unit,
          amount: eventData.amount,
          completesAt: eventData.complete_at
        });
        break;

      default:
        // Log unknown events to discover new ones
        console.log('[TW-Agent] 🔍 Unknown event:', eventName, eventData);
        break;
    }
  }

  /**
   * Forward incoming command to control server
   */
  function forwardIncomingCommand(eventData) {
    console.log('[TW-Agent] ⚔️ INCOMING ATTACK detected!', eventData);
    forwardGameEvent('incomingCommand', {
      commandId: eventData.id || eventData.command_id,
      type: eventData.type || 'attack',
      originCoords: eventData.origin_coords || eventData.origin,
      originVillageId: eventData.origin_village_id || eventData.start_village_id,
      originVillageName: eventData.origin_village_name || eventData.start_village_name,
      originPlayerId: eventData.origin_player_id || eventData.player_id,
      originPlayerName: eventData.origin_player_name || eventData.player_name,
      targetVillageId: eventData.target_village_id || eventData.village_id,
      arrivalTime: eventData.arrival_time || eventData.arrival || eventData.arrive_at,
      size: eventData.size
    });
  }

  /**
   * Forward outgoing command to control server
   */
  function forwardOutgoingCommand(eventData) {
    console.log('[TW-Agent] 📤 OUTGOING COMMAND detected!', eventData);
    forwardGameEvent('outgoingCommand', {
      commandId: eventData.id || eventData.command_id,
      type: eventData.type || 'attack',
      targetCoords: eventData.target_coords || eventData.target,
      targetVillageId: eventData.target_village_id || eventData.village_id,
      targetVillageName: eventData.target_village_name || eventData.village_name,
      originVillageId: eventData.origin_village_id || eventData.start_village_id,
      arrivalTime: eventData.arrival_time || eventData.arrival || eventData.arrive_at,
      units: eventData.units || eventData.troops
    });
  }

  /**
   * Forward game event to control server
   * Queues if not connected yet
   */
  function forwardGameEvent(type, data) {
    const event = {
      type,
      data,
      timestamp: Date.now()
    };

    // Try to send immediately if control server connected
    if (typeof window.sendToControlServer === 'function') {
      window.sendToControlServer('gameEvent', event);
    } else {
      // Queue for later
      gameEventQueue.push(event);
      if (gameEventQueue.length > 100) {
        gameEventQueue.shift(); // Keep only last 100
      }
    }
  }

  /**
   * Flush queued events (called when control server connects)
   */
  window.flushGameEventQueue = function() {
    console.log(`[TW-Agent] Flushing ${gameEventQueue.length} queued game events`);
    while (gameEventQueue.length > 0) {
      const event = gameEventQueue.shift();
      if (typeof window.sendToControlServer === 'function') {
        window.sendToControlServer('gameEvent', event);
      }
    }
  };

  /**
   * Debug utilities
   */
  window.getGameWebSocket = function() {
    return gameWebSocket;
  };

  window.isGameSocketConnected = function() {
    return gameWebSocket !== null && gameWebSocket.readyState === WebSocket.OPEN;
  };

  console.log('[TW-Agent] 🔌 WebSocket interceptor installed');

  // ============ CONFIGURATION ============
  const CONFIG = {
    serverUrl: 'wss://172.236.201.97:3000/ws',
    apiKey: 'dev-secret-key-change-in-production',
    reportInterval: 60000,      // Base interval: 60 seconds
    reportJitter: 10000,        // Random jitter: ±10 seconds
    reconnectDelay: 5000,       // Reconnect after 5 seconds
    maxReconnectDelay: 60000,   // Max reconnect delay: 60 seconds
    debug: true                 // Enable debug logging
  };

  // ============ STATE ============
  let ws = null;
  let sessionId = null;
  let reconnectAttempts = 0;
  let reportTimer = null;
  let isConnected = false;
  let isMasterTab = false;  // Track if this tab is the master (active) tab

  // ============ MASTER TAB PERSISTENCE ============
  // Use sessionStorage to persist master status across page navigations
  const MASTER_STATUS_KEY = 'tw_agent_is_master';

  function saveMasterStatus(isMaster) {
    sessionStorage.setItem(MASTER_STATUS_KEY, isMaster ? 'true' : 'false');
    log(`Master status saved to sessionStorage: ${isMaster}`);
  }

  function loadMasterStatus() {
    const saved = sessionStorage.getItem(MASTER_STATUS_KEY) === 'true';
    log(`Master status loaded from sessionStorage: ${saved}`);
    return saved;
  }

  // ============ UTILITY FUNCTIONS ============

  function log(...args) {
    if (CONFIG.debug) {
      console.log('[TW Agent]', ...args);
    }
  }

  function error(...args) {
    console.error('[TW Agent]', ...args);
  }

  function randomJitter() {
    return Math.floor(Math.random() * CONFIG.reportJitter * 2) - CONFIG.reportJitter;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
      log(`Waiting ${waitTime}ms for safe action window`);
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

  // ============ HUNGARIAN LANGUAGE SUPPORT ============
  // Mapping for klanhaboru.hu (Hungarian TW version)

  /**
   * Detect if we're on Hungarian version
   */
  function isHungarianVersion() {
    return window.location.hostname.includes('klanhaboru.hu');
  }

  /**
   * Get building selector variations for both EN and HU
   */
  function getBuildingSelectors(buildingName) {
    const huMap = {
      'main': 'főépület',
      'barracks': 'kaszárnya',
      'stable': 'istálló',
      'garage': 'műhely',
      'workshop': 'műhely',
      'snob': 'akadémia',
      'smith': 'kovács',
      'place': 'gyülekezőhely',
      'statue': 'szobor',
      'market': 'piac',
      'wood': 'favágó',
      'stone': 'agyagbánya',
      'iron': 'vasbánya',
      'farm': 'farm',
      'storage': 'raktár',
      'hide': 'rejtekhe ly',
      'wall': 'fal',
      'church': 'templom',
      'church_f': 'első_templom',
      'watchtower': 'őrtorony'
    };

    const selectors = [
      `#main_buildrow_${buildingName}`,
      `tr[id*="${buildingName}"]`,
      `.buildrow_${buildingName}`
    ];

    // Add Hungarian variants
    if (huMap[buildingName]) {
      const huName = huMap[buildingName];
      selectors.push(
        `#main_buildrow_${huName}`,
        `tr[id*="${huName}"]`,
        `.buildrow_${huName}`
      );
    }

    return selectors;
  }

  /**
   * Get unit name variations for both EN and HU
   */
  function getUnitSelectors(unitName) {
    const huMap = {
      'spear': 'lándzsás',
      'sword': 'kardos',
      'axe': 'fejszés',
      'archer': 'íjász',
      'spy': 'felderítő',
      'light': 'könnyűlovas',
      'marcher': 'lovasíjász',
      'heavy': 'nehézlovas',
      'ram': 'faltörő_kos',
      'catapult': 'katapult',
      'knight': 'paladin',
      'snob': 'nemes'
    };

    const selectors = [
      `input[name="${unitName}"]`,
      `#unit_input_${unitName}`,
      `#${unitName}_input`
    ];

    // Add Hungarian variants
    if (huMap[unitName]) {
      const huName = huMap[unitName];
      selectors.push(
        `input[name="${huName}"]`,
        `#unit_input_${huName}`,
        `#${huName}_input`
      );
    }

    return selectors;
  }

  /**
   * Try multiple selectors until one works
   */
  function findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * Find button with English or Hungarian text
   */
  function findButton(enText, huText) {
    // Try by value attribute (submit buttons)
    const btnByValue = document.querySelector(`input[type="submit"][value*="${enText}"], input[type="submit"][value*="${huText}"]`);
    if (btnByValue) return btnByValue;

    // Try by text content (regular buttons/links)
    const buttons = document.querySelectorAll('button, a.btn, .btn, input[type="button"]');
    for (const btn of buttons) {
      const text = btn.textContent || btn.value || '';
      if (text.includes(enText) || text.includes(huText)) {
        return btn;
      }
    }

    return null;
  }

  // ============ QUICKBAR STATUS INJECTION ============
  // Injects master/standby status and quick navigation into game's quickbar

  /**
   * Get TW image URL based on game assets
   */
  function getTWImageUrl(imageName) {
    // Use the game's graphic path
    const graphicPath = unsafeWindow.game_data?.link_base_pure || 'https://dsen.innogamescdn.com/asset/2f86a37/graphic/';
    return `${graphicPath}${imageName}`;
  }

  /**
   * Inject quickbar styles
   */
  function injectQuickbarStyles() {
    if (document.getElementById('tw-agent-quickbar-styles')) return;

    const style = document.createElement('style');
    style.id = 'tw-agent-quickbar-styles';
    style.textContent = `
      /* Master badge - green glow */
      .tw-agent-master-badge {
        background: linear-gradient(to bottom, #2d5016, #1a3009) !important;
        border: 1px solid #4caf50 !important;
        box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);
        border-radius: 3px;
        margin-right: 3px !important;
      }

      .tw-agent-master-badge a,
      .tw-agent-master-badge span {
        color: #7fff00 !important;
        font-weight: bold;
        text-shadow: 0 0 3px rgba(76, 175, 80, 0.8);
        padding: 2px 8px !important;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      /* Standby badge - gray */
      .tw-agent-standby-badge {
        background: linear-gradient(to bottom, #3a3a3a, #252525) !important;
        border: 1px solid #666 !important;
        border-radius: 3px;
        margin-right: 3px !important;
      }

      .tw-agent-standby-badge a,
      .tw-agent-standby-badge span {
        color: #999 !important;
        padding: 2px 8px !important;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      /* Quick nav items */
      .tw-agent-nav-item {
        margin-right: 2px !important;
      }

      .tw-agent-nav-item a {
        display: inline-flex !important;
        align-items: center;
        gap: 3px;
        padding: 2px 6px !important;
      }

      .tw-agent-nav-item img {
        width: 14px;
        height: 14px;
        vertical-align: middle;
      }

      /* Separator */
      .tw-agent-separator {
        color: #8b6914 !important;
        padding: 0 4px !important;
        font-weight: bold;
      }

      /* Refresh button */
      .tw-agent-refresh-btn {
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .tw-agent-refresh-btn:hover {
        background: linear-gradient(to bottom, #4a4a2a, #3a3a1a) !important;
      }

      .tw-agent-refresh-btn.refreshing img {
        animation: tw-agent-spin 1s linear infinite;
      }

      @keyframes tw-agent-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Status dot animation */
      .tw-agent-status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 4px;
      }

      .tw-agent-status-dot.master {
        background: #4caf50;
        box-shadow: 0 0 6px #4caf50;
        animation: tw-agent-pulse 2s ease-in-out infinite;
      }

      .tw-agent-status-dot.standby {
        background: #888;
      }

      @keyframes tw-agent-pulse {
        0%, 100% { opacity: 1; box-shadow: 0 0 6px #4caf50; }
        50% { opacity: 0.7; box-shadow: 0 0 12px #4caf50; }
      }

      /* ============ CUSTOM STATUS BAR (non-premium) ============ */
      .tw-agent-custom-statusbar {
        background: linear-gradient(to bottom, #4a3c28 0%, #3d3122 50%, #2a2115 100%);
        border: 1px solid #5d4c2f;
        border-radius: 4px;
        padding: 6px 12px;
        margin: 8px 0;
        position: relative;
        z-index: 100;
        box-sizing: border-box;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
      }

      .tw-agent-statusbar-inner {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tw-agent-status-item {
        padding: 3px 10px;
        border-radius: 3px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: bold;
      }

      .tw-agent-nav-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        background: linear-gradient(to bottom, #4a3c28, #3a2e1f);
        border: 1px solid #5d4c2f;
        border-radius: 3px;
        color: #c9a86c !important;
        text-decoration: none !important;
        font-size: 11px;
        transition: all 0.2s ease;
      }

      .tw-agent-nav-link:hover {
        background: linear-gradient(to bottom, #5a4c38, #4a3e2f);
        border-color: #7d6c4f;
        color: #e9c88c !important;
      }

      .tw-agent-nav-link img {
        width: 14px;
        height: 14px;
      }

      .tw-agent-custom-statusbar .tw-agent-separator {
        color: #5d4c2f;
        font-weight: bold;
        padding: 0 2px;
      }

      .tw-agent-custom-statusbar .tw-agent-refresh-btn.refreshing img {
        animation: tw-agent-spin 1s linear infinite;
      }

      /* Make Master button */
      .tw-agent-make-master-btn {
        background: linear-gradient(to bottom, #5a4020, #3a2810) !important;
        border: 1px solid #8b6914 !important;
        color: #ffd700 !important;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .tw-agent-make-master-btn:hover {
        background: linear-gradient(to bottom, #7a5030, #5a3820) !important;
        border-color: #ffd700 !important;
        box-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
      }

      .tw-agent-make-master-btn.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      /* Hide make master button when already master */
      .tw-agent-master-active .tw-agent-make-master-btn {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inject status and navigation into quickbar
   * Always uses custom status bar (below game UI) to avoid blending with premium quickbar
   */
  function injectQuickbarStatus() {
    // Inject styles first
    injectQuickbarStyles();

    // Always use custom status bar - works for both premium and non-premium
    // This prevents blending with premium quickbar
    injectCustomStatusBar();
  }

  /**
   * Create custom status bar (works for both premium and non-premium)
   */
  function injectCustomStatusBar() {
    // Remove old custom bar if exists
    const oldBar = document.getElementById('tw-agent-custom-bar');
    if (oldBar) oldBar.remove();

    // Find the best injection point - prioritize content area for visibility
    // Try multiple locations from most preferred to fallback
    const insertionPoints = [
      // 1. Inside content container, at the very top
      { container: document.querySelector('#contentContainer'), position: 'prepend' },
      // 2. Before the main content value
      { container: document.querySelector('#content_value'), position: 'before' },
      // 3. After header info table (inside visible area)
      { container: document.querySelector('table#header_info'), position: 'after' },
      // 4. Inside main layout wrapper
      { container: document.querySelector('#ds_body'), position: 'prepend' },
      // 5. Fallback: before main_layout
      { container: document.querySelector('#main_layout'), position: 'before' }
    ];

    let insertConfig = null;
    for (const point of insertionPoints) {
      if (point.container) {
        insertConfig = point;
        break;
      }
    }

    if (!insertConfig) {
      log('No injection point found - retrying in 1s');
      setTimeout(injectQuickbarStatus, 1000);
      return;
    }

    log(`Status bar injection point: ${insertConfig.container.id || insertConfig.container.tagName} (${insertConfig.position})`);

    // Get game's graphic base URL
    const graphicBase = unsafeWindow.image_base || '/graphic/';
    const villageId = unsafeWindow.game_data?.village?.id || '';
    const baseUrl = `/game.php?village=${villageId}&screen=`;

    // Create custom bar container
    const customBar = document.createElement('div');
    customBar.id = 'tw-agent-custom-bar';
    customBar.className = 'tw-agent-custom-statusbar';

    // Create inner container for flex layout
    const innerBar = document.createElement('div');
    innerBar.className = 'tw-agent-statusbar-inner';

    // Create elements
    const { statusBadge, navItemElements, refreshBtn, makeMasterBtn } = createStatusBarElements(graphicBase, baseUrl);

    // Add status badge
    innerBar.appendChild(statusBadge);

    // Add Make Master button (only visible when STANDBY)
    innerBar.appendChild(makeMasterBtn);

    // Add separator
    const sep1 = document.createElement('span');
    sep1.className = 'tw-agent-separator';
    sep1.textContent = '|';
    innerBar.appendChild(sep1);

    // Add nav items
    navItemElements.forEach(item => innerBar.appendChild(item));

    // Add separator
    const sep2 = document.createElement('span');
    sep2.className = 'tw-agent-separator';
    sep2.textContent = '|';
    innerBar.appendChild(sep2);

    // Add refresh button
    innerBar.appendChild(refreshBtn);

    customBar.appendChild(innerBar);

    // Add class for master state (used to hide make master button)
    if (isMasterTab) {
      customBar.classList.add('tw-agent-master-active');
    }

    // Insert based on position strategy
    const { container, position } = insertConfig;
    switch (position) {
      case 'prepend':
        container.insertBefore(customBar, container.firstChild);
        break;
      case 'before':
        container.parentNode.insertBefore(customBar, container);
        break;
      case 'after':
        container.parentNode.insertBefore(customBar, container.nextSibling);
        break;
    }

    log(`Custom status bar injected: ${isMasterTab ? 'MASTER' : 'STANDBY'} tab`);
  }

  /**
   * Create status bar elements for custom bar
   */
  function createStatusBarElements(graphicBase, baseUrl) {
    // Status Badge
    const statusBadge = document.createElement('div');
    statusBadge.className = `tw-agent-status-item ${isMasterTab ? 'tw-agent-master-badge' : 'tw-agent-standby-badge'}`;
    statusBadge.id = 'tw-agent-status-badge';

    const statusDot = document.createElement('span');
    statusDot.className = `tw-agent-status-dot ${isMasterTab ? 'master' : 'standby'}`;
    statusBadge.appendChild(statusDot);
    statusBadge.appendChild(document.createTextNode(isMasterTab ? 'MASTER' : 'STANDBY'));

    // Nav items
    const navConfig = [
      { text: 'Áttekintés', screen: 'overview', icon: 'overview/village_info.png' },
      { text: 'Főép.', screen: 'main', icon: 'buildings/main.png' },
      { text: 'Barakk', screen: 'barracks', icon: 'buildings/barracks.png' },
      { text: 'Gyülekező', screen: 'place', icon: 'buildings/place.png' },
      { text: 'Statisztikák', screen: 'info_player&mode=stats_own', icon: 'icons/ally.png' }
    ];

    const navItemElements = navConfig.map(item => {
      const navItem = document.createElement('a');
      navItem.href = baseUrl + item.screen;
      navItem.className = 'tw-agent-nav-link';

      const img = document.createElement('img');
      img.src = graphicBase + item.icon;
      navItem.appendChild(img);

      const text = document.createElement('span');
      text.textContent = item.text;
      navItem.appendChild(text);

      return navItem;
    });

    // Refresh button
    const refreshBtn = document.createElement('a');
    refreshBtn.href = '#';
    refreshBtn.className = 'tw-agent-nav-link tw-agent-refresh-btn';
    refreshBtn.title = 'Adatok frissítése';

    const refreshImg = document.createElement('img');
    refreshImg.src = graphicBase + 'icons/refresh.png';
    refreshBtn.appendChild(refreshImg);

    const refreshText = document.createElement('span');
    refreshText.textContent = 'Frissítés';
    refreshBtn.appendChild(refreshText);

    refreshBtn.addEventListener('click', handleRefreshClick(baseUrl));

    // Make Master button (only shown when STANDBY)
    const makeMasterBtn = document.createElement('a');
    makeMasterBtn.href = '#';
    makeMasterBtn.className = 'tw-agent-nav-link tw-agent-make-master-btn';
    makeMasterBtn.id = 'tw-agent-make-master-btn';
    makeMasterBtn.title = 'Ezt a tabot MASTER-ré teszi';
    makeMasterBtn.style.display = isMasterTab ? 'none' : 'inline-flex';

    const crownIcon = document.createElement('span');
    crownIcon.textContent = '👑';
    crownIcon.style.fontSize = '12px';
    makeMasterBtn.appendChild(crownIcon);

    const makeMasterText = document.createElement('span');
    makeMasterText.textContent = 'MASTER';
    makeMasterBtn.appendChild(makeMasterText);

    makeMasterBtn.addEventListener('click', handleMakeMasterClick);

    return { statusBadge, navItemElements, refreshBtn, makeMasterBtn };
  }

  /**
   * Handle "Make Master" button click
   */
  function handleMakeMasterClick(e) {
    e.preventDefault();

    if (isMasterTab) {
      log('Already master - ignoring click');
      return;
    }

    log('Requesting master status...');

    // Send request to server
    send('requestMaster', {
      sessionId: sessionId,
      reason: 'User requested via UI'
    });

    // Visual feedback
    const btn = e.currentTarget;
    btn.classList.add('disabled');
    btn.textContent = 'Requesting...';
  }

  /**
   * Handle refresh button click
   */
  function handleRefreshClick(baseUrl) {
    return async (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      btn.classList.add('refreshing');
      log('Manual refresh triggered');

      const currentScreen = new URLSearchParams(window.location.search).get('screen');
      if (currentScreen !== 'overview') {
        window.location.href = baseUrl + 'overview';
      } else {
        reportData();
        setTimeout(() => btn.classList.remove('refreshing'), 1000);
      }
    };
  }

  /**
   * Update quickbar status badge (when master status changes)
   */
  function updateQuickbarStatus() {
    const badge = document.getElementById('tw-agent-status-badge');
    if (!badge) {
      injectQuickbarStatus();
      return;
    }

    // Check if it's native quickbar (li element) or custom bar (div element)
    const isNative = badge.tagName === 'LI';

    if (isNative) {
      // Native quickbar - update li class
      badge.className = `quickbar_item tw-agent-injected ${isMasterTab ? 'tw-agent-master-badge' : 'tw-agent-standby-badge'}`;

      // Update content
      const statusSpan = badge.querySelector('span');
      if (statusSpan) {
        statusSpan.innerHTML = '';
        const statusDot = document.createElement('span');
        statusDot.className = `tw-agent-status-dot ${isMasterTab ? 'master' : 'standby'}`;
        statusSpan.appendChild(statusDot);
        statusSpan.appendChild(document.createTextNode(isMasterTab ? 'MASTER' : 'STANDBY'));
      }
    } else {
      // Custom status bar - update div class
      badge.className = `tw-agent-status-item ${isMasterTab ? 'tw-agent-master-badge' : 'tw-agent-standby-badge'}`;

      // Update content - clear and rebuild
      badge.innerHTML = '';
      const statusDot = document.createElement('span');
      statusDot.className = `tw-agent-status-dot ${isMasterTab ? 'master' : 'standby'}`;
      badge.appendChild(statusDot);
      badge.appendChild(document.createTextNode(isMasterTab ? 'MASTER' : 'STANDBY'));
    }

    // Update Make Master button visibility
    const makeMasterBtn = document.getElementById('tw-agent-make-master-btn');
    if (makeMasterBtn) {
      makeMasterBtn.style.display = isMasterTab ? 'none' : 'inline-flex';
      // Reset button state if it was in "requesting" state
      if (!isMasterTab) {
        makeMasterBtn.classList.remove('disabled');
        makeMasterBtn.innerHTML = '<span style="font-size:12px">👑</span><span>MASTER</span>';
      }
    }

    // Update custom bar class
    const customBar = document.getElementById('tw-agent-custom-bar');
    if (customBar) {
      if (isMasterTab) {
        customBar.classList.add('tw-agent-master-active');
      } else {
        customBar.classList.remove('tw-agent-master-active');
      }
    }

    // Update browser tab title
    updateTabTitle();

    log(`Status badge updated: ${isMasterTab ? 'MASTER' : 'STANDBY'}`);
  }

  /**
   * Update browser tab title with MASTER/STANDBY prefix
   */
  let originalTitle = null;

  function updateTabTitle() {
    // Store original title on first call
    if (originalTitle === null) {
      originalTitle = document.title;
    }

    // Remove any existing prefix
    let baseTitle = originalTitle;
    if (baseTitle.startsWith('[MASTER] ') || baseTitle.startsWith('[STANDBY] ')) {
      baseTitle = baseTitle.replace(/^\[(MASTER|STANDBY)\] /, '');
    }

    // Add new prefix
    const prefix = isMasterTab ? '[MASTER]' : '[STANDBY]';
    document.title = `${prefix} ${baseTitle}`;

    log(`Tab title updated: ${document.title}`);
  }

  // ============ CONNECTION LAYER ============

  /**
   * Wait for game_data to be available
   * Since we run at document-start, game_data doesn't exist yet
   */
  async function waitForGameData(maxWait = 60000) {
    const startTime = Date.now();
    log('Waiting for game_data to load...');

    let lastDebugTime = 0;

    while (Date.now() - startTime < maxWait) {
      // Debug logging every 5 seconds
      if (Date.now() - lastDebugTime > 5000) {
        const hasGameData = typeof unsafeWindow.game_data !== 'undefined';
        log(`Still waiting... game_data exists: ${hasGameData}, elapsed: ${Math.floor((Date.now() - startTime) / 1000)}s`);
        lastDebugTime = Date.now();
      }

      // Check if game_data is available
      if (unsafeWindow.game_data &&
          unsafeWindow.game_data.player &&
          unsafeWindow.game_data.village &&
          unsafeWindow.game_data.world) {
        log('game_data loaded successfully!');
        log('Player:', unsafeWindow.game_data.player.name);
        log('World:', unsafeWindow.game_data.world);
        return true;
      }

      await sleep(200);
    }

    error(`Timeout waiting for game_data after ${maxWait}ms`);
    error('game_data exists:', typeof unsafeWindow.game_data !== 'undefined');
    return false;
  }

  function connect() {
    log('Connecting to server:', CONFIG.serverUrl);

    try {
      ws = new WebSocket(CONFIG.serverUrl);

      ws.onopen = async () => {
        log('WebSocket connected');
        isConnected = true;
        reconnectAttempts = 0;

        // Wait for game_data to be available before registering
        await waitForGameData();

        // Register with server
        register();

        // Flush any queued game events from interceptor
        if (typeof window.flushGameEventQueue === 'function') {
          window.flushGameEventQueue();
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (err) {
          error('Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        error('WebSocket error:', err);
      };

      ws.onclose = () => {
        log('WebSocket closed');
        isConnected = false;
        ws = null;

        // Reconnect with exponential backoff
        reconnect();
      };
    } catch (err) {
      error('Failed to create WebSocket:', err);
      reconnect();
    }
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (reportTimer) {
      clearTimeout(reportTimer);
      reportTimer = null;
    }
    isConnected = false;
  }

  function reconnect() {
    reconnectAttempts++;
    const delay = Math.min(
      CONFIG.reconnectDelay * Math.pow(2, reconnectAttempts - 1),
      CONFIG.maxReconnectDelay
    );

    log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    setTimeout(connect, delay);
  }

  function send(type, data = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      error('Cannot send message: WebSocket not connected');
      return false;
    }

    const message = { type, ...data };
    try {
      ws.send(JSON.stringify(message));
      log('Sent message:', type);
      return true;
    } catch (err) {
      error('Failed to send message:', err);
      return false;
    }
  }

  // Expose send function globally for game WebSocket interceptor
  window.sendToControlServer = send;

  // ============ MESSAGE HANDLERS ============

  function handleMessage(message) {
    log('Received message:', message.type);

    switch (message.type) {
      case 'registered':
        handleRegistered(message);
        break;

      case 'masterStatusChanged':
        handleMasterStatusChanged(message);
        break;

      case 'sendTroops':
        handleSendTroops(message);
        break;

      case 'buildBuilding':
        handleBuildBuilding(message);
        break;

      case 'recruitTroops':
        handleRecruitTroops(message);
        break;

      case 'requestRefresh':
        handleRequestRefresh(message);
        break;

      case 'ping':
        handlePing(message);
        break;

      case 'fetchStatistics':
        handleFetchStatistics(message);
        break;

      case 'navigate':
        handleNavigate(message);
        break;

      case 'startFarm':
        handleStartFarm(message);
        break;

      default:
        log('Unknown message type:', message.type);
    }
  }

  function handleRegistered(message) {
    sessionId = message.sessionId;
    isMasterTab = message.isMaster || false;

    // IMPORTANT: Save master status to sessionStorage for persistence across navigation
    saveMasterStatus(isMasterTab);

    log(`Registered with sessionId: ${sessionId}`);
    log(`Tab role: ${isMasterTab ? 'MASTER' : 'STANDBY'}`);
    log(`Total connections: ${message.connectionCount || 1}`);

    // Inject quickbar status
    injectQuickbarStatus();

    // Update browser tab title
    updateTabTitle();

    // Only master tab does periodic reporting
    if (isMasterTab) {
      scheduleReport();
      // Send immediate report
      reportData();
    } else {
      log('STANDBY tab - not scheduling reports (master handles this)');
    }
  }

  function handleMasterStatusChanged(message) {
    const wasMaster = isMasterTab;
    isMasterTab = message.isMaster;

    // IMPORTANT: Save master status to sessionStorage for persistence across navigation
    saveMasterStatus(isMasterTab);

    log(`Master status changed: ${wasMaster ? 'MASTER' : 'STANDBY'} -> ${isMasterTab ? 'MASTER' : 'STANDBY'}`);
    log(`Reason: ${message.reason || 'unknown'}`);

    // Update quickbar badge
    updateQuickbarStatus();

    // If promoted to master, start reporting
    if (isMasterTab && !wasMaster) {
      log('Promoted to MASTER - starting periodic reports');
      scheduleReport();
      reportData();
    }

    // If demoted from master, stop reporting
    if (!isMasterTab && wasMaster) {
      log('Demoted to STANDBY - stopping periodic reports');
      if (reportTimer) {
        clearTimeout(reportTimer);
        reportTimer = null;
      }
    }
  }

  function handleSendTroops(message) {
    // Only master tab executes commands
    if (!isMasterTab) {
      log('Ignoring sendTroops command - not master tab');
      return;
    }
    log('Send troops command:', message);
    executeSendTroops(message);
  }

  function handleBuildBuilding(message) {
    // Only master tab executes commands
    if (!isMasterTab) {
      log('Ignoring buildBuilding command - not master tab');
      return;
    }
    log('Build building command:', message);
    executeBuildBuilding(message);
  }

  function handleRecruitTroops(message) {
    // Only master tab executes commands
    if (!isMasterTab) {
      log('Ignoring recruitTroops command - not master tab');
      return;
    }
    log('Recruit troops command:', message);
    executeRecruitTroops(message);
  }

  /**
   * Handle fetchStatistics command from server
   * Navigates to statistics page, waits for load, scrapes data, and reports back
   */
  function handleFetchStatistics(message) {
    // Only master tab executes commands
    if (!isMasterTab) {
      log('Ignoring fetchStatistics command - not master tab');
      return;
    }

    log('Fetch statistics command received:', message);

    const actionId = message.actionId;

    // Check if we're already on the statistics page
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('screen') === 'info_player' && urlParams.get('mode') === 'stats_own') {
      log('Already on statistics page - scraping now');
      // Already on page, scrape immediately
      const stats = scrapeStatistics();
      if (stats) {
        // Send data report
        reportData();
        sendCommandResult(actionId, true, 'Statistics scraped successfully');
      } else {
        sendCommandResult(actionId, false, 'Failed to scrape statistics');
      }
      return;
    }

    // Navigate to statistics page
    log('Navigating to statistics page...');

    // Store actionId for when page loads
    sessionStorage.setItem('tw_pending_fetch_stats', actionId);

    // Build the statistics URL
    const baseUrl = window.location.href.split('?')[0].replace(/\/game\.php.*/, '/game.php');
    const villageId = unsafeWindow.game_data?.village?.id || urlParams.get('village');
    const statsUrl = `${baseUrl}?village=${villageId}&screen=info_player&mode=stats_own`;

    log('Navigating to:', statsUrl);
    window.location.href = statsUrl;
  }

  /**
   * Handle navigate command - navigate to a specific game screen
   */
  function handleNavigate(message) {
    // Only master tab executes commands
    if (!isMasterTab) {
      log('Ignoring navigate command - not master tab');
      return;
    }

    const screen = message.screen;
    const actionId = message.actionId;

    log(`Navigate command received: ${screen}`);

    // Build the navigation URL
    const urlParams = new URLSearchParams(window.location.search);
    const baseUrl = window.location.href.split('?')[0].replace(/\/game\.php.*/, '/game.php');
    const villageId = unsafeWindow.game_data?.village?.id || urlParams.get('village');

    let targetUrl;

    // Map screen names to TW URLs
    switch (screen) {
      case 'overview':
        targetUrl = `${baseUrl}?village=${villageId}&screen=overview`;
        break;
      case 'main':
        targetUrl = `${baseUrl}?village=${villageId}&screen=main`;
        break;
      case 'barracks':
        targetUrl = `${baseUrl}?village=${villageId}&screen=barracks`;
        break;
      case 'stable':
        targetUrl = `${baseUrl}?village=${villageId}&screen=stable`;
        break;
      case 'garage':
        targetUrl = `${baseUrl}?village=${villageId}&screen=garage`;
        break;
      case 'smith':
        targetUrl = `${baseUrl}?village=${villageId}&screen=smith`;
        break;
      case 'place':
        targetUrl = `${baseUrl}?village=${villageId}&screen=place`;
        break;
      case 'market':
        targetUrl = `${baseUrl}?village=${villageId}&screen=market`;
        break;
      case 'wood':
        targetUrl = `${baseUrl}?village=${villageId}&screen=wood`;
        break;
      case 'stone':
        targetUrl = `${baseUrl}?village=${villageId}&screen=stone`;
        break;
      case 'iron':
        targetUrl = `${baseUrl}?village=${villageId}&screen=iron`;
        break;
      case 'farm':
        targetUrl = `${baseUrl}?village=${villageId}&screen=farm`;
        break;
      case 'storage':
        targetUrl = `${baseUrl}?village=${villageId}&screen=storage`;
        break;
      case 'wall':
        targetUrl = `${baseUrl}?village=${villageId}&screen=wall`;
        break;
      case 'statue':
        targetUrl = `${baseUrl}?village=${villageId}&screen=statue`;
        break;
      case 'snob':
        targetUrl = `${baseUrl}?village=${villageId}&screen=snob`;
        break;
      case 'statistics':
        targetUrl = `${baseUrl}?village=${villageId}&screen=info_player&mode=stats_own`;
        break;
      default:
        log(`Unknown screen: ${screen}`);
        sendCommandResult(actionId, false, `Unknown screen: ${screen}`);
        return;
    }

    log(`Navigating to: ${targetUrl}`);
    window.location.href = targetUrl;
  }

  function handleRequestRefresh(message) {
    log('Refresh requested');
    reportData();
  }

  function handlePing(message) {
    send('pong', { timestamp: Date.now() });
  }

  // ============ FARM BOT ============

  // ============ FARM BOT HANDLER ============
  // Adapted from NorbiOn_Farm.js NorbiFarmTabHandler
  // Uses WebSocket for reporting instead of localStorage

  const FarmHandler = {
    farmTimer: null,
    totalClicks: 0,
    isRunning: false,
    isPaused: false,
    startTime: null,
    recheckTimeout: null,
    actionId: null,
    lastProgress: { current: 0, total: 0 },
    noProgressCount: 0,

    /**
     * Start the farming process
     */
    start: function(actionId) {
      log('[FarmHandler] === STARTING FARM PROCESS ===');
      log('[FarmHandler] ActionId: ' + actionId);
      this.actionId = actionId;
      this.isRunning = true;
      this.isPaused = false;
      this.totalClicks = 0;
      this.startTime = Date.now();
      this.lastProgress = { current: 0, total: 0 };
      this.noProgressCount = 0;

      // Log current page state for debugging
      const progressBar = document.getElementById('FarmGodProgessbar');
      const buttonA = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_a');
      const buttonB = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_b');
      log('[FarmHandler] Progress bar found: ' + !!progressBar);
      log('[FarmHandler] Button A found: ' + !!buttonA);
      log('[FarmHandler] Button B found: ' + !!buttonB);

      if (!progressBar && !buttonA && !buttonB) {
        log('[FarmHandler] WARNING: No FarmGod elements found! FarmGod may not be initialized.');
      }

      const self = this;

      // Start single interval: bot check -> progress check -> button click
      this.farmTimer = setInterval(function() {
        // Skip if paused (waiting for bot protection recheck)
        if (self.isPaused) {
          return;
        }

        // Step 1: Check bot protection first
        if (self.checkBotProtection()) {
          return; // Paused, waiting for recheck
        }

        // Step 2: Check progress
        if (self.monitorProgress()) {
          return; // Stop if farming completed
        }

        // Step 3: Click farm button
        self.clickFarmButton();
      }, 220); // Check and click every 220ms

      log('[FarmHandler] Farm timer started (220ms interval)');
    },

    /**
     * Click farm button (A or B)
     */
    clickFarmButton: function() {
      if (!this.isRunning) return;

      try {
        // Look for farm buttons (A or B) - same selectors as NorbiOn_Farm.js
        const buttonA = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_a');
        const buttonB = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_b');

        // Click whichever button is available (A first, then B)
        const button = buttonA || buttonB;

        if (button) {
          button.click();
          this.totalClicks++;

          if (this.totalClicks % 50 === 0) {
            log('[FarmHandler] Clicked farm button ' + this.totalClicks + ' times');
          }
        } else {
          // Log every 50 cycles when no button found
          if (this.totalClicks % 50 === 0 || this.totalClicks === 0) {
            log('[FarmHandler] No farm button found, waiting...');
          }
        }
      } catch (err) {
        error('[FarmHandler] Error clicking farm button:', err);
      }
    },

    /**
     * Monitor farming progress
     */
    monitorProgress: function() {
      if (!this.isRunning) return false;

      try {
        const progressBar = document.getElementById('FarmGodProgessbar');
        if (!progressBar) return false;

        const labelSpan = progressBar.querySelector('span.label');
        if (!labelSpan) return false;

        // Get clean text (handles HTML like grey dots)
        const cleanText = labelSpan.innerText || labelSpan.textContent;

        // Simple string-based parsing to handle thousands separators
        const parts = cleanText.split(' / ');

        if (parts.length !== 2) {
          return false;
        }

        let currentStr = parts[0].trim();
        let totalStr = parts[1].trim();

        // Handle thousands separators (Hungarian uses "." or space)
        if (currentStr.indexOf('.') !== -1) {
          currentStr = currentStr.replace(/\./g, '');
        }
        currentStr = currentStr.replace(/\s/g, '');

        if (totalStr.indexOf('.') !== -1) {
          totalStr = totalStr.replace(/\./g, '');
        }
        totalStr = totalStr.replace(/\s/g, '');

        const current = parseInt(currentStr, 10);
        const total = parseInt(totalStr, 10);

        if (isNaN(current) || isNaN(total)) {
          return false;
        }

        // Send progress update if changed
        if (current !== this.lastProgress.current || total !== this.lastProgress.total) {
          log(`[FarmHandler] Progress: ${current}/${total}`);
          send('farmProgress', {
            actionId: this.actionId,
            current: current,
            total: total
          });
          this.lastProgress = { current, total };
          this.noProgressCount = 0;
        } else {
          this.noProgressCount++;
        }

        // Check if farming is complete
        // Case 1: Normal completion - current >= total (and total > 0)
        // Case 2: Empty run - total is 0 (no villages to farm) - treat as success
        if ((total > 0 && current >= total) || (total === 0 && this.noProgressCount > 10)) {
          const isEmptyRun = total === 0;
          if (isEmptyRun) {
            log('[FarmHandler] EMPTY RUN - No villages to farm (0/0)');
          } else {
            log('[FarmHandler] FARMING COMPLETED! Final: ' + cleanText);
          }
          this.stop();

          const duration = Date.now() - this.startTime;
          const durationMinutes = Math.floor(duration / 60000);
          const durationSeconds = Math.floor((duration % 60000) / 1000);

          log(`[FarmHandler] Duration: ${durationMinutes}m ${durationSeconds}s, Clicks: ${this.totalClicks}`);

          send('farmComplete', {
            actionId: this.actionId,
            farmed: total,
            duration: duration,
            totalClicks: this.totalClicks,
            emptyRun: isEmptyRun
          });

          // Close farm tab after 2 seconds (new tab approach)
          log('[FarmHandler] Closing farm tab in 2 seconds...');
          setTimeout(function() {
            log('[FarmHandler] Closing farm tab now');
            window.close();
          }, 2000);

          return true; // Farming completed
        }

        // Check for stall (no progress for ~22 seconds with 220ms interval)
        if (this.noProgressCount > 100) {
          log('[FarmHandler] Farming stalled - no progress detected');
          this.stop();
          send('farmError', {
            actionId: this.actionId,
            error: 'stalled',
            message: 'Farming stalled - no progress for 22 seconds'
          });
          // Close farm tab after error
          setTimeout(function() {
            log('[FarmHandler] Closing farm tab after stall error');
            window.close();
          }, 2000);
          return true;
        }

        return false; // Not complete yet

      } catch (err) {
        error('[FarmHandler] Error monitoring progress:', err);
        return false;
      }
    },

    /**
     * Comprehensive bot protection detection (7 methods from NorbiOn_Farm.js)
     */
    detectBotProtection: function() {
      try {
        // Method 1: Check for botprotection_quest element
        if (document.getElementById('botprotection_quest')) {
          return 'botprotection_quest element';
        }

        // Method 2: Check for .bot-protection-row
        if (document.querySelector('.bot-protection-row')) {
          return '.bot-protection-row element';
        }

        // Method 3: Check for .captcha element
        if (document.querySelector('.captcha')) {
          return '.captcha element';
        }

        // Method 4: Check for popup_box_bot_protection
        if (document.querySelector('#popup_box_bot_protection')) {
          return '#popup_box_bot_protection element';
        }

        // Method 5-7: Check for bot protection text (Hungarian/German/English)
        const bodyText = document.body.textContent || document.body.innerText || '';
        if (bodyText.indexOf('Bot védelem') !== -1) {
          return '"Bot védelem" text';
        }
        if (bodyText.indexOf('Kezdd meg a botvédelem ellenőrzését') !== -1) {
          return '"Kezdd meg a botvédelem ellenőrzését" text';
        }
        if (bodyText.indexOf('botvédelem ellenőrzését') !== -1) {
          return '"botvédelem ellenőrzését" text';
        }
        if (bodyText.indexOf('Start the bot protection check') !== -1) {
          return '"Start the bot protection check" text';
        }
        if (bodyText.indexOf('Botschutz') !== -1) {
          return '"Botschutz" text';
        }

      } catch (err) {
        error('[FarmHandler] Error in detectBotProtection:', err);
      }

      return null; // No bot protection detected
    },

    /**
     * Check bot protection with pause/resume logic
     */
    checkBotProtection: function() {
      if (!this.isRunning) return false;

      const detectionMethod = this.detectBotProtection();

      if (detectionMethod) {
        // Bot protection detected!
        if (!this.isPaused) {
          // First detection - pause and schedule recheck
          log('[FarmHandler] BOT PROTECTION DETECTED! Method: ' + detectionMethod);
          log('[FarmHandler] Pausing farming for 10 seconds... (captcha solver working)');

          this.isPaused = true;
          const self = this;

          // Send pause notification to server
          send('farmProgress', {
            actionId: this.actionId,
            current: this.lastProgress.current,
            total: this.lastProgress.total,
            paused: true,
            reason: 'Bot protection detected: ' + detectionMethod
          });

          // Schedule recheck after 10 seconds
          this.recheckTimeout = setTimeout(function() {
            log('[FarmHandler] Rechecking bot protection after 10 seconds...');

            const recheckMethod = self.detectBotProtection();

            if (recheckMethod) {
              // Still detected - stop farming completely
              log('[FarmHandler] BOT PROTECTION STILL PRESENT! Method: ' + recheckMethod);
              log('[FarmHandler] Captcha solver failed or timeout. Stopping farming...');

              self.stop();

              send('farmError', {
                actionId: self.actionId,
                error: 'botProtection',
                message: 'Bot protection detected - farming stopped after recheck',
                detectionMethod: recheckMethod,
                totalClicks: self.totalClicks
              });
            } else {
              // All clear - resume farming!
              log('[FarmHandler] BOT PROTECTION CLEARED! Captcha solver successful!');
              log('[FarmHandler] Resuming farming...');
              self.isPaused = false;

              // Notify server that we resumed
              send('farmProgress', {
                actionId: self.actionId,
                current: self.lastProgress.current,
                total: self.lastProgress.total,
                paused: false,
                reason: 'Bot protection cleared, resuming'
              });
            }
          }, 10000); // 10 seconds
        }

        return true; // Bot protection detected (paused)
      }

      return false; // No bot protection
    },

    /**
     * Stop farming
     */
    stop: function() {
      this.isRunning = false;
      this.isPaused = false;

      // Clear farm timer
      if (this.farmTimer) {
        clearInterval(this.farmTimer);
        this.farmTimer = null;
      }

      // Clear recheck timeout if exists
      if (this.recheckTimeout) {
        clearTimeout(this.recheckTimeout);
        this.recheckTimeout = null;
      }

      // Clear sessionStorage state
      sessionStorage.removeItem('tw_farm_state');

      log('[FarmHandler] Stopped farming. Total button clicks: ' + this.totalClicks);
    }
  };

  /**
   * Handle start farm command from server
   */
  function handleStartFarm(message) {
    // Only master tab executes commands
    if (!isMasterTab) {
      log('Ignoring startFarm command - not master tab');
      return;
    }

    const actionId = message.actionId;

    log(`Starting farm with actionId: ${actionId}`);

    // Get farm page URL
    const baseUrl = window.location.href.split('?')[0].replace(/\/game\.php.*/, '/game.php');
    const villageId = unsafeWindow.game_data?.village?.id;

    if (!villageId) {
      log('Error: Could not get village ID');
      send('farmError', {
        actionId: actionId,
        error: 'noVillageId',
        message: 'Could not get village ID'
      });
      return;
    }

    // Build farm URL with actionId parameter (new tab approach)
    const farmUrl = `${baseUrl}?village=${villageId}&screen=am_farm&tw_farm_action=${actionId}`;
    log(`Opening farm tab: ${farmUrl}`);

    // Open in new tab - the new tab will detect the tw_farm_action parameter and start farming
    window.open(farmUrl, 'tw_farm_tab_' + villageId);
  }

  /**
   * Check if we're on the farm page and should execute farming
   * New tab approach: detect tw_farm_action URL parameter
   */
  function checkFarmExecution() {
    log('=== CHECK FARM EXECUTION (New Tab) ===');

    // Check for tw_farm_action parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const actionId = urlParams.get('tw_farm_action');

    if (!actionId) {
      log('No tw_farm_action parameter - this is not a farm tab');
      return;
    }

    log(`FARM TAB DETECTED! ActionId: ${actionId}`);

    // Verify we're on the am_farm page
    const isAmFarm = window.location.href.includes('screen=am_farm');
    if (!isAmFarm) {
      log('ERROR: tw_farm_action found but not on am_farm page');
      return;
    }

    // CRITICAL: Farm tabs should NEVER become master
    // Clear master status from sessionStorage to prevent stealing master from opener tab
    sessionStorage.removeItem(MASTER_STATUS_KEY);
    log('Cleared master status - farm tabs are always workers');

    // Mark this tab as a dedicated farm tab (not master)
    log('This is a dedicated farm tab - will execute farming and close when done');

    // Execute farming after page loads
    setTimeout(function() {
      executeFarming(actionId);
    }, 3000); // Wait 3 seconds for page to fully load
  }

  /**
   * Execute the actual farming process
   * EXACTLY following NorbiOn_Farm.js workflow
   * Uses sessionStorage to survive page updates (from NorbiOn_Farm.js pattern)
   */
  // Helper to send debug messages to server via WebSocket
  function farmDebug(actionId, message, data) {
    log('[FarmDebug] ' + message);
    send('farmDebug', {
      actionId: actionId,
      message: message,
      data: data || {},
      timestamp: Date.now()
    });
  }

  function executeFarming(actionId) {
    log('=== EXECUTE FARMING (NorbiOn workflow) ===');
    log('ActionId: ' + actionId);
    farmDebug(actionId, 'Starting executeFarming');

    // Check if we already clicked the button (page might have reloaded)
    var farmState = sessionStorage.getItem('tw_farm_state');
    if (farmState) {
      try {
        farmState = JSON.parse(farmState);
        if (farmState.actionId === actionId && farmState.buttonClicked) {
          log('Resuming farming - button was already clicked');
          // Go directly to FarmHandler
          loadFarmGod(function() {
            waitForFarmGod(function() {
              log('FarmGod ready, starting FarmHandler (resumed)...');
              FarmHandler.start(actionId);
            });
          });
          return;
        }
      } catch (e) {
        log('Error parsing farm state: ' + e);
      }
    }

    // Step 1: Load FarmGod script (from NorbiOn_Farm.js line 283)
    farmDebug(actionId, 'Step 1: Loading FarmGod script...');
    loadFarmGod(function() {
      log('FarmGod script loaded!');
      farmDebug(actionId, 'FarmGod script loaded successfully');

      // Step 2: Wait for FarmGod to initialize (from NorbiOn_Farm.js line 288-289)
      farmDebug(actionId, 'Step 2: Waiting for FarmGod to initialize...');
      waitForFarmGod(function() {
        log('FarmGod ready, starting Final Initialization...');
        farmDebug(actionId, 'FarmGod is ready');

        // Step 2.5: Check if A/B farm buttons are already visible (farm already configured)
        var buttonA = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_a');
        var buttonB = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_b');

        if (buttonA || buttonB) {
          log('A/B farm buttons already visible - farm is configured, skipping setup button');
          farmDebug(actionId, 'A/B buttons found! Farm already configured, starting FarmHandler directly', {
            hasButtonA: !!buttonA,
            hasButtonB: !!buttonB
          });
          FarmHandler.start(actionId);
          return;
        }

        // Step 3: Click the "Farm megtervezése" button (from NorbiOn_Farm.js line 293-296)
        log('Looking for Farm megtervezése button...');
        farmDebug(actionId, 'Step 3: Looking for Farm megtervezése button (A/B not found)...');
        var planButton = document.querySelector('input.btn.optionButton[value="Farm megtervezése"]');

        // Debug: log all buttons on page if not found
        if (!planButton) {
          log('DEBUG: Button not found with exact selector, checking alternatives...');
          var allInputBtns = document.querySelectorAll('input.btn');
          var buttonList = [];
          allInputBtns.forEach(function(btn, i) {
            buttonList.push({ index: i, value: btn.value, className: btn.className });
            log('  [' + i + '] value="' + btn.value + '" class="' + btn.className + '"');
          });
          farmDebug(actionId, 'Button NOT found! All buttons on page:', { buttons: buttonList });

          // Try alternative selectors
          planButton = document.querySelector('input[value="Farm megtervezése"]');
          if (planButton) {
            log('DEBUG: Found with simpler selector!');
            farmDebug(actionId, 'Found button with simpler selector');
          }
        }

        if (planButton) {
          log('Found Farm megtervezése button, clicking...');
          farmDebug(actionId, 'Found button, clicking it');

          // Save state BEFORE clicking (in case page reloads)
          sessionStorage.setItem('tw_farm_state', JSON.stringify({
            actionId: actionId,
            buttonClicked: true,
            timestamp: Date.now()
          }));

          planButton.click();

          // Step 4: Wait for loading throbber to disappear (from NorbiOn_Farm.js line 301-320)
          log('Waiting for loading throbber to disappear...');
          waitForThrobberToDisappear(function() {
            log('Farm plan created, now starting continuous farming...');

            // Step 5: Start the FarmHandler (from NorbiOn_Farm.js line 327+)
            FarmHandler.start(actionId);
          });
        } else {
          log('ERROR: Farm megtervezése button not found!');
          farmDebug(actionId, 'ERROR: Farm megtervezése button not found! Closing tab in 3s');
          send('farmError', {
            actionId: actionId,
            error: 'buttonNotFound',
            message: 'Farm megtervezése button not found'
          });
          setTimeout(function() { window.close(); }, 3000);
        }
      });
    });
  }

  /**
   * Load FarmGod script from Innogames CDN
   */
  function loadFarmGod(callback) {
    // Check if FarmGod is already loaded
    if (typeof unsafeWindow.FarmGod !== 'undefined') {
      log('FarmGod already loaded');
      callback();
      return;
    }

    // Check if jQuery is available
    if (typeof unsafeWindow.$ !== 'undefined' && unsafeWindow.$.getScript) {
      log('Loading FarmGod via jQuery.getScript...');
      unsafeWindow.$.getScript('https://media.innogamescdn.com/com_DS_HU/scripts/farmgod.js')
        .done(function() {
          log('FarmGod script loaded successfully');
          callback();
        })
        .fail(function() {
          log('Failed to load FarmGod via jQuery, trying script tag...');
          loadFarmGodViaScript(callback);
        });
    } else {
      loadFarmGodViaScript(callback);
    }
  }

  /**
   * Load FarmGod via script tag (fallback)
   */
  function loadFarmGodViaScript(callback) {
    const script = document.createElement('script');
    script.src = 'https://media.innogamescdn.com/com_DS_HU/scripts/farmgod.js';
    script.onload = function() {
      log('FarmGod script loaded via script tag');
      callback();
    };
    script.onerror = function() {
      log('Failed to load FarmGod script');
      const farmData = sessionStorage.getItem('tw_farm_active');
      const actionId = farmData ? JSON.parse(farmData).actionId : null;
      send('farmError', {
        actionId: actionId,
        error: 'farmGodLoadFailed',
        message: 'Failed to load FarmGod script from CDN'
      });
    };
    document.head.appendChild(script);
  }

  /**
   * Wait for FarmGod to be fully initialized AND its UI to appear
   * Waits for either the setup button OR the A/B farm buttons
   */
  function waitForFarmGod(callback) {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds max

    const checkFarmGod = function() {
      attempts++;

      // First check if FarmGod object exists
      if (!unsafeWindow.FarmGod) {
        if (attempts >= maxAttempts) {
          log('FarmGod object not found after timeout');
          callback();
          return;
        }
        setTimeout(checkFarmGod, 100);
        return;
      }

      // FarmGod exists, now wait for its UI to appear
      // Check for setup button (in popup)
      var setupButton = document.querySelector('input.btn.optionButton[value="Farm megtervezése"]');
      // Check for A/B buttons (farm already configured)
      var buttonA = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_a');
      var buttonB = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_b');

      if (setupButton || buttonA || buttonB) {
        log('FarmGod UI is ready: ' + (setupButton ? 'setup button found' : 'A/B buttons found'));
        callback();
      } else if (attempts >= maxAttempts) {
        log('FarmGod UI timeout - proceeding anyway (buttons might appear later)');
        callback();
      } else {
        if (attempts % 10 === 0) {
          log('Waiting for FarmGod UI... attempt ' + attempts);
        }
        setTimeout(checkFarmGod, 100);
      }
    };

    checkFarmGod();
  }

  /**
   * Wait for loading throbber to disappear
   */
  function waitForThrobberToDisappear(callback, maxWait) {
    maxWait = maxWait || 30000;
    const startTime = Date.now();

    const checkThrobber = function() {
      // Check for throbber image
      const throbber = document.querySelector('img[src*="throbber.gif"]');

      if (!throbber) {
        log('Throbber disappeared, loading complete!');
        // Wait a bit more for content to render
        setTimeout(callback, 1000);
        return;
      }

      if (Date.now() - startTime > maxWait) {
        log('Throbber wait timeout, proceeding anyway...');
        callback();
        return;
      }

      setTimeout(checkThrobber, 500);
    };

    // Start checking after initial delay
    setTimeout(checkThrobber, 500);
  }

  // ============ REGISTRATION ============

  function register() {
    const accountInfo = scrapeAccountInfo();
    const villageInfo = scrapeVillageInfo();

    if (!accountInfo || !villageInfo) {
      error('Failed to scrape account/village info');
      return;
    }

    // Check if this tab was master before navigation (persisted in sessionStorage)
    const wasMaster = loadMasterStatus();
    log(`Registering with wasMaster=${wasMaster}`);

    send('register', {
      apiKey: CONFIG.apiKey,
      accountId: accountInfo.accountId,
      world: accountInfo.world,
      villageId: villageInfo.villageId,
      villageName: villageInfo.villageName,
      coords: villageInfo.coords,
      playerName: accountInfo.playerName,
      wasMaster: wasMaster  // Tell server this tab was master before page navigation
    });
  }

  // ============ SCRAPERS ============

  function scrapeAccountInfo() {
    try {
      // Use game_data directly - much more reliable than DOM scraping
      const world = unsafeWindow.game_data?.world || 'unknown';
      const playerName = unsafeWindow.game_data?.player?.name || 'unknown';

      // Create unique account ID from world + player name
      const accountId = `${world}_${playerName}`;

      log('Account info:', { accountId, world, playerName });

      return { accountId, world, playerName };
    } catch (err) {
      error('Failed to scrape account info:', err);
      return null;
    }
  }

  function scrapeVillageInfo() {
    try {
      // Use game_data directly - much more reliable than DOM scraping
      const villageId = unsafeWindow.game_data?.village?.id || null;
      const villageName = unsafeWindow.game_data?.village?.name || 'Unknown Village';

      // Get coordinates from game_data
      const x = unsafeWindow.game_data?.village?.x;
      const y = unsafeWindow.game_data?.village?.y;
      const coords = (x !== undefined && y !== undefined) ? `${x}|${y}` : 'unknown';

      log('Village info:', { villageId, villageName, coords });

      return { villageId, villageName, coords };
    } catch (err) {
      error('Failed to scrape village info:', err);
      return null;
    }
  }

  function scrapeResources() {
    try {
      // Use game_data directly - much more reliable than DOM scraping
      const resources = {
        wood: unsafeWindow.game_data?.village?.wood || 0,
        clay: unsafeWindow.game_data?.village?.stone || 0,  // Note: clay is called 'stone' in game_data
        iron: unsafeWindow.game_data?.village?.iron || 0,
        storage: unsafeWindow.game_data?.village?.storage_max || 0,
        population: {
          used: unsafeWindow.game_data?.village?.pop || 0,
          max: unsafeWindow.game_data?.village?.pop_max || 0
        }
      };

      log('Resources:', resources);
      return resources;
    } catch (err) {
      error('Failed to scrape resources:', err);
      return null;
    }
  }

  function scrapeBuildingLevels() {
    try {
      // This is tricky - building levels are only visible on main building page
      // For now, return null if not on main page
      // TODO: Navigate to main building page if needed

      const buildings = {};

      // Try to get from game_data if available
      if (unsafeWindow.game_data?.village?.buildings) {
        return unsafeWindow.game_data.village.buildings;
      }

      log('Building levels:', buildings);
      return buildings;
    } catch (err) {
      error('Failed to scrape building levels:', err);
      return {};
    }
  }

  function scrapeTroops() {
    try {
      const troops = {};
      const unitTypes = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

      // Method 1: Try #show_units widget with data-count attributes (Hungarian version)
      const showUnitsWidget = document.querySelector('#show_units');
      if (showUnitsWidget) {
        log('Found #show_units widget, scraping troops...');

        unitTypes.forEach(unitType => {
          const countElement = showUnitsWidget.querySelector(`strong[data-count="${unitType}"]`);
          if (countElement) {
            const count = parseInt(countElement.textContent.trim()) || 0;
            if (count > 0) {
              troops[unitType] = count;
              log(`Found ${unitType}: ${count}`);
            }
          }
        });

        if (Object.keys(troops).length > 0) {
          log('Troops scraped from #show_units:', troops);
          return troops;
        }
      }

      // Method 2: Try VillageOverview.units JavaScript variable
      if (unsafeWindow.VillageOverview && unsafeWindow.VillageOverview.units) {
        const homeUnits = unsafeWindow.VillageOverview.units[1]; // Index 1 = home units
        if (homeUnits && typeof homeUnits === 'object') {
          log('Found VillageOverview.units[1]:', homeUnits);

          unitTypes.forEach(unitType => {
            if (homeUnits[unitType] && typeof homeUnits[unitType] === 'object') {
              // It's an object with unit data - probably unused
              return;
            }
            const count = parseInt(homeUnits[unitType]) || 0;
            if (count > 0) {
              troops[unitType] = count;
            }
          });

          if (Object.keys(troops).length > 0) {
            log('Troops scraped from VillageOverview.units:', troops);
            return troops;
          }
        }
      }

      // Method 3: Fallback - return empty (manual import available in dashboard)
      log('No troops found - returning empty object');
      return {};
    } catch (err) {
      error('Failed to scrape troops:', err);
      return {};
    }
  }

  function scrapeIncomings() {
    try {
      // NEW v1.0.23: Use WebSocket for detailed command data
      // Only scrape COUNTS from DOM for verification
      const incomingAttacksEl = document.querySelector('#incomings_amount');
      const incomingSupportsEl = document.querySelector('#supports_amount');

      const attackCount = incomingAttacksEl ? parseInt(incomingAttacksEl.textContent) || 0 : 0;
      const supportCount = incomingSupportsEl ? parseInt(incomingSupportsEl.textContent) || 0 : 0;

      log(`Incoming counts - Attacks: ${attackCount}, Supports: ${supportCount}`);

      // Return empty array - WebSocket handles individual command details
      // This is just for dashboard count verification
      return [];
    } catch (err) {
      error('Failed to scrape incoming counts:', err);
      return [];
    }
  }

  function scrapeOutgoings() {
    try {
      // NEW v1.0.23: WebSocket handles outgoing commands
      // No need to scrape from DOM (was causing duplicates)
      log('Outgoings: WebSocket-only (no DOM scraping)');
      return [];
    } catch (err) {
      error('Failed to scrape outgoings:', err);
      return [];
    }
  }

  function scrapeBuildingQueue() {
    try {
      const queue = [];

      // Find building queue in sidebar or main building page
      const queueRows = document.querySelectorAll('.buildorder_container tr, .build-queue-item');

      queueRows.forEach(row => {
        try {
          const buildingName = row.querySelector('.build-name')?.textContent.trim() || 'unknown';
          const level = parseInt(row.querySelector('.level')?.textContent || '0');

          const timerEl = row.querySelector('.timer, [data-endtime]');
          let completesAt = Date.now() + 3600000;

          if (timerEl) {
            const endtime = parseInt(timerEl.getAttribute('data-endtime'));
            if (endtime) {
              completesAt = endtime * 1000;
            }
          }

          queue.push({
            building: buildingName,
            level,
            completesAt
          });
        } catch (err) {
          // Skip this row
        }
      });

      log('Building queue:', queue.length);
      return queue;
    } catch (err) {
      error('Failed to scrape building queue:', err);
      return [];
    }
  }

  function scrapeRecruitmentQueue() {
    try {
      const queue = {};

      // Recruitment queue is visible in barracks, stable, workshop pages
      // This is simplified for now

      log('Recruitment queue:', queue);
      return queue;
    } catch (err) {
      error('Failed to scrape recruitment queue:', err);
      return {};
    }
  }

  function scrapeEffects() {
    try {
      const effects = [];
      const effectsWidget = document.querySelector('#show_effects .widget_content');

      if (!effectsWidget) {
        log('No effects widget found');
        return [];
      }

      const effectRows = effectsWidget.querySelectorAll('.village_overview_effect');

      effectRows.forEach(row => {
        try {
          const img = row.querySelector('img');
          const link = row.querySelector('a');

          // Get text content (either direct text or link text)
          let text = '';
          if (link) {
            text = link.textContent.trim();
          } else {
            // Get text excluding any nested elements
            text = Array.from(row.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent.trim())
              .join(' ')
              .trim();
          }

          if (text) {
            effects.push({
              name: text,
              icon: img?.src || null,
              tooltip: row.getAttribute('data-title') || null,
              hasLink: !!link
            });
          }
        } catch (err) {
          // Skip this row if parsing fails
        }
      });

      log(`Effects scraped: ${effects.length}`, effects);
      return effects;
    } catch (err) {
      error('Failed to scrape effects:', err);
      return [];
    }
  }

  /**
   * Scrape player statistics from the stats page
   * Only works on screen=info_player&mode=stats_own
   */
  function scrapeStatistics() {
    try {
      // Check if we're on the statistics page
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('screen') !== 'info_player' || urlParams.get('mode') !== 'stats_own') {
        log('Not on statistics page - skipping statistics scrape');
        return null;
      }

      log('On statistics page - scraping data...');

      const statistics = {
        scrapedAt: Date.now(),
        playerPoints: [],
        playerVillages: [],
        playerRank: [],
        tribePoints: [],
        villagesLooted: [],
        lootedResources: [],
        enemyUnitsKilled: [],
        troopGains: [],
        troopLosses: [],
        resourceSpending: {}
      };

      // Get all script content from the page
      const scripts = document.querySelectorAll('script');
      const scriptContent = Array.from(scripts).map(s => s.textContent).join('\n');

      // Extract graph data using regex patterns
      // Pattern: InfoPlayer.Stats.createGraph('graph_name', 'type', [[data]])

      // Player Points
      const playerPointsMatch = scriptContent.match(/createGraph\s*\(\s*['"]graph_player_points['"]\s*,\s*['"]line['"]\s*,\s*(\[\[.*?\]\])\s*\)/s);
      if (playerPointsMatch) {
        try {
          statistics.playerPoints = JSON.parse(playerPointsMatch[1]);
          log(`Player points: ${statistics.playerPoints.length} data points`);
        } catch (e) { log('Failed to parse player points'); }
      }

      // Player Villages
      const playerVillagesMatch = scriptContent.match(/createGraph\s*\(\s*['"]graph_player_villages['"]\s*,\s*['"]line['"]\s*,\s*(\[\[.*?\]\])\s*\)/s);
      if (playerVillagesMatch) {
        try {
          statistics.playerVillages = JSON.parse(playerVillagesMatch[1]);
          log(`Player villages: ${statistics.playerVillages.length} data points`);
        } catch (e) { log('Failed to parse player villages'); }
      }

      // Player Rank (special handling - data is in var data = [...])
      const playerRankMatch = scriptContent.match(/graph_player_rank[\s\S]*?var\s+data\s*=\s*\[\{data:\s*(\[\[.*?\]\])/);
      if (playerRankMatch) {
        try {
          statistics.playerRank = JSON.parse(playerRankMatch[1]);
          log(`Player rank: ${statistics.playerRank.length} data points`);
        } catch (e) { log('Failed to parse player rank'); }
      }

      // Tribe Points
      const tribePointsMatch = scriptContent.match(/createGraph\s*\(\s*['"]graph_ally_points['"]\s*,\s*['"]line['"]\s*,\s*(\[\[.*?\]\])\s*\)/s);
      if (tribePointsMatch) {
        try {
          statistics.tribePoints = JSON.parse(tribePointsMatch[1]);
          log(`Tribe points: ${statistics.tribePoints.length} data points`);
        } catch (e) { log('Failed to parse tribe points'); }
      }

      // Villages Looted (bar chart)
      const villagesLootedMatch = scriptContent.match(/createGraph\s*\(\s*['"]graph_villages_looted['"]\s*,\s*['"]bar['"]\s*,\s*(\[\[.*?\]\])\s*\)/s);
      if (villagesLootedMatch) {
        try {
          statistics.villagesLooted = JSON.parse(villagesLootedMatch[1]);
          log(`Villages looted: ${statistics.villagesLooted.length} data points`);
        } catch (e) { log('Failed to parse villages looted'); }
      }

      // Looted Resources (bar chart)
      const lootedResourcesMatch = scriptContent.match(/createGraph\s*\(\s*['"]graph_loot['"]\s*,\s*['"]bar['"]\s*,\s*(\[\[.*?\]\])\s*\)/s);
      if (lootedResourcesMatch) {
        try {
          statistics.lootedResources = JSON.parse(lootedResourcesMatch[1]);
          log(`Looted resources: ${statistics.lootedResources.length} data points`);
        } catch (e) { log('Failed to parse looted resources'); }
      }

      // Enemy Units Killed (bar chart)
      const enemyUnitsMatch = scriptContent.match(/createGraph\s*\(\s*['"]graph_enemy_units['"]\s*,\s*['"]bar['"]\s*,\s*(\[\[.*?\]\])\s*\)/s);
      if (enemyUnitsMatch) {
        try {
          statistics.enemyUnitsKilled = JSON.parse(enemyUnitsMatch[1]);
          log(`Enemy units killed: ${statistics.enemyUnitsKilled.length} data points`);
        } catch (e) { log('Failed to parse enemy units killed'); }
      }

      // Troop Gains/Losses (two datasets in var data = [...])
      const troopDiffMatch = scriptContent.match(/graph_units_diff[\s\S]*?var\s+data\s*=\s*\[\s*\{\s*data:\s*(\[\[.*?\]\])\s*,\s*color:\s*['"]green['"]\s*\}\s*,\s*\{\s*data:\s*(\[\[.*?\]\]|\[\])/s);
      if (troopDiffMatch) {
        try {
          statistics.troopGains = JSON.parse(troopDiffMatch[1]);
          log(`Troop gains: ${statistics.troopGains.length} data points`);
          if (troopDiffMatch[2] && troopDiffMatch[2] !== '[]') {
            statistics.troopLosses = JSON.parse(troopDiffMatch[2]);
            log(`Troop losses: ${statistics.troopLosses.length} data points`);
          }
        } catch (e) { log('Failed to parse troop gains/losses'); }
      }

      // Resource Spending (stacked bar with multiple categories)
      // This one is more complex - extract the breakdown
      const spendingCategories = ['Egységek', 'Épületek', 'Lovag', 'Fejlesztés', 'Kereskedelem'];
      const spendingMatch = scriptContent.match(/graph_resource_spending[\s\S]*?var\s+data\s*=\s*\[\];([\s\S]*?)var\s+graph\s*=/);
      if (spendingMatch) {
        const spendingContent = spendingMatch[1];

        spendingCategories.forEach(category => {
          const categoryMatch = spendingContent.match(new RegExp(`label:\\s*['"]${category}['"][\\s\\S]*?data:\\s*(\\[\\[.*?\\]\\])`, 's'));
          if (categoryMatch) {
            try {
              statistics.resourceSpending[category] = JSON.parse(categoryMatch[1]);
              log(`Resource spending (${category}): ${statistics.resourceSpending[category].length} data points`);
            } catch (e) { log(`Failed to parse spending for ${category}`); }
          }
        });
      }

      // Calculate summary values (latest data points)
      const getLatestValue = (dataArray) => {
        if (!dataArray || dataArray.length === 0) return 0;
        return parseInt(dataArray[dataArray.length - 1][1]) || 0;
      };

      const getTotalFromBar = (dataArray) => {
        if (!dataArray || dataArray.length === 0) return 0;
        return dataArray.reduce((sum, item) => sum + (parseInt(item[1]) || 0), 0);
      };

      statistics.summary = {
        currentPoints: getLatestValue(statistics.playerPoints),
        currentVillages: getLatestValue(statistics.playerVillages),
        currentRank: getLatestValue(statistics.playerRank),
        currentTribePoints: getLatestValue(statistics.tribePoints),
        totalVillagesLooted: getTotalFromBar(statistics.villagesLooted),
        totalResourcesLooted: getTotalFromBar(statistics.lootedResources),
        totalEnemyKilled: getTotalFromBar(statistics.enemyUnitsKilled),
        totalTroopGains: getTotalFromBar(statistics.troopGains),
        totalTroopLosses: getTotalFromBar(statistics.troopLosses)
      };

      log('Statistics summary:', statistics.summary);
      return statistics;

    } catch (err) {
      error('Failed to scrape statistics:', err);
      return null;
    }
  }

  function scrapeAll() {
    const villageInfo = scrapeVillageInfo();

    return {
      resources: scrapeResources(),
      buildings: scrapeBuildingLevels(),
      troops: scrapeTroops(),
      incomings: scrapeIncomings(),
      outgoings: scrapeOutgoings(),
      buildingQueue: scrapeBuildingQueue(),
      recruitmentQueue: scrapeRecruitmentQueue(),
      effects: scrapeEffects(),
      statistics: scrapeStatistics()  // Only populated when on stats page
    };
  }

  // ============ EXECUTOR UTILITIES ============

  /**
   * Navigate to a game screen
   * @param {string} screen - Screen name (e.g., 'place', 'main', 'barracks')
   * @param {object} params - Additional URL parameters
   */
  async function navigateTo(screen, params = {}) {
    const baseUrl = `${window.location.origin}/game.php`;
    const villageId = unsafeWindow.game_data.village.id;

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

  // ============ COMMAND EXECUTORS ============

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
   * Parse arrival time from command confirmation
   */
  function parseArrivalTime() {
    const arrivalElement = document.querySelector('.command-container .arrival, .arrive_time');
    if (arrivalElement) {
      return arrivalElement.textContent.trim();
    }
    return null;
  }

  // ============ SEND TROOPS EXECUTOR ============

  /**
   * Check for rally point error messages (Hungarian)
   * Returns error message if found, null if no errors
   */
  function checkRallyPointErrors() {
    const errorMessages = [
      'Csak a saját klánod tagjainak küldhetsz erősítést',  // Can only send to own tribe
      'Nem áll rendelkezésre elegendő egység',               // Not enough units
      'Kérünk adj meg célfalut',                              // Please specify target village
      'Nincs elegendő',                                       // Not enough (generic)
      'Only members of your tribe',                           // English: tribe restriction
      'Not enough units',                                     // English: not enough units
      'Please enter',                                         // English: missing input
      'error_box',                                            // Error container class
      'error'                                                 // Generic error
    ];

    // Check for error containers
    const errorBoxes = document.querySelectorAll('.error_box, .error, .info_box.error, #error_box');

    for (const errorBox of errorBoxes) {
      if (errorBox && errorBox.offsetParent !== null) { // Check if visible
        const errorText = errorBox.textContent.trim();

        // Check if contains any error message
        for (const msg of errorMessages) {
          if (errorText.includes(msg)) {
            log('Rally point error detected:', errorText);
            return errorText;
          }
        }

        // If error box has text, it's probably an error
        if (errorText.length > 0) {
          log('Generic rally point error detected:', errorText);
          return errorText;
        }
      }
    }

    // Check entire page content for error messages (fallback)
    const bodyText = document.body.textContent;
    for (const msg of errorMessages.slice(0, 3)) { // Check main Hungarian messages
      if (bodyText.includes(msg)) {
        log('Error message found in page:', msg);
        return msg;
      }
    }

    return null; // No errors found
  }

  /**
   * Execute send troops command
   */
  async function executeSendTroops(command) {
    const { actionId, targetCoords, troops, sendType, executeAt } = command;

    try {
      // Wait for safe action window (anti-detection)
      await waitForSafeActionWindow();

      if (!isOnScreen('place')) {
        storePendingCommand({ ...command, step: 'fillForm' });
        navigateTo('place');
        return;
      }

      const confirmBtn = document.getElementById('troop_confirm_submit');
      if (confirmBtn) {
        return await handleTroopConfirmation(command);
      }

      // Check for errors BEFORE filling form (in case of previous error)
      const preError = checkRallyPointErrors();
      if (preError) {
        throw new Error(`Rally point error: ${preError}`);
      }

      // Simulate human presence before filling form
      await simulateHumanPresence();

      await fillTroopForm(targetCoords, troops, sendType);

      // Check for errors AFTER filling form
      await sleep(500); // Wait for error messages to appear
      const postError = checkRallyPointErrors();
      if (postError) {
        throw new Error(`Rally point error: ${postError}`);
      }

      const attackBtn = document.getElementById('target_attack');
      const supportBtn = document.getElementById('target_support');
      const submitBtn = sendType === 'support' ? supportBtn : attackBtn;

      if (!submitBtn) {
        throw new Error('Submit button not found');
      }

      // Human delay before clicking submit
      await sleep(getHumanDelay(500, 1000));

      // Store pending command BEFORE clicking (page will reload)
      storePendingCommand({ ...command, step: 'confirm' });

      await clickElement(submitBtn);

      // Check for errors AFTER clicking submit (if page didn't reload immediately)
      await sleep(300);
      const submitError = checkRallyPointErrors();
      if (submitError) {
        // Clear pending command since we have an error
        GM_setValue('pendingCommand', null);
        throw new Error(`Rally point error: ${submitError}`);
      }

    } catch (error) {
      log('Send troops failed:', error.message);
      sendCommandResult(actionId, false, error.message);

      // Clear any pending command to prevent loops
      GM_setValue('pendingCommand', null);
    }
  }

  /**
   * Fill the troop sending form
   */
  async function fillTroopForm(targetCoords, troops, sendType) {
    // FIRST: Try Hungarian version (single input with "X|Y" format)
    const singleCoordInput = document.querySelector('input[name="input"].target-input-field') ||
                             document.querySelector('.target-input-field') ||
                             document.querySelector('#place_target input[type="text"]:not([name="x"]):not([name="y"])') ||
                             document.querySelector('input[placeholder*="|"]');

    if (singleCoordInput) {
      log('Found single coordinate input (Hungarian version)');
      log(`Filling coordinates: ${targetCoords}`);

      // Clear existing value
      singleCoordInput.value = '';
      await sleep(100);

      // Type the full coordinate string "X|Y"
      log('Typing coordinates:', targetCoords);
      await humanType(singleCoordInput, targetCoords);
      await sleep(getHumanDelay(200, 400));

      // Verify coordinates were set
      log('Coordinates set:', singleCoordInput.value);
    } else {
      // FALLBACK: English version - separate X and Y inputs
      log('Single input not found, trying separate X/Y inputs (English version)');
      const [x, y] = targetCoords.split('|');

      const inputX = document.getElementById('inputx') ||
                     document.querySelector('input[name="x"]') ||
                     document.querySelector('input[name="koordinatak_x"]') ||
                     document.querySelector('#place_target input[placeholder*="x"]') ||
                     document.querySelector('.target-input-x') ||
                     document.querySelector('input.target-x');

      const inputY = document.getElementById('inputy') ||
                     document.querySelector('input[name="y"]') ||
                     document.querySelector('input[name="koordinatak_y"]') ||
                     document.querySelector('#place_target input[placeholder*="y"]') ||
                     document.querySelector('.target-input-y') ||
                     document.querySelector('input.target-y');

      log('Coordinate inputs found:', { x: !!inputX, y: !!inputY });

      if (!inputX || !inputY) {
        // Debug: log all inputs on the page to help identify the correct selectors
        const allInputs = document.querySelectorAll('input');
        log('All inputs on page:', Array.from(allInputs).map(inp => ({
          id: inp.id,
          name: inp.name,
          type: inp.type,
          placeholder: inp.placeholder,
          className: inp.className
        })));
        throw new Error('Coordinate inputs not found');
      }

      log(`Filling coordinates: ${x}|${y}`);

      // Clear existing values first
      inputX.value = '';
      inputY.value = '';
      await sleep(100);

      // Use humanType for more realistic input
      log('Typing X coordinate:', x);
      await humanType(inputX, x);
      await sleep(getHumanDelay(100, 200));

      log('Typing Y coordinate:', y);
      await humanType(inputY, y);
      await sleep(getHumanDelay(100, 200));

      // Verify coordinates were set
      log('Coordinates set:', { x: inputX.value, y: inputY.value });
    }

    const unitOrder = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

    for (const unit of unitOrder) {
      const count = troops[unit] || 0;
      if (count > 0) {
        // Use Hungarian-aware selectors
        const selectors = getUnitSelectors(unit);
        const input = findElement(selectors);

        if (input) {
          await humanType(input, count.toString());
          await sleep(getHumanDelay(50, 150));
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

      if (executeAt) {
        const now = Date.now();
        const delay = executeAt - now - 100;

        if (delay > 0) {
          log(`Waiting ${delay}ms for timed send...`);
          await sleep(delay);
        }
      }

      await clickElement(confirmBtn);
      await sleep(500);

      const arrivalTime = parseArrivalTime();

      sendCommandResult(actionId, true, 'Troops sent successfully', {
        arrivalTime: arrivalTime
      });

    } catch (error) {
      sendCommandResult(actionId, false, error.message);
    }
  }

  // ============ BUILD BUILDING EXECUTOR ============

  /**
   * Execute build building command
   */
  async function executeBuildBuilding(command) {
    const { actionId, building, levels = 1 } = command;

    try {
      // Wait for safe action window (anti-detection)
      await waitForSafeActionWindow();

      if (!isOnScreen('main')) {
        storePendingCommand({ ...command, step: 'build' });
        navigateTo('main');
        return;
      }

      // Simulate human presence
      await simulateHumanPresence();

      const buildingRow = findBuildingRow(building);

      if (!buildingRow) {
        throw new Error(`Building ${building} not found in HQ`);
      }

      const buildLink = buildingRow.querySelector('a.btn-build, a[class*="order_button"], .build_button a');

      if (!buildLink) {
        const errorCell = buildingRow.querySelector('.inactive, .not_enough_res');
        if (errorCell) {
          throw new Error('Cannot build: not enough resources or max level reached');
        }
        throw new Error('Build button not found');
      }

      // Human delay before clicking
      await sleep(getHumanDelay(300, 700));

      await clickElement(buildLink);
      await sleep(getHumanDelay(800, 1200));

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
    // Use Hungarian-aware selectors
    const selectors = getBuildingSelectors(buildingName);
    const row = findElement(selectors);

    if (row) return row;

    // Fallback: try to find by image
    const buildingImg = document.querySelector(`img[src*="/${buildingName}."]`);
    if (buildingImg) {
      return buildingImg.closest('tr');
    }

    return null;
  }

  // ============ RECRUIT TROOPS EXECUTOR ============

  /**
   * Check for recruitment error messages (Hungarian)
   * Returns error message if found, null if no errors
   */
  function checkRecruitmentErrors() {
    const errorMessages = [
      'Nincs elég nyersanyag vagy elértél a népességi korlátot',  // Not enough resources or reached population limit
      'Nincs elég nyersanyag',                                      // Not enough resources
      'elértél a népességi korlátot',                               // Reached population limit
      'Nem áll rendelkezésre elegendő',                             // Not enough available
      'Not enough resources',                                       // English: not enough resources
      'Population limit',                                           // English: population limit
      'error_box',                                                  // Error container class
      'error'                                                       // Generic error
    ];

    // Check for error containers (banners, boxes)
    const errorBoxes = document.querySelectorAll('.error_box, .error, .info_box.error, #error_box, .error-msg, .red');

    for (const errorBox of errorBoxes) {
      if (errorBox && errorBox.offsetParent !== null) { // Check if visible
        const errorText = errorBox.textContent.trim();

        // Check if contains any error message
        for (const msg of errorMessages) {
          if (errorText.includes(msg)) {
            log('Recruitment error detected:', errorText);
            return errorText;
          }
        }

        // If error box has text and looks like an error, return it
        if (errorText.length > 10 && (
          errorBox.classList.contains('error') ||
          errorBox.classList.contains('error_box') ||
          errorBox.style.color === 'red'
        )) {
          log('Generic recruitment error detected:', errorText);
          return errorText;
        }
      }
    }

    // Check entire page content for error messages (fallback)
    const bodyText = document.body.textContent;
    for (const msg of errorMessages.slice(0, 3)) { // Check main Hungarian messages
      if (bodyText.includes(msg)) {
        log('Error message found in page:', msg);
        return msg;
      }
    }

    return null; // No errors found
  }

  /**
   * Execute recruit troops command
   */
  async function executeRecruitTroops(command) {
    const { actionId, building, units } = command;

    try {
      // Wait for safe action window (anti-detection)
      await waitForSafeActionWindow();

      const screenMap = {
        'barracks': 'barracks',
        'stable': 'stable',
        'workshop': 'garage',
        'garage': 'garage',
        'snob': 'snob'
      };

      const screenName = screenMap[building] || building;

      if (!isOnScreen(screenName)) {
        storePendingCommand({ ...command, step: 'recruit' });
        navigateTo(screenName);
        return;
      }

      // Check for errors BEFORE filling form (in case of previous error)
      const preError = checkRecruitmentErrors();
      if (preError) {
        throw new Error(`Recruitment error: ${preError}`);
      }

      // Simulate human presence
      await simulateHumanPresence();

      for (const [unit, amount] of Object.entries(units)) {
        if (amount <= 0) continue;

        // Use Hungarian-aware selectors
        const selectors = getUnitSelectors(unit);
        const input = findElement(selectors);

        if (input) {
          await humanType(input, amount.toString());
          await sleep(getHumanDelay(100, 200));
        } else {
          log(`Input for ${unit} not found`);
        }
      }

      // Check for errors AFTER filling form
      await sleep(500); // Wait for error messages to appear
      const postError = checkRecruitmentErrors();
      if (postError) {
        throw new Error(`Recruitment error: ${postError}`);
      }

      // Find recruit button with Hungarian support
      let recruitBtn = document.querySelector('.btn-recruit') ||
                       document.querySelector('input.btn-recruit-confirm');

      if (!recruitBtn) {
        recruitBtn = findButton('Recruit', 'Toborzás');
      }

      if (!recruitBtn) {
        throw new Error('Recruit button not found');
      }

      // Human delay before clicking recruit
      await sleep(getHumanDelay(400, 800));

      // Store pending command BEFORE clicking (page might reload)
      storePendingCommand({ ...command, step: 'confirmRecruit' });

      await clickElement(recruitBtn);

      // Check for errors AFTER clicking recruit (if page didn't reload immediately)
      await sleep(500);
      const submitError = checkRecruitmentErrors();
      if (submitError) {
        // Clear pending command since we have an error
        GM_setValue('pendingCommand', null);
        throw new Error(`Recruitment error: ${submitError}`);
      }

      await sleep(getHumanDelay(800, 1200));

      const queue = scrapeRecruitmentQueue();

      sendCommandResult(actionId, true, `Started recruiting in ${building}`, {
        building: building,
        units: units,
        queue: queue[building]
      });

    } catch (error) {
      log('Recruit troops failed:', error.message);
      sendCommandResult(actionId, false, error.message);

      // Clear any pending command to prevent loops
      GM_setValue('pendingCommand', null);
    }
  }

  // ============ REPORTING ============

  function reportData() {
    if (!isConnected) {
      log('Cannot report: not connected');
      return;
    }

    const accountInfo = scrapeAccountInfo();
    const villageInfo = scrapeVillageInfo();
    const data = scrapeAll();

    if (!accountInfo || !villageInfo) {
      error('Cannot report: missing account/village info');
      return;
    }

    send('report', {
      timestamp: Date.now(),
      accountId: accountInfo.accountId,
      villageId: villageInfo.villageId,
      data
    });

    log('Data reported');
  }

  function scheduleReport() {
    if (reportTimer) {
      clearTimeout(reportTimer);
    }

    const interval = CONFIG.reportInterval + randomJitter();
    log(`Next report in ${Math.floor(interval / 1000)}s`);

    reportTimer = setTimeout(() => {
      reportData();
      scheduleReport();
    }, interval);
  }

  // ============ INITIALIZATION ============

  /**
   * Check for pending commands on page load
   */
  function checkPendingCommands() {
    const pending = getPendingCommand();

    if (pending) {
      log('Resuming pending command:', pending);

      setTimeout(() => {
        if (pending.type === 'sendTroops') {
          executeSendTroops(pending);
        } else if (pending.type === 'buildBuilding') {
          executeBuildBuilding(pending);
        } else if (pending.type === 'recruitTroops') {
          executeRecruitTroops(pending);
        }
      }, 1000);
    }

    // Check for pending statistics fetch
    const pendingStatsActionId = sessionStorage.getItem('tw_pending_fetch_stats');
    if (pendingStatsActionId) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('screen') === 'info_player' && urlParams.get('mode') === 'stats_own') {
        log('Completing pending statistics fetch:', pendingStatsActionId);

        // Clear the pending flag
        sessionStorage.removeItem('tw_pending_fetch_stats');

        // Wait a bit for page to fully load, then scrape and report
        setTimeout(() => {
          const stats = scrapeStatistics();
          if (stats) {
            log('Statistics scraped successfully:', stats);
            // Send data report - this will include the statistics
            reportData();
            sendCommandResult(pendingStatsActionId, true, 'Statistics scraped successfully');
          } else {
            log('Failed to scrape statistics');
            sendCommandResult(pendingStatsActionId, false, 'Failed to scrape statistics');
          }
        }, 2000); // Wait 2 seconds for page to fully render
      }
    }
  }

  function init() {
    log('TW Controller Agent starting...');
    log('Version: 1.5.8 - Treat 0/0 progress as empty run (success) not stall');
    log('Server:', CONFIG.serverUrl);
    log('URL:', window.location.href);
    log('Hostname:', window.location.hostname);

    // Check if we're on a valid page (just warn, don't block)
    if (!unsafeWindow.game_data) {
      log('Warning: unsafeWindow.game_data not found - some features may not work');
    } else {
      log('game_data found:', Object.keys(unsafeWindow.game_data));
    }

    // Check for pending commands from navigation
    checkPendingCommands();

    // Check if we should execute farming (after navigation to farm page)
    checkFarmExecution();

    // Connect to server
    connect();

    // Visual indicator (minimal - main status is in quickbar)
    const indicator = document.createElement('div');
    indicator.id = 'tw-agent-indicator';
    indicator.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      padding: 4px 8px;
      background: rgba(30, 30, 30, 0.9);
      border: 1px solid #444;
      color: #888;
      font-size: 10px;
      border-radius: 3px;
      z-index: 9999;
      font-family: monospace;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    indicator.textContent = 'TW Agent v1.5.1';
    indicator.addEventListener('mouseenter', () => indicator.style.opacity = '1');
    indicator.addEventListener('mouseleave', () => indicator.style.opacity = '0.7');
    document.body.appendChild(indicator);

    // Update indicator with connection and master status
    setInterval(() => {
      if (isConnected) {
        if (isMasterTab) {
          indicator.style.borderColor = '#4caf50';
          indicator.style.color = '#7fff00';
          indicator.textContent = 'TW Agent: MASTER';
        } else {
          indicator.style.borderColor = '#666';
          indicator.style.color = '#999';
          indicator.textContent = 'TW Agent: STANDBY';
        }
      } else {
        indicator.style.borderColor = '#ff6b6b';
        indicator.style.color = '#ff6b6b';
        indicator.textContent = 'TW Agent: Offline';
      }
    }, 1000);

    log('TW Controller Agent initialized');
  }

  // Start when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
