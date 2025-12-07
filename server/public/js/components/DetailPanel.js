/**
 * AccountDetailPanel Component
 * Sliding sidebar panel showing detailed account information
 */

class DetailPanel extends Component {
  constructor(containerSelector) {
    super(containerSelector);
    this.isOpen = false;
    this.currentAccount = null;
    this.updateInterval = null;

    // Resize state
    this.isResizing = false;
    this.minWidth = 400;
    this.maxWidth = 1200;
    this.savedWidth = this.loadSavedWidth();

    // Bind resize handlers
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * Load saved panel width from localStorage
   */
  loadSavedWidth() {
    const saved = localStorage.getItem('detailPanelWidth');
    return saved ? parseInt(saved, 10) : null;
  }

  /**
   * Save panel width to localStorage
   */
  saveWidth(width) {
    localStorage.setItem('detailPanelWidth', width);
    this.savedWidth = width;
  }

  /**
   * Open the detail panel with account data
   * @param {Object} accountData - Account data to display
   */
  open(accountData) {
    this.currentAccount = accountData;
    this.isOpen = true;
    this.render();

    // Start countdown updates
    this.startCountdownUpdates();
  }

  /**
   * Close the detail panel
   */
  close() {
    this.isOpen = false;
    this.currentAccount = null;
    this.stopCountdownUpdates();

    if (this.container) {
      const panel = this.container.querySelector('.detail-panel');
      if (panel) {
        panel.classList.remove('open');
        setTimeout(() => this.container.innerHTML = '', 300);
      }
    }
  }

  /**
   * Start interval for updating countdowns
   */
  startCountdownUpdates() {
    this.stopCountdownUpdates();
    this.updateInterval = setInterval(() => {
      this.updateCountdowns();
    }, 1000);
  }

  /**
   * Stop countdown updates
   */
  stopCountdownUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update all countdown timers
   */
  updateCountdowns() {
    if (!this.container || !this.isOpen) return;

    const countdowns = this.container.querySelectorAll('.countdown[data-timestamp]');
    countdowns.forEach(el => {
      const timestamp = parseInt(el.dataset.timestamp);
      el.textContent = this.formatCountdown(timestamp);
    });
  }

  /**
   * Render the detail panel
   */
  render() {
    if (!this.container || !this.currentAccount) return;

    const account = this.currentAccount;

    // Create panel element
    const panel = this.createElement('div', { className: 'detail-panel' });

    // Apply saved width if exists
    if (this.savedWidth) {
      panel.style.width = `${this.savedWidth}px`;
    }

    // Add resize handle
    const resizeHandle = this.createElement('div', { className: 'detail-panel-resize' });
    resizeHandle.addEventListener('mousedown', (e) => this.handleMouseDown(e, panel));
    panel.appendChild(resizeHandle);

    // Header
    panel.appendChild(this.createHeader(account));

    // Main content wrapper - three column layout
    const mainContent = this.createElement('div', { className: 'detail-panel-main' });

    // LEFT SIDEBAR 1 - Action buttons (Műveletek)
    const actionsSidebar = this.createElement('div', { className: 'detail-panel-sidebar' });
    actionsSidebar.appendChild(this.createActionsSidebar(account));
    mainContent.appendChild(actionsSidebar);

    // LEFT SIDEBAR 2 - Navigation buttons (Navigáció)
    const navSidebar = this.createElement('div', { className: 'detail-panel-sidebar' });
    navSidebar.appendChild(this.createNavigationSidebar(account));
    mainContent.appendChild(navSidebar);

    // RIGHT CONTENT - Detail sections
    const body = this.createElement('div', { className: 'detail-panel-body' });

    // Village Info
    body.appendChild(this.createVillageInfoSection(account));

    // Resources
    if (account.data.resources) {
      body.appendChild(this.createResourcesSection(account.data.resources));
    }

    // Troops (always show section, even if empty)
    body.appendChild(this.createTroopsSection(account.data.troops || {}));

    // Effects/Bonuses
    if (account.data.effects && account.data.effects.length > 0) {
      body.appendChild(this.createEffectsSection(account.data.effects));
    }

    // Buildings
    if (account.data.buildings) {
      body.appendChild(this.createBuildingsSection(account.data.buildings, account.data.buildQueue));
    }

    // Recruitment
    if (account.data.recruitQueue) {
      body.appendChild(this.createRecruitmentSection(account.data.recruitQueue));
    }

    // Incoming/Outgoing
    body.appendChild(this.createCommandsSection(account.data.incomings, account.data.outgoings));

    // Statistics - Always show section with Fetch button
    body.appendChild(this.createStatisticsSection(account.data.statistics, account.accountId));

    // Notes (if exists)
    if (account.notes) {
      body.appendChild(this.createNotesSection(account));
    }

    // Add body to main content, then main content to panel
    mainContent.appendChild(body);
    panel.appendChild(mainContent);

    // Clear container and add panel
    this.container.innerHTML = '';
    this.container.appendChild(panel);

    // Trigger animation
    setTimeout(() => panel.classList.add('open'), 10);
  }

  /**
   * Create panel header
   */
  createHeader(account) {
    const header = this.createElement('div', { className: 'detail-panel-header' });

    const title = this.createElement('div', {
      className: 'detail-panel-title'
    }, `${account.accountId} - ${account.data.villageName || 'Falu'}`);
    header.appendChild(title);

    const closeBtn = this.createElement('button', {
      className: 'detail-panel-close',
      onClick: () => this.close()
    }, '✕');
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Create village info section
   */
  createVillageInfoSection(account) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Falu Információk');
    section.appendChild(title);

    section.appendChild(this.createDetailRow('Név', account.data.villageName || 'N/A'));
    section.appendChild(this.createDetailRow('Koordináták', account.data.coords || 'N/A'));
    section.appendChild(this.createDetailRow('Pontok', account.data.points || 'N/A'));
    section.appendChild(this.createDetailRow('Világ', account.data.world || 'N/A'));

    const lastUpdate = new Date(account.lastUpdate).toLocaleString('hu-HU');
    const relative = this.formatRelativeTime(account.lastUpdate);
    section.appendChild(this.createDetailRow('Utolsó frissítés', `${lastUpdate} (${relative})`));

    return section;
  }

  /**
   * Create resources section with detailed bars
   */
  createResourcesSection(resources) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Nyersanyagok');
    section.appendChild(title);

    // Wood
    section.appendChild(this.createResourceDetail('wood', 'Fa', resources.wood, resources.storage, 450));

    // Clay
    section.appendChild(this.createResourceDetail('clay', 'Agyag', resources.clay, resources.storage, 380));

    // Iron
    section.appendChild(this.createResourceDetail('iron', 'Vas', resources.iron, resources.storage, 320));

    // Population
    if (resources.population) {
      section.appendChild(this.createResourceDetail(
        'population',
        'Lakosság',
        resources.population.used,
        resources.population.max,
        0
      ));
    }

    // Storage info
    const storageInfo = this.createElement('div', {
      style: { marginTop: '8px', fontSize: '10px', color: '#666' }
    }, `📦 Raktár: ${this.formatNumber(resources.storage)}`);
    section.appendChild(storageInfo);

    return section;
  }

