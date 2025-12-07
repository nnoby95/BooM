/**
 * Farm Bot Service
 * Server-side farm scheduling and management
 * Controls automated farming for connected accounts
 */

const { logger } = require('../utils/logger');
const { accountState } = require('../state/accounts');

class FarmBotService {
  constructor() {
    // Map: accountId -> FarmSession
    this.farmSessions = new Map();

    // Default settings
    this.defaultSettings = {
      intervalMinutes: 30,
      randomDelayMinutes: 5,
      template: 'A', // 'A', 'B', or 'both'
      enabled: true
    };
  }

  /**
   * Get farm session for an account
   */
  getSession(accountId) {
    return this.farmSessions.get(accountId);
  }

  /**
   * Get farm status for an account
   */
  getStatus(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session) {
      return {
        accountId,
        isRunning: false,
        isPaused: false,
        settings: this.defaultSettings
      };
    }

    return {
      accountId,
      isRunning: session.isRunning,
      isPaused: session.isPaused,
      isFarming: session.isFarming,
      currentProgress: session.currentProgress,
      lastRun: session.lastRun,
      nextRun: session.nextRun,
      loopCount: session.loopCount,
      totalFarmed: session.totalFarmed,
      lastError: session.lastError,
      settings: session.settings
    };
  }

  /**
   * Get all farm statuses
   */
  getAllStatuses() {
    const statuses = [];
    for (const [accountId, session] of this.farmSessions) {
      statuses.push(this.getStatus(accountId));
    }
    return statuses;
  }

  /**
   * Start farming for an account
   */
  start(accountId, options = {}) {
    // Check if account is connected
    const account = accountState.get(accountId);
    if (!account || account.status !== 'connected') {
      logger.warn(`Cannot start farm: account not connected: ${accountId}`);
      return { success: false, error: 'Account not connected' };
    }

    // Check if master connection exists
    const masterConn = accountState.getMasterConnection(accountId);
    if (!masterConn) {
      logger.warn(`Cannot start farm: no master connection: ${accountId}`);
      return { success: false, error: 'No master tab connected' };
    }

    // Get or create session
    let session = this.farmSessions.get(accountId);
    if (!session) {
      session = this.createSession(accountId);
    }

    // Update settings if provided
    if (options.template) {
      session.settings.template = options.template;
    }
    if (options.intervalMinutes !== undefined) {
      session.settings.intervalMinutes = options.intervalMinutes;
    }
    if (options.randomDelayMinutes !== undefined) {
      session.settings.randomDelayMinutes = options.randomDelayMinutes;
    }

    // Already running?
    if (session.isRunning && !session.isPaused) {
      logger.info(`Farm already running for ${accountId}`);
      return { success: true, message: 'Already running', status: this.getStatus(accountId) };
    }

    // Start the farm
    session.isRunning = true;
    session.isPaused = false;
    session.startedAt = Date.now();

    // Execute farm immediately
    this.executeFarm(accountId);

    logger.info(`Farm started for ${accountId}`, {
      template: session.settings.template,
      interval: session.settings.intervalMinutes
    });

    return {
      success: true,
      message: 'Farm started',
      status: this.getStatus(accountId)
    };
  }

  /**
   * Stop farming for an account
   */
  stop(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session) {
      return { success: true, message: 'No active farm session' };
    }

    // Clear scheduled timer
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    session.isRunning = false;
    session.isPaused = false;
    session.isFarming = false;
    session.nextRun = null;

    logger.info(`Farm stopped for ${accountId}`);

    return {
      success: true,
      message: 'Farm stopped',
      status: this.getStatus(accountId)
    };
  }

  /**
   * Pause farming (keeps session but stops execution)
   */
  pause(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session || !session.isRunning) {
      return { success: false, error: 'Farm not running' };
    }

    // Clear scheduled timer
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    session.isPaused = true;
    session.nextRun = null;

    logger.info(`Farm paused for ${accountId}`);

    return {
      success: true,
      message: 'Farm paused',
      status: this.getStatus(accountId)
    };
  }

  /**
   * Resume paused farming
   */
  resume(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session) {
      return { success: false, error: 'No farm session' };
    }

    if (!session.isPaused) {
      return { success: false, error: 'Farm not paused' };
    }

    session.isPaused = false;

    // Execute farm immediately
    this.executeFarm(accountId);

    logger.info(`Farm resumed for ${accountId}`);

    return {
      success: true,
      message: 'Farm resumed',
      status: this.getStatus(accountId)
    };
  }

  /**
   * Run farm once (single execution, no loop)
   */
  farmOnce(accountId) {
    // Check if account is connected
    const account = accountState.get(accountId);
    if (!account || account.status !== 'connected') {
      logger.warn(`Cannot farm once: account not connected: ${accountId}`);
      return { success: false, error: 'Account not connected' };
    }

    // Check if master connection exists
    const masterConn = accountState.getMasterConnection(accountId);
    if (!masterConn) {
      logger.warn(`Cannot farm once: no master connection: ${accountId}`);
      return { success: false, error: 'No master tab connected' };
    }

    // Get or create session (don't start loop mode)
    let session = this.farmSessions.get(accountId);
    if (!session) {
      session = this.createSession(accountId);
    }

    // Check if already farming
    if (session.isFarming) {
      return { success: false, error: 'Already farming' };
    }

    // Generate action ID
    const actionId = `farm_once_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    session.currentActionId = actionId;
    session.isFarming = true;
    session.currentProgress = { current: 0, total: 0 };
    session.isOnceMode = true; // Flag to prevent scheduling next run

    // Send command to userscript
    const command = {
      type: 'startFarm',
      actionId: actionId,
      template: session.settings.template,
      once: true
    };

    const sent = accountState.sendToAccount(accountId, command);

    if (!sent) {
      session.isFarming = false;
      session.isOnceMode = false;
      session.lastError = 'Failed to send command - no master connection';
      logger.error(`Failed to farm once for ${accountId}: no master connection`);
      return { success: false, error: 'No master connection' };
    }

    logger.info(`Farm once command sent to ${accountId}`, { actionId, template: session.settings.template });

    return {
      success: true,
      message: 'Farm once started',
      status: this.getStatus(accountId)
    };
  }

  /**
   * Update farm settings for an account
   */
  updateSettings(accountId, settings) {
    let session = this.farmSessions.get(accountId);
    if (!session) {
      session = this.createSession(accountId);
    }

    // Update settings
    if (settings.intervalMinutes !== undefined) {
      session.settings.intervalMinutes = Math.max(5, Math.min(120, settings.intervalMinutes));
    }
    if (settings.randomDelayMinutes !== undefined) {
      session.settings.randomDelayMinutes = Math.max(0, Math.min(30, settings.randomDelayMinutes));
    }
    if (settings.template !== undefined) {
      session.settings.template = ['A', 'B', 'both'].includes(settings.template)
        ? settings.template
        : 'A';
    }
    if (settings.enabled !== undefined) {
      session.settings.enabled = Boolean(settings.enabled);
    }

    logger.info(`Farm settings updated for ${accountId}`, session.settings);

    return {
      success: true,
      settings: session.settings
    };
  }

  /**
   * Create a new farm session
   */
  createSession(accountId) {
    const session = {
      accountId,
      isRunning: false,
      isPaused: false,
      isFarming: false,
      currentProgress: null,
      lastRun: null,
      nextRun: null,
      loopCount: 0,
      totalFarmed: 0,
      lastError: null,
      startedAt: null,
      timer: null,
      currentActionId: null,
      settings: { ...this.defaultSettings }
    };

    this.farmSessions.set(accountId, session);
    return session;
  }

  /**
   * Execute farm for an account (send command to userscript)
   */
  executeFarm(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session || !session.isRunning || session.isPaused) {
      return;
    }

    // Check if already farming
    if (session.isFarming) {
      logger.warn(`Already farming for ${accountId}, skipping`);
      return;
    }

    // Generate action ID
    const actionId = `farm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    session.currentActionId = actionId;
    session.isFarming = true;
    session.currentProgress = { current: 0, total: 0 };

    // Send command to userscript
    const command = {
      type: 'startFarm',
      actionId: actionId,
      template: session.settings.template
    };

    const sent = accountState.sendToAccount(accountId, command);

    if (!sent) {
      session.isFarming = false;
      session.lastError = 'Failed to send command - no master connection';
      logger.error(`Failed to start farm for ${accountId}: no master connection`);

      // Schedule retry
      this.scheduleNextRun(accountId);
      return;
    }

    logger.info(`Farm command sent to ${accountId}`, { actionId, template: session.settings.template });
  }

  /**
   * Handle farm progress report from userscript
   */
  handleProgress(accountId, data) {
    const session = this.farmSessions.get(accountId);
    if (!session) return;

    if (data.actionId !== session.currentActionId) {
      logger.warn(`Ignoring progress for old actionId: ${data.actionId}`);
      return;
    }

    session.currentProgress = {
      current: data.current || 0,
      total: data.total || 0
    };

    logger.debug(`Farm progress for ${accountId}: ${data.current}/${data.total}`);
  }

  /**
   * Handle farm completion from userscript
   */
  handleComplete(accountId, data) {
    const session = this.farmSessions.get(accountId);
    if (!session) return;

    const wasOnceMode = session.isOnceMode;

    session.isFarming = false;
    session.isOnceMode = false; // Reset once mode flag
    session.loopCount++;
    session.lastRun = Date.now();
    session.totalFarmed += data.farmed || 0;
    session.currentProgress = null;
    session.lastError = null;
    session.lastEmptyRun = data.emptyRun || false;

    if (data.emptyRun) {
      logger.info(`Farm completed for ${accountId} (empty run - no villages)`, {
        loopCount: session.loopCount,
        wasOnceMode
      });
    } else {
      logger.info(`Farm completed for ${accountId}`, {
        farmed: data.farmed,
        duration: data.duration,
        loopCount: session.loopCount,
        totalFarmed: session.totalFarmed,
        wasOnceMode
      });
    }

    // Schedule next run only if in loop mode (not once mode) and still running
    if (!wasOnceMode && session.isRunning && !session.isPaused) {
      this.scheduleNextRun(accountId);
    }
  }

  /**
   * Handle farm error from userscript
   */
  handleError(accountId, data) {
    const session = this.farmSessions.get(accountId);
    if (!session) return;

    session.isFarming = false;
    session.lastError = data.error || 'Unknown error';

    logger.error(`Farm error for ${accountId}`, {
      error: data.error,
      message: data.message
    });

    // If bot protection detected, pause the farm
    if (data.error === 'botProtection') {
      session.isPaused = true;
      session.lastError = 'Bot protection detected! Manual action required.';

      // TODO: Send notification (Discord/Telegram)
      logger.warn(`BOT PROTECTION detected for ${accountId}! Farm paused.`);
    } else if (session.isRunning && !session.isPaused) {
      // For other errors, schedule retry with longer delay
      this.scheduleNextRun(accountId, true);
    }
  }

  /**
   * Reset a stalled farm session (timeout) but keep the loop running
   * This allows the farm to retry on the next scheduled interval
   */
  resetStalled(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session) {
      return { success: false, error: 'No farm session' };
    }

    // Reset the stuck state
    session.isFarming = false;
    session.currentProgress = null;
    session.lastError = 'Timeout - no response';

    logger.info(`Farm session reset (stalled) for ${accountId}, scheduling retry`);

    // If farm was running, schedule next run (retry mode = shorter delay)
    if (session.isRunning && !session.isPaused) {
      this.scheduleNextRun(accountId, true); // true = retry mode (2 min delay)
    }

    return {
      success: true,
      message: 'Session reset, will retry on next interval',
      status: this.getStatus(accountId)
    };
  }

  /**
   * Schedule next farm run
   */
  scheduleNextRun(accountId, isRetry = false) {
    const session = this.farmSessions.get(accountId);
    if (!session || !session.isRunning || session.isPaused) {
      return;
    }

    // Clear existing timer
    if (session.timer) {
      clearTimeout(session.timer);
    }

    // Calculate delay
    let delayMs;
    if (isRetry) {
      // Retry after 2 minutes
      delayMs = 2 * 60 * 1000;
    } else {
      // Normal interval with random delay
      const baseMs = session.settings.intervalMinutes * 60 * 1000;
      const randomRange = session.settings.randomDelayMinutes * 60 * 1000;
      const randomOffset = (Math.random() * 2 - 1) * randomRange; // -randomRange to +randomRange
      delayMs = Math.max(60000, baseMs + randomOffset); // Minimum 1 minute
    }

    session.nextRun = Date.now() + delayMs;

    session.timer = setTimeout(() => {
      this.executeFarm(accountId);
    }, delayMs);

    logger.info(`Next farm scheduled for ${accountId}`, {
      nextRun: new Date(session.nextRun).toISOString(),
      delayMinutes: Math.round(delayMs / 60000)
    });
  }

  /**
   * Handle account disconnect - pause farm
   */
  handleAccountDisconnect(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session || !session.isRunning) return;

    session.isPaused = true;
    session.isFarming = false;
    session.lastError = 'Account disconnected';

    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }

    logger.info(`Farm paused due to disconnect: ${accountId}`);
  }

  /**
   * Handle account reconnect - resume farm if was running
   */
  handleAccountReconnect(accountId) {
    const session = this.farmSessions.get(accountId);
    if (!session || !session.isRunning) return;

    if (session.isPaused && session.lastError === 'Account disconnected') {
      session.isPaused = false;
      session.lastError = null;
      this.scheduleNextRun(accountId);
      logger.info(`Farm resumed after reconnect: ${accountId}`);
    }
  }

  /**
   * Get summary statistics
   */
  getStats() {
    let running = 0;
    let paused = 0;
    let farming = 0;
    let totalFarmed = 0;

    for (const session of this.farmSessions.values()) {
      if (session.isRunning) running++;
      if (session.isPaused) paused++;
      if (session.isFarming) farming++;
      totalFarmed += session.totalFarmed;
    }

    return {
      sessions: this.farmSessions.size,
      running,
      paused,
      currentlyFarming: farming,
      totalFarmed
    };
  }
}

// Create singleton instance
const farmBot = new FarmBotService();

module.exports = { FarmBotService, farmBot };
