/**
 * Bulk Farm Service
 * Handles starting farming on multiple accounts with staggered execution
 */

const { logger } = require('../utils/logger');
const { farmBot } = require('./farmBot');
const { accountState } = require('../state/accounts');

class BulkFarmService {
  constructor() {
    // Current bulk operation
    this.currentOperation = null;

    // Operation logs (last 500)
    this.logs = [];
    this.maxLogs = 500;

    // Stagger timer
    this.staggerTimer = null;

    // WebSocket broadcast function (set by websocket.js)
    this.broadcastFn = null;

    // Timeout tracking for pending farm confirmations (accountId -> { timeoutId, startTime })
    this.pendingConfirmations = new Map();

    // Timeout duration (30 seconds)
    this.CONFIRMATION_TIMEOUT_MS = 30000;
  }

  /**
   * Set the broadcast function for WebSocket updates
   */
  setBroadcast(fn) {
    this.broadcastFn = fn;
  }

  /**
   * Broadcast message to all connected dashboards
   */
  broadcast(type, data) {
    if (this.broadcastFn) {
      this.broadcastFn({ type, ...data });
    }
  }

  /**
   * Start bulk farming operation
   * @param {string[]} accountIds - List of account IDs to start
   * @param {Object} settings - Base settings { intervalMinutes, randomDelayMinutes, template }
   * @param {Object} options - Options { staggerMin, staggerMax, randomizeMin, randomizeMax }
   */
  start(accountIds, settings, options = {}) {
    // Check if already running
    if (this.currentOperation && this.currentOperation.status === 'running') {
      return {
        success: false,
        error: 'A bulk operation is already running'
      };
    }

    // Validate accounts
    const validAccounts = [];
    const invalidAccounts = [];

    for (const accountId of accountIds) {
      const account = accountState.get(accountId);
      if (account && account.status === 'connected') {
        validAccounts.push(accountId);
      } else {
        invalidAccounts.push({
          accountId,
          reason: account ? 'Not connected' : 'Account not found'
        });
      }
    }

    if (validAccounts.length === 0) {
      return {
        success: false,
        error: 'No valid connected accounts to start'
      };
    }

    // Create operation
    const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    this.currentOperation = {
      id: operationId,
      status: 'running',
      startedAt: Date.now(),
      baseSettings: {
        intervalMinutes: settings.intervalMinutes || 15,
        randomDelayMinutes: settings.randomDelayMinutes || 2,
        template: settings.template || 'A'
      },
      options: {
        staggerMin: options.staggerMin || 10,
        staggerMax: options.staggerMax || 15,
        randomizeMin: options.randomizeMin || 1,
        randomizeMax: options.randomizeMax || 3
      },
      queue: [...validAccounts],
      started: [],
      failed: [],
      skipped: invalidAccounts
    };

    // Log skipped accounts
    for (const skipped of invalidAccounts) {
      this.addLog(skipped.accountId, 'skipped', `Skipped: ${skipped.reason}`);
    }

    logger.info(`Bulk farm operation started: ${operationId}`, {
      totalAccounts: accountIds.length,
      validAccounts: validAccounts.length,
      invalidAccounts: invalidAccounts.length
    });

    // Start processing queue immediately
    this.processQueue();

    return {
      success: true,
      operationId,
      queued: validAccounts.length,
      skipped: invalidAccounts.length
    };
  }

