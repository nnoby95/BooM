/**
 * BulkFarmTab Component
 * Professional UI for bulk farming across multiple accounts
 * Shows real-time farm status for all accounts
 */

class BulkFarmTab extends Component {
  constructor(containerSelector) {
    super(containerSelector);
    this.state = {
      selectedAccounts: new Set(),
      settings: {
        intervalMinutes: 15,
        randomDelayMinutes: 2
      },
      operation: null,
      farmStatuses: [],        // Real-time farm status for all accounts
      farmSummary: null,       // Summary stats
      logs: [],
      isLoading: false
    };

    // Polling interval for farm status
    this.statusPollInterval = null;
    this.STATUS_POLL_MS = 3000; // Poll every 3 seconds

    // Bind methods
    this.handleStartAll = this.handleStartAll.bind(this);
    this.handleStopAll = this.handleStopAll.bind(this);
    this.handleAccountToggle = this.handleAccountToggle.bind(this);
  }

  /**
   * Initialize component
   */
  async init() {
    await this.loadStatus();
    await this.loadFarmStatuses();
    await this.loadLogs();
    this.render();

    // Start polling for farm statuses
    this.startStatusPolling();
  }

  /**
   * Start polling for real-time farm statuses
   */
  startStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
    }
    this.statusPollInterval = setInterval(() => {
      this.loadFarmStatuses();
    }, this.STATUS_POLL_MS);
  }

  /**
   * Stop polling
   */
  stopStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    this.stopStatusPolling();
    super.destroy && super.destroy();
  }

  /**
   * Load bulk farm operation status from API
   */
  async loadStatus() {
    try {
      const response = await fetch('/api/bulk-farm/status');
      const data = await response.json();
      if (data.hasOperation) {
        this.setState({ operation: data }, false);
      } else {
        this.setState({ operation: null }, false);
      }
    } catch (error) {
      console.error('Failed to load bulk farm status:', error);
    }
  }

  /**
   * Load real-time farm statuses for all accounts
   */
  async loadFarmStatuses() {
    try {
      const response = await fetch('/api/bulk-farm/farm-statuses');
      const data = await response.json();
      if (data.success) {
        const oldStatuses = JSON.stringify(this.state.farmStatuses);
        const newStatuses = JSON.stringify(data.statuses);

        // Only update if changed (to avoid unnecessary re-renders)
        if (oldStatuses !== newStatuses) {
          this.setState({
            farmStatuses: data.statuses,
            farmSummary: data.summary
          }, false);
          this.updateFarmStatusDisplay();
        }
      }
    } catch (error) {
      console.error('Failed to load farm statuses:', error);
    }
  }

  /**
   * Update just the farm status display (optimized partial render)
   */
  updateFarmStatusDisplay() {
    const container = document.getElementById('bulk-farm-status-list');
    if (container) {
      container.innerHTML = '';
      this.renderStatusItems(container);
    }

    // Update summary
    const summaryEl = document.getElementById('bulk-farm-summary');
    if (summaryEl && this.state.farmSummary) {
      summaryEl.innerHTML = this.renderSummaryHTML();
    }
  }

  /**
   * Load logs from API
   */
  async loadLogs() {
    try {
      const response = await fetch('/api/bulk-farm/logs?count=100');
      const data = await response.json();
      if (data.success) {
        this.setState({ logs: data.logs }, false);
      }
    } catch (error) {
      console.error('Failed to load bulk farm logs:', error);
    }
  }

  /**
   * Get accounts from global state
   */
  getAccounts() {
    return window.accounts || [];
  }

  /**
   * Handle WebSocket message for bulk farm
   */
  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'bulkFarmProgress':
        this.handleProgress(message);
        break;
      case 'bulkFarmComplete':
        this.handleComplete(message);
        break;
      case 'bulkFarmStopped':
        this.handleStopped(message);
        break;
      case 'bulkFarmLog':
        this.handleLog(message);
        break;
      case 'farmProgress':
      case 'farmComplete':
      case 'farmError':
        // Real-time farm events - refresh status
        this.loadFarmStatuses();
        break;
    }
  }

  handleProgress(data) {
    this.loadStatus();
    this.loadFarmStatuses();
  }

  handleComplete(data) {
    this.loadStatus();
    this.loadFarmStatuses();
  }

  handleStopped(data) {
    this.loadStatus();
    this.loadFarmStatuses();
  }

  handleLog(log) {
    const logs = [...this.state.logs, log];
    if (logs.length > 200) {
      logs.splice(0, logs.length - 200);
    }
    this.setState({ logs });
  }

  /**
   * Toggle account selection
   */
  handleAccountToggle(accountId) {
    const selected = new Set(this.state.selectedAccounts);
    if (selected.has(accountId)) {
      selected.delete(accountId);
    } else {
      selected.add(accountId);
    }
    this.setState({ selectedAccounts: selected });
  }

  /**
   * Select all connected accounts
   */
  selectAll() {
    const accounts = this.getAccounts();
    const selected = new Set();
    accounts.forEach(acc => {
      if (acc.status === 'connected') {
        selected.add(acc.accountId);
      }
    });
    this.setState({ selectedAccounts: selected });
  }

  /**
   * Deselect all accounts
   */
  deselectAll() {
    this.setState({ selectedAccounts: new Set() });
  }

  /**
   * Handle Start All button click
   */
  async handleStartAll() {
    if (this.state.selectedAccounts.size === 0) {
      alert('Valassz legalabb egy fiokot!');
      return;
    }

    const accountIds = Array.from(this.state.selectedAccounts);
    this.setState({ isLoading: true });

    try {
      const response = await fetch('/api/bulk-farm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountIds,
          settings: this.state.settings,
          options: {
            staggerMin: 10,
            staggerMax: 15,
            randomizeMin: 1,
            randomizeMax: 3
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('Bulk farm started:', result);
        await this.loadStatus();
        await this.loadFarmStatuses();
      } else {
        alert('Hiba: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to start bulk farm:', error);
      alert('Hiba tortent a bulk farm inditasakor!');
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Handle Stop All button click
   */
  async handleStopAll() {
    this.setState({ isLoading: true });

    try {
      const response = await fetch('/api/bulk-farm/stop-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        console.log('Bulk farm stopped:', result);
        await this.loadStatus();
        await this.loadFarmStatuses();
      } else {
        alert('Hiba: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to stop bulk farm:', error);
      alert('Hiba tortent a bulk farm megallitasakor!');
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Update setting value
   */
  updateSetting(key, value) {
    const settings = { ...this.state.settings, [key]: value };
    this.setState({ settings });
  }

  /**
   * Format timestamp for log
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Format time remaining until next run
   */
  formatTimeRemaining(nextRun) {
    if (!nextRun) return '-';
    const now = Date.now();
    const diff = nextRun - now;
    if (diff <= 0) return 'most...';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}p ${seconds}mp`;
    }
    return `${seconds}mp`;
  }

  /**
   * Get farm state info for an account
   */
  getFarmStateInfo(status) {
    if (status.isFarming) {
      const progress = status.currentProgress;
      if (progress && progress.total > 0) {
        return {
          state: 'farming',
          icon: '🚜',
          text: 'Farmol',
          detail: `${progress.current}/${progress.total}`,
          class: 'farming'
        };
      }
      return {
        state: 'farming',
        icon: '🚜',
        text: 'Farmol',
        detail: 'Folyamatban...',
        class: 'farming'
      };
    }

    if (status.isPaused) {
      return {
        state: 'paused',
        icon: '⏸️',
        text: 'Szuneteltetve',
        detail: status.lastError || '-',
        class: 'paused'
      };
    }

    if (status.isRunning) {
      return {
        state: 'loop',
        icon: '🔄',
        text: 'Loop aktiv',
        detail: this.formatTimeRemaining(status.nextRun),
        class: 'loop'
      };
    }

    return {
      state: 'idle',
      icon: '⏹️',
      text: 'Inaktiv',
      detail: '-',
      class: 'idle'
    };
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return null;

    this.container.innerHTML = '';
    this.container.className = 'bulk-farm-tab';

    const wrapper = this.createElement('div', { className: 'bulk-farm-container' });

    // Left Column - Accounts & Settings
    const leftCol = this.createElement('div', { className: 'bulk-farm-left-column' });
    leftCol.appendChild(this.renderAccountsCard());
    leftCol.appendChild(this.renderSettingsCard());
    wrapper.appendChild(leftCol);

    // Right Column - Farm Status (real-time)
    const rightCol = this.createElement('div', { className: 'bulk-farm-right-column' });
    rightCol.appendChild(this.renderFarmStatusCard());
    rightCol.appendChild(this.renderActions());
    wrapper.appendChild(rightCol);

    // Log Section (full width)
    wrapper.appendChild(this.renderLogCard());

    this.container.appendChild(wrapper);
    return this.container;
  }

  /**
   * Render accounts card
   */
  renderAccountsCard() {
    const card = this.createElement('div', { className: 'bulk-farm-card bulk-farm-accounts-card' });

    // Header
    const header = this.createElement('div', { className: 'bulk-farm-card-header' });
    header.appendChild(this.createElement('div', { className: 'bulk-farm-card-title' }, 'Fiokok'));
    card.appendChild(header);

    // Body
    const body = this.createElement('div', { className: 'bulk-farm-card-body' });

    // Select controls
    const controls = this.createElement('div', { className: 'bulk-farm-select-controls' });

    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'bulk-farm-select-btn';
    selectAllBtn.textContent = 'Mind Kijelol';
    selectAllBtn.addEventListener('click', () => this.selectAll());
    controls.appendChild(selectAllBtn);

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.className = 'bulk-farm-select-btn';
    deselectAllBtn.textContent = 'Mind Torol';
    deselectAllBtn.addEventListener('click', () => this.deselectAll());
    controls.appendChild(deselectAllBtn);

    body.appendChild(controls);

    // Account list
    const list = this.createElement('div', { className: 'bulk-farm-account-list' });
    const accounts = this.getAccounts();

    if (accounts.length === 0) {
      list.appendChild(this.createElement('div', {
        style: { padding: '30px', textAlign: 'center', color: '#8B7355', fontStyle: 'italic' }
      }, 'Nincs csatlakozott fiok'));
    } else {
      accounts.forEach(account => {
        const isConnected = account.status === 'connected';
        const isSelected = this.state.selectedAccounts.has(account.accountId);

        // Get real-time farm status for this account
        const farmStatus = this.state.farmStatuses.find(s => s.accountId === account.accountId);
        const isFarming = farmStatus && farmStatus.isFarming;
        const isLoop = farmStatus && farmStatus.isRunning && !farmStatus.isPaused;

        const item = this.createElement('div', {
          className: `bulk-farm-account-item ${isSelected ? 'selected' : ''} ${!isConnected ? 'disabled' : ''}`,
          onClick: () => isConnected && this.handleAccountToggle(account.accountId)
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'bulk-farm-account-checkbox';
        checkbox.checked = isSelected;
        checkbox.disabled = !isConnected;
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        checkbox.addEventListener('change', () => this.handleAccountToggle(account.accountId));
        item.appendChild(checkbox);

        const name = this.createElement('span', { className: 'bulk-farm-account-name' }, account.accountId);
        item.appendChild(name);

        let statusClass = isConnected ? 'connected' : 'disconnected';
        let statusText = isConnected ? 'Online' : 'Offline';
        if (isFarming) {
          statusClass = 'farming';
          statusText = '🚜 Farmol';
        } else if (isLoop) {
          statusClass = 'loop';
          statusText = '🔄 Loop';
        }

        const status = this.createElement('span', {
          className: `bulk-farm-account-status ${statusClass}`
        }, statusText);
        item.appendChild(status);

        list.appendChild(item);
      });
    }

    body.appendChild(list);

    // Selected count
    const connectedCount = accounts.filter(a => a.status === 'connected').length;
    const selectedCount = this.createElement('div', { className: 'bulk-farm-selected-count' });
    selectedCount.innerHTML = `<strong>${this.state.selectedAccounts.size}</strong> / ${connectedCount} fiok kijelolve`;
    body.appendChild(selectedCount);

    card.appendChild(body);
    return card;
  }

  /**
   * Render settings card
   */
  renderSettingsCard() {
    const card = this.createElement('div', { className: 'bulk-farm-card bulk-farm-settings-card' });

    // Header
    const header = this.createElement('div', { className: 'bulk-farm-card-header' });
    header.appendChild(this.createElement('div', { className: 'bulk-farm-card-title' }, 'Beallitasok'));
    card.appendChild(header);

    // Body
    const body = this.createElement('div', { className: 'bulk-farm-card-body' });

    const grid = this.createElement('div', { className: 'bulk-farm-settings-grid' });

    // Interval setting
    const intervalGroup = this.createElement('div', { className: 'bulk-farm-setting-group' });
    intervalGroup.appendChild(this.createElement('label', {}, 'Ismetles'));

    const intervalWrapper = this.createElement('div', { className: 'bulk-farm-input-wrapper' });
    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.className = 'bulk-farm-input';
    intervalInput.value = this.state.settings.intervalMinutes;
    intervalInput.min = 5;
    intervalInput.max = 120;
    intervalInput.addEventListener('change', (e) => this.updateSetting('intervalMinutes', parseInt(e.target.value) || 15));
    intervalWrapper.appendChild(intervalInput);
    intervalWrapper.appendChild(this.createElement('span', { className: 'bulk-farm-input-suffix' }, 'perc'));
    intervalGroup.appendChild(intervalWrapper);
    grid.appendChild(intervalGroup);

    // Delay setting
    const delayGroup = this.createElement('div', { className: 'bulk-farm-setting-group' });
    delayGroup.appendChild(this.createElement('label', {}, 'Kesleltetes'));

    const delayWrapper = this.createElement('div', { className: 'bulk-farm-input-wrapper' });
    delayWrapper.appendChild(this.createElement('span', { className: 'bulk-farm-input-prefix' }, '+-'));
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.className = 'bulk-farm-input';
    delayInput.value = this.state.settings.randomDelayMinutes;
    delayInput.min = 0;
    delayInput.max = 30;
    delayInput.addEventListener('change', (e) => this.updateSetting('randomDelayMinutes', parseInt(e.target.value) || 2));
    delayWrapper.appendChild(delayInput);
    delayWrapper.appendChild(this.createElement('span', { className: 'bulk-farm-input-suffix' }, 'perc'));
    delayGroup.appendChild(delayWrapper);
    grid.appendChild(delayGroup);

    body.appendChild(grid);

    // Info
    const info = this.createElement('div', { className: 'bulk-farm-settings-info' });
    info.innerHTML = 'Minden fiok egyedi beallitast kap automatikus elteresekkel (+-1-3 perc) a felderites elkerulese erdekeben.';
    body.appendChild(info);

    card.appendChild(body);
    return card;
  }

  /**
   * Generate summary HTML
   */
  renderSummaryHTML() {
    const summary = this.state.farmSummary || { total: 0, running: 0, farming: 0, paused: 0, idle: 0 };
    return `
      <div class="bulk-farm-summary-item farming">
        <span class="bulk-farm-summary-icon">🚜</span>
        <span class="bulk-farm-summary-value">${summary.farming}</span>
        <span class="bulk-farm-summary-label">Farmol</span>
      </div>
      <div class="bulk-farm-summary-item loop">
        <span class="bulk-farm-summary-icon">🔄</span>
        <span class="bulk-farm-summary-value">${summary.running}</span>
        <span class="bulk-farm-summary-label">Loop</span>
      </div>
      <div class="bulk-farm-summary-item paused">
        <span class="bulk-farm-summary-icon">⏸️</span>
        <span class="bulk-farm-summary-value">${summary.paused}</span>
        <span class="bulk-farm-summary-label">Szunet</span>
      </div>
      <div class="bulk-farm-summary-item idle">
        <span class="bulk-farm-summary-icon">⏹️</span>
        <span class="bulk-farm-summary-value">${summary.idle}</span>
        <span class="bulk-farm-summary-label">Inaktiv</span>
      </div>
    `;
  }

  /**
   * Render status items into container
   */
  renderStatusItems(container) {
    const statuses = this.state.farmStatuses || [];

    if (statuses.length === 0) {
      const empty = this.createElement('div', { className: 'bulk-farm-status-empty' });
      empty.innerHTML = '<div class="bulk-farm-idle-icon">🚜</div><div>Nincs csatlakozott fiok</div>';
      container.appendChild(empty);
      return;
    }

    statuses.forEach(status => {
      const stateInfo = this.getFarmStateInfo(status);

      const row = this.createElement('div', {
        className: `bulk-farm-status-row ${stateInfo.class}`
      });

      // Icon
      const iconEl = this.createElement('span', { className: 'bulk-farm-status-icon' }, stateInfo.icon);
      row.appendChild(iconEl);

      // Account name
      const nameEl = this.createElement('span', { className: 'bulk-farm-status-name' }, status.playerName);
      row.appendChild(nameEl);

      // State text
      const stateEl = this.createElement('span', { className: 'bulk-farm-status-state' }, stateInfo.text);
      row.appendChild(stateEl);

      // Detail (progress or next run time)
      const detailEl = this.createElement('span', { className: 'bulk-farm-status-detail' }, stateInfo.detail);
      row.appendChild(detailEl);

      // Stats (if has farmed)
      if (status.totalFarmed > 0) {
        const statsEl = this.createElement('span', {
          className: 'bulk-farm-status-stats',
          title: `Loop: ${status.loopCount}x, Farmolva: ${status.totalFarmed}`
        }, `#${status.loopCount}`);
        row.appendChild(statsEl);
      }

      container.appendChild(row);
    });
  }

  /**
   * Render real-time farm status card
   */
  renderFarmStatusCard() {
    const card = this.createElement('div', { className: 'bulk-farm-card bulk-farm-status-card' });

    // Header
    const header = this.createElement('div', { className: 'bulk-farm-card-header' });
    header.appendChild(this.createElement('div', { className: 'bulk-farm-card-title' }, 'Farm Statusz'));

    // Live indicator
    const liveIndicator = this.createElement('div', { className: 'bulk-farm-live-indicator' });
    liveIndicator.innerHTML = '<span class="bulk-farm-live-dot"></span> Elo';
    header.appendChild(liveIndicator);

    card.appendChild(header);

    // Body
    const body = this.createElement('div', { className: 'bulk-farm-card-body' });

    // Summary row
    const summary = this.createElement('div', {
      id: 'bulk-farm-summary',
      className: 'bulk-farm-summary'
    });
    summary.innerHTML = this.renderSummaryHTML();
    body.appendChild(summary);

    // Status list
    const statusList = this.createElement('div', {
      id: 'bulk-farm-status-list',
      className: 'bulk-farm-status-list'
    });
    this.renderStatusItems(statusList);
    body.appendChild(statusList);

    card.appendChild(body);
    return card;
  }

  /**
   * Render action buttons
   */
  renderActions() {
    const section = this.createElement('div', { className: 'bulk-farm-actions' });

    const summary = this.state.farmSummary || { running: 0 };
    const hasRunning = summary.running > 0 || summary.farming > 0;

    const startBtn = document.createElement('button');
    startBtn.className = 'bulk-farm-btn bulk-farm-btn-start';
    startBtn.textContent = 'Inditas';
    startBtn.disabled = this.state.isLoading || this.state.selectedAccounts.size === 0;
    startBtn.addEventListener('click', this.handleStartAll);
    section.appendChild(startBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'bulk-farm-btn bulk-farm-btn-stop';
    stopBtn.textContent = 'Leallitas';
    stopBtn.disabled = this.state.isLoading || !hasRunning;
    stopBtn.addEventListener('click', this.handleStopAll);
    section.appendChild(stopBtn);

    return section;
  }

  /**
   * Render log card
   */
  renderLogCard() {
    const card = this.createElement('div', { className: 'bulk-farm-card bulk-farm-log-card' });

    // Header
    const header = this.createElement('div', { className: 'bulk-farm-card-header' });
    header.appendChild(this.createElement('div', { className: 'bulk-farm-card-title' }, 'Esemenynaplo'));
    card.appendChild(header);

    // Body
    const body = this.createElement('div', { className: 'bulk-farm-card-body' });

    const logContainer = this.createElement('div', { className: 'bulk-farm-log-container' });

    if (this.state.logs.length === 0) {
      logContainer.appendChild(this.createElement('div', { className: 'bulk-farm-log-empty' }, 'Nincsenek esemenyek'));
    } else {
      this.state.logs.slice(-50).forEach(log => {
        const row = this.createElement('div', { className: 'bulk-farm-log-row' });
        row.innerHTML = `
          <span class="bulk-farm-log-time">${this.formatTime(log.timestamp)}</span>
          <span class="bulk-farm-log-type ${log.type}">${log.type.toUpperCase()}</span>
          <span class="bulk-farm-log-account">${log.accountId || '-'}</span>
          <span class="bulk-farm-log-message">${log.message}</span>
        `;
        logContainer.appendChild(row);
      });

      // Auto-scroll to bottom
      setTimeout(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      }, 10);
    }

    body.appendChild(logContainer);
    card.appendChild(body);
    return card;
  }
}
