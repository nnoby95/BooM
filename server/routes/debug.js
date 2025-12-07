/**
 * Debug API Routes
 * Endpoints for debug log access
 */

const express = require('express');
const router = express.Router();
const { debugLog } = require('../services/debugLog');

/**
 * GET /api/debug/logs
 * Get recent debug logs
 */
router.get('/logs', (req, res) => {
  try {
    const { accountId, type, count, since } = req.query;

    const filters = {};
    if (accountId) filters.accountId = accountId;
    if (type) filters.type = type;
    if (since) filters.since = parseInt(since);

    const logs = Object.keys(filters).length > 0
      ? debugLog.getLogs(filters)
      : debugLog.getRecent(parseInt(count) || 100);

    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/debug/logs
 * Clear all debug logs
 */
router.delete('/logs', (req, res) => {
  try {
    debugLog.clear();
    res.json({
      success: true,
      message: 'Logs cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/debug/stats
 * Get debug log statistics
 */
router.get('/stats', (req, res) => {
  try {
    res.json({
      success: true,
      count: debugLog.getCount()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