  /**
   * Process next account in queue
   */
  processQueue() {
    if (!this.currentOperation || this.currentOperation.status !== 'running') {
      return;
    }

    if (this.currentOperation.queue.length === 0) {
      // Operation complete
      this.currentOperation.status = 'complete';
      this.currentOperation.completedAt = Date.now();

      const summary = {
        operationId: this.currentOperation.id,
        started: this.currentOperation.started.length,
        failed: this.currentOperation.failed.length,
        skipped: this.currentOperation.skipped.length,
        duration: this.currentOperation.completedAt - this.currentOperation.startedAt
      };

      logger.info(`Bulk farm operation complete: ${this.currentOperation.id}`, summary);

      this.addLog('system', 'complete',
        `Bulk operation complete: ${summary.started} started, ${summary.failed} failed`);

      this.broadcast('bulkFarmComplete', summary);
      return;
    }

    // Get next account
    const accountId = this.currentOperation.queue.shift();

    // Randomize settings for this account
    const settings = this.randomizeSettings(
      this.currentOperation.baseSettings,
      this.currentOperation.options.randomizeMin,
      this.currentOperation.options.randomizeMax
    );

    // Try to start farm with error handling
    let result;
    try {
      result = farmBot.start(accountId, settings);
    } catch (error) {
      logger.error(`Bulk farm: exception starting ${accountId}`, { error: error.message });
      result = { success: false, error: `Exception: ${error.message}` };
    }

    if (result.success) {
      this.currentOperation.started.push({
        accountId,
        settings,
        startedAt: Date.now(),
        confirmed: false // Track if we received confirmation
      });

      this.addLog(accountId, 'success',
        `Started with ${settings.intervalMinutes}min, ±${settings.randomDelayMinutes}min`);

      logger.info(`Bulk farm: started ${accountId}`, settings);

      // Set up timeout to check for confirmation
      this.setupConfirmationTimeout(accountId, settings);
    } else {
      this.currentOperation.failed.push({
        accountId,
        error: result.error,
        failedAt: Date.now()
      });

      this.addLog(accountId, 'error', `Failed: ${result.error}`);

      logger.warn(`Bulk farm: failed to start ${accountId}`, { error: result.error });
    }

    // Broadcast progress
    this.broadcast('bulkFarmProgress', {
      operationId: this.currentOperation.id,
      current: this.currentOperation.started.length + this.currentOperation.failed.length,
      total: this.currentOperation.started.length + this.currentOperation.failed.length + this.currentOperation.queue.length,
      started: this.currentOperation.started.length,
      failed: this.currentOperation.failed.length,
      remaining: this.currentOperation.queue.length,
      lastAccount: accountId,
      lastResult: result.success ? 'success' : 'error',
      lastSettings: result.success ? settings : null
    });

    // Schedule next with stagger
    if (this.currentOperation.queue.length > 0) {
      const staggerMs = this.getRandomStagger(
        this.currentOperation.options.staggerMin,
        this.currentOperation.options.staggerMax
      );

      this.staggerTimer = setTimeout(() => this.processQueue(), staggerMs);

      logger.debug(`Next bulk farm start in ${staggerMs}ms`);
    } else {
      // Process complete (will mark as complete)
      this.processQueue();
    }
  }

  /**
   * Set up timeout for farm confirmation
   * After 30 seconds, if no progress received, mark as timed out
   */
  setupConfirmationTimeout(accountId, settings) {
    // Clear any existing timeout for this account
    this.clearConfirmationTimeout(accountId);

    const timeoutId = setTimeout(() => {
      this.handleConfirmationTimeout(accountId);
    }, this.CONFIRMATION_TIMEOUT_MS);

    this.pendingConfirmations.set(accountId, {
      timeoutId,
      startTime: Date.now(),
      settings
    });

    logger.debug(`Confirmation timeout set for ${accountId} (${this.CONFIRMATION_TIMEOUT_MS / 1000}s)`);
  }

  /**
   * Clear confirmation timeout for an account
   */
  clearConfirmationTimeout(accountId) {
    const pending = this.pendingConfirmations.get(accountId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingConfirmations.delete(accountId);
      logger.debug(`Confirmation timeout cleared for ${accountId}`);
    }
  }

