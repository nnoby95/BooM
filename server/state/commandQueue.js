/**
 * Command Queue System
 * Ensures only ONE command executes across ALL accounts at any time
 * Prevents IP correlation and coordinated action detection
 */

const { logger } = require('../utils/logger');

class CommandQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.lastExecutionTime = 0;

    // Minimum delay between ANY commands across ALL accounts
    this.MIN_GLOBAL_DELAY = 5000;  // 5 seconds minimum
    this.MAX_GLOBAL_DELAY = 15000; // 15 seconds maximum

    // Per-account cooldowns
    this.accountCooldowns = new Map(); // accountId -> lastCommandTime
    this.ACCOUNT_COOLDOWN = 30000; // 30 seconds between commands to same account
  }

  /**
   * Add command to queue with priority
   */
  enqueue(accountId, command, priority = 'normal') {
    const queueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId,
      command,
      priority, // 'high', 'normal', 'low'
      enqueuedAt: Date.now(),
      status: 'pending'
    };

    // Insert based on priority
    if (priority === 'high') {
      // Find first non-high priority item and insert before it
      const insertIndex = this.queue.findIndex(item => item.priority !== 'high');
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }
    } else {
      this.queue.push(queueItem);
    }

    logger.info(`[Queue] Command enqueued for ${accountId}`, {
      queueId: queueItem.id,
      commandType: command.type,
      priority,
      queueLength: this.queue.length
    });

    // Start processing if not already
    this.processNext();

    return queueItem.id;
  }

  /**
   * Process next command in queue with safety delays
   */
  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Find next executable command (respecting account cooldowns)
      const nextItem = this.findNextExecutable();

      if (!nextItem) {
        // All commands are in cooldown, wait and retry
        const waitTime = this.getMinCooldownRemaining();
        logger.debug(`[Queue] All accounts in cooldown, waiting ${waitTime}ms`);
        setTimeout(() => {
          this.isProcessing = false;
          this.processNext();
        }, waitTime);
        return;
      }

      // Calculate delay since last execution
      const timeSinceLastExec = Date.now() - this.lastExecutionTime;
      const requiredDelay = this.getRandomDelay();

      if (timeSinceLastExec < requiredDelay) {
        const waitTime = requiredDelay - timeSinceLastExec;
        logger.info(`[Queue] Waiting ${waitTime}ms before next command`);
        await this.sleep(waitTime);
      }

      // Execute the command
      logger.info(`[Queue] Executing command for ${nextItem.accountId}`, {
        commandType: nextItem.command.type,
        queueId: nextItem.id
      });
      nextItem.status = 'executing';

      const success = await this.executeCommand(nextItem);

      // Update tracking
      this.lastExecutionTime = Date.now();
      this.accountCooldowns.set(nextItem.accountId, Date.now());

      // Remove from queue
      this.queue = this.queue.filter(item => item.id !== nextItem.id);

      // Log result
      logger.info(`[Queue] Command ${success ? 'succeeded' : 'failed'} for ${nextItem.accountId}`, {
        queueId: nextItem.id,
        remainingInQueue: this.queue.length
      });

    } catch (error) {
      logger.error('[Queue] Error processing command', { error: error.message });
    } finally {
      this.isProcessing = false;

      // Continue processing if more items
      if (this.queue.length > 0) {
        // Add small delay before checking next
        setTimeout(() => this.processNext(), 1000);
      }
    }
  }

  /**
   * Find next command that can be executed (not in cooldown)
   */
  findNextExecutable() {
    const now = Date.now();

    for (const item of this.queue) {
      const lastCommandTime = this.accountCooldowns.get(item.accountId) || 0;
      const timeSinceLastCommand = now - lastCommandTime;

      if (timeSinceLastCommand >= this.ACCOUNT_COOLDOWN) {
        return item;
      }
    }

    return null;
  }

  /**
   * Get minimum remaining cooldown across all queued accounts
   */
  getMinCooldownRemaining() {
    const now = Date.now();
    let minRemaining = this.ACCOUNT_COOLDOWN;

    for (const item of this.queue) {
      const lastCommandTime = this.accountCooldowns.get(item.accountId) || 0;
      const remaining = this.ACCOUNT_COOLDOWN - (now - lastCommandTime);
      if (remaining < minRemaining && remaining > 0) {
        minRemaining = remaining;
      }
    }

    return Math.max(minRemaining, 1000);
  }

  /**
   * Get random delay between commands (human-like variance)
   */
  getRandomDelay() {
    return this.MIN_GLOBAL_DELAY +
           Math.random() * (this.MAX_GLOBAL_DELAY - this.MIN_GLOBAL_DELAY);
  }

  /**
   * Execute command via WebSocket
   */
  async executeCommand(queueItem) {
    const { sendToAccount } = require('../websocket');
    return sendToAccount(queueItem.accountId, queueItem.command);
  }

  /**
   * Get queue status
   */
  getStatus() {
    const now = Date.now();

    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      pendingByAccount: this.queue.reduce((acc, item) => {
        acc[item.accountId] = (acc[item.accountId] || 0) + 1;
        return acc;
      }, {}),
      accountCooldowns: Object.fromEntries(
        Array.from(this.accountCooldowns.entries()).map(([id, time]) => [
          id,
          Math.max(0, this.ACCOUNT_COOLDOWN - (now - time))
        ])
      ),
      queue: this.queue.map(item => ({
        id: item.id,
        accountId: item.accountId,
        commandType: item.command.type,
        priority: item.priority,
        enqueuedAt: item.enqueuedAt,
        waitingFor: Math.max(0, this.ACCOUNT_COOLDOWN - (now - (this.accountCooldowns.get(item.accountId) || 0)))
      }))
    };
  }

  /**
   * Cancel pending commands for an account
   */
  cancelForAccount(accountId) {
    const removed = this.queue.filter(item => item.accountId === accountId);
    this.queue = this.queue.filter(item => item.accountId !== accountId);

    logger.info(`[Queue] Cancelled ${removed.length} commands for ${accountId}`);

    return removed.length;
  }

  /**
   * Clear entire queue
   */
  clearAll() {
    const count = this.queue.length;
    this.queue = [];
    logger.warn(`[Queue] Cleared all ${count} pending commands`);
    return count;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const commandQueue = new CommandQueue();

module.exports = { commandQueue, CommandQueue };
