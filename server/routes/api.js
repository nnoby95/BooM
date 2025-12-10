/**
 * REST API routes for dashboard
 */

const express = require('express');
const { accountState } = require('../state/accounts');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/status
 * Server health and connection count
 */
router.get('/status', (req, res) => {
  const stats = accountState.getStats();
  res.json({
    status: 'online',
    timestamp: Date.now(),
    connections: stats
  });
});

/**
 * GET /api/accounts
 * List all connected accounts with latest data
 */
router.get('/accounts', (req, res) => {
  const accounts = accountState.getAll();
  res.json({
    success: true,
    count: accounts.length,
    accounts
  });
});

/**
 * GET /api/accounts/:id
 * Get specific account details
 */
router.get('/accounts/:id', (req, res) => {
  const { id } = req.params;
  const account = accountState.get(id);

  if (!account) {
    return res.status(404).json({
      success: false,
      error: 'Account not found'
    });
  }

  res.json({
    success: true,
    account: {
      accountId: account.accountId,
      sessionId: account.sessionId,
      status: account.status,
      lastUpdate: account.lastUpdate,
      registeredAt: account.registeredAt,
      data: account.data
    }
  });
});

/**
 * GET /api/alerts
 * Get all incoming attacks across all accounts
 */
router.get('/alerts', (req, res) => {
  const incomings = accountState.getAllIncomings();
  res.json({
    success: true,
    count: incomings.length,
    incomings
  });
});

/**
 * POST /api/commands/send-troops
 * Queue a send troops command
 */
router.post('/commands/send-troops', (req, res) => {
  const { accountId, targetCoords, troops, sendType, executeAt } = req.body;

  // Validate required fields
  if (!accountId || !targetCoords || !troops || !sendType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: accountId, targetCoords, troops, sendType'
    });
  }

  // Check if account exists and is connected
  const account = accountState.get(accountId);
  if (!account || account.status !== 'connected') {
    return res.status(404).json({
      success: false,
      error: 'Account not found or not connected'
    });
  }

  // Generate action ID
  const actionId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Send command to userscript
  const message = {
    type: 'sendTroops',
    actionId,
    targetCoords,
    troops,
    sendType,
    executeAt: executeAt || null
  };

  const sent = accountState.sendToAccount(accountId, message);

  if (!sent) {
    return res.status(500).json({
      success: false,
      error: 'Failed to send command to account'
    });
  }

  logger.info('Send troops command queued', { accountId, actionId, targetCoords, sendType });

  res.json({
    success: true,
    actionId,
    message: 'Command sent to userscript'
  });
});

/**
 * POST /api/commands/build
 * Queue a build building command
 */
router.post('/commands/build', (req, res) => {
  const { accountId, building, levels } = req.body;

  // Validate required fields
  if (!accountId || !building) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: accountId, building'
    });
  }

  // Check if account exists and is connected
  const account = accountState.get(accountId);
  if (!account || account.status !== 'connected') {
    return res.status(404).json({
      success: false,
      error: 'Account not found or not connected'
    });
  }

  // Generate action ID
  const actionId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Send command to userscript
  const message = {
    type: 'buildBuilding',
    actionId,
    building,
    levels: levels || 1
  };

  const sent = accountState.sendToAccount(accountId, message);

  if (!sent) {
    return res.status(500).json({
      success: false,
      error: 'Failed to send command to account'
    });
  }

  logger.info('Build command queued', { accountId, actionId, building });

  res.json({
    success: true,
    actionId,
    message: 'Command sent to userscript'
  });
});

/**
 * POST /api/commands/recruit
 * Queue a recruit troops command
 */
router.post('/commands/recruit', (req, res) => {
  const { accountId, building, units } = req.body;

  // Validate required fields
  if (!accountId || !building || !units) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: accountId, building, units'
    });
  }

  // Check if account exists and is connected
  const account = accountState.get(accountId);
  if (!account || account.status !== 'connected') {
    return res.status(404).json({
      success: false,
      error: 'Account not found or not connected'
    });
  }

  // Generate action ID
  const actionId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Send command to userscript
  const message = {
    type: 'recruitTroops',
    actionId,
    building,
    units
  };

  const sent = accountState.sendToAccount(accountId, message);

  if (!sent) {
    return res.status(500).json({
      success: false,
      error: 'Failed to send command to account'
    });
  }

  logger.info('Recruit command queued', { accountId, actionId, building, units });

  res.json({
    success: true,
    actionId,
    message: 'Command sent to userscript'
  });
});

/**
 * POST /api/commands/refresh
 * Request immediate data refresh from account
 */
router.post('/commands/refresh', (req, res) => {
  const { accountId } = req.body;

  if (!accountId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: accountId'
    });
  }

  const account = accountState.get(accountId);
  if (!account || account.status !== 'connected') {
    return res.status(404).json({
      success: false,
      error: 'Account not found or not connected'
    });
  }

  const sent = accountState.sendToAccount(accountId, { type: 'requestRefresh' });

  if (!sent) {
    return res.status(500).json({
      success: false,
      error: 'Failed to send refresh request'
    });
  }

  res.json({
    success: true,
    message: 'Refresh request sent'
  });
});

/**
 * POST /api/commands/open-tab
 * Open a specific tab (building, troops, etc.) for an account
 */
router.post('/commands/open-tab', (req, res) => {
  const { accountId, tabType } = req.body;

  if (!accountId || !tabType) {
    return res.status(400).json({
      success: false,
      error: 'accountId and tabType are required'
    });
  }

  // Valid tab types
  const validTabTypes = ['building', 'troops', 'overview'];
  if (!validTabTypes.includes(tabType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid tabType. Must be one of: ${validTabTypes.join(', ')}`
    });
  }

  // Import openTabForAccount dynamically to avoid circular dependency
  const { openTabForAccount } = require('../websocket');

  const success = openTabForAccount(accountId, tabType);

  if (!success) {
    return res.status(404).json({
      success: false,
      error: 'Account not connected or no master tab available'
    });
  }

  logger.info('Open tab command sent', { accountId, tabType });

  res.json({
    success: true,
    message: `Opening ${tabType} tab for ${accountId}`
  });
});

module.exports = router;
