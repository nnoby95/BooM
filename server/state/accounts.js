/**
 * In-memory state management for connected accounts
 * Stores account data and WebSocket connections
 * Supports multiple tabs per account with master/standby system
 */

const { logger } = require('../utils/logger');

class AccountState {
  constructor() {
    // Map: accountId -> { connections[], data, lastUpdate }
    this.accounts = new Map();
  }

  /**
   * Register a new account connection
   * Supports multiple tabs per account - first tab is master, others are standby
   * wasMaster flag: if true, this tab was master before page navigation and should reclaim master status
   */
  register(accountId, ws, registrationData) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const wasMaster = registrationData.wasMaster || false;
    const connectionInfo = {
      ws,
      sessionId,
      isMaster: false,
      connectedAt: Date.now()
    };

    let account = this.accounts.get(accountId);

    if (account) {
      // Account exists - add new connection
      // Clean up any dead connections first
      account.connections = account.connections.filter(conn =>
        conn.ws && conn.ws.readyState === 1 // OPEN = 1
      );

      // Check if there's a master
      const currentMaster = account.connections.find(conn => conn.isMaster);

      // If this tab was master before navigation, reclaim master status
      if (wasMaster) {
        if (currentMaster) {
          // Demote current master
          currentMaster.isMaster = false;
          logger.info(`Demoting current master for wasMaster reconnect: ${accountId}`, {
            demotedSession: currentMaster.sessionId
          });

          // Notify demoted master
          try {
            currentMaster.ws.send(JSON.stringify({
              type: 'masterStatusChanged',
              isMaster: false,
              reason: 'Previous master tab reconnected after navigation'
            }));
          } catch (err) {
            logger.error('Failed to notify demoted master', { error: err.message });
          }
        }

        // This connection becomes master
        connectionInfo.isMaster = true;
        logger.info(`Reconnecting tab reclaimed MASTER status (wasMaster=true): ${accountId}`, { sessionId });
      } else if (!currentMaster) {
        // No master exists - this connection becomes master
        connectionInfo.isMaster = true;
        logger.info(`New connection promoted to MASTER (no existing master): ${accountId}`, { sessionId });
      } else {
        logger.info(`New connection added as STANDBY: ${accountId}`, { sessionId });
      }

      account.connections.push(connectionInfo);
      account.lastUpdate = Date.now();
      account.status = 'connected';

      // Update village data if provided
      if (registrationData.villageId) {
        account.data.villageId = registrationData.villageId;
        account.data.villageName = registrationData.villageName;
        account.data.coords = registrationData.coords;
      }
    } else {
      // New account - first connection is always master
      connectionInfo.isMaster = true;

      account = {
        accountId,
        connections: [connectionInfo],
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
          recruitmentQueue: {},
          effects: null,
          statistics: null
        }
      };

