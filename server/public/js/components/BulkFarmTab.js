/**
 * BulkFarmTab Component
 * Professional UI for bulk farming across multiple accounts
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
      logs: [],
      isLoading: false
    };

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
    await this.loadLogs();
    this.render();
  }

  /**
   * Load bulk farm status from API
   */
  async loadStatus() {
    try {
      const response = await fetch('/api/bulk-farm/status');
      const data = await response.json();
      if (data.hasOperation) {
        this.setState({ operation: data });
      }
    } catch (error) {
      console.error('Failed to load bulk farm status:', error);
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
        this.setState({ logs: data.logs });
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
    }
  }

  handleProgress(data) {
    this.loadStatus();
  }

  handleComplete(data) {
    this.loadStatus();
  }

  handleStopped(data) {
    this.loadStatus();
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

    // Right Column - Progress & Actions
    const rightCol = this.createElement('div', { className: 'bulk-farm-right-column' });
    rightCol.appendChild(this.renderProgressCard());
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
        const isFarming = account.farmStatus && account.farmStatus.isRunning;

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
          statusText = 'Farmol';
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
   * Render progress card
   */
  renderProgressCard() {
    const op = this.state.operation;
    const hasOp = op && op.hasOperation;
    const statusClass = hasOp ? (op.status === 'running' ? 'running' : op.status === 'complete' ? 'complete' : '') : '';

    const card = this.createElement('div', { className: `bulk-farm-card bulk-farm-progress-card ${statusClass}` });

    // Header
    const header = this.createElement('div', { className: 'bulk-farm-card-header' });
    header.appendChild(this.createElement('div', { className: 'bulk-farm-card-title' }, 'Statusz'));

    if (hasOp) {
      const statusText = op.status === 'running' ? 'Fut' :
                         op.status === 'complete' ? 'Kesz' :
                         op.status === 'stopped' ? 'Leallitva' : 'Varakozik';
      const badge = this.createElement('div', {
        className: `bulk-farm-status-badge ${op.status === 'running' ? 'running' : ''}`
      }, statusText);
      header.appendChild(badge);
    }
    card.appendChild(header);

    // Body
    const body = this.createElement('div', { className: 'bulk-farm-card-body' });

    if (!hasOp) {
      // Idle state
      const idle = this.createElement('div', { className: 'bulk-farm-idle-state' });
      idle.innerHTML = `
        <div class="bulk-farm-idle-icon">🚜</div>
        <div class="bulk-farm-idle-text">Nincs aktiv muvelet</div>
        <div class="bulk-farm-idle-hint">Valaszd ki a fiokokat es kattints az "Inditas" gombra</div>
      `;
      body.appendChild(idle);
    } else {
      const progress = op.progress || { total: 0, started: 0, failed: 0, remaining: 0 };
      const done = progress.started + progress.failed;
      const percent = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;

      // Progress bar
      const barContainer = this.createElement('div', { className: 'bulk-farm-progress-bar-container' });
      const bar = this.createElement('div', { className: 'bulk-farm-progress-bar' });
      const fill = this.createElement('div', {
        className: 'bulk-farm-progress-fill',
        style: { width: `${Math.max(percent, 8)}%` }
      });
      const text = this.createElement('span', { className: 'bulk-farm-progress-text' }, `${done} / ${progress.total}`);
      fill.appendChild(text);
      bar.appendChild(fill);
      barContainer.appendChild(bar);
      body.appendChild(barContainer);

      // Stats row
      const statsRow = this.createElement('div', { className: 'bulk-farm-stats-row' });

      const startedStat = this.createElement('div', { className: 'bulk-farm-stat' });
      startedStat.innerHTML = `
        <div class="bulk-farm-stat-value success">${progress.started}</div>
        <div class="bulk-farm-stat-label">Elinditva</div>
      `;
      statsRow.appendChild(startedStat);

      const failedStat = this.createElement('div', { className: 'bulk-farm-stat' });
      failedStat.innerHTML = `
        <div class="bulk-farm-stat-value error">${progress.failed}</div>
        <div class="bulk-farm-stat-label">Sikertelen</div>
      `;
      statsRow.appendChild(failedStat);

      const remainingStat = this.createElement('div', { className: 'bulk-farm-stat' });
      remainingStat.innerHTML = `
        <div class="bulk-farm-stat-value pending">${progress.remaining}</div>
        <div class="bulk-farm-stat-label">Varakozik</div>
      `;
      statsRow.appendChild(remainingStat);

      body.appendChild(statsRow);

      // Status list
      if ((op.started && op.started.length > 0) || (op.failed && op.failed.length > 0) || (op.queue && op.queue.length > 0)) {
        const statusList = this.createElement('div', { className: 'bulk-farm-status-list' });

        (op.started || []).forEach(item => {
          const row = this.createElement('div', { className: 'bulk-farm-status-item' });
          row.innerHTML = `
            <span class="bulk-farm-status-icon success">✓</span>
            <span class="bulk-farm-status-account">${item.accountId}</span>
            <span class="bulk-farm-status-info">${item.settings.intervalMinutes}p, +-${item.settings.randomDelayMinutes}p</span>
          `;
          statusList.appendChild(row);
        });

        (op.failed || []).forEach(item => {
          const row = this.createElement('div', { className: 'bulk-farm-status-item' });
          row.innerHTML = `
            <span class="bulk-farm-status-icon error">✗</span>
            <span class="bulk-farm-status-account">${item.accountId}</span>
            <span class="bulk-farm-status-info">${item.error}</span>
          `;
          statusList.appendChild(row);
        });

        (op.queue || []).forEach(accountId => {
          const row = this.createElement('div', { className: 'bulk-farm-status-item' });
          row.innerHTML = `
            <span class="bulk-farm-status-icon queued">⏳</span>
            <span class="bulk-farm-status-account">${accountId}</span>
            <span class="bulk-farm-status-info">Varakozik...</span>
          `;
          statusList.appendChild(row);
        });

        body.appendChild(statusList);
      }
    }

    card.appendChild(body);
    return card;
  }

  /**
   * Render action buttons
   */
  renderActions() {
    const section = this.createElement('div', { className: 'bulk-farm-actions' });

    const isRunning = this.state.operation && this.state.operation.status === 'running';

    const startBtn = document.createElement('button');
    startBtn.className = 'bulk-farm-btn bulk-farm-btn-start';
    startBtn.textContent = 'Inditas';
    startBtn.disabled = this.state.isLoading || isRunning || this.state.selectedAccounts.size === 0;
    startBtn.addEventListener('click', this.handleStartAll);
    section.appendChild(startBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'bulk-farm-btn bulk-farm-btn-stop';
    stopBtn.textContent = 'Leallitas';
    stopBtn.disabled = this.state.isLoading || !isRunning;
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
