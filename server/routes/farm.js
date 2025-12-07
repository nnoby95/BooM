/**
 * Farm Bot API Routes
 * Endpoints for controlling farm automation
 */

const express = require('express');
const router = express.Router();
const { farmBot } = require('../services/farmBot');
const { logger } = require('../utils/logger');

/**
 * POST /api/farm/start
 * Start farming for an account (loop mode)
 */
router.post('/start', (req, res) => {
  try {
    const { accountId, template, intervalMinutes, randomDelayMinutes } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: accountId'
      });
    }

    const result = farmBot.start(accountId, { template, intervalMinutes, randomDelayMinutes });
    res.json(result);

  } catch (error) {
    logger.error('Error in farm start:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/farm/once
 * Run farm once (single execution, no loop)
 */
router.post('/once', (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: accountId'
      });
    }

    const result = farmBot.farmOnce(accountId);
    res.json(result);

  } catch (error) {
    logger.error('Error in farm once:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/farm/stop
 * Stop farming for an account
 */
router.post('/stop', (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: accountId'
      });
    }

    const result = farmBot.stop(accountId);
    res.json(result);

  } catch (error) {
    logger.error('Error in farm stop:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/farm/pause
 * Pause farming for an account
 */
router.post('/pause', (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: accountId'
      });
    }

    const result = farmBot.pause(accountId);
    res.json(result);

  } catch (error) {
    logger.error('Error in farm pause:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/farm/resume
 * Resume paused farming for an account
 */
router.post('/resume', (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: accountId'
      });
    }

    const result = farmBot.resume(accountId);
    res.json(result);

  } catch (error) {
    logger.error('Error in farm resume:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/farm/status/:accountId
 * Get farm status for a specific account
 */
router.get('/status/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    const status = farmBot.getStatus(accountId);
    res.json(status);

  } catch (error) {
    logger.error('Error in farm status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/farm/all
 * Get all farm statuses
 */
router.get('/all', (req, res) => {
  try {
    const statuses = farmBot.getAllStatuses();
    const stats = farmBot.getStats();

    res.json({
      stats,
      sessions: statuses
    });

  } catch (error) {
    logger.error('Error in farm all:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/farm/settings/:accountId
 * Update farm settings for an account
 */
router.put('/settings/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    const { intervalMinutes, randomDelayMinutes, template, enabled } = req.body;

    const result = farmBot.updateSettings(accountId, {
      intervalMinutes,
      randomDelayMinutes,
      template,
      enabled
    });

    res.json(result);

  } catch (error) {
    logger.error('Error in farm settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/farm/stats
 * Get farm bot statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = farmBot.getStats();
    res.json(stats);

  } catch (error) {
    logger.error('Error in farm stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