      this.accounts.set(accountId, account);
      logger.info(`Account registered as MASTER: ${accountId}`, {
        world: registrationData.world,
        village: registrationData.villageName,
        sessionId
      });
    }

    return { sessionId, isMaster: connectionInfo.isMaster };
  }

  /**
   * Get connection info by session ID
   */
  getConnectionBySession(accountId, sessionId) {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    return account.connections.find(conn => conn.sessionId === sessionId);
  }

  /**
   * Get the master connection for an account
   */
  getMasterConnection(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    return account.connections.find(conn => conn.isMaster && conn.ws && conn.ws.readyState === 1);
  }

  /**
   * Get all connections for an account
   */
  getConnections(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) return [];
    return account.connections.filter(conn => conn.ws && conn.ws.readyState === 1);
  }

  /**
   * Disconnect a specific session and handle master promotion
   */
  disconnectSession(accountId, sessionId) {
    const account = this.accounts.get(accountId);
    if (!account) return;

    const disconnectedConn = account.connections.find(conn => conn.sessionId === sessionId);
    const wasMaster = disconnectedConn?.isMaster;

    // Remove the disconnected connection
    account.connections = account.connections.filter(conn => conn.sessionId !== sessionId);

    logger.info(`Session disconnected: ${sessionId}`, { accountId, wasMaster });

    // If master disconnected, promote oldest standby
    if (wasMaster && account.connections.length > 0) {
      // Find active connections
      const activeConnections = account.connections.filter(conn =>
        conn.ws && conn.ws.readyState === 1
      );

      if (activeConnections.length > 0) {
        // Sort by connectedAt (oldest first) and promote
        activeConnections.sort((a, b) => a.connectedAt - b.connectedAt);
        const newMaster = activeConnections[0];
        newMaster.isMaster = true;

        logger.info(`Promoted standby to MASTER: ${accountId}`, {
          newMasterSessionId: newMaster.sessionId
        });

        // Notify the new master
        try {
          newMaster.ws.send(JSON.stringify({
            type: 'masterStatusChanged',
            isMaster: true,
            reason: 'Previous master disconnected'
          }));
        } catch (err) {
          logger.error('Failed to notify new master', { error: err.message });
        }
      }
    }

    // Update account status
    if (account.connections.length === 0) {
      account.status = 'disconnected';
      logger.info(`All connections closed for account: ${accountId}`);
    }
  }

  /**
   * Manually promote a specific session to master (user requested)
   * Demotes current master to standby
   */
  promoteMaster(accountId, sessionId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      logger.warn(`Cannot promote master: account not found: ${accountId}`);
      return { success: false, error: 'Account not found' };
    }

    // Find the session to promote
    const sessionToPromote = account.connections.find(conn => conn.sessionId === sessionId);
    if (!sessionToPromote) {
      logger.warn(`Cannot promote master: session not found: ${sessionId}`);
      return { success: false, error: 'Session not found' };
    }

    // Already master?
    if (sessionToPromote.isMaster) {
      logger.info(`Session ${sessionId} is already master`);
      return { success: true, alreadyMaster: true };
    }

    // Find current master and demote
    const currentMaster = account.connections.find(conn => conn.isMaster);
    if (currentMaster) {
      currentMaster.isMaster = false;
      logger.info(`Demoted previous master: ${currentMaster.sessionId}`);

      // Notify demoted master
      try {
        currentMaster.ws.send(JSON.stringify({
          type: 'masterStatusChanged',
          isMaster: false,
          reason: 'Another tab requested master status'
        }));
      } catch (err) {
        logger.error('Failed to notify demoted master', { error: err.message });
      }
    }

    // Promote the new master
    sessionToPromote.isMaster = true;
    logger.info(`Promoted session to MASTER: ${sessionId}`, { accountId });

    // Notify new master
    try {
      sessionToPromote.ws.send(JSON.stringify({
        type: 'masterStatusChanged',
        isMaster: true,
        reason: 'User requested via UI'
      }));
    } catch (err) {
      logger.error('Failed to notify new master', { error: err.message });
    }

    return { success: true, newMasterSessionId: sessionId };
  }

  /**
   * Update account data from report
   * Only updates fields that have non-null values (preserves existing data)
   */
  updateData(accountId, reportData) {
    const account = this.accounts.get(accountId);
    if (!account) {
      logger.warn(`Attempted to update non-existent account: ${accountId}`);
      return false;
    }

    // Merge data, preserving existing values when new value is null
    for (const [key, value] of Object.entries(reportData)) {
      if (value !== null && value !== undefined) {
        account.data[key] = value;
      }
    }
    account.lastUpdate = Date.now();
    account.status = 'connected';

    logger.debug(`Account data updated: ${accountId}`);
    return true;
  }

  /**
   * Mark account as disconnected (disconnects all connections)
   */
  disconnect(accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.status = 'disconnected';
      account.connections = [];
      logger.info(`Account disconnected (all connections): ${accountId}`);
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
    return Array.from(this.accounts.values()).map(account => {
      // Get active connections info
      const activeConnections = account.connections.filter(conn =>
        conn.ws && conn.ws.readyState === 1
      );
      const masterConn = activeConnections.find(conn => conn.isMaster);

      return {
        accountId: account.accountId,
        sessionId: masterConn?.sessionId || null,
        status: account.status,
        lastUpdate: account.lastUpdate,
        registeredAt: account.registeredAt,
        data: account.data,
        // New multi-tab info
        connectionCount: activeConnections.length,
        connections: activeConnections.map(conn => ({
          sessionId: conn.sessionId,
          isMaster: conn.isMaster,
          connectedAt: conn.connectedAt
        }))
      };
    });
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
   * Send message to specific account (master connection only)
   */
  sendToAccount(accountId, message) {
    const masterConn = this.getMasterConnection(accountId);
    if (!masterConn) {
      logger.warn(`Cannot send message to account ${accountId}: no master connection`);
      return false;
    }

    try {
      masterConn.ws.send(JSON.stringify(message));
      logger.debug(`Message sent to ${accountId} (master)`, { type: message.type });
      return true;
    } catch (error) {
      logger.error(`Failed to send message to ${accountId}`, { error: error.message });
      return false;
    }
  }

  /**
   * Send message to all connections of an account
   */
  broadcastToAccount(accountId, message) {
    const connections = this.getConnections(accountId);
    if (connections.length === 0) {
      logger.warn(`Cannot broadcast to account ${accountId}: no connections`);
      return false;
    }

    let sent = 0;
    const msgStr = JSON.stringify(message);

    for (const conn of connections) {
      try {
        conn.ws.send(msgStr);
        sent++;
      } catch (error) {
        logger.error(`Failed to send to session ${conn.sessionId}`, { error: error.message });
      }
    }

    logger.debug(`Broadcast to ${accountId}`, { type: message.type, sentTo: sent, total: connections.length });
    return sent > 0;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const all = this.accounts.size;
    const connected = this.getConnected().length;
    const disconnected = all - connected;

    // Count total connections across all accounts
    let totalConnections = 0;
    let masterConnections = 0;
    let standbyConnections = 0;

    for (const account of this.accounts.values()) {
      const activeConns = account.connections.filter(conn =>
        conn.ws && conn.ws.readyState === 1
      );
      totalConnections += activeConns.length;
      masterConnections += activeConns.filter(c => c.isMaster).length;
      standbyConnections += activeConns.filter(c => !c.isMaster).length;
    }

    return {
      total: all,
      connected,
      disconnected,
      totalConnections,
      masterConnections,
      standbyConnections,
      accounts: this.getAll().map(acc => ({
        accountId: acc.accountId,
        status: acc.status,
        lastUpdate: acc.lastUpdate,
        world: acc.data.world,
        village: acc.data.villageName,
        connectionCount: acc.connectionCount,
        connections: acc.connections
      }))
    };
  }
}

// Create singleton instance
const accountState = new AccountState();

module.exports = { AccountState, accountState };
