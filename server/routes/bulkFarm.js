/**
 * Bulk Farm API Routes
 * Endpoints for bulk farm operations across multiple accounts
 */

const express = require('express');
const router = express.Router();
const { bulkFarmService } = require('../services/bulkFarmService');
const { farmBot } = require('../services/farmBot');
const { accountState } = require('../state/accounts');
const { logger } = require('../utils/logger');

/**
 * POST /api/bulk-farm/start
 * Start bulk farming for multiple accounts
 */
router.post('/start', (req, res) => {
  try {
    const { accountIds, settings, options } = req.body;

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or empty accountIds array'
      });
    }

    const result = bulkFarmService.start(accountIds, settings || {}, options || {});
    res.json(result);

  } catch (error) {
    logger.error('Error in bulk-farm start:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bulk-farm/stop
 * Stop the current bulk operation (doesn't stop farms that already started)
 */
router.post('/stop', (req, res) => {
  try {
    const result = bulkFarmService.stop();
    res.json(result);

  } catch (error) {
    logger.error('Error in bulk-farm stop:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/bulk-farm/stop-all
 * Stop all farms that were started by bulk operation
 */
router.post('/stop-all', (req, res) => {
  try {
    const result = bulkFarmService.stopAllFarms();
    res.json(result);

  } catch (error) {
    logger.error('Error in bulk-farm stop-all:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bulk-farm/status
 * Get current bulk operation status
 */
router.get('/status', (req, res) => {
  try {
    const status = bulkFarmService.getStatus();
    res.json(status);

  } catch (error) {
    logger.error('Error in bulk-farm status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bulk-farm/logs
 * Get bulk farm logs
 */
router.get('/logs', (req, res) => {
  try {
    const count = parseInt(req.query.count) || 100;
    const operationId = req.query.operationId || null;

    const logs = bulkFarmService.getLogs(count, operationId);
    res.json({
      success: true,
      logs,
      count: logs.length
    });

  } catch (error) {
    logger.error('Error in bulk-farm logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/bulk-farm/logs
 * Clear bulk farm logs
 */
router.delete('/logs', (req, res) => {
  try {
    const result = bulkFarmService.clearLogs();
    res.json(result);

  } catch (error) {
    logger.error('Error clearing bulk-farm logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/bulk-farm/farm-statuses
 * Get real-time farm status for all connected accounts
 * Returns actual farming state from farmBot service
 */
router.get('/farm-statuses', (req, res) => {
  try {
    // Get all accounts (returns array)
    const accounts = accountState.getAll();

    // Build status for each connected account
    const statuses = [];

    for (const account of accounts) {
      // Only include connected accounts
      if (account.status !== 'connected') continue;

      const accountId = account.accountId;

      // Get farm status from farmBot
      const farmStatus = farmBot.getStatus(accountId);

      statuses.push({
        accountId,
        playerName: account.data?.playerName || accountId.split('_')[1] || accountId,
        world: account.data?.world,
        // Farm state
        isRunning: farmStatus.isRunning || false,
        isPaused: farmStatus.isPaused || false,
        isFarming: farmStatus.isFarming || false,
        // Progress (when actively farming)
        currentProgress: farmStatus.currentProgress || null,
        // Timing
        lastRun: farmStatus.lastRun || null,
        nextRun: farmStatus.nextRun || null,
        // Stats
        loopCount: farmStatus.loopCount || 0,
        totalFarmed: farmStatus.totalFarmed || 0,
        // Error state
        lastError: farmStatus.lastError || null,
        // Settings
        settings: farmStatus.settings || null
      });
    }

    // Sort by accountId
    statuses.sort((a, b) => a.accountId.localeCompare(b.accountId));

    res.json({
      success: true,
      timestamp: Date.now(),
      statuses,
      summary: {
        total: statuses.length,
        running: statuses.filter(s => s.isRunning && !s.isPaused).length,
        farming: statuses.filter(s => s.isFarming).length,
        paused: statuses.filter(s => s.isPaused).length,
        idle: statuses.filter(s => !s.isRunning).length
      }
    });

  } catch (error) {
    logger.error('Error in bulk-farm farm-statuses:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