  /**
   * Handle confirmation timeout - farm didn't respond in time
   */
  handleConfirmationTimeout(accountId) {
    this.pendingConfirmations.delete(accountId);

    // Check if farm is actually running
    const farmStatus = farmBot.getStatus(accountId);

    if (farmStatus.isFarming && farmStatus.currentProgress) {
      // Farm is actually running, just late confirmation
      logger.info(`Bulk farm: late confirmation for ${accountId}, farm is running`);
      this.markAccountConfirmed(accountId);
      return;
    }

    // Farm didn't start properly - mark as timeout
    logger.warn(`Bulk farm: timeout for ${accountId} - no response in ${this.CONFIRMATION_TIMEOUT_MS / 1000}s`);

    // Reset the stalled session but keep the loop running - will retry on next interval
    farmBot.resetStalled(accountId);

    // Update operation status
    if (this.currentOperation) {
      // Move from started to failed
      const startedIndex = this.currentOperation.started.findIndex(s => s.accountId === accountId);
      if (startedIndex !== -1) {
        const startedItem = this.currentOperation.started.splice(startedIndex, 1)[0];
        this.currentOperation.failed.push({
          accountId,
          error: 'Timeout - no response (30s)',
          failedAt: Date.now(),
          originalSettings: startedItem.settings
        });
      }

      // Log and broadcast
      this.addLog(accountId, 'error', 'Timeout - no response after 30 seconds. Will retry on next cycle.');

      this.broadcast('bulkFarmProgress', {
        operationId: this.currentOperation.id,
        current: this.currentOperation.started.length + this.currentOperation.failed.length,
        total: this.currentOperation.started.length + this.currentOperation.failed.length + this.currentOperation.queue.length,
        started: this.currentOperation.started.length,
        failed: this.currentOperation.failed.length,
        remaining: this.currentOperation.queue.length,
        lastAccount: accountId,
        lastResult: 'timeout'
      });
    }
  }

  /**
   * Mark an account as confirmed (received progress/complete)
   */
  markAccountConfirmed(accountId) {
    this.clearConfirmationTimeout(accountId);

    if (this.currentOperation) {
      const started = this.currentOperation.started.find(s => s.accountId === accountId);
      if (started) {
        started.confirmed = true;
      }
    }
  }

  /**
   * Called when farm progress is received - confirms the farm is running
   */
  handleFarmProgress(accountId) {
    if (this.pendingConfirmations.has(accountId)) {
      logger.debug(`Bulk farm: confirmed ${accountId} via progress`);
      this.markAccountConfirmed(accountId);
    }
  }

  /**
   * Called when farm completes - confirms the farm ran
   */
  handleFarmComplete(accountId) {
    if (this.pendingConfirmations.has(accountId)) {
      logger.debug(`Bulk farm: confirmed ${accountId} via complete`);
      this.markAccountConfirmed(accountId);
    }
  }

  /**
   * Called when farm errors - clear timeout and potentially mark failed
   */
  handleFarmError(accountId, error) {
    this.clearConfirmationTimeout(accountId);

    // Update operation if this was a bulk-started farm
    if (this.currentOperation) {
      const started = this.currentOperation.started.find(s => s.accountId === accountId);
      if (started && !started.confirmed) {
        // Move from started to failed
        const startedIndex = this.currentOperation.started.findIndex(s => s.accountId === accountId);
        if (startedIndex !== -1) {
          const startedItem = this.currentOperation.started.splice(startedIndex, 1)[0];
          this.currentOperation.failed.push({
            accountId,
            error: error || 'Farm error',
            failedAt: Date.now(),
            originalSettings: startedItem.settings
          });

          this.addLog(accountId, 'error', `Farm error: ${error}`);

          this.broadcast('bulkFarmProgress', {
            operationId: this.currentOperation.id,
            started: this.currentOperation.started.length,
            failed: this.currentOperation.failed.length,
            remaining: this.currentOperation.queue.length
          });
        }
      }
    }
  }

