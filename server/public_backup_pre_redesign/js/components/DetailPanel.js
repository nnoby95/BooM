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

    // Header
    panel.appendChild(this.createHeader(account));

    // Body with sections
    const body = this.createElement('div', { className: 'detail-panel-body' });

    // Village Info
    body.appendChild(this.createVillageInfoSection(account));

    // Resources
    if (account.data.resources) {
      body.appendChild(this.createResourcesSection(account.data.resources));
    }

    // Troops
    if (account.data.troops) {
      body.appendChild(this.createTroopsSection(account.data.troops));
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

    // Notes (if exists)
    if (account.notes) {
      body.appendChild(this.createNotesSection(account));
    }

    // Action Buttons
    body.appendChild(this.createActionsSection(account));

    panel.appendChild(body);

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
   * Create actions section
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
   * Cleanup on destroy
   */
  destroy() {
    this.stopCountdownUpdates();
    super.destroy();
  }
}
