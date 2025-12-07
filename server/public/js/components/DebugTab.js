/**
 * DebugTab Component
 * Real-time debug log viewer for all connected accounts
 */

class DebugTab extends Component {
  constructor(containerSelector) {
    super(containerSelector);
    this.state = {
      logs: [],
      selectedAccount: 'all',
      selectedType: 'all',
      autoScroll: true,
      isLoading: false
    };
    this.logTypes = ['all', 'farmDebug', 'farmProgress', 'farmComplete', 'farmError', 'botProtection', 'connect', 'disconnect'];
  }

  /**
   * Initialize component - load initial logs
   */
  async init() {
    await this.loadLogs();
    this.render();
  }

  /**
   * Load logs from API
   */
  async loadLogs() {
    this.setState({ isLoading: true });
    try {
      const response = await fetch('/api/debug/logs?count=200');
      const data = await response.json();
      if (data.success) {
        this.setState({ logs: data.logs, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load debug logs:', error);
      this.setState({ isLoading: false });
    }
  }

  /**
   * Add log entry (called from WebSocket handler)
   */
  addLog(log) {
    const logs = [...this.state.logs, {
      id: log.id || `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: log.timestamp || Date.now(),
      accountId: log.accountId || 'system',
      type: log.type || 'info',
      message: log.message || '',
      data: log.data || {}
    }];

    // Keep last 500 logs in memory
    if (logs.length > 500) {
      logs.splice(0, logs.length - 500);
    }

    this.setState({ logs });

    // Auto-scroll if enabled
    if (this.state.autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Scroll log container to bottom
   */
  scrollToBottom() {
    setTimeout(() => {
      const logContainer = this.container?.querySelector('.debug-log-container');
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }, 50);
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    if (!confirm('Biztosan t\u00F6r\u00F6lni szeretn\u00E9d az \u00F6sszes debug logot?')) return;

    try {
      await fetch('/api/debug/logs', { method: 'DELETE' });
      this.setState({ logs: [] });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  /**
   * Get filtered logs
   */
  getFilteredLogs() {
    let filtered = [...this.state.logs];

    if (this.state.selectedAccount !== 'all') {
      filtered = filtered.filter(log => log.accountId === this.state.selectedAccount);
    }

    if (this.state.selectedType !== 'all') {
      filtered = filtered.filter(log => log.type === this.state.selectedType);
    }

    return filtered;
  }

  /**
   * Get unique account IDs from logs
   */
  getAccountIds() {
    const ids = new Set();
    this.state.logs.forEach(log => {
      if (log.accountId && log.accountId !== 'system') {
        ids.add(log.accountId);
      }
    });
    return Array.from(ids).sort();
  }

  /**
   * Get log type color
   */
  getTypeColor(type) {
    const colors = {
      farmDebug: '#2196F3',      // Blue
      farmProgress: '#4CAF50',   // Green
      farmComplete: '#388E3C',   // Dark Green
      farmError: '#f44336',      // Red
      botProtection: '#FF9800',  // Orange
      connect: '#9E9E9E',        // Gray
      disconnect: '#757575'      // Dark Gray
    };
    return colors[type] || '#333';
  }

  /**
   * Get log type label
   */
  getTypeLabel(type) {
    const labels = {
      farmDebug: 'DEBUG',
      farmProgress: 'PROGRESS',
      farmComplete: 'COMPLETE',
      farmError: 'ERROR',
      botProtection: 'BOT PROT',
      connect: 'CONNECT',
      disconnect: 'DISCONNECT'
    };
    return labels[type] || type.toUpperCase();
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return null;

    this.container.innerHTML = '';
    this.container.className = 'debug-tab';

    // Header with title and controls
    const header = this.createElement('div', {
      className: 'debug-header',
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        padding: '8px 12px',
        background: 'linear-gradient(to bottom, rgba(101, 67, 33, 0.1), transparent)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--tw-border-light)'
      }
    });

    // Title
    const title = this.createElement('h3', {
      style: { margin: 0, fontSize: '14px', color: 'var(--tw-text-dark)' }
    }, 'Debug Log');
    header.appendChild(title);

    // Controls
    const controls = this.createElement('div', {
      style: { display: 'flex', gap: '12px', alignItems: 'center' }
    });

    // Account filter
    const accountSelect = this.createElement('select', {
      className: 'debug-filter-select',
      onChange: (e) => this.setState({ selectedAccount: e.target.value })
    });
    accountSelect.appendChild(this.createElement('option', { value: 'all' }, 'Minden fi\u00F3k'));
    this.getAccountIds().forEach(id => {
      accountSelect.appendChild(this.createElement('option', { value: id }, id));
    });
    accountSelect.value = this.state.selectedAccount;
    controls.appendChild(accountSelect);

    // Type filter
    const typeSelect = this.createElement('select', {
      className: 'debug-filter-select',
      onChange: (e) => this.setState({ selectedType: e.target.value })
    });
    this.logTypes.forEach(type => {
      const label = type === 'all' ? 'Minden t\u00EDpus' : this.getTypeLabel(type);
      typeSelect.appendChild(this.createElement('option', { value: type }, label));
    });
    typeSelect.value = this.state.selectedType;
    controls.appendChild(typeSelect);

    // Auto-scroll toggle
    const autoScrollLabel = this.createElement('label', {
      style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }
    });
    const autoScrollCheckbox = this.createElement('input', {
      type: 'checkbox',
      checked: this.state.autoScroll,
      onChange: (e) => this.setState({ autoScroll: e.target.checked })
    });
    autoScrollLabel.appendChild(autoScrollCheckbox);
    autoScrollLabel.appendChild(document.createTextNode('Auto-scroll'));
    controls.appendChild(autoScrollLabel);

    // Clear button
    const clearBtn = this.createElement('button', {
      className: 'debug-clear-btn',
      onClick: () => this.clearLogs()
    }, 'T\u00F6rl\u00E9s');
    controls.appendChild(clearBtn);

    // Refresh button
    const refreshBtn = this.createElement('button', {
      className: 'debug-refresh-btn',
      onClick: () => this.loadLogs()
    }, 'Friss\u00EDt\u00E9s');
    controls.appendChild(refreshBtn);

    header.appendChild(controls);
    this.container.appendChild(header);

    // Log container
    const logContainer = this.createElement('div', {
      className: 'debug-log-container'
    });

    const filteredLogs = this.getFilteredLogs();

    if (this.state.isLoading) {
      logContainer.appendChild(this.createElement('div', {
        className: 'debug-loading'
      }, 'Bet\u00F6lt\u00E9s...'));
    } else if (filteredLogs.length === 0) {
      logContainer.appendChild(this.createElement('div', {
        className: 'debug-empty'
      }, 'Nincs megjelen\u00EDthet\u0151 log'));
    } else {
      filteredLogs.forEach(log => {
        logContainer.appendChild(this.createLogRow(log));
      });
    }

    this.container.appendChild(logContainer);

    // Footer with stats
    const footer = this.createElement('div', {
      className: 'debug-footer'
    });
    footer.appendChild(this.createElement('span', {},
      `\u00D6sszesen: ${filteredLogs.length} / ${this.state.logs.length} bejegyz\u00E9s`
    ));
    this.container.appendChild(footer);

    // Auto-scroll if enabled
    if (this.state.autoScroll) {
      this.scrollToBottom();
    }

    return this.container;
  }

  /**
   * Create a log row
   */
  createLogRow(log) {
    const row = this.createElement('div', {
      className: 'debug-log-row'
    });

    // Timestamp
    row.appendChild(this.createElement('span', {
      className: 'debug-log-time'
    }, this.formatTime(log.timestamp)));

    // Type badge
    const typeBadge = this.createElement('span', {
      className: 'debug-log-type',
      style: {
        background: this.getTypeColor(log.type),
        color: 'white'
      }
    }, this.getTypeLabel(log.type));
    row.appendChild(typeBadge);

    // Account ID
    row.appendChild(this.createElement('span', {
      className: 'debug-log-account'
    }, log.accountId || '-'));

    // Message
    row.appendChild(this.createElement('span', {
      className: 'debug-log-message'
    }, log.message || ''));

    // Data (if exists and not empty)
    if (log.data && Object.keys(log.data).length > 0) {
      const dataStr = JSON.stringify(log.data);
      if (dataStr !== '{}') {
        row.appendChild(this.createElement('span', {
          className: 'debug-log-data',
          title: dataStr
        }, dataStr.length > 50 ? dataStr.substring(0, 50) + '...' : dataStr));
      }
    }

    return row;
  }
}
