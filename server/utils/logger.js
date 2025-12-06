/**
 * Simple logging utility for TW Controller Server
 */

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(level = LogLevel.INFO) {
    this.level = level;
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] [${level}] ${message}`;
    return data ? `${logMsg} ${JSON.stringify(data)}` : logMsg;
  }

  debug(message, data) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  info(message, data) {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  warn(message, data) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  error(message, data) {
    if (this.level <= LogLevel.ERROR) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }
}

// Create default logger instance
const logger = new Logger(LogLevel.INFO);

module.exports = { Logger, LogLevel, logger };
