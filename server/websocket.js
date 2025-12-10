/**
 * WebSocket connection handler for userscript agents
 * Handles incoming messages from userscripts and routes commands
 */

const { WebSocketServer } = require('ws');
const { accountState } = require('./state/accounts');
const { logger } = require('./utils/logger');
const templateManager = require('./state/templates');
const templateExecutor = require('./services/templateExecutor');
const { farmBot } = require('./services/farmBot');
const { bulkFarmService } = require('./services/bulkFarmService');
const { debugLog } = require('./services/debugLog');

// Configuration
const CONFIG = {
  apiKey: process.env.TW_API_KEY || 'dev-secret-key-change-in-production',
  pingInterval: 30000 // Ping clients every 30 seconds
};

/**
 * Initialize WebSocket server
 */
function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Store wss instance for broadcasting to dashboards
  accountState.wss = wss;

  // Set up broadcast function for bulk farm service
  bulkFarmService.setBroadcast((data) => {
    broadcastToDashboards(data.type, data);
  });

  logger.info('WebSocket server initialized on /ws');

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info('New WebSocket connection', { ip: clientIp });

    let accountId = null;
    let sessionId = null;  // Track session for proper disconnect handling
    let authenticated = false;
    let pingTimer = null;

    // Start ping interval to keep connection alive
    pingTimer = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, CONFIG.pingInterval);

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message, { accountId, sessionId, authenticated }, (newAccountId, newSessionId, newAuth) => {
          accountId = newAccountId;
          sessionId = newSessionId;
          authenticated = newAuth;
        });
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { error: error.message });
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    // Handle connection close
    ws.on('close', () => {
      if (accountId && sessionId) {
        // Use session-specific disconnect for multi-tab support
        accountState.disconnectSession(accountId, sessionId);
        // Log to debug log
        debugLog.addLog(accountId, 'disconnect', 'Disconnected', { sessionId });
      }
      if (pingTimer) {
        clearInterval(pingTimer);
      }
      logger.info('WebSocket connection closed', { accountId, sessionId, ip: clientIp });
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { accountId, error: error.message });
    });
  });

  return wss;
}

/**
 * Handle individual WebSocket messages
 */
