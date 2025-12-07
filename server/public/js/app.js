/**
 * TW Controller Dashboard - Main JavaScript
 */

// State
let accounts = [];
let alerts = [];
let queueStatus = {};
let dashboardWs = null;
let reconnectInterval = null;
let alertSound = null;
let buildingTemplates = [];
let recruitmentTemplates = [];

// Component instances
let detailPanel = null;
let accountCards = new Map(); // Map of accountId -> AccountCard instance
let alertsTab = null;
let logsTab = null;
let settingsTab = null;
let debugTab = null;

// Initialize dashboard
async function init() {
  updateConnectionStatus('connecting');

  // Initialize DetailPanel component
  detailPanel = new DetailPanel('#detail-panel-container');

  // Initialize tab components
  alertsTab = new AlertsTab('#alerts-tab-container');
  logsTab = new LogsTab('#logs-tab-container');
  settingsTab = new SettingsTab('#settings-tab-container');
  debugTab = new DebugTab('#debug-tab-container');

  // Initial render of tabs
  alertsTab.render();
  logsTab.render();
  settingsTab.render();
  debugTab.init();

  // Setup feature navigation
  setupFeatureNav();

  // Setup tab switching (legacy)
  setupTabs();

  // Setup command buttons
  setupCommandButtons();

  // Initialize alert sound
  initAlertSound();

  // Connect to WebSocket for real-time updates
  connectDashboardWebSocket();

  // Load initial data
  await loadAccounts();
  await loadAlerts();
  await loadQueueStatus();
  await loadTemplates();

  // Refresh data periodically (fallback)
  setInterval(async () => {
    await loadAccounts();
    await loadAlerts();
    await loadQueueStatus();
  }, 5000); // Every 5 seconds

  // Update alert countdowns every second
  setInterval(updateAlertCountdowns, 1000);

  // Make components globally accessible
  window.detailPanel = detailPanel;
  window.alertsTab = alertsTab;
  window.logsTab = logsTab;
  window.settingsTab = settingsTab;
  window.debugTab = debugTab;
  window.accounts = accounts;
  window.addLog = addLog;
}

/**
 * Setup tab switching
 * Note: Tab navigation has been removed - functionality is in DetailPanel
 */
function setupTabs() {
  // Tab navigation has been removed from main dashboard
  // Account-specific operations are now in the DetailPanel sidebar
}

/**
 * Setup command button event listeners
 * Note: Many buttons removed from main dashboard - functionality is in DetailPanel
 */
function setupCommandButtons() {
  // These buttons have been removed from main dashboard
  // Functionality is now in DetailPanel sidebar
}

/**
 * Setup feature navigation bar
 * Handles clicking feature boxes and switching content
 */
function setupFeatureNav() {
  const featureBoxes = document.querySelectorAll('.feature-box');
  const featureContents = document.querySelectorAll('.feature-content');

  featureBoxes.forEach(box => {
    box.addEventListener('click', () => {
      // Skip disabled boxes
      if (box.classList.contains('disabled')) {
        return;
      }

      const featureId = box.dataset.feature;

      // Update active state on boxes
      featureBoxes.forEach(b => b.classList.remove('active'));
      box.classList.add('active');

      // Show corresponding content
      featureContents.forEach(content => {
        content.classList.remove('active');
      });

      // Find and show the target content
      const targetContent = document.getElementById(`feature-${featureId}`);
      if (targetContent) {
        targetContent.classList.add('active');
      } else {
        // Show placeholder for future features
        const placeholder = document.getElementById('feature-placeholder');
        if (placeholder) {
          placeholder.classList.add('active');
        }
      }
    });
  });
}

/**
 * Load accounts from API
 */
async function loadAccounts() {
  try {
    const response = await fetch('/api/accounts');
    const data = await response.json();

    if (data.success) {
      accounts = data.accounts;
      renderAccounts();
      populateAccountSelectors();
      updateConnectionStatus('connected');
      document.getElementById('account-count').textContent = `${data.count} fiók`;

      // Update alerts tab with account data
      if (alertsTab) {
        alertsTab.update(accounts);
      }
    }
  } catch (error) {
    console.error('Failed to load accounts:', error);
    updateConnectionStatus('disconnected');
  }
}

/**
 * Load alerts from API
 */