  /**
   * Create detailed resource row
   */
  createResourceDetail(type, label, current, max, production) {
    const detail = this.createElement('div', { className: 'resource-detail' });

    // Header with icon and values
    const header = this.createElement('div', { className: 'resource-detail-header' });
    const icon = this.createElement('span', { className: this.getResourceIconClass(type) });
    header.appendChild(icon);

    const labelEl = this.createElement('strong', {}, label);
    header.appendChild(labelEl);

    const values = this.createElement('span', {
      style: { marginLeft: 'auto' }
    }, `${this.formatNumber(current)} / ${this.formatNumber(max)}`);
    header.appendChild(values);

    detail.appendChild(header);

    // Progress bar
    const barContainer = this.createElement('div', { className: 'resource-detail-bar' });
    const percentage = Math.min(100, (current / max) * 100);
    const barFill = this.createElement('div', {
      className: `resource-detail-bar-fill ${type}`,
      style: { width: `${percentage}%` }
    });
    barContainer.appendChild(barFill);
    detail.appendChild(barContainer);

    // Info (percentage and production)
    const info = this.createElement('div', { className: 'resource-detail-info' });
    const percentText = this.createElement('span', {}, `${Math.round(percentage)}%`);
    info.appendChild(percentText);

    if (production > 0) {
      const prodText = this.createElement('span', {}, `+${production}/h`);
      info.appendChild(prodText);
    }

    detail.appendChild(info);

    return detail;
  }

  /**
   * Create troops section
   */
  createTroopsSection(troops) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Csapatok');
    section.appendChild(title);

    const troopTypes = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
    const troopNames = {
      spear: 'Lándzsás',
      sword: 'Kardos',
      axe: 'Fejszés',
      archer: 'Íjász',
      spy: 'Felderítő',
      light: 'Könnyű lovas',
      marcher: 'Lovas íjász',
      heavy: 'Nehéz lovas',
      ram: 'Faltörő',
      catapult: 'Katapult',
      knight: 'Lovas',
      snob: 'Nemes'
    };

    const grid = this.createElement('div', { className: 'troops-grid' });

    troopTypes.forEach(type => {
      const count = troops[type] || 0;
      const item = this.createTroopItem(type, troopNames[type], count);
      grid.appendChild(item);
    });

    section.appendChild(grid);

    // Total
    const total = troopTypes.reduce((sum, type) => sum + (troops[type] || 0), 0);
    const totalEl = this.createElement('div', {
      style: { marginTop: '8px', fontSize: '11px', fontWeight: 'bold' }
    }, `Összesen: ${this.formatNumber(total)} egység`);
    section.appendChild(totalEl);