function handleMessage(ws, message, context, updateContext) {
  const { type } = message;

  logger.debug('Received message', { type, accountId: context.accountId });

  switch (type) {
    case 'register':
      handleRegister(ws, message, updateContext);
      break;

    case 'report':
      handleReport(ws, message, context);
      break;

    case 'commandResult':
      handleCommandResult(ws, message, context);
      break;

    case 'error':
      handleError(ws, message, context);
      break;

    case 'pong':
      handlePong(ws, message, context);
      break;

    case 'gameEvent':
      handleGameEvent(ws, message, context);
      break;

    case 'requestMaster':
      handleRequestMaster(ws, message, context);
      break;

    // Template operations (dashboard only)
    case 'getTemplates':
      handleGetTemplates(ws, message);
      break;

    case 'createTemplate':
      handleCreateTemplate(ws, message);
      break;

    case 'updateTemplate':
      handleUpdateTemplate(ws, message);
      break;

    case 'deleteTemplate':
      handleDeleteTemplate(ws, message);
      break;

    case 'duplicateTemplate':
      handleDuplicateTemplate(ws, message);
      break;

    // Template execution operations (dashboard only)
    case 'executeTemplate':
      handleExecuteTemplate(ws, message);
      break;

    case 'previewTemplate':
      handlePreviewTemplate(ws, message);
      break;

    case 'stopTemplateExecution':
      handleStopTemplateExecution(ws, message);
      break;

    // Farm bot operations
    case 'farmProgress':
      handleFarmProgress(ws, message, context);
      break;

    case 'farmComplete':
      handleFarmComplete(ws, message, context);
      break;

    case 'farmError':
      handleFarmError(ws, message, context);
      break;

    case 'farmDebug':
      handleFarmDebug(ws, message, context);
      break;

    // Troops Tab operations
    case 'troopReport':
      handleTroopReport(ws, message, context);
      break;

    // Building Tab operations
    case 'buildingReport':
      handleBuildingReport(ws, message, context);
      break;

    // Tab management
    case 'tabOpened':
      handleTabOpened(ws, message, context);
      break;

    // Command forwarding (dashboard → userscript)
    case 'recruitTroops':
      handleRecruitTroops(ws, message);
      break;

    default:
      logger.warn('Unknown message type', { type, accountId: context.accountId });
      ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${type}`
      }));
  }
}

/**
 * Handle registration from userscript
 */
function handleRegister(ws, message, updateContext) {
  const { apiKey, accountId, world, villageId, villageName, coords, playerName, wasMaster } = message;

  // Validate API key
  if (apiKey !== CONFIG.apiKey) {
    logger.warn('Registration failed: invalid API key', { accountId });
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Invalid API key'
    }));
    ws.close();
    return;
  }

  // Validate required fields
  if (!accountId || !world || !villageId) {
    logger.warn('Registration failed: missing required fields');
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Missing required fields: accountId, world, villageId'
    }));
    return;
  }

  // Register the account - now returns { sessionId, isMaster }
  // Pass wasMaster flag to give priority to tabs that were master before navigation
  const { sessionId, isMaster } = accountState.register(accountId, ws, {
    world,
    villageId,
    villageName,
    coords,
    playerName,
    wasMaster: wasMaster || false
  });

  // Update context with sessionId
  updateContext(accountId, sessionId, true);

  // Get connection count for this account
  const connections = accountState.getConnections(accountId);

  // Send confirmation with master status
  ws.send(JSON.stringify({
    type: 'registered',
    sessionId,
    isMaster,
    connectionCount: connections.length
  }));

  logger.info('Account registered successfully', {
    accountId,
    sessionId,
    world,
    isMaster,
    wasMaster: wasMaster || false,
    totalConnections: connections.length
  });

  // Log to debug log for dashboard
  debugLog.addLog(accountId, 'connect', `Connected (${isMaster ? 'master' : 'slave'})`, {
    sessionId,
    world,
    villageName,
    connections: connections.length
  });
}

/**
 * Handle data report from userscript
 */
function handleReport(ws, message, context) {
  if (!context.authenticated) {
    logger.warn('Report rejected: not authenticated');
    return;
  }

  const { accountId, data } = message;

  if (accountId !== context.accountId) {
    logger.warn('Report rejected: accountId mismatch', {
      expected: context.accountId,
      received: accountId
    });
    return;
  }

  // Update account data
  const success = accountState.updateData(accountId, data);

  if (!success) {
    logger.error('Failed to update account data', { accountId });
  }
}

/**
 * Handle command execution result
 */
function handleCommandResult(ws, message, context) {
  if (!context.authenticated) {
    return;
  }

  const { actionId, success, message: resultMessage, details } = message;

  logger.info('Command result received', {
    accountId: context.accountId,
    actionId,
    success,
    message: resultMessage
  });

  // TODO: Store command results for dashboard to retrieve
  // For now, just log it
}

/**
 * Handle error report from userscript
 */
function handleError(ws, message, context) {
  const { actionId, error, context: errorContext } = message;

  logger.error('Userscript error', {
    accountId: context.accountId,
    actionId,
    error,
    context: errorContext
  });

  // TODO: Store error for dashboard to display
}

/**
 * Handle pong response
 */
function handlePong(ws, message, context) {
  // Just acknowledge - connection is alive
  logger.debug('Pong received', { accountId: context.accountId });
}

/**
 * Handle request to become master (user clicked "Make Master" button)
 */
function handleRequestMaster(ws, message, context) {
  if (!context.authenticated) {
    logger.warn('requestMaster rejected: not authenticated');
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Not authenticated'
    }));
    return;
  }

  const { sessionId, reason } = message;

  logger.info('Master promotion requested', {
    accountId: context.accountId,
    sessionId: context.sessionId,
    reason
  });

  // Promote the requesting session to master
  const result = accountState.promoteMaster(context.accountId, context.sessionId);

  if (!result.success) {
    ws.send(JSON.stringify({
      type: 'error',
      error: result.error || 'Failed to promote to master'
    }));
  }

  // Note: The promoteMaster function already sends masterStatusChanged to both tabs
  logger.info('Master promotion result', { accountId: context.accountId, result });
}

/**
 * Handle game event from WebSocket interceptor
 */
function handleGameEvent(ws, message, context) {
  if (!context.authenticated) {
    return;
  }

  const { type, data, timestamp } = message;

  logger.debug('Game event received', {
    accountId: context.accountId,
    type,
    timestamp
  });

  switch (type) {
    case 'incomingCommand':
      handleIncomingCommand(context.accountId, data);
      break;

    case 'resourceUpdate':
      handleResourceUpdate(context.accountId, data);
      break;

    case 'buildingUpdate':
      handleBuildingUpdate(context.accountId, data);
      break;

    case 'recruitmentUpdate':
      handleRecruitmentUpdate(context.accountId, data);
      break;

    case 'gameSocketStatus':
      handleGameSocketStatus(context.accountId, data);
      break;

    case 'outgoingCommand':
      handleOutgoingCommand(context.accountId, data);
      break;

    default:
      logger.debug('Unknown game event type', { type, accountId: context.accountId });
      break;
  }
}

/**
 * Handle incoming attack/support command
 * HIGH PRIORITY - Store and broadcast to dashboard
 */
function handleIncomingCommand(accountId, data) {
  const alert = {
    alertId: `${accountId}_${data.commandId}`,
    accountId,
    commandId: data.commandId,
    type: data.type,
    originCoords: data.originCoords,
    originVillageId: data.originVillageId,
    originVillageName: data.originVillageName,
    originPlayerId: data.originPlayerId,
    originPlayerName: data.originPlayerName,
    targetVillageId: data.targetVillageId,
    arrivalTime: data.arrivalTime,
    size: data.size,
    createdAt: Date.now()
  };

  // Store alert
  const accountState = require('./state/accounts').accountState;
  accountState.addAlert(accountId, alert);

  logger.warn('🚨 INCOMING COMMAND DETECTED', {
    accountId,
    type: data.type,
    from: data.originCoords,
    arrival: new Date(data.arrivalTime).toISOString(),
    size: data.size
  });

  // Broadcast to all dashboard clients
  broadcastToDashboards('newAlert', alert);
}

/**
 * Handle outgoing command (attack/support sent FROM this village)
 * Just log it - no alerts needed for outgoing commands
 */
function handleOutgoingCommand(accountId, data) {
  logger.info('📤 OUTGOING COMMAND DETECTED', {
    accountId,
    type: data.type,
    target: data.targetCoords,
    arrival: data.arrivalTime ? new Date(data.arrivalTime).toISOString() : 'unknown'
  });

  // Don't create alerts or broadcast - this is not an incoming attack
}

/**
 * Handle resource update from game
 */
function handleResourceUpdate(accountId, data) {
  const accountState = require('./state/accounts').accountState;
  const account = accountState.get(accountId);

  if (account) {
    // Update resources in real-time
    accountState.updateData(accountId, {
      resources: {
        wood: data.wood,
        clay: data.clay,
        iron: data.iron,
        storage: data.storage,
        population: {
          used: data.population,
          max: data.populationMax
        }
      }
    });

    logger.debug('Resources updated', { accountId, resources: data });
  }
}

/**
 * Handle building update from game
 */
function handleBuildingUpdate(accountId, data) {
  logger.info('Building update', {
    accountId,
    building: data.building,
    level: data.level,
    event: data.event
  });

  // TODO: Store building queue info for dashboard
}

/**
 * Handle recruitment update from game
 */
function handleRecruitmentUpdate(accountId, data) {
  logger.info('Recruitment update', {
    accountId,
    building: data.building,
    unit: data.unit,
    amount: data.amount,
    event: data.event
  });

  // TODO: Store recruitment queue info for dashboard
}

/**
 * Handle game socket status change
 */
function handleGameSocketStatus(accountId, data) {
  logger.info('Game socket status', {
    accountId,
    connected: data.connected
  });

  const accountState = require('./state/accounts').accountState;
  const account = accountState.get(accountId);

  if (account) {
    account.gameSocketConnected = data.connected;
  }
}

/**
 * Broadcast event to all connected dashboard clients
 */
function broadcastToDashboards(eventType, data) {
  const accountState = require('./state/accounts').accountState;
  const wss = accountState.wss;

  if (!wss) return;

  const message = JSON.stringify({
    type: 'dashboardEvent',
    eventType,
    data,
    timestamp: Date.now()
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.isDashboard) { // OPEN = 1
      client.send(message);
    }
  });

  logger.debug('Broadcasted to dashboards', { eventType, clientCount: wss.clients.size });
}

/**
 * Send command to specific account
 */
function sendToAccount(accountId, command) {
  return accountState.sendToAccount(accountId, command);
}

/**
 * Get account by ID
 */
function getAccountById(accountId) {
  return accountState.get(accountId);
}

/**
 * Get all accounts
 */
function getAccounts() {
  return accountState.getAll();
}

/**
 * Handle get templates request
 */
function handleGetTemplates(ws, message) {
  const { templateType } = message; // 'building' or 'recruitment' or 'all'

  try {
    let templates;
    if (templateType === 'all' || !templateType) {
      templates = {
        building: templateManager.getBuildingTemplates(),
        recruitment: templateManager.getRecruitmentTemplates()
      };
    } else if (templateType === 'building') {
      templates = templateManager.getBuildingTemplates();
    } else if (templateType === 'recruitment') {
      templates = templateManager.getRecruitmentTemplates();
    }

    ws.send(JSON.stringify({
      type: 'templates',
      templateType,
      templates
    }));

    logger.debug('Sent templates', { templateType });
  } catch (error) {
    logger.error('Failed to get templates', { error: error.message });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle create template request
 */
function handleCreateTemplate(ws, message) {
  const { templateType, data } = message;

  try {
    let template;
    if (templateType === 'building') {
      template = templateManager.createBuildingTemplate(data);
    } else if (templateType === 'recruitment') {
      template = templateManager.createRecruitmentTemplate(data);
    } else {
      throw new Error('Invalid template type');
    }

    ws.send(JSON.stringify({
      type: 'templateCreated',
      templateType,
      template
    }));

    logger.info('Template created', { templateType, id: template.id, name: template.name });

    // Broadcast to all dashboards
    broadcastToDashboards('templateCreated', { templateType, template });
  } catch (error) {
    logger.error('Failed to create template', { error: error.message });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle update template request
 */
function handleUpdateTemplate(ws, message) {
  const { templateType, id, updates } = message;

  try {
    let template;
    if (templateType === 'building') {
      template = templateManager.updateBuildingTemplate(id, updates);
    } else if (templateType === 'recruitment') {
      template = templateManager.updateRecruitmentTemplate(id, updates);
    } else {
      throw new Error('Invalid template type');
    }

    ws.send(JSON.stringify({
      type: 'templateUpdated',
      templateType,
      template
    }));

    logger.info('Template updated', { templateType, id, name: template.name });

    // Broadcast to all dashboards
    broadcastToDashboards('templateUpdated', { templateType, template });
  } catch (error) {
    logger.error('Failed to update template', { error: error.message });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle delete template request
 */
function handleDeleteTemplate(ws, message) {
  const { templateType, id } = message;

  try {
    templateManager.deleteTemplate(id, templateType);

    ws.send(JSON.stringify({
      type: 'templateDeleted',
      templateType,
      id
    }));

    logger.info('Template deleted', { templateType, id });

    // Broadcast to all dashboards
    broadcastToDashboards('templateDeleted', { templateType, id });
  } catch (error) {
    logger.error('Failed to delete template', { error: error.message });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle duplicate template request
 */
function handleDuplicateTemplate(ws, message) {
  const { templateType, id } = message;

  try {
    const template = templateManager.duplicateTemplate(id, templateType);

    ws.send(JSON.stringify({
      type: 'templateDuplicated',
      templateType,
      template
    }));

    logger.info('Template duplicated', { templateType, id, newId: template.id });

    // Broadcast to all dashboards
    broadcastToDashboards('templateCreated', { templateType, template });
  } catch (error) {
    logger.error('Failed to duplicate template', { error: error.message });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle template execution request
 */
async function handleExecuteTemplate(ws, message) {
  const { accountId, templateId, options } = message;

  try {
    logger.info('Executing template', { accountId, templateId });

    const result = await templateExecutor.executeForAccount(accountId, templateId, options);

    ws.send(JSON.stringify({
      type: 'templateExecutionResult',
      accountId,
      templateId,
      result
    }));

    // Broadcast to all dashboards
    broadcastToDashboards('templateExecutionResult', { accountId, templateId, result });

  } catch (error) {
    logger.error('Failed to execute template', { error: error.message, accountId, templateId });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle template preview request
 */
function handlePreviewTemplate(ws, message) {
  const { accountId, templateId } = message;

  try {
    const preview = templateExecutor.previewNextStep(accountId, templateId);

    ws.send(JSON.stringify({
      type: 'templatePreview',
      accountId,
      templateId,
      preview
    }));

  } catch (error) {
    logger.error('Failed to preview template', { error: error.message });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle stop template execution request
 */
function handleStopTemplateExecution(ws, message) {
  const { accountId } = message;

  try {
    const stopped = templateExecutor.stopExecution(accountId);

    ws.send(JSON.stringify({
      type: 'templateExecutionStopped',
      accountId,
      stopped
    }));

    logger.info('Template execution stopped', { accountId });

  } catch (error) {
    logger.error('Failed to stop template execution', { error: error.message });
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

/**
 * Handle farm progress report from userscript
 */
function handleFarmProgress(ws, message, context) {
  if (!context.authenticated) {
    return;
  }

  const { actionId, current, total } = message;

  logger.debug('Farm progress', {
    accountId: context.accountId,
    actionId,
    progress: `${current}/${total}`
  });

  farmBot.handleProgress(context.accountId, { actionId, current, total });

  // Notify bulk farm service of progress (confirms farm is running)
  bulkFarmService.handleFarmProgress(context.accountId);

  // Broadcast to dashboards
  broadcastToDashboards('farmProgress', {
    accountId: context.accountId,
    actionId,
    current,
    total
  });

  // Log to debug log (only log every 10th progress to avoid spam)
  if (current % 10 === 0 || current === total) {
    debugLog.addLog(context.accountId, 'farmProgress', `Progress: ${current}/${total}`, { actionId, current, total });
  }
}

/**
 * Handle farm completion from userscript
 */
function handleFarmComplete(ws, message, context) {
  if (!context.authenticated) {
    return;
  }

  const { actionId, farmed, duration, emptyRun } = message;

  if (emptyRun) {
    logger.info('Farm completed (empty run - no villages to farm)', {
      accountId: context.accountId,
      actionId,
      emptyRun: true
    });
  } else {
    logger.info('Farm completed', {
      accountId: context.accountId,
      actionId,
      farmed,
      durationSec: Math.round(duration / 1000)
    });
  }

  farmBot.handleComplete(context.accountId, { actionId, farmed, duration, emptyRun });

  // Notify bulk farm service of completion (confirms farm ran)
  bulkFarmService.handleFarmComplete(context.accountId);

  // Broadcast to dashboards
  broadcastToDashboards('farmComplete', {
    accountId: context.accountId,
    actionId,
    farmed,
    duration,
    emptyRun: emptyRun || false
  });

  // Log to debug log
  const msg = emptyRun ? 'Farm completed (empty)' : `Farm completed: ${farmed} villages`;
  debugLog.addLog(context.accountId, 'farmComplete', msg, { actionId, farmed, duration, emptyRun });
}

/**
 * Handle farm error from userscript
 */
function handleFarmError(ws, message, context) {
  if (!context.authenticated) {
    return;
  }

  const { actionId, error, message: errorMessage } = message;

  logger.error('Farm error', {
    accountId: context.accountId,
    actionId,
    error,
    message: errorMessage
  });

  farmBot.handleError(context.accountId, { actionId, error, message: errorMessage });

  // Notify bulk farm service of error
  bulkFarmService.handleFarmError(context.accountId, error);

  // Broadcast to dashboards
  broadcastToDashboards('farmError', {
    accountId: context.accountId,
    actionId,
    error,
    message: errorMessage
  });

  // Log to debug log
  const logType = error === 'botProtection' ? 'botProtection' : 'farmError';
  debugLog.addLog(context.accountId, logType, errorMessage || error, { actionId, error });
}

/**
 * Handle farm debug message from userscript
 * Logs debug info from farm tab to server console for troubleshooting
 */
function handleFarmDebug(ws, message, context) {
  if (!context.accountId) {
    logger.warn('FarmDebug from unregistered connection');
    return;
  }

  const { actionId, message: debugMessage, data, timestamp } = message;

  // Log to server console with bright color for visibility
  logger.info(`[FARM DEBUG] ${context.accountId}`, {
    actionId,
    message: debugMessage,
    data: data || {},
    timestamp: new Date(timestamp).toISOString()
  });

  // Also broadcast to dashboards so it shows in real-time
  broadcastToDashboards('farmDebug', {
    accountId: context.accountId,
    actionId,
    message: debugMessage,
    data: data || {},
    timestamp
  });

  // Log to debug log
  debugLog.addLog(context.accountId, 'farmDebug', debugMessage, { actionId, ...data });
}

/**
 * Handle troop report from Troops Tab
 * Stores detailed troop data (troops, queue, canRecruit) for dashboard display
 */
function handleTroopReport(ws, message, context) {
  if (!context.accountId) {
    logger.warn('TroopReport from unregistered connection');
    return;
  }

  const { troops, queue, canRecruit } = message;

  // Store in account data
  const troopDetails = {
    troops: troops || {},
    queue: queue || { barracks: [], stable: [], garage: [] },
    canRecruit: canRecruit || {},
    lastUpdate: Date.now()
  };

  // Update account state
  accountState.updateData(context.accountId, { troopDetails });

  logger.debug(`TroopReport received from ${context.accountId}`, {
    troopCount: Object.keys(troops || {}).length,
    queueItems: (queue?.barracks?.length || 0) + (queue?.stable?.length || 0) + (queue?.garage?.length || 0)
  });

  // Broadcast to dashboards
  broadcastToDashboards('troopUpdate', {
    accountId: context.accountId,
    troopDetails
  });

  // Log to debug log
  debugLog.addLog(context.accountId, 'troopReport', 'Troop data received', {
    troopCount: Object.keys(troops || {}).length
  });
}

/**
 * Handle tabOpened confirmation from userscript
 */
function handleTabOpened(ws, message, context) {
  if (!context.accountId) {
    logger.warn('TabOpened from unregistered connection');
    return;
  }

  const { tabType, screen, url } = message;

  logger.info('Tab opened', {
    accountId: context.accountId,
    tabType,
    screen,
    url
  });

  // Broadcast to dashboards
  broadcastToDashboards('tabOpened', {
    accountId: context.accountId,
    tabType,
    screen,
    url
  });

  // Log to debug log
  debugLog.addLog(context.accountId, 'tabOpened', `Opened ${tabType || screen} tab`, { url });
}

/**
 * Open a specific tab for an account (called from dashboard/API)
 * @param {string} accountId - The account ID
 * @param {string} tabType - Type of tab: 'building', 'troops', 'overview'
 * @returns {boolean} Success
 */
function openTabForAccount(accountId, tabType) {
  const account = accounts.get(accountId);
  if (!account || !account.ws) {
    logger.warn('Cannot open tab: account not connected', { accountId, tabType });
    return false;
  }

  // Find master connection for this account
  const masterConn = account.ws;

  logger.info('Sending openTab command', { accountId, tabType });

  masterConn.send(JSON.stringify({
    type: 'openTab',
    tabType
  }));

  return true;
}

/**
 * Handle building report from Building Tab
 * Stores detailed building data (buildings, buildQueue, queueSlots) for dashboard display
 */
function handleBuildingReport(ws, message, context) {
  if (!context.accountId) {
    logger.warn('BuildingReport from unregistered connection');
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

  logger.info('BuildingReport received', {
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

/**
 * Handle recruitTroops command from dashboard
 * Forwards the command to the account's userscript
 */
function handleRecruitTroops(ws, message) {
  const { accountId, building, units, actionId } = message;

  if (!accountId) {
    logger.warn('RecruitTroops without accountId');
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Missing accountId for recruitTroops'
    }));
    return;
  }

  logger.info('RecruitTroops command received', {
    accountId,
    building,
    units,
    actionId
  });

  // Log to debug log
  debugLog.addLog(accountId, 'recruitTroops', `Recruiting in ${building}`, {
    units,
    actionId
  });

  // Forward to userscript
  const sent = sendToAccount(accountId, {
    type: 'recruitTroops',
    building,
    units,
    actionId
  });

  if (!sent) {
    logger.warn('Failed to send recruitTroops - account not connected', { accountId });
    ws.send(JSON.stringify({
      type: 'commandResult',
      actionId,
      success: false,
      message: 'Account not connected or no master tab available'
    }));
  }
}

module.exports = {
  initWebSocket,
  CONFIG,
  sendToAccount,
  getAccountById,
  getAccounts,
  debugLog,
  openTabForAccount
};