async function loadAlerts() {
  try {
    const response = await fetch('/api/alerts');
    const data = await response.json();

    if (data.success) {
      alerts = data.incomings;
      renderAlerts();
    }
  } catch (error) {
    console.error('Failed to load alerts:', error);
  }
}

/**
 * Load queue status
 */
async function loadQueueStatus() {
  try {
    const response = await fetch('/api/commands/queue/status');
    queueStatus = await response.json();
    renderQueueStatus();
  } catch (error) {
    console.error('Failed to load queue status:', error);
  }
}

/**
 * Populate account selectors in all tabs
 */
function populateAccountSelectors() {
  const selectors = [
    document.getElementById('send-account'),
    document.getElementById('build-account'),
    document.getElementById('recruit-account'),
    document.getElementById('bulk-attack-accounts')
  ];

  selectors.forEach((selector, index) => {
    if (!selector) return;

    // For bulk selector (multi-select)
    if (index === 3) {
      selector.innerHTML = accounts.map(account => {
        const isConnected = account.status === 'connected';
        return `<option value="${account.accountId}" ${!isConnected ? 'disabled' : ''}>
          ${account.accountId} ${!isConnected ? '(Disconnected)' : ''}
        </option>`;
      }).join('');
    } else {
      // For single selectors
      selector.innerHTML = '<option value="">Válassz fiókot...</option>' +
        accounts.map(account => {
          const isConnected = account.status === 'connected';
          return `<option value="${account.accountId}" ${!isConnected ? 'disabled' : ''}>
            ${account.accountId} ${!isConnected ? '(Disconnected)' : ''}
          </option>`;
        }).join('');
    }
  });

  // Also update template account selectors if they exist
  if (buildingTemplates.length > 0 || recruitmentTemplates.length > 0) {
    populateTemplateSelectors();
  }
}

/**
 * Render accounts list using AccountCard components
 */
function renderAccounts() {
  const accountsGrid = document.getElementById('accounts-grid');

  if (accounts.length === 0) {
    accountsGrid.innerHTML = '<p class="no-data">Nincs csatlakozott fiók</p>';
    accountCards.clear();
    return;
  }

  // Clear grid
  accountsGrid.innerHTML = '';

  // Create or update account cards
  accounts.forEach(account => {
    let card = accountCards.get(account.accountId);

    if (card) {
      // Update existing card
      card.update(account);
      accountsGrid.appendChild(card.getElement());
    } else {
      // Create new card
      card = new AccountCard(
        account,
        handleAccountCardClick,
        handleFavoriteToggle
      );
      accountCards.set(account.accountId, card);
      accountsGrid.appendChild(card.render());
    }
  });
}

/**
 * Handle account card click - open detail panel
 */
function handleAccountCardClick(accountData) {
  if (detailPanel) {
    detailPanel.open(accountData);
  }
}

/**
 * Handle favorite toggle
 */
function handleFavoriteToggle(accountId) {
  // TODO: Implement favorite toggle (save to localStorage or backend)
  console.log('Toggle favorite for:', accountId);

  // Update local state
  const account = accounts.find(acc => acc.accountId === accountId);
  if (account) {
    account.favorite = !account.favorite;
    renderAccounts();
  }
}

/**
 * Render alerts list
 */
function renderAlerts() {
  const alertsList = document.getElementById('alerts-list');

  if (alerts.length === 0) {
    alertsList.innerHTML = '<p class="no-data">Nincs bejövő támadás</p>';
    return;
  }

  alertsList.innerHTML = alerts.map(alert => {
    const timeUntil = formatTimeUntil(alert.arrivalTime);

    return `
      <div class="alert-item">
        <div class="alert-info">
          <div class="alert-target">
            Támadás erre: ${alert.accountId} (${alert.villageName})
          </div>
          <div class="alert-source">
            Innen: ${alert.originCoords} - ${alert.originVillage || 'Ismeretlen'}
          </div>
        </div>
        <div class="alert-time">${timeUntil}</div>
      </div>
    `;
  }).join('');
}

/**
 * Render queue status
 * Note: Queue UI elements have been removed from main dashboard
 */
function renderQueueStatus() {
  // Queue display has been removed from main dashboard
  // This function is kept for potential future use
}

/**
 * Get command label in Hungarian
 */
