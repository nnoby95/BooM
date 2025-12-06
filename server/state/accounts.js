/**
 * In-memory state management for connected accounts
 * Stores account data and WebSocket connections
 */

const { logger } = require('../utils/logger');

class AccountState {
  constructor() {
    // Map: accountId -> { connection, data, lastUpdate }
    this.accounts = new Map();
  }

  /**
   * Register a new account connection
   */
  register(accountId, ws, registrationData) {
    const account = {
      accountId,
      connection: ws,
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      registeredAt: Date.now(),
      lastUpdate: Date.now(),
      status: 'connected',
      data: {
        world: registrationData.world,
        villageId: registrationData.villageId,
        villageName: registrationData.villageName,
        coords: registrationData.coords,
        playerName: registrationData.playerName,
        resources: null,
        buildings: null,
        troops: null,
        incomings: [],
        outgoings: [],
        buildingQueue: [],
        recruitmentQueue: {}
      }
    };

    this.accounts.set(accountId, account);
    logger.info(`Account registered: ${accountId}`, {
      world: registrationData.world,
      village: registrationData.villageName,
      sessionId: account.sessionId
    });

    return account.sessionId;
  }

  /**
   * Update account data from report
   */
  updateData(accountId, reportData) {
    const account = this.accounts.get(accountId);
    if (!account) {
      logger.warn(`Attempted to update non-existent account: ${accountId}`);
      return false;
    }

    account.data = {
      ...account.data,
      ...reportData
    };
    account.lastUpdate = Date.now();
    account.status = 'connected';

    logger.debug(`Account data updated: ${accountId}`);
    return true;
  }

  /**
   * Mark account as disconnected
   */
  disconnect(accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.status = 'disconnected';
      account.connection = null;
      logger.info(`Account disconnected: ${accountId}`);
    }
  }

  /**
   * Remove account completely
   */
  remove(accountId) {
    const removed = this.accounts.delete(accountId);
    if (removed) {
      logger.info(`Account removed: ${accountId}`);
    }
    return removed;
  }

  /**
   * Get account by ID
   */
  get(accountId) {
    return this.accounts.get(accountId);
  }

  /**
   * Get all accounts
   */
  getAll() {
    return Array.from(this.accounts.values()).map(account => ({
      accountId: account.accountId,
      sessionId: account.sessionId,
      status: account.status,
      lastUpdate: account.lastUpdate,
      registeredAt: account.registeredAt,
      data: account.data
    }));
  }

  /**
   * Get all connected accounts
   */
  getConnected() {
    return this.getAll().filter(acc => acc.status === 'connected');
  }

  /**
   * Get all incoming attacks across all accounts
   */
  getAllIncomings() {
    const incomings = [];
    for (const account of this.accounts.values()) {
      if (account.data.incomings && account.data.incomings.length > 0) {
        account.data.incomings.forEach(incoming => {
          incomings.push({
            ...incoming,
            accountId: account.accountId,
            villageId: account.data.villageId,
            villageName: account.data.villageName,
            coords: account.data.coords
          });
        });
      }
    }
    // Sort by arrival time (soonest first)
    return incomings.sort((a, b) => a.arrivalTime - b.arrivalTime);
  }

  /**
   * Add alert for incoming command
   */
  addAlert(accountId, alert) {
    const account = this.accounts.get(accountId);
    if (!account) {
      logger.warn(`Cannot add alert for non-existent account: ${accountId}`);
      return false;
    }

    // Initialize incomings array if needed
    if (!account.data.incomings) {
      account.data.incomings = [];
    }

    // Check if alert already exists
    const exists = account.data.incomings.some(
      inc => inc.commandId === alert.commandId
    );

    if (!exists) {
      account.data.incomings.push(alert);
      logger.info(`Alert added for ${accountId}`, {
        commandId: alert.commandId,
        arrivalTime: new Date(alert.arrivalTime).toISOString()
      });

      // Auto-remove alert after arrival time + 5 minutes
      const cleanupDelay = Math.max(0, alert.arrivalTime - Date.now() + 300000);
      setTimeout(() => {
        this.removeAlert(accountId, alert.commandId);
      }, cleanupDelay);
    }

    return true;
  }

  /**
   * Remove alert by command ID
   */
  removeAlert(accountId, commandId) {
    const account = this.accounts.get(accountId);
    if (!account || !account.data.incomings) {
      return false;
    }

    const before = account.data.incomings.length;
    account.data.incomings = account.data.incomings.filter(
      inc => inc.commandId !== commandId
    );
    const removed = before - account.data.incomings.length;

    if (removed > 0) {
      logger.debug(`Removed ${removed} alert(s) for ${accountId}`, { commandId });
    }

    return removed > 0;
  }

  /**
   * Send message to specific account
   */
  sendToAccount(accountId, message) {
    const account = this.accounts.get(accountId);
    if (!account || !account.connection || account.status !== 'connected') {
      logger.warn(`Cannot send message to account ${accountId}: not connected`);
      return false;
    }

    try {
      account.connection.send(JSON.stringify(message));
      logger.debug(`Message sent to ${accountId}`, { type: message.type });
      return true;
    } catch (error) {
      logger.error(`Failed to send message to ${accountId}`, { error: error.message });
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const all = this.accounts.size;
    const connected = this.getConnected().length;
    const disconnected = all - connected;

    return {
      total: all,
      connected,
      disconnected,
      accounts: this.getAll().map(acc => ({
        accountId: acc.accountId,
        status: acc.status,
        lastUpdate: acc.lastUpdate,
        world: acc.data.world,
        village: acc.data.villageName
      }))
    };
  }
}

// Create singleton instance
const accountState = new AccountState();

module.exports = { AccountState, accountState };
