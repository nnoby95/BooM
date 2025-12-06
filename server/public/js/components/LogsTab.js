/**
 * LogsTab Component
 * Displays command history with filtering and pagination
 */

class LogsTab extends Component {
  constructor(containerSelector) {
    super(containerSelector);
    this.state = {
      logs: [],
      filters: {
        all: true,
        commands: true,
        errors: true,
        connection: true,
        alerts: true
      },
      selectedAccount: 'all',
      selectedDate: 'today',
      searchQuery: '',
      currentPage: 1,
      logsPerPage: 20
    };
  }

  /**
   * Add log entry
   */
  addLog(log) {
    const logs = [...this.state.logs];
    logs.unshift({
      ...log,
      timestamp: log.timestamp || Date.now(),
      id: log.id || `${Date.now()}-${Math.random()}`
    });

    // Keep last 5000 logs
    if (logs.length > 5000) {
      logs.splice(5000);
    }

    this.setState({ logs, currentPage: 1 });
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    if (confirm('Biztos törölni szeretnéd az összes naplóbejegyzést?')) {
      this.setState({ logs: [], currentPage: 1 });
    }
  }

  /**
   * Get log icon based on type
   */
  getLogIcon(type) {
    const icons = {
      success: '✅',
      command: '📤',
      connection: '🔌',
      attack: '⚔️',
      error: '❌',
      refresh: '🔄',
      build: '🏗️',
      recruit: '👥',
      support: '🛡️',
      market: '🏪',
      info: 'ℹ️'
    };
    return icons[type] || '📌';
  }

  /**
   * Get log type category
   */
  getLogCategory(type) {
    if (['success', 'command', 'build', 'recruit', 'support', 'market'].includes(type)) {
      return 'commands';
    }
    if (type === 'error') return 'errors';
    if (type === 'connection') return 'connection';
    if (type === 'attack') return 'alerts';
    return 'all';
  }

  /**
   * Filter logs based on current filters
   */
  getFilteredLogs() {
    let filtered = [...this.state.logs];

    // Filter by type
    if (!this.state.filters.all) {
      filtered = filtered.filter(log => {
        const category = this.getLogCategory(log.type);
        return this.state.filters[category];
      });
    }

    // Filter by account
    if (this.state.selectedAccount !== 'all') {
      filtered = filtered.filter(log =>
        log.accountId === this.state.selectedAccount ||
        log.accountName === this.state.selectedAccount
      );
    }

    // Filter by date
    if (this.state.selectedDate !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);

        switch (this.state.selectedDate) {
          case 'today':
            return logDate >= today;
          case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return logDate >= yesterday && logDate < today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return logDate >= weekAgo;
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.message?.toLowerCase().includes(query) ||
        log.accountName?.toLowerCase().includes(query) ||
        log.accountId?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  /**
   * Get unique account names from logs
   */
  getAccountNames() {
    const names = new Set();
    this.state.logs.forEach(log => {
      if (log.accountName) {
        names.add(log.accountName);
      }
    });
    return Array.from(names).sort();
  }

  /**
   * Toggle filter
   */
  toggleFilter(filterKey) {
    const filters = { ...this.state.filters };

    if (filterKey === 'all') {
      const newValue = !filters.all;
      filters.all = newValue;
      filters.commands = newValue;
      filters.errors = newValue;
      filters.connection = newValue;
      filters.alerts = newValue;
    } else {
      filters[filterKey] = !filters[filterKey];
      // Update "all" checkbox
      filters.all = filters.commands && filters.errors && filters.connection && filters.alerts;
    }

    this.setState({ filters, currentPage: 1 });
  }

  /**
   * Change page
   */
  changePage(page) {
    const filteredLogs = this.getFilteredLogs();
    const totalPages = Math.ceil(filteredLogs.length / this.state.logsPerPage);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    this.setState({ currentPage: page });
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return null;

    this.container.innerHTML = '';
    this.container.className = 'logs-tab';

    // Filters Section
    const filtersSection = this.createElement('div', {
      className: 'filters-section',
      style: { marginBottom: 'var(--spacing-md)' }
    });

    // Filter checkboxes
    const filterCheckboxes = this.createElement('div', {
      style: {
        display: 'flex',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-sm)',
        flexWrap: 'wrap'
      }
    });

    const filterLabels = {
      all: 'Mind',
      commands: 'Parancsok',
      errors: 'Hibák',
      connection: 'Kapcsolat',
      alerts: 'Riasztások'
    };

    Object.entries(filterLabels).forEach(([key, label]) => {
      const checkboxLabel = this.createElement('label', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'pointer',
          fontSize: '11px'
        }
      });

      const checkbox = this.createElement('input', {
        type: 'checkbox',
        checked: this.state.filters[key],
        onChange: () => this.toggleFilter(key)
      });
      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(document.createTextNode(label));

      filterCheckboxes.appendChild(checkboxLabel);
    });

    filtersSection.appendChild(filterCheckboxes);