function getCommandLabel(commandType) {
  const labels = {
    'sendTroops': '📤 Csapatok Küldése',
    'buildBuilding': '🏗️ Építés',
    'recruitTroops': '👥 Toborzás'
  };
  return labels[commandType] || commandType;
}

/**
 * Send troops command
 */
async function sendTroops() {
  const accountId = document.getElementById('send-account').value;
  const targetCoords = document.getElementById('send-coords').value;
  const sendType = document.getElementById('send-type').value;

  if (!accountId) {
    alert('Válassz egy fiókot!');
    return;
  }

  if (!targetCoords || !/^\d+\|\d+$/.test(targetCoords)) {
    alert('Érvényes koordinátákat adj meg (pl. 500|500)!');
    return;
  }

  // Collect troops
  const troops = {};
  const troopTypes = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'snob'];

  troopTypes.forEach(type => {
    const count = parseInt(document.getElementById(`troop-${type}`).value) || 0;
    if (count > 0) {
      troops[type] = count;
    }
  });

  if (Object.keys(troops).length === 0) {
    alert('Add meg legalább egy egység számát!');
    return;
  }

  try {
    const response = await fetch('/api/commands/send-troops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        targetCoords,
        troops,
        sendType
      })
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ Parancs várólistára került!\n\nVárólista pozíció: ${result.queuePosition}/${result.queueLength}\nParancs ID: ${result.actionId}`);
      await loadQueueStatus();
    } else {
      alert(`❌ Hiba: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending troops:', error);
    alert('Hiba történt a parancs küldése során!');
  }
}

/**
 * Build building command
 */
async function buildBuilding() {
  const accountId = document.getElementById('build-account').value;
  const building = document.getElementById('build-building').value;
  const levels = parseInt(document.getElementById('build-levels').value) || 1;

  if (!accountId) {
    alert('Válassz egy fiókot!');
    return;
  }

  try {
    const response = await fetch('/api/commands/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        building,
        levels
      })
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ Építés parancs várólistára került!\n\nVárólista pozíció: ${result.queuePosition}\nParancs ID: ${result.actionId}`);
      await loadQueueStatus();
    } else {
      alert(`❌ Hiba: ${result.error}`);
    }
  } catch (error) {
    console.error('Error building:', error);
    alert('Hiba történt az építés parancs küldése során!');
  }
}

/**
 * Recruit troops command
 */
async function recruitTroops() {
  const accountId = document.getElementById('recruit-account').value;
  const building = document.getElementById('recruit-building').value;

  if (!accountId) {
    alert('Válassz egy fiókot!');
    return;
  }

  // Collect units
  const units = {};
  const troopTypes = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'snob'];

  troopTypes.forEach(type => {
    const count = parseInt(document.getElementById(`recruit-${type}`).value) || 0;
    if (count > 0) {
      units[type] = count;
    }
  });

  if (Object.keys(units).length === 0) {
    alert('Add meg legalább egy egység számát!');
    return;
  }

  try {
    const response = await fetch('/api/commands/recruit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        building,
        units
      })
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ Toborzás parancs várólistára került!\n\nVárólista pozíció: ${result.queuePosition}\nParancs ID: ${result.actionId}`);
      await loadQueueStatus();
    } else {
      alert(`❌ Hiba: ${result.error}`);
    }
  } catch (error) {
    console.error('Error recruiting:', error);
    alert('Hiba történt a toborzás parancs küldése során!');
  }
}

/**
 * Bulk attack command
 */
async function bulkAttack() {
  const targetCoords = document.getElementById('bulk-attack-coords').value;
  const troopCount = parseInt(document.getElementById('bulk-attack-count').value) || 100;
  const selectedAccounts = Array.from(document.getElementById('bulk-attack-accounts').selectedOptions).map(opt => opt.value);

  if (!targetCoords || !/^\d+\|\d+$/.test(targetCoords)) {
    alert('Érvényes koordinátákat adj meg (pl. 500|500)!');
    return;
  }

  if (selectedAccounts.length === 0) {
    alert('Válassz legalább egy fiókot!');
    return;
  }

  if (!confirm(`⚠️ Tömeges támadás indítása:\n\n${selectedAccounts.length} fiók\nCél: ${targetCoords}\nCsapatok: ${troopCount} egység típusonként\n\nBiztos vagy benne?`)) {
    return;
  }

  // Send attack command for each selected account
  let queued = 0;
  const troops = { axe: troopCount }; // Default to axemen

  for (const accountId of selectedAccounts) {
    try {
      const response = await fetch('/api/commands/send-troops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          targetCoords,
          troops,
          sendType: 'attack'
        })
      });

      const result = await response.json();
      if (result.success) {
        queued++;
      }
    } catch (error) {
      console.error(`Error sending attack from ${accountId}:`, error);
    }
  }

  alert(`✅ Tömeges támadás várólistára került!\n\n${queued}/${selectedAccounts.length} parancs sikeresen hozzáadva a várólistához.\n\nA parancsok automatikusan végrehajtásra kerülnek 5-15 mp késleltetéssel egymás között.`);
  await loadQueueStatus();
}

