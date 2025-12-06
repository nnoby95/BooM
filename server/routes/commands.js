/**
 * Command API routes
 * Endpoints for sending commands to userscript agents
 */

const express = require('express');
const router = express.Router();
const { getAccountById, getAccounts } = require('../websocket');
const { commandQueue } = require('../state/commandQueue');
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

    // QUEUE the command instead of sending directly!
    const queueId = commandQueue.enqueue(accountId, command, 'normal');

    res.json({
      success: true,
      actionId: actionId,
      queueId: queueId,
      message: 'Command queued for execution',
      queuePosition: commandQueue.queue.findIndex(q => q.id === queueId) + 1,
      queueLength: commandQueue.queue.length
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

    const queueId = commandQueue.enqueue(accountId, command, 'normal');

    res.json({
      success: true,
      actionId: actionId,
      queueId: queueId,
      message: 'Build command queued',
      queuePosition: commandQueue.queue.findIndex(q => q.id === queueId) + 1
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

    const queueId = commandQueue.enqueue(accountId, command, 'normal');

    res.json({
      success: true,
      actionId: actionId,
      queueId: queueId,
      message: 'Recruit command queued',
      queuePosition: commandQueue.queue.findIndex(q => q.id === queueId) + 1
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
 * GET /api/commands/queue/status
 * Get overall queue status
 */
router.get('/queue/status', (req, res) => {
  res.json(commandQueue.getStatus());
});

/**
 * GET /api/commands/pending/:accountId
 * Get pending commands for a specific account
 */
router.get('/pending/:accountId', (req, res) => {
  const status = commandQueue.getStatus();
  const accountQueue = status.queue.filter(item => item.accountId === req.params.accountId);

  res.json({
    accountId: req.params.accountId,
    pending: accountQueue.length,
    cooldownRemaining: status.accountCooldowns[req.params.accountId] || 0,
    commands: accountQueue
  });
});

/**
 * DELETE /api/commands/queue/:accountId
 * Cancel all pending commands for an account
 */
router.delete('/queue/:accountId', (req, res) => {
  const cancelled = commandQueue.cancelForAccount(req.params.accountId);
  res.json({
    success: true,
    cancelled: cancelled,
    message: `Cancelled ${cancelled} command(s) for ${req.params.accountId}`
  });
});

/**
 * DELETE /api/commands/queue
 * Clear entire queue (emergency stop)
 */
router.delete('/queue', (req, res) => {
  const cleared = commandQueue.clearAll();
  res.json({
    success: true,
    cleared: cleared,
    message: `Cleared all ${cleared} pending commands`
  });
});

module.exports = router;
