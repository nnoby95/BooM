/**
 * Debug Log Service
 * Stores debug logs in memory for dashboard display
 */

const MAX_LOGS = 500;

class DebugLogService {
  constructor() {
    this.logs = [];
  }

  /**
   * Add a log entry
   * @param {string} accountId - Account identifier
   * @param {string} type - Log type (farmDebug, farmProgress, farmComplete, farmError, botProtection, connect, disconnect)
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  addLog(accountId, type, message, data = {}) {
    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      accountId: accountId || 'system',
      type,
      message,
      data
    };

    this.logs.push(entry);

    // Trim to max size
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    return entry;
  }

  /**
   * Get all logs
   * @param {Object} filters - Optional filters { accountId, type, since }
   */
  getLogs(filters = {}) {
    let result = this.logs;

    if (filters.accountId) {
      result = result.filter(log => log.accountId === filters.accountId);
    }

    if (filters.type) {
      result = result.filter(log => log.type === filters.type);
    }

    if (filters.since) {
      result = result.filter(log => log.timestamp > filters.since);
    }

    return result;
  }

  /**
   * Get recent logs (last N entries)
   */
  getRecent(count = 100) {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
  }

  /**
   * Get log count
   */
  getCount() {
    return this.logs.length;
  }
}

// Singleton instance
const debugLog = new DebugLogService();

module.exports = { DebugLogService, debugLog };