/**
 * Clear queue
 */
async function clearQueue() {
  if (!confirm('⚠️ Biztosan törölni akarod az összes várakozó parancsot?')) {
    return;
  }

  try {
    const response = await fetch('/api/commands/queue', {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      alert(`✅ ${result.cleared} parancs törölve a várólistáról!`);
      await loadQueueStatus();
    }
  } catch (error) {
    console.error('Error clearing queue:', error);
    alert('Hiba történt a várólista törlése során!');
  }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connection-status');
  statusEl.className = status;

  switch (status) {
    case 'connected':
      statusEl.textContent = '✅ Csatlakozva';
      break;
    case 'connecting':
      statusEl.textContent = '🔄 Csatlakozás...';
      break;
    case 'disconnected':
      statusEl.textContent = '❌ Lecsatlakozva';
      break;
  }
}

/**
 * Format timestamp to relative time
 */
function formatTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}mp`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}p`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}ó`;
  return `${Math.floor(seconds / 86400)}n`;
}

/**
 * Format time until arrival
 */
function formatTimeUntil(timestamp) {
  const seconds = Math.floor((timestamp - Date.now()) / 1000);

  if (seconds < 0) return 'Megérkezett';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format number with thousands separator
 */
function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Initialize alert sound
 */
function initAlertSound() {
  // Create AudioContext for alert sound
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();

    alertSound = {
      context: audioContext,
      play: function() {
        // Create beep sound
        const oscillator = this.context.createOscillator();
        const gainNode = this.context.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.context.destination);

        oscillator.frequency.value = 800; // Frequency in Hz
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.5);

        oscillator.start(this.context.currentTime);
        oscillator.stop(this.context.currentTime + 0.5);
      }
    };
  } catch (error) {
    console.error('Failed to initialize alert sound:', error);
    alertSound = { play: () => {} }; // Fallback no-op
  }
}

/**
 * Connect to WebSocket for real-time dashboard updates
 */
function connectDashboardWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  console.log('[Dashboard] Connecting to WebSocket:', wsUrl);

  try {
    dashboardWs = new WebSocket(wsUrl);

    dashboardWs.onopen = () => {
      console.log('[Dashboard] WebSocket connected');
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    };

    dashboardWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleDashboardMessage(message);
      } catch (error) {
        console.error('[Dashboard] Failed to parse message:', error);
      }
    };

    dashboardWs.onclose = () => {
      console.log('[Dashboard] WebSocket disconnected');
      dashboardWs = null;

      // Attempt reconnection
      if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
          console.log('[Dashboard] Attempting to reconnect...');
          connectDashboardWebSocket();
        }, 5000);
      }
    };

    dashboardWs.onerror = (error) => {
      console.error('[Dashboard] WebSocket error:', error);
    };
  } catch (error) {
    console.error('[Dashboard] Failed to create WebSocket:', error);
  }
}

/**
 * Handle incoming dashboard WebSocket messages
 */
function handleDashboardMessage(message) {
  console.log('[Dashboard] Received message:', message);

  if (message.type === 'dashboardEvent') {
    const { eventType, data } = message;

    switch (eventType) {
      case 'newAlert':
        handleNewAlert(data);
        break;

      case 'resourceUpdate':
        handleResourceUpdate(data);
        break;

      default:
        console.log('[Dashboard] Unknown event type:', eventType);
        break;
    }
  }

  // Handle debug log messages
  if (['farmDebug', 'farmProgress', 'farmComplete', 'farmError', 'botProtection'].includes(message.type)) {
    if (debugTab) {
      debugTab.addLog({
        accountId: message.accountId,
        type: message.type,
        message: message.message,
        data: message.data || {},
        timestamp: message.timestamp || Date.now()
      });
    }
  }
}

/**
 * Handle new alert from WebSocket
 */
function handleNewAlert(alert) {
  console.log('[Dashboard] 🚨 NEW ALERT:', alert);

  // Add to alerts array if not already present
  const exists = alerts.some(a => a.alertId === alert.alertId);
  if (!exists) {
    alerts.push(alert);

    // Play alert sound
    if (alertSound) {
      alertSound.play();
    }

    // Flash page title
    flashPageTitle('🚨 TÁMADÁS!');

    // Show browser notification if permitted
    showBrowserNotification(alert);

    // Re-render alerts immediately
    renderAlerts();
  }
}

/**
 * Flash page title to get user attention
 */
function flashPageTitle(alertText) {
  const originalTitle = document.title;
  let flashing = true;
  let count = 0;

  const flashInterval = setInterval(() => {
    document.title = flashing ? alertText : originalTitle;
    flashing = !flashing;
    count++;

    if (count >= 20) { // Flash 10 times
      clearInterval(flashInterval);
      document.title = originalTitle;
    }
  }, 1000);
}

/**
 * Show browser notification
 */
function showBrowserNotification(alert) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🚨 Bejövő Támadás!', {
      body: `${alert.accountId}\nTámadás érkezik innen: ${alert.originCoords}\nÉrkezés: ${new Date(alert.arrivalTime).toLocaleString('hu-HU')}`,
      icon: '/favicon.ico',
      tag: alert.alertId,
      requireInteraction: true
    });
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Update alert countdowns
 */
function updateAlertCountdowns() {
  const alertElements = document.querySelectorAll('.alert-time');
  alertElements.forEach((el, index) => {
    if (alerts[index]) {
      const timeUntil = formatTimeUntil(alerts[index].arrivalTime);
      el.textContent = timeUntil;
    }
  });
}

/**
 * Handle resource update from WebSocket
 */
function handleResourceUpdate(data) {
  // Find account and update resources
  const account = accounts.find(acc => acc.accountId === data.accountId);
  if (account && account.data.resources) {
    account.data.resources.wood = data.wood;
    account.data.resources.clay = data.clay;
    account.data.resources.iron = data.iron;
    account.data.resources.population = {
      used: data.population,
      max: data.populationMax
    };

    // Update account card if it exists
    const card = accountCards.get(account.accountId);
    if (card) {
      card.update(account);
    }

    // Update detail panel if this account is currently open
    if (detailPanel && detailPanel.currentAccount && detailPanel.currentAccount.accountId === account.accountId) {
      detailPanel.open(account);
    }

    // Update alerts tab
    if (alertsTab) {
      alertsTab.update(accounts);
    }
  }
}

/**
 * Load templates via WebSocket
 */
async function loadTemplates() {
  return new Promise((resolve) => {
    if (!dashboardWs || dashboardWs.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not ready, cannot load templates');
      resolve();
      return;
    }

    // Set up one-time listener for templates response
    const handleTemplates = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'templates') {
        buildingTemplates = message.templates.building || [];
        recruitmentTemplates = message.templates.recruitment || [];
        populateTemplateSelectors();
        dashboardWs.removeEventListener('message', handleTemplates);
        resolve();
      }
    };

    dashboardWs.addEventListener('message', handleTemplates);

    // Request templates
    dashboardWs.send(JSON.stringify({
      type: 'getTemplates',
      templateType: 'all'
    }));

    // Timeout after 5 seconds
    setTimeout(() => {
      dashboardWs.removeEventListener('message', handleTemplates);
      resolve();
    }, 5000);
  });
}

/**
 * Populate template select dropdowns
 */
function populateTemplateSelectors() {
  // Populate building template selector
  const buildTemplateSelect = document.getElementById('bulk-build-template');
  if (buildTemplateSelect) {
    buildTemplateSelect.innerHTML = '<option value="">Válassz sablont...</option>' +
      buildingTemplates.map(template => {
        return `<option value="${template.id}">${template.name} (${template.totalSteps} lépés)</option>`;
      }).join('');
  }

  // Populate recruitment template selector
  const recruitTemplateSelect = document.getElementById('bulk-recruit-template');
  if (recruitTemplateSelect) {
    recruitTemplateSelect.innerHTML = '<option value="">Válassz sablont...</option>' +
      recruitmentTemplates.map(template => {
        return `<option value="${template.id}">${template.name} (${template.type})</option>`;
      }).join('');
  }

  // Also populate account selectors in bulk operations
  const bulkBuildAccounts = document.getElementById('bulk-build-accounts');
  const bulkRecruitAccounts = document.getElementById('bulk-recruit-accounts');

  if (bulkBuildAccounts) {
    bulkBuildAccounts.innerHTML = accounts.map(account => {
      const isConnected = account.status === 'connected';
      return `<option value="${account.accountId}" ${!isConnected ? 'disabled' : ''}>
        ${account.accountId} ${!isConnected ? '(Disconnected)' : ''}
      </option>`;
    }).join('');
  }

  if (bulkRecruitAccounts) {
    bulkRecruitAccounts.innerHTML = accounts.map(account => {
      const isConnected = account.status === 'connected';
      return `<option value="${account.accountId}" ${!isConnected ? 'disabled' : ''}>
        ${account.accountId} ${!isConnected ? '(Disconnected)' : ''}
      </option>`;
    }).join('');
  }
}

/**
 * Bulk execute building template
 */
async function bulkBuildTemplate() {
  const templateId = document.getElementById('bulk-build-template').value;
  const maxOps = parseInt(document.getElementById('bulk-build-max-ops').value);
  const autoStorage = document.getElementById('bulk-build-auto-storage').checked;
  const autoFarm = document.getElementById('bulk-build-auto-farm').checked;
  const accountSelect = document.getElementById('bulk-build-accounts');
  const selectedAccounts = Array.from(accountSelect.selectedOptions).map(opt => opt.value);

  if (!templateId) {
    alert('Válassz egy sablont!');
    return;
  }

  if (selectedAccounts.length === 0) {
    alert('Válassz legalább egy fiókot!');
    return;
  }

  const template = buildingTemplates.find(t => t.id === templateId);
  if (!template) {
    alert('Sablon nem található!');
    return;
  }

  if (!confirm(`Biztos, hogy végrehajtod a "${template.name}" sablont ${selectedAccounts.length} fiókon?`)) {
    return;
  }

  // Execute template on each account via WebSocket
  for (const accountId of selectedAccounts) {
    if (dashboardWs && dashboardWs.readyState === WebSocket.OPEN) {
      dashboardWs.send(JSON.stringify({
        type: 'executeTemplate',
        accountId,
        templateId,
        options: {
          maxOperations: maxOps,
          autoStorage,
          autoFarm
        }
      }));
    }
  }

  alert(`Építési sablon elindítva ${selectedAccounts.length} fiókon!`);
}

/**
 * Bulk execute recruitment template
 */
async function bulkRecruitTemplate() {
  const templateId = document.getElementById('bulk-recruit-template').value;
  const accountSelect = document.getElementById('bulk-recruit-accounts');
  const selectedAccounts = Array.from(accountSelect.selectedOptions).map(opt => opt.value);

  if (!templateId) {
    alert('Válassz egy sablont!');
    return;
  }

  if (selectedAccounts.length === 0) {
    alert('Válassz legalább egy fiókot!');
    return;
  }

  const template = recruitmentTemplates.find(t => t.id === templateId);
  if (!template) {
    alert('Sablon nem található!');
    return;
  }

  if (!confirm(`Biztos, hogy végrehajtod a "${template.name}" toborzási sablont ${selectedAccounts.length} fiókon?`)) {
    return;
  }

  // TODO: Implement recruitment template execution
  alert('Toborzási sablon végrehajtás hamarosan elérhető!');
}

/**
 * Add log entry
 */
function addLog(type, accountId, accountName, message) {
  if (logsTab) {
    logsTab.addLog({
      type: type,
      accountId: accountId,
      accountName: accountName,
      message: message,
      timestamp: Date.now()
    });
  }

  // Also add to alertsTab events if relevant
  if (alertsTab && ['build', 'recruit', 'attack', 'support', 'connection', 'error'].includes(type)) {
    const icons = {
      build: '🏗️',
      recruit: '👥',
      attack: '⚔️',
      support: '🛡️',
      connection: '🔌',
      error: '❌'
    };

    alertsTab.addEvent({
      icon: icons[type] || 'ℹ️',
      accountName: accountName,
      message: message
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
