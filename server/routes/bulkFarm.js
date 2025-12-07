/**
 * Bulk Farm API Routes
 * Endpoints for bulk farm operations across multiple accounts
 */

const express = require('express');
const router = express.Router();
const { bulkFarmService } = require('../services/bulkFarmService');
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

module.exports = router;