  /**
   * Stop bulk operation
   */
  stop() {
    // Clear stagger timer
    if (this.staggerTimer) {
      clearTimeout(this.staggerTimer);
      this.staggerTimer = null;
    }

    // Clear all pending confirmation timeouts
    for (const [accountId, pending] of this.pendingConfirmations) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingConfirmations.clear();

    if (!this.currentOperation) {
      return { success: true, message: 'No active operation' };
    }

    const wasRunning = this.currentOperation.status === 'running';
    this.currentOperation.status = 'stopped';
    this.currentOperation.stoppedAt = Date.now();

    const remaining = this.currentOperation.queue.length;
    this.currentOperation.queue = [];

    this.addLog('system', 'stopped',
      `Bulk operation stopped. ${remaining} accounts were not started.`);

    logger.info(`Bulk farm operation stopped: ${this.currentOperation.id}`, {
      started: this.currentOperation.started.length,
      notStarted: remaining
    });

    this.broadcast('bulkFarmStopped', {
      operationId: this.currentOperation.id,
      started: this.currentOperation.started.length,
      notStarted: remaining
    });

    return {
      success: true,
      started: this.currentOperation.started.length,
      notStarted: remaining
    };
  }

  /**
   * Stop all farms that were started by bulk operation
   */
  stopAllFarms() {
    let stopped = 0;

    if (this.currentOperation && this.currentOperation.started) {
      for (const item of this.currentOperation.started) {
        const result = farmBot.stop(item.accountId);
        if (result.success) {
          stopped++;
        }
      }
    }

    // Also stop the bulk operation itself
    this.stop();

    this.addLog('system', 'info', `Stopped ${stopped} farms`);

    return {
      success: true,
      stopped
    };
  }

  /**
   * Randomize settings for an account
   */
  randomizeSettings(baseSettings, minVariation, maxVariation) {
    const variation = Math.floor(Math.random() * (maxVariation - minVariation + 1)) + minVariation;
    const signInterval = Math.random() > 0.5 ? 1 : -1;
    const signDelay = Math.random() > 0.5 ? 1 : -1;

    return {
      intervalMinutes: Math.max(5, baseSettings.intervalMinutes + (signInterval * variation)),
      randomDelayMinutes: Math.max(1, baseSettings.randomDelayMinutes + (signDelay * variation)),
      template: baseSettings.template
    };
  }

  /**
   * Get random stagger time in milliseconds
   */
  getRandomStagger(minSeconds, maxSeconds) {
    const seconds = minSeconds + Math.random() * (maxSeconds - minSeconds);
    return Math.round(seconds * 1000);
  }

  /**
   * Get current operation status
   */
  getStatus() {
    if (!this.currentOperation) {
      return {
        hasOperation: false,
        status: 'idle'
      };
    }

    return {
      hasOperation: true,
      operationId: this.currentOperation.id,
      status: this.currentOperation.status,
      startedAt: this.currentOperation.startedAt,
      completedAt: this.currentOperation.completedAt,
      stoppedAt: this.currentOperation.stoppedAt,
      baseSettings: this.currentOperation.baseSettings,
      progress: {
        total: this.currentOperation.started.length +
               this.currentOperation.failed.length +
               this.currentOperation.queue.length +
               this.currentOperation.skipped.length,
        started: this.currentOperation.started.length,
        failed: this.currentOperation.failed.length,
        skipped: this.currentOperation.skipped.length,
        remaining: this.currentOperation.queue.length
      },
      started: this.currentOperation.started,
      failed: this.currentOperation.failed,
      skipped: this.currentOperation.skipped,
      queue: this.currentOperation.queue
    };
  }

  /**
   * Add log entry
   */
  addLog(accountId, type, message, data = {}) {
    const log = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      operationId: this.currentOperation?.id || null,
      accountId,
      type, // success, error, skipped, stopped, complete, info
      message,
      data
    };

    this.logs.push(log);

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Broadcast log
    this.broadcast('bulkFarmLog', log);

    return log;
  }

  /**
   * Get logs
   */
  getLogs(count = 100, operationId = null) {
    let logs = [...this.logs];

    if (operationId) {
      logs = logs.filter(l => l.operationId === operationId);
    }

    return logs.slice(-count);
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
    return { success: true };
  }
}

// Create singleton instance
const bulkFarmService = new BulkFarmService();

module.exports = { BulkFarmService, bulkFarmService };