    // Filter controls
    const filterControls = this.createElement('div', {
      style: {
        display: 'flex',
        gap: 'var(--spacing-sm)',
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    });

    // Account dropdown
    const accountLabel = this.createElement('label', {
      style: { fontSize: '11px', marginRight: '4px' }
    }, 'Fiók:');
    filterControls.appendChild(accountLabel);

    const accountSelect = this.createElement('select', {
      className: 'form-control',
      style: { width: '150px', padding: '4px', fontSize: '11px' },
      onChange: (e) => this.setState({ selectedAccount: e.target.value, currentPage: 1 })
    });

    const allOption = this.createElement('option', { value: 'all' }, 'Mind');
    accountSelect.appendChild(allOption);

    this.getAccountNames().forEach(name => {
      const option = this.createElement('option', { value: name }, name);
      accountSelect.appendChild(option);
    });

    accountSelect.value = this.state.selectedAccount;
    filterControls.appendChild(accountSelect);

    // Date dropdown
    const dateLabel = this.createElement('label', {
      style: { fontSize: '11px', marginLeft: 'var(--spacing-sm)', marginRight: '4px' }
    }, 'Dátum:');
    filterControls.appendChild(dateLabel);

    const dateSelect = this.createElement('select', {
      className: 'form-control',
      style: { width: '120px', padding: '4px', fontSize: '11px' },
      onChange: (e) => this.setState({ selectedDate: e.target.value, currentPage: 1 })
    });

    const dateOptions = [
      { value: 'today', label: 'Ma' },
      { value: 'yesterday', label: 'Tegnap' },
      { value: 'week', label: 'Elmúlt hét' },
      { value: 'all', label: 'Összes' }
    ];

    dateOptions.forEach(opt => {
      const option = this.createElement('option', { value: opt.value }, opt.label);
      dateSelect.appendChild(option);
    });

    dateSelect.value = this.state.selectedDate;
    filterControls.appendChild(dateSelect);

    // Search box
    const searchInput = this.createElement('input', {
      type: 'text',
      className: 'form-control',
      placeholder: '🔍 Keresés...',
      value: this.state.searchQuery,
      style: { width: '200px', padding: '4px 8px', fontSize: '11px', marginLeft: 'var(--spacing-sm)' },
      onInput: (e) => this.setState({ searchQuery: e.target.value, currentPage: 1 })
    });
    filterControls.appendChild(searchInput);

    // Clear button
    const clearBtn = this.createElement('button', {
      className: 'btn btn-sm btn-brown',
      onClick: () => this.clearLogs(),
      style: { marginLeft: 'auto' }
    }, '🗑️ Törlés');
    filterControls.appendChild(clearBtn);

    filtersSection.appendChild(filterControls);
    this.container.appendChild(filtersSection);

    // Logs List
    const logsList = this.createElement('div', {
      className: 'logs-list',
      style: {
        background: 'rgba(255, 255, 255, 0.5)',
        border: '1px solid var(--tw-border-light)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--spacing-md)',
        minHeight: '400px',
        maxHeight: '500px',
        overflowY: 'auto',
        marginBottom: 'var(--spacing-md)'
      }
    });

    const filteredLogs = this.getFilteredLogs();
    const totalPages = Math.ceil(filteredLogs.length / this.state.logsPerPage);
    const startIdx = (this.state.currentPage - 1) * this.state.logsPerPage;
    const endIdx = startIdx + this.state.logsPerPage;
    const pageALogs = filteredLogs.slice(startIdx, endIdx);

    if (pageALogs.length === 0) {
      const noLogs = this.createElement('div', {
        style: { textAlign: 'center', color: '#999', padding: 'var(--spacing-lg)' }
      }, 'Nincsenek naplóbejegyzések');
      logsList.appendChild(noLogs);
    } else {
      pageALogs.forEach(log => {
        const logRow = this.createLogRow(log);
        logsList.appendChild(logRow);
      });
    }

    this.container.appendChild(logsList);

    // Pagination
    const pagination = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        color: 'var(--tw-text-dark)'
      }
    });

    const totalCount = this.createElement('div', {},
      `Összesen: ${filteredLogs.length} bejegyzés`
    );
    pagination.appendChild(totalCount);

    if (totalPages > 1) {
      const pageControls = this.createElement('div', {
        style: { display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }
      });

      const prevBtn = this.createElement('button', {
        className: 'btn btn-sm btn-brown',
        disabled: this.state.currentPage === 1,
        onClick: () => this.changePage(this.state.currentPage - 1)
      }, '<');
      pageControls.appendChild(prevBtn);

      const pageInfo = this.createElement('span', {},
        `${this.state.currentPage} / ${totalPages}`
      );
      pageControls.appendChild(pageInfo);

      const nextBtn = this.createElement('button', {
        className: 'btn btn-sm btn-brown',
        disabled: this.state.currentPage === totalPages,
        onClick: () => this.changePage(this.state.currentPage + 1)
      }, '>');
      pageControls.appendChild(nextBtn);

      pagination.appendChild(pageControls);
    }

    this.container.appendChild(pagination);

    return this.container;
  }

  /**
   * Create log row
   */
  createLogRow(log) {
    const row = this.createElement('div', {
      className: 'log-row',
      style: {
        padding: 'var(--spacing-xs) 0',
        borderBottom: '1px solid var(--tw-border-light)',
        fontSize: '11px',
        color: 'var(--tw-text-dark)',
        display: 'flex',
        gap: 'var(--spacing-sm)'
      }
    });

    // Timestamp
    const time = this.createElement('span', {
      style: { color: '#666', flexShrink: 0, width: '70px' }
    }, this.formatTime(log.timestamp));
    row.appendChild(time);

    // Icon
    const icon = this.createElement('span', {
      style: { flexShrink: 0 }
    }, this.getLogIcon(log.type));
    row.appendChild(icon);

    // Account name
    if (log.accountName) {
      const accountName = this.createElement('span', {
        style: { fontWeight: 'bold', flexShrink: 0, minWidth: '120px' }
      }, log.accountName);
      row.appendChild(accountName);
    }

    // Message
    const message = this.createElement('span', {
      style: { flex: 1 }
    }, log.message || '');
    row.appendChild(message);

    return row;
  }

  /**
   * Format time as HH:MM:SS
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
}
