// ==UserScript==
// @name         TW Controller Agent
// @namespace    tw-controller
// @version      1.0.24
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

      default:
        log('Unknown message type:', message.type);
    }
  }

  function handleRegistered(message) {
    sessionId = message.sessionId;
    log('Registered with sessionId:', sessionId);

    // Start periodic reporting
    scheduleReport();

    // Send immediate report
    reportData();
  }

  function handleSendTroops(message) {
    log('Send troops command:', message);
    executeSendTroops(message);
  }

  function handleBuildBuilding(message) {
    log('Build building command:', message);
    executeBuildBuilding(message);
  }

  function handleRecruitTroops(message) {
    log('Recruit troops command:', message);
    executeRecruitTroops(message);
  }

  function handleRequestRefresh(message) {
    log('Refresh requested');
    reportData();
  }

  function handlePing(message) {
    send('pong', { timestamp: Date.now() });
  }

  // ============ REGISTRATION ============

  function register() {
    const accountInfo = scrapeAccountInfo();
    const villageInfo = scrapeVillageInfo();

    if (!accountInfo || !villageInfo) {
      error('Failed to scrape account/village info');
      return;
    }

    send('register', {
      apiKey: CONFIG.apiKey,
      accountId: accountInfo.accountId,
      world: accountInfo.world,
      villageId: villageInfo.villageId,
      villageName: villageInfo.villageName,
      coords: villageInfo.coords,
      playerName: accountInfo.playerName
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
      effects: scrapeEffects()
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
  }

  function init() {
    log('TW Controller Agent starting...');
    log('Version: 1.0.24 - Added village effects/bonuses scraping');
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

    // Connect to server
    connect();

    // Visual indicator
    const indicator = document.createElement('div');
    indicator.id = 'tw-agent-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      background: #2a2a2a;
      border: 2px solid #4a9eff;
      color: #fff;
      font-size: 12px;
      border-radius: 4px;
      z-index: 9999;
      font-family: monospace;
    `;
    indicator.textContent = '🤖 TW Agent: Connecting...';
    document.body.appendChild(indicator);

    // Update indicator on connection status
    setInterval(() => {
      if (isConnected) {
        indicator.style.borderColor = '#7fff00';
        indicator.textContent = '🤖 TW Agent: Connected';
      } else {
        indicator.style.borderColor = '#ff6b6b';
        indicator.textContent = '🤖 TW Agent: Disconnected';
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