    return section;
  }

  /**
   * Create troop item for grid
   */
  createTroopItem(type, name, count) {
    const item = this.createElement('div', { className: 'troop-item' });

    // Icon (would use background image in CSS, but create img for now)
    const icon = this.createElement('img', {
      className: 'unit-icon',
      src: this.getUnitIcon(type),
      alt: name
    });
    item.appendChild(icon);

    const countEl = this.createElement('div', { className: 'troop-count' }, this.formatNumber(count));
    item.appendChild(countEl);

    const nameEl = this.createElement('div', { className: 'troop-name' }, name);
    item.appendChild(nameEl);

    return item;
  }

  /**
   * Create effects/bonuses section
   */
  createEffectsSection(effects) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, '✨ Aktív Bónuszok');
    section.appendChild(title);

    const effectsContainer = this.createElement('div', {
      className: 'effects-container',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }
    });

    effects.forEach(effect => {
      const effectItem = this.createElement('div', {
        className: 'effect-item',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px',
          background: 'rgba(255, 215, 0, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(255, 215, 0, 0.3)'
        }
      });

      // Icon
      if (effect.icon) {
        const icon = this.createElement('img', {
          src: effect.icon,
          alt: effect.name,
          style: {
            width: '24px',
            height: '24px',
            verticalAlign: 'middle'
          }
        });
        effectItem.appendChild(icon);
      }

      // Name/Description
      const nameEl = this.createElement('div', {
        style: {
          flex: '1',
          fontSize: '11px',
          fontWeight: '500',
          color: '#d4af37'
        }
      }, effect.name);

      if (effect.tooltip) {
        nameEl.setAttribute('title', effect.tooltip);
      }

      effectItem.appendChild(nameEl);

      // Link indicator
      if (effect.hasLink) {
        const linkIcon = this.createElement('span', {
          style: {
            fontSize: '10px',
            color: '#888'
          }
        }, '🔗');
        effectItem.appendChild(linkIcon);
      }

      effectsContainer.appendChild(effectItem);
    });

    section.appendChild(effectsContainer);

    return section;
  }

  /**
   * Create buildings section
   */
  createBuildingsSection(buildings, buildQueue) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Épületek');
    section.appendChild(title);

    const buildingTypes = ['main', 'barracks', 'stable', 'garage', 'smith', 'market', 'place', 'statue',
      'wood', 'stone', 'iron', 'farm', 'storage', 'hide', 'wall'];
    const buildingNames = {
      main: 'Főépület',
      barracks: 'Kaszárnya',
      stable: 'Istálló',
      garage: 'Műhely',
      snob: 'Akadémia',
      smith: 'Kovács',
      place: 'Gyülekezőhely',
      statue: 'Szobor',
      market: 'Piac',
      wood: 'Favágó',
      stone: 'Agyag',
      iron: 'Vas',
      farm: 'Farm',
      storage: 'Raktár',
      hide: 'Rejtekely',
      wall: 'Fal'
    };

    const grid = this.createElement('div', { className: 'buildings-grid' });

    buildingTypes.forEach(type => {
      const level = buildings[type] || 0;
      const item = this.createBuildingItem(type, buildingNames[type], level);
      grid.appendChild(item);
    });

    section.appendChild(grid);

    // Build Queue
    if (buildQueue && buildQueue.length > 0) {
      const queueTitle = this.createElement('div', {
        style: { marginTop: '12px', marginBottom: '8px', fontSize: '11px', fontWeight: 'bold' }
      }, `📋 Építési sor (${buildQueue.length}/2):`);
      section.appendChild(queueTitle);

      buildQueue.forEach((item, index) => {
        const queueItem = this.createQueueItem(
          `${index + 1}. ${buildingNames[item.building]} ${item.currentLevel}→${item.targetLevel}`,
          item.finishTime
        );
        section.appendChild(queueItem);
      });
    }

    return section;
  }

  /**
   * Create building item for grid
   */
  createBuildingItem(type, name, level) {
    const item = this.createElement('div', { className: 'building-item' });

    // Icon
    const icon = this.createElement('img', {
      className: 'building-icon',
      src: this.getBuildingIcon(type),
      alt: name
    });
    item.appendChild(icon);

    // Level badge
    const levelBadge = this.createElement('div', { className: 'building-level' }, level.toString());
    item.appendChild(levelBadge);

    const nameEl = this.createElement('div', { className: 'building-name' }, name);
    item.appendChild(nameEl);

    return item;
  }

  /**
   * Create recruitment section
   */
  createRecruitmentSection(recruitQueue) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Toborzás');
    section.appendChild(title);

    if (recruitQueue.length === 0) {
      const empty = this.createElement('div', {
        style: { textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '12px' }
      }, 'Nincs aktív toborzás');
      section.appendChild(empty);
      return section;
    }

    // Group by building
    const byBuilding = {};
    recruitQueue.forEach(item => {
      if (!byBuilding[item.building]) {
        byBuilding[item.building] = [];
      }
      byBuilding[item.building].push(item);
    });

    Object.entries(byBuilding).forEach(([building, items]) => {
      const buildingName = {
        barracks: 'Kaszárnya',
        stable: 'Istálló',
        garage: 'Műhely',
        snob: 'Akadémia'
      }[building] || building;

      const buildingTitle = this.createElement('div', {
        style: { marginTop: '8px', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold' }
      }, `📍 ${buildingName}:`);
      section.appendChild(buildingTitle);

      items.forEach(item => {
        const queueItem = this.createQueueItem(
          `${item.unit} x${item.count}`,
          item.finishTime
        );
        section.appendChild(queueItem);
      });
    });

    return section;
  }

  /**
   * Create commands section (incoming/outgoing)
   */
  createCommandsSection(incomings, outgoings) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Bejövő/Kimenő');
    section.appendChild(title);

    // Incoming attacks
    if (incomings && incomings.length > 0) {
      const attacksTitle = this.createElement('div', {
        style: { marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: 'var(--alert-critical)' }
      }, `⚔️ BEJÖVŐ TÁMADÁSOK (${incomings.length}):`);
      section.appendChild(attacksTitle);

      incomings.forEach(incoming => {
        const item = this.createCommandItem(
          `⚔️ ${incoming.originCoords} (${incoming.originVillage || 'Ismeretlen'})`,
          incoming.arrivalTime,
          'incoming-attack'
        );
        section.appendChild(item);
      });
    }

    // Outgoing commands
    if (outgoings && outgoings.length > 0) {
      const outgoingTitle = this.createElement('div', {
        style: { marginTop: '12px', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold' }
      }, `🚀 KIMENŐ PARANCSOK (${outgoings.length}):`);
      section.appendChild(outgoingTitle);

      outgoings.forEach(outgoing => {
        const item = this.createCommandItem(
          `→ ${outgoing.targetCoords} (${outgoing.type})`,
          outgoing.arrivalTime,
          'outgoing'
        );
        section.appendChild(item);
      });
    }

    if ((!incomings || incomings.length === 0) && (!outgoings || outgoings.length === 0)) {
      const empty = this.createElement('div', {
        style: { textAlign: 'center', color: '#999', fontStyle: 'italic', padding: '12px' }
      }, 'Nincs aktív parancs');
      section.appendChild(empty);
    }

    return section;
  }

  /**
   * Create statistics section
   * @param {Object|null} statistics - Statistics data or null
   * @param {string} accountId - Account ID for fetch button
   */
  createStatisticsSection(statistics, accountId) {
    const section = this.createElement('div', { className: 'detail-section' });

    // Title with Fetch button
    const titleRow = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    });

    const title = this.createElement('div', {
      className: 'detail-section-title',
      style: { marginBottom: '0' }
    }, '📊 Statisztikák');
    titleRow.appendChild(title);

    const fetchBtn = this.createElement('button', {
      className: 'btn btn-sm btn-brown',
      style: { fontSize: '10px', padding: '4px 8px' },
      onClick: () => this.handleFetchStatistics(accountId)
    }, '🔄 Lekérés');
    titleRow.appendChild(fetchBtn);

    section.appendChild(titleRow);

    // If no statistics data, show message
    if (!statistics || !statistics.summary) {
      const noData = this.createElement('div', {
        style: {
          textAlign: 'center',
          color: '#999',
          fontStyle: 'italic',
          padding: '16px'
        }
      }, 'Nincs statisztikai adat. Kattints a "Lekérés" gombra a betöltéshez.');
      section.appendChild(noData);
      return section;
    }

    const summary = statistics.summary;

    // Player stats grid
    const statsGrid = this.createElement('div', {
      className: 'stats-grid',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '12px'
      }
    });

    // Current Points
    statsGrid.appendChild(this.createStatItem('🏆 Pontok', this.formatNumber(summary.currentPoints)));

    // Current Rank
    statsGrid.appendChild(this.createStatItem('📈 Helyezés', `#${summary.currentRank}`));

    // Current Villages
    statsGrid.appendChild(this.createStatItem('🏰 Falvak', summary.currentVillages));

    // Total Looted
    statsGrid.appendChild(this.createStatItem('💰 Zsákmány', this.formatNumber(summary.totalLooted)));

    // Enemy Killed
    statsGrid.appendChild(this.createStatItem('⚔️ Legyőzött', this.formatNumber(summary.totalEnemyKilled)));

    // Troop Gains
    statsGrid.appendChild(this.createStatItem('📗 Nyereség', this.formatNumber(summary.totalTroopGains)));

    // Troop Losses
    statsGrid.appendChild(this.createStatItem('📕 Veszteség', this.formatNumber(summary.totalTroopLosses)));

    section.appendChild(statsGrid);

    // Show last scraped time
    if (statistics.scrapedAt) {
      const scrapedTime = new Date(statistics.scrapedAt).toLocaleString('hu-HU');
      const timeInfo = this.createElement('div', {
        style: { fontSize: '9px', color: '#666', textAlign: 'right' }
      }, `Utolsó frissítés: ${scrapedTime}`);
      section.appendChild(timeInfo);
    }

    // Trend indicators (if we have graph data)
    if (statistics.graphs && statistics.graphs.playerPoints && statistics.graphs.playerPoints.length > 1) {
      section.appendChild(this.createTrendSection(statistics.graphs));
    }

    return section;
  }

  /**
   * Handle farm start button click (modal only)
   */
  async handleFarmStart(accountId) {
    // Get values from modal
    const intervalInput = document.getElementById(`farm-modal-interval-${accountId}`);
    const delayInput = document.getElementById(`farm-modal-delay-${accountId}`);

    const intervalMinutes = parseInt(intervalInput?.value) || 30;
    const randomDelayMinutes = parseInt(delayInput?.value) || 5;

    console.log(`Starting farm for ${accountId} with interval ${intervalMinutes}min ±${randomDelayMinutes}min`);

    try {
      const response = await fetch('/api/farm/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, intervalMinutes, randomDelayMinutes })
      });

      const result = await response.json();

      if (result.success) {
        this.updateFarmModalUI(accountId, result.status);
      } else {
        alert(`Farm indítási hiba: ${result.error}`);
      }
    } catch (error) {
      console.error('Farm start error:', error);
      alert(`Hiba: ${error.message}`);
    }
  }

  /**
   * Handle farm stop button click
   */
  async handleFarmStop(accountId) {
    console.log(`Stopping farm loop for ${accountId}`);

    try {
      const response = await fetch('/api/farm/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      const result = await response.json();

      if (result.success) {
        this.updateFarmModalUI(accountId, result.status);
      } else {
        alert(`Farm leállítási hiba: ${result.error}`);
      }
    } catch (error) {
      console.error('Farm stop error:', error);
      alert(`Hiba: ${error.message}`);
    }
  }

  /**
   * Handle save farm settings button click
   */
  async handleFarmSaveSettings(accountId) {
    // Get values from modal
    const intervalInput = document.getElementById(`farm-modal-interval-${accountId}`);
    const delayInput = document.getElementById(`farm-modal-delay-${accountId}`);

    const intervalMinutes = parseInt(intervalInput?.value) || 30;
    const randomDelayMinutes = parseInt(delayInput?.value) || 5;

    console.log(`Saving farm settings for ${accountId}: interval=${intervalMinutes}min, delay=±${randomDelayMinutes}min`);

    try {
      const response = await fetch(`/api/farm/settings/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes, randomDelayMinutes })
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Beállítások mentve!\nIntervallum: ${intervalMinutes} perc\nRandom: ±${randomDelayMinutes} perc`);
      } else {
        alert(`Mentési hiba: ${result.error}`);
      }
    } catch (error) {
      console.error('Save settings error:', error);
      alert(`Hiba: ${error.message}`);
    }
  }

  /**
   * Handle farm now (single run) button click
   */
  async handleFarmNow(accountId) {
    console.log(`Running farm once for ${accountId}`);

    // Disable button during execution
    const farmNowBtn = document.getElementById(`farm-modal-now-${accountId}`);
    if (farmNowBtn) {
      farmNowBtn.disabled = true;
      farmNowBtn.textContent = '🚜 Farmolás...';
    }

    try {
      const response = await fetch('/api/farm/once', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      const result = await response.json();

      if (result.success) {
        this.updateFarmModalUI(accountId, result.status);
      } else {
        alert(`Farm hiba: ${result.error}`);
        // Re-enable button on error
        if (farmNowBtn) {
          farmNowBtn.disabled = false;
          farmNowBtn.textContent = '🚜 Farm Most';
        }
      }
    } catch (error) {
      console.error('Farm once error:', error);
      alert(`Hiba: ${error.message}`);
      // Re-enable button on error
      if (farmNowBtn) {
        farmNowBtn.disabled = false;
        farmNowBtn.textContent = '🚜 Farm Most';
      }
    }
  }

  /**
   * Create a stat item for the statistics grid
   */
  createStatItem(label, value) {
    const item = this.createElement('div', {
      className: 'stat-item',
      style: {
        background: 'rgba(101, 67, 33, 0.2)',
        padding: '8px',
        borderRadius: '4px',
        textAlign: 'center'
      }
    });

    const labelEl = this.createElement('div', {
      style: { fontSize: '10px', color: '#999', marginBottom: '4px' }
    }, label);
    item.appendChild(labelEl);

    const valueEl = this.createElement('div', {
      style: { fontSize: '14px', fontWeight: 'bold', color: '#d4af37' }
    }, value !== null && value !== undefined ? value.toString() : '-');
    item.appendChild(valueEl);

    return item;
  }

  /**
   * Create trend section from graph data
   */
  createTrendSection(graphs) {
    const container = this.createElement('div', {
      style: { marginTop: '12px' }
    });

    const trendTitle = this.createElement('div', {
      style: { fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }
    }, '📉 Trend (utolsó 7 nap)');
    container.appendChild(trendTitle);

    // Calculate trends from graph data
    const trends = [];

    // Points trend
    if (graphs.playerPoints && graphs.playerPoints.length >= 2) {
      const recent = graphs.playerPoints.slice(-7);
      if (recent.length >= 2) {
        const first = recent[0][1];
        const last = recent[recent.length - 1][1];
        const change = last - first;
        const percent = first > 0 ? ((change / first) * 100).toFixed(1) : 0;
        trends.push({
          label: 'Pontok',
          change: change,
          percent: percent,
          positive: change >= 0
        });
      }
    }

    // Rank trend (inverted - lower is better)
    if (graphs.playerRank && graphs.playerRank.length >= 2) {
      const recent = graphs.playerRank.slice(-7);
      if (recent.length >= 2) {
        const first = recent[0][1];
        const last = recent[recent.length - 1][1];
        const change = first - last; // Inverted: positive means rank improved
        trends.push({
          label: 'Helyezés',
          change: -change, // Show as negative if rank number went up
          percent: null,
          positive: change >= 0
        });
      }
    }

    if (trends.length === 0) {
      return container;
    }

    const trendGrid = this.createElement('div', {
      style: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }
    });

    trends.forEach(trend => {
      const trendItem = this.createElement('div', {
        style: {
          background: trend.positive ? 'rgba(0, 128, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }
      });

      const arrow = trend.positive ? '▲' : '▼';
      const color = trend.positive ? '#4CAF50' : '#f44336';
      const changeText = trend.percent !== null
        ? `${arrow} ${trend.percent}%`
        : `${arrow} ${Math.abs(trend.change)}`;

      trendItem.innerHTML = `<span style="color: ${color}">${changeText}</span> ${trend.label}`;
      trendGrid.appendChild(trendItem);
    });

    container.appendChild(trendGrid);

    return container;
  }

  /**
   * Create queue item
   */
  createQueueItem(label, finishTime) {
    const item = this.createElement('div', { className: 'queue-item' });

    const info = this.createElement('div', { className: 'queue-item-info' }, label);
    item.appendChild(info);

    const time = this.createElement('div', {
      className: 'queue-item-time countdown',
      dataset: { timestamp: finishTime.toString() }
    }, this.formatCountdown(finishTime));
    item.appendChild(time);

    return item;
  }

  /**
   * Create command item
   */
  createCommandItem(label, arrivalTime, type) {
    const item = this.createElement('div', { className: `command-item ${type}` });

    const info = this.createElement('div', {}, label);
    item.appendChild(info);

    const time = this.createElement('div', {
      className: 'countdown',
      dataset: { timestamp: arrivalTime.toString() }
    }, this.formatCountdown(arrivalTime));
    item.appendChild(time);

    return item;
  }

  /**
   * Create notes section
   */
  createNotesSection(account) {
    const section = this.createElement('div', { className: 'detail-section notes-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Jegyzetek');
    section.appendChild(title);

    const text = this.createElement('div', { className: 'notes-text' }, account.notes || '');
    section.appendChild(text);

    const meta = this.createElement('div', { className: 'notes-meta' });
    const lastEdited = this.createElement('span', {}, 'Utoljára szerkesztve: N/A');
    meta.appendChild(lastEdited);

    const editBtn = this.createElement('button', {
      className: 'btn btn-sm btn-brown',
      onClick: () => alert('Jegyzetek szerkesztése hamarosan elérhető!')
    }, '✏️ Szerkesztés');
    meta.appendChild(editBtn);

    section.appendChild(meta);

    return section;
  }

  /**
   * Create actions sidebar (vertical button layout for left sidebar)
   */
  createActionsSidebar(account) {
    const container = this.createElement('div', { className: 'actions-sidebar' });

    // Title
    const title = this.createElement('div', {
      className: 'sidebar-title'
    }, 'Műveletek');
    container.appendChild(title);

    // Vertical action buttons
    const buttons = this.createElement('div', { className: 'sidebar-buttons' });

    // Build button
    buttons.appendChild(this.createSidebarButton('🏗️', 'Építés', () => this.handleAction('build', account)));

    // Attack button
    buttons.appendChild(this.createSidebarButton('⚔️', 'Támadás', () => this.handleAction('attack', account)));

    // Support button
    buttons.appendChild(this.createSidebarButton('🛡️', 'Támogatás', () => this.handleAction('support', account)));

    // Recruit button
    buttons.appendChild(this.createSidebarButton('👥', 'Toborzás', () => this.handleAction('recruit', account)));

    // Farm Bot button
    const farmBtn = this.createFarmSidebarButton(account);
    buttons.appendChild(farmBtn);

    container.appendChild(buttons);

    return container;
  }

  /**
   * Create sidebar button (icon + label stacked)
   */
  createSidebarButton(icon, label, onClick) {
    const btn = this.createElement('div', {
      className: 'sidebar-btn',
      onClick
    });

    const iconEl = this.createElement('div', { className: 'sidebar-btn-icon' }, icon);
    btn.appendChild(iconEl);

    const labelEl = this.createElement('div', { className: 'sidebar-btn-label' }, label);
    btn.appendChild(labelEl);

    return btn;
  }

  /**
   * Create Farm Bot sidebar button with status indicator
   */
  createFarmSidebarButton(account) {
    const btn = this.createElement('div', {
      className: 'sidebar-btn farm-sidebar-btn',
      id: `farm-sidebar-btn-${account.accountId}`,
      onClick: () => this.openFarmModal(account)
    });

    const iconEl = this.createElement('div', { className: 'sidebar-btn-icon' }, '🚜');
    btn.appendChild(iconEl);

    const labelEl = this.createElement('div', { className: 'sidebar-btn-label' }, 'Farm');
    btn.appendChild(labelEl);

    // Status indicator dot
    const statusDot = this.createElement('div', {
      className: 'farm-status-dot',
      id: `farm-dot-${account.accountId}`
    });
    btn.appendChild(statusDot);

    // Load initial status
    this.loadFarmButtonStatus(account.accountId);

    return btn;
  }

  /**
   * Load farm status for sidebar button
   */
  async loadFarmButtonStatus(accountId) {
    try {
      const response = await fetch(`/api/farm/status/${accountId}`);
      const status = await response.json();
      this.updateFarmButtonStatus(accountId, status);
    } catch (error) {
      console.error('Failed to load farm button status:', error);
    }
  }

  /**
   * Update farm sidebar button status dot
   */
  updateFarmButtonStatus(accountId, status) {
    const dot = document.getElementById(`farm-dot-${accountId}`);
    if (!dot) return;

    dot.className = 'farm-status-dot';
    if (status.isRunning) {
      if (status.isFarming) {
        dot.classList.add('farming');
        dot.title = 'Farmol...';
      } else if (status.isPaused) {
        dot.classList.add('paused');
        dot.title = 'Szünetel';
      } else {
        dot.classList.add('active');
        dot.title = 'Aktív';
      }
    } else {
      dot.classList.add('idle');
      dot.title = 'Inaktív';
    }

    if (status.lastError) {
      dot.classList.add('error');
      dot.title = status.lastError;
    }
  }

  /**
   * Open Farm Bot modal
   */
  openFarmModal(account) {
    // Remove existing modal if any
    const existingModal = document.getElementById('farm-modal');
    if (existingModal) existingModal.remove();

    // Clear any existing status polling
    if (this.farmStatusInterval) {
      clearInterval(this.farmStatusInterval);
      this.farmStatusInterval = null;
    }

    const modal = this.createElement('div', {
      className: 'farm-modal-overlay',
      id: 'farm-modal',
      onClick: (e) => {
        if (e.target.id === 'farm-modal') this.closeFarmModal();
      }
    });

    const modalContent = this.createElement('div', { className: 'farm-modal-content' });

    // Modal header
    const header = this.createElement('div', { className: 'farm-modal-header' });
    header.appendChild(this.createElement('h3', {}, '🚜 Farm Bot'));

    const closeBtn = this.createElement('button', {
      className: 'farm-modal-close',
      onClick: () => this.closeFarmModal()
    }, '×');
    header.appendChild(closeBtn);
    modalContent.appendChild(header);

    // Modal body
    const body = this.createElement('div', { className: 'farm-modal-body' });

    // Status & Progress Card
    const statusCard = this.createElement('div', { className: 'farm-status-card' });

    // Status row
    const statusRow = this.createElement('div', { className: 'farm-status-row' });
    const statusLabel = this.createElement('span', { className: 'farm-label' }, 'Státusz:');
    const statusBadge = this.createElement('span', {
      className: 'farm-status-badge farm-status-idle',
      id: `farm-modal-status-${account.accountId}`
    }, 'Betöltés...');
    statusRow.appendChild(statusLabel);
    statusRow.appendChild(statusBadge);
    statusCard.appendChild(statusRow);

    // Next run row (hidden initially)
    const nextRunRow = this.createElement('div', {
      className: 'farm-status-row',
      id: `farm-modal-nextrun-${account.accountId}`,
      style: { display: 'none' }
    });
    const nextRunLabel = this.createElement('span', { className: 'farm-label' }, 'Következő:');
    const nextRunDisplay = this.createElement('span', {
      className: 'farm-next-run-value',
      id: `farm-modal-nextrun-text-${account.accountId}`
    }, '--:--');
    nextRunRow.appendChild(nextRunLabel);
    nextRunRow.appendChild(nextRunDisplay);
    statusCard.appendChild(nextRunRow);

    // Progress section (hidden initially)
    const progressSection = this.createElement('div', {
      className: 'farm-progress-section',
      id: `farm-modal-progress-${account.accountId}`,
      style: { display: 'none' }
    });
    const progressBar = this.createElement('div', { className: 'farm-progress-bar' });
    const progressFill = this.createElement('div', {
      className: 'farm-progress-fill',
      id: `farm-modal-progress-fill-${account.accountId}`
    });
    progressBar.appendChild(progressFill);
    progressSection.appendChild(progressBar);
    const progressText = this.createElement('div', {
      className: 'farm-progress-text',
      id: `farm-modal-progress-text-${account.accountId}`
    }, '0 / 0');
    progressSection.appendChild(progressText);
    statusCard.appendChild(progressSection);

    body.appendChild(statusCard);

    // Loop Settings Card
    const settingsCard = this.createElement('div', { className: 'farm-settings-card' });
    const settingsTitle = this.createElement('div', { className: 'farm-card-title' }, 'Loop Beállítások');
    settingsCard.appendChild(settingsTitle);

    const settingsGrid = this.createElement('div', { className: 'farm-settings-grid' });

    // Interval input
    const intervalGroup = this.createElement('div', { className: 'farm-setting-group' });
    intervalGroup.appendChild(this.createElement('label', {}, 'Intervallum'));
    const intervalWrapper = this.createElement('div', { className: 'farm-input-wrapper' });
    const intervalInput = this.createElement('input', {
      type: 'number',
      id: `farm-modal-interval-${account.accountId}`,
      className: 'farm-input',
      value: '30',
      min: '5',
      max: '120'
    });
    intervalWrapper.appendChild(intervalInput);
    intervalWrapper.appendChild(this.createElement('span', { className: 'farm-input-suffix' }, 'perc'));
    intervalGroup.appendChild(intervalWrapper);
    settingsGrid.appendChild(intervalGroup);

    // Random delay input
    const delayGroup = this.createElement('div', { className: 'farm-setting-group' });
    delayGroup.appendChild(this.createElement('label', {}, 'Random'));
    const delayWrapper = this.createElement('div', { className: 'farm-input-wrapper' });
    delayWrapper.appendChild(this.createElement('span', { className: 'farm-input-prefix' }, '±'));
    const delayInput = this.createElement('input', {
      type: 'number',
      id: `farm-modal-delay-${account.accountId}`,
      className: 'farm-input',
      value: '5',
      min: '0',
      max: '30'
    });
    delayWrapper.appendChild(delayInput);
    delayWrapper.appendChild(this.createElement('span', { className: 'farm-input-suffix' }, 'perc'));
    delayGroup.appendChild(delayWrapper);
    settingsGrid.appendChild(delayGroup);

    settingsCard.appendChild(settingsGrid);

    // Save button inline with settings
    const saveBtn = this.createElement('button', {
      className: 'btn-farm-save-inline',
      id: `farm-modal-save-${account.accountId}`,
      onClick: () => this.handleFarmSaveSettings(account.accountId)
    }, 'Mentés');
    settingsCard.appendChild(saveBtn);

    body.appendChild(settingsCard);

    // Stats Card
    const statsCard = this.createElement('div', { className: 'farm-stats-card' });
    const statsInfo = this.createElement('div', {
      className: 'farm-stats-info',
      id: `farm-modal-stats-${account.accountId}`
    }, 'Még nem futott');
    statsCard.appendChild(statsInfo);
    body.appendChild(statsCard);

    modalContent.appendChild(body);

    // Modal footer with action buttons
    const footer = this.createElement('div', { className: 'farm-modal-footer' });

    // Farm Now (single run) button
    const farmNowBtn = this.createElement('button', {
      className: 'btn-farm-action btn-farm-now',
      id: `farm-modal-now-${account.accountId}`,
      onClick: () => this.handleFarmNow(account.accountId)
    }, 'Farm Most');
    footer.appendChild(farmNowBtn);

    // Start Loop Mode button
    const startLoopBtn = this.createElement('button', {
      className: 'btn-farm-action btn-farm-loop-start',
      id: `farm-modal-start-loop-${account.accountId}`,
      onClick: () => this.handleFarmStart(account.accountId)
    }, 'Loop Indítás');
    footer.appendChild(startLoopBtn);

    // Stop Loop Mode button
    const stopLoopBtn = this.createElement('button', {
      className: 'btn-farm-action btn-farm-loop-stop',
      id: `farm-modal-stop-loop-${account.accountId}`,
      onClick: () => this.handleFarmStop(account.accountId),
      style: { display: 'none' }
    }, 'Loop Leállítás');
    footer.appendChild(stopLoopBtn);

    modalContent.appendChild(footer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Load current status
    this.loadFarmModalStatus(account.accountId);

    // Start polling for status updates every 2 seconds while modal is open
    this.farmStatusInterval = setInterval(() => {
      const modalExists = document.getElementById('farm-modal');
      if (modalExists) {
        this.loadFarmModalStatus(account.accountId);
      } else {
        // Modal closed, stop polling
        clearInterval(this.farmStatusInterval);
        this.farmStatusInterval = null;
      }
    }, 2000);
  }

  /**
   * Close farm modal
   */
  closeFarmModal() {
    // Stop status polling
    if (this.farmStatusInterval) {
      clearInterval(this.farmStatusInterval);
      this.farmStatusInterval = null;
    }
    const modal = document.getElementById('farm-modal');
    if (modal) modal.remove();
  }

  /**
   * Load farm status for modal
   */
  async loadFarmModalStatus(accountId) {
    try {
      const response = await fetch(`/api/farm/status/${accountId}`);
      const status = await response.json();
      this.updateFarmModalUI(accountId, status);
    } catch (error) {
      console.error('Failed to load farm modal status:', error);
    }
  }

  /**
   * Update farm modal UI based on status
   */
  updateFarmModalUI(accountId, status) {
    const statusBadge = document.getElementById(`farm-modal-status-${accountId}`);
    const startLoopBtn = document.getElementById(`farm-modal-start-loop-${accountId}`);
    const stopLoopBtn = document.getElementById(`farm-modal-stop-loop-${accountId}`);
    const farmNowBtn = document.getElementById(`farm-modal-now-${accountId}`);
    const progressSection = document.getElementById(`farm-modal-progress-${accountId}`);
    const progressFill = document.getElementById(`farm-modal-progress-fill-${accountId}`);
    const progressText = document.getElementById(`farm-modal-progress-text-${accountId}`);
    const statsInfo = document.getElementById(`farm-modal-stats-${accountId}`);
    const nextRunSection = document.getElementById(`farm-modal-nextrun-${accountId}`);
    const nextRunText = document.getElementById(`farm-modal-nextrun-text-${accountId}`);
    const intervalInput = document.getElementById(`farm-modal-interval-${accountId}`);
    const delayInput = document.getElementById(`farm-modal-delay-${accountId}`);

    if (!statusBadge) return;

    // Populate settings from status
    if (status.settings) {
      if (intervalInput) intervalInput.value = status.settings.intervalMinutes || 30;
      if (delayInput) delayInput.value = status.settings.randomDelayMinutes || 5;
    }

    // Update status badge
    statusBadge.className = 'farm-status-badge';
    if (status.isFarming) {
      statusBadge.textContent = 'Farmol...';
      statusBadge.classList.add('farm-status-farming');
    } else if (status.isRunning) {
      if (status.isPaused) {
        statusBadge.textContent = 'Szünetel';
        statusBadge.classList.add('farm-status-paused');
      } else {
        statusBadge.textContent = 'Loop Aktív';
        statusBadge.classList.add('farm-status-active');
      }
    } else {
      statusBadge.textContent = 'Inaktív';
      statusBadge.classList.add('farm-status-idle');
    }

    if (status.lastError) {
      statusBadge.textContent = 'Hiba!';
      statusBadge.classList.add('farm-status-error');
      statusBadge.title = status.lastError;
    }

    // Update loop buttons
    if (startLoopBtn && stopLoopBtn) {
      if (status.isRunning) {
        startLoopBtn.style.display = 'none';
        stopLoopBtn.style.display = 'inline-block';
      } else {
        startLoopBtn.style.display = 'inline-block';
        stopLoopBtn.style.display = 'none';
      }
    }

    // Update Farm Now button
    if (farmNowBtn) {
      if (status.isFarming) {
        farmNowBtn.disabled = true;
        farmNowBtn.textContent = 'Farmolás...';
        farmNowBtn.classList.add('farming');
      } else {
        farmNowBtn.disabled = false;
        farmNowBtn.textContent = 'Farm Most';
        farmNowBtn.classList.remove('farming');
      }
    }

    // Update progress
    if (progressSection && status.currentProgress) {
      const { current, total } = status.currentProgress;
      progressSection.style.display = 'block';
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${current} / ${total}`;
    } else if (progressSection && !status.isFarming) {
      progressSection.style.display = 'none';
    }

    // Update stats
    if (statsInfo) {
      if (status.lastRun) {
        const lastRunDate = new Date(status.lastRun).toLocaleString('hu-HU');
        let statsText = `Utolsó futás: ${lastRunDate}`;
        if (status.loopCount) {
          statsText += ` | Ciklusok: ${status.loopCount}`;
        }
        if (status.totalFarmed) {
          statsText += ` | Összesen: ${status.totalFarmed}`;
        }
        statsInfo.textContent = statsText;
      } else {
        statsInfo.textContent = 'Még nem futott';
      }
    }

    // Update next run countdown
    if (nextRunSection && nextRunText) {
      if (status.isRunning && status.nextRun && !status.isFarming) {
        nextRunSection.style.display = 'block';
        const now = Date.now();
        const nextRun = new Date(status.nextRun).getTime();
        const diff = nextRun - now;

        if (diff > 0) {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          nextRunText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          nextRunText.style.color = 'var(--tw-btn-green)';
        } else {
          nextRunText.textContent = 'Hamarosan...';
          nextRunText.style.color = 'var(--status-warning)';
        }
      } else if (status.isFarming) {
        nextRunSection.style.display = 'block';
        nextRunText.textContent = 'Farmolás folyamatban...';
        nextRunText.style.color = 'var(--tw-btn-green)';
      } else {
        nextRunSection.style.display = 'none';
      }
    }

    // Also update sidebar button
    this.updateFarmButtonStatus(accountId, status);
  }

  /**
   * Create navigation sidebar (vertical button layout for navigation)
   */
  createNavigationSidebar(account) {
    const container = this.createElement('div', { className: 'actions-sidebar nav-sidebar' });

    // Title
    const title = this.createElement('div', {
      className: 'sidebar-title'
    }, 'Navigáció');
    container.appendChild(title);

    // Vertical navigation buttons
    const buttons = this.createElement('div', { className: 'sidebar-buttons' });

    // Village Overview
    buttons.appendChild(this.createSidebarButton('🏘️', 'Áttekintés', () => this.handleNavigation('overview', account)));

    // Main Building
    buttons.appendChild(this.createSidebarButton('🏛️', 'Főépület', () => this.handleNavigation('main', account)));

    // Barracks
    buttons.appendChild(this.createSidebarButton('⚔️', 'Kaszárnya', () => this.handleNavigation('barracks', account)));

    // Rally Point
    buttons.appendChild(this.createSidebarButton('🚩', 'Gyülekező', () => this.handleNavigation('place', account)));

    // Statistics
    buttons.appendChild(this.createSidebarButton('📊', 'Statisztika', () => this.handleNavigation('statistics', account)));

    // Market
    buttons.appendChild(this.createSidebarButton('🛒', 'Piac', () => this.handleNavigation('market', account)));

    container.appendChild(buttons);

    return container;
  }

  /**
   * Handle navigation button click - sends command to master tab
   */
  async handleNavigation(screen, account) {
    console.log(`Navigation: ${screen} for account ${account.accountId}`);

    try {
      const response = await fetch('/api/commands/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.accountId,
          screen: screen
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Navigation failed');
      }

      console.log(`Navigation command sent: ${screen}`);
    } catch (error) {
      console.error('Failed to navigate:', error);
      alert(`❌ Navigáció hiba: ${error.message}`);
    }
  }

  /**
   * Create actions section (legacy - kept for compatibility)
   */
  createActionsSection(account) {
    const section = this.createElement('div', { className: 'detail-section' });

    const title = this.createElement('div', {
      className: 'detail-section-title'
    }, 'Műveletek');
    section.appendChild(title);

    const grid = this.createElement('div', { className: 'action-buttons-grid' });

    // Build button
    grid.appendChild(this.createActionButton('🏗️ Építés', () => this.handleAction('build', account)));

    // Attack button
    grid.appendChild(this.createActionButton('⚔️ Támadás', () => this.handleAction('attack', account)));

    // Support button
    grid.appendChild(this.createActionButton('🛡️ Támogatás', () => this.handleAction('support', account)));

    // Recruit button
    grid.appendChild(this.createActionButton('👥 Toborzás', () => this.handleAction('recruit', account)));

    section.appendChild(grid);

    return section;
  }

  /**
   * Create action button
   */
  createActionButton(label, onClick) {
    return this.createElement('div', {
      className: 'action-btn',
      onClick
    }, label);
  }

  /**
   * Handle fetch statistics button click
   * Sends command to userscript to navigate to stats page and scrape
   */
  async handleFetchStatistics(accountId) {
    console.log(`Fetching statistics for account: ${accountId}`);

    try {
      const response = await fetch('/api/commands/fetch-statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId })
      });

      const result = await response.json();

      if (result.success) {
        alert('📊 Statisztika lekérés elindítva!\nA fiók navigál a statisztika oldalra és betölti az adatokat.');
      } else {
        throw new Error(result.error || 'Ismeretlen hiba');
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      alert(`❌ Hiba: ${error.message}`);
    }
  }

  /**
   * Handle action button click
   */
  handleAction(action, account) {
    console.log(`Action: ${action} for account ${account.accountId}`);

    switch (action) {
      case 'build':
        this.openBuildModal(account);
        break;

      case 'attack':
        this.openAttackModal(account);
        break;

      case 'support':
        this.openSupportModal(account);
        break;

      case 'recruit':
        this.openRecruitModal(account);
        break;

      default:
        console.warn('Unknown action:', action);
    }
  }

  /**
   * Open build modal
   */
  openBuildModal(account) {
    const modal = new BuildModal(account, async (buildData) => {
      try {
        const response = await fetch('/api/commands/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildData)
        });

        const result = await response.json();

        if (result.success) {
          alert(`✅ Építési parancs várólistára került!\nVárólista pozíció: ${result.queuePosition}\nParancs ID: ${result.actionId}`);
        } else {
          throw new Error(result.error || 'Ismeretlen hiba');
        }
      } catch (error) {
        alert(`❌ Hiba: ${error.message}`);
        throw error;
      }
    });

    modal.open();
  }

  /**
   * Open attack modal
   */
  openAttackModal(account) {
    const modal = new AttackModal(account, 'attack', async (attackData) => {
      try {
        const response = await fetch('/api/commands/send-troops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attackData)
        });

        const result = await response.json();

        if (result.success) {
          alert(`✅ Támadási parancs várólistára került!\nVárólista pozíció: ${result.queuePosition}/${result.queueLength}\nParancs ID: ${result.actionId}`);
        } else {
          throw new Error(result.error || 'Ismeretlen hiba');
        }
      } catch (error) {
        alert(`❌ Hiba: ${error.message}`);
        throw error;
      }
    });

    modal.open();
  }

  /**
   * Open support modal
   */
  openSupportModal(account) {
    const modal = new AttackModal(account, 'support', async (supportData) => {
      try {
        const response = await fetch('/api/commands/send-troops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(supportData)
        });

        const result = await response.json();

        if (result.success) {
          alert(`✅ Támogatási parancs várólistára került!\nVárólista pozíció: ${result.queuePosition}/${result.queueLength}\nParancs ID: ${result.actionId}`);
        } else {
          throw new Error(result.error || 'Ismeretlen hiba');
        }
      } catch (error) {
        alert(`❌ Hiba: ${error.message}`);
        throw error;
      }
    });

    modal.open();
  }

  /**
   * Open recruit modal
   */
  openRecruitModal(account) {
    const modal = new RecruitModal(account, async (recruitData) => {
      try {
        const response = await fetch('/api/commands/recruit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recruitData)
        });

        const result = await response.json();

        if (result.success) {
          alert(`✅ Toborzási parancs várólistára került!\nVárólista pozíció: ${result.queuePosition}\nParancs ID: ${result.actionId}`);
        } else {
          throw new Error(result.error || 'Ismeretlen hiba');
        }
      } catch (error) {
        alert(`❌ Hiba: ${error.message}`);
        throw error;
      }
    });

    modal.open();
  }

  /**
   * Create detail row
   */
  createDetailRow(label, value) {
    const row = this.createElement('div', { className: 'detail-row' });

    const labelEl = this.createElement('span', { className: 'detail-label' }, `${label}:`);
    row.appendChild(labelEl);

    const valueEl = this.createElement('span', { className: 'detail-value' }, value);
    row.appendChild(valueEl);

    return row;
  }

  /**
   * Handle mouse down on resize handle - start resizing
   */
  handleMouseDown(e, panel) {
    e.preventDefault();
    this.isResizing = true;
    this.currentPanel = panel;

    // Add dragging class for visual feedback
    const handle = panel.querySelector('.detail-panel-resize');
    if (handle) handle.classList.add('dragging');

    // Add document-level listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  }

  /**
   * Handle mouse move while resizing
   */
  handleMouseMove(e) {
    if (!this.isResizing || !this.currentPanel) return;

    // Calculate new width (from right edge to mouse position)
    const newWidth = window.innerWidth - e.clientX;

    // Clamp to min/max
    const clampedWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));

    // Apply width
    this.currentPanel.style.width = `${clampedWidth}px`;
  }

  /**
   * Handle mouse up - stop resizing and save width
   */
  handleMouseUp() {
    if (!this.isResizing) return;

    this.isResizing = false;

    // Remove dragging class
    if (this.currentPanel) {
      const handle = this.currentPanel.querySelector('.detail-panel-resize');
      if (handle) handle.classList.remove('dragging');

      // Save the final width
      const finalWidth = parseInt(this.currentPanel.style.width, 10);
      if (finalWidth) {
        this.saveWidth(finalWidth);
      }
    }

    // Remove document-level listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);

    // Restore normal selection
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    this.currentPanel = null;
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.stopCountdownUpdates();
    // Clean up resize listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    super.destroy();
  }
}
