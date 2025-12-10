/**
 * AccountCard Component
 * Displays individual account information in a card format
 */

class AccountCard extends Component {
  constructor(accountData, onCardClick, onFavoriteToggle) {
    super(null); // No container needed, we create the card element
    this.accountData = accountData;
    this.onCardClick = onCardClick;
    this.onFavoriteToggle = onFavoriteToggle;
    this.element = null;
  }

  /**
   * Update account data and re-render
   * @param {Object} accountData - New account data
   */
  update(accountData) {
    this.accountData = accountData;
    this.render();
  }

  /**
   * Render the account card
   * @returns {HTMLElement}
   */
  render() {
    const account = this.accountData;
    const isConnected = account.status === 'connected';
    // Handle both new object format { attacks, supports } and legacy array format
    const incomings = account.data.incomings;
    const incomingAttacks = incomings?.attacks ?? (Array.isArray(incomings) ? incomings.length : 0);
    const hasAlert = incomingAttacks > 0;

    // Create card element
    const card = this.createElement('div', {
      className: `account-card ${!isConnected ? 'disconnected' : ''} ${hasAlert ? 'has-alert' : ''}`,
      dataset: { accountId: account.accountId },
      onClick: () => this.handleCardClick()
    });

    // Header
    const header = this.createHeader(account, isConnected);
    card.appendChild(header);

    // Body
    const body = this.createElement('div', { className: 'account-card-body' });

    // Village info
    body.appendChild(this.createVillageInfo(account));

    // Resources
    if (account.data.resources) {
      body.appendChild(this.createResourcesSection(account.data.resources));
    }

    // Incoming attacks - always show (with 0 or count)
    body.appendChild(this.createIncomingAttacksRow(incomingAttacks));

    // Building queue
    if (account.data.buildQueue && account.data.buildQueue.length > 0) {
      body.appendChild(this.createBuildQueue(account.data.buildQueue));
    }

    // Recruitment queue
    if (account.data.recruitQueue && account.data.recruitQueue.length > 0) {
      body.appendChild(this.createRecruitQueue(account.data.recruitQueue));
    }

    card.appendChild(body);

    // Footer
    const footer = this.createFooter(account);
    card.appendChild(footer);

    // Store reference and return
    this.element = card;
    return card;
  }

  /**
   * Create card header with account name and actions
   */
  createHeader(account, isConnected) {
    const header = this.createElement('div', { className: 'account-card-header' });

    // Account name
    const name = this.createElement('div', { className: 'account-name' }, account.accountId);
    header.appendChild(name);

    // Actions (favorite button and status dot)
    const actions = this.createElement('div', { className: 'account-header-actions' });

    // Favorite button
    const favoriteBtn = this.createElement('button', {
      className: `favorite-btn ${account.favorite ? 'active' : ''}`,
      onClick: (e) => {
        e.stopPropagation();
        this.handleFavoriteClick();
      }
    }, account.favorite ? '⭐' : '☆');
    actions.appendChild(favoriteBtn);

    // Status dot
    const statusDot = this.createElement('span', {
      className: `status-dot ${!isConnected ? 'offline' : ''}`
    });
    actions.appendChild(statusDot);

    header.appendChild(actions);
    return header;
  }

  /**
   * Create village information section
   */
  createVillageInfo(account) {
    const info = this.createElement('div', { className: 'village-info' });

    const villageName = this.createElement('div', {
      className: 'village-name'
    }, `🏰 ${account.data.villageName || 'Ismeretlen Falu'}`);
    info.appendChild(villageName);

    const coords = this.createElement('div', {
      className: 'village-coords'
    }, `📍 ${account.data.coords || 'N/A'} | ${account.data.world || 'N/A'}`);
    info.appendChild(coords);

    return info;
  }

  /**
   * Create resources section with progress bars
   */
  createResourcesSection(resources) {
    const section = this.createElement('div', { className: 'account-resources' });

    // Wood
    section.appendChild(this.createResourceRow('wood', resources.wood, resources.storage));

    // Clay
    section.appendChild(this.createResourceRow('clay', resources.clay, resources.storage));

    // Iron
    section.appendChild(this.createResourceRow('iron', resources.iron, resources.storage));

    // Population
    if (resources.population) {
      section.appendChild(this.createResourceRow(
        'population',
        resources.population.used,
        resources.population.max
      ));
    }

    return section;
  }

  /**
   * Create individual resource row
   */
  createResourceRow(type, current, max) {
    const row = this.createElement('div', { className: 'resource-row' });

    // Icon
    const icon = this.createElement('span', { className: this.getResourceIconClass(type) });
    row.appendChild(icon);

    // Value
    const value = this.createElement('span', {
      className: 'resource-value'
    }, this.formatNumber(current));
    row.appendChild(value);

    // Progress bar
    const bar = this.createProgressBar(current, max, type);
    row.appendChild(bar);

    return row;
  }

  /**
   * Create incoming attacks row with TW attack icon
   */
  createIncomingAttacksRow(attackCount) {
    const row = this.createElement('div', { className: 'card-incoming-attacks' });

    // Attack icon from TW
    const icon = this.createElement('img', {
      className: 'card-attack-icon',
      src: 'https://dshu.innogamescdn.com/asset/fa5daa46/graphic/unit/att.webp',
      alt: 'Attack'
    });
    row.appendChild(icon);

    // Label
    const label = this.createElement('span', { className: 'card-attack-label' }, 'Bejövő:');
    row.appendChild(label);

    // Count badge
    const countBadge = this.createElement('span', {
      className: `card-attack-count ${attackCount > 0 ? 'has-attacks' : 'no-attacks'}`
    }, attackCount.toString());
    row.appendChild(countBadge);

    return row;
  }

  /**
   * Create building queue display
   */
  createBuildQueue(buildQueue) {
    const queueBox = this.createElement('div', { className: 'card-build-queue' });

    const firstItem = buildQueue[0];
    const text = this.createElement('span', {},
      `🏗️ ${this.getBuildingNameHu(firstItem.building)} ${firstItem.currentLevel}→${firstItem.targetLevel}`
    );
    queueBox.appendChild(text);

    const countdown = this.createElement('span', {
      className: 'countdown'
    }, this.formatCountdown(firstItem.finishTime));
    queueBox.appendChild(countdown);

    return queueBox;
  }

  /**
   * Create recruitment queue display
   */
  createRecruitQueue(recruitQueue) {
    const queueBox = this.createElement('div', { className: 'card-recruit-queue' });

    const items = recruitQueue.slice(0, 2).map(item => {
      return `[${item.unit}]x${item.count} (${this.formatCountdown(item.finishTime).slice(-5)})`;
    }).join(' → ');

    const text = this.createElement('span', {}, `👥 ${items}`);
    queueBox.appendChild(text);

    return queueBox;
  }

  /**
   * Create card footer with last update time
   */
  createFooter(account) {
    const footer = this.createElement('div', { className: 'account-card-footer' });

    const lastUpdate = this.createElement('span', {},
      `Frissítve: ${this.formatRelativeTime(account.lastUpdate)}`
    );
    footer.appendChild(lastUpdate);

    return footer;
  }

  /**
   * Handle card click
   */
  handleCardClick() {
    if (this.onCardClick) {
      this.onCardClick(this.accountData);
    }
  }

  /**
   * Handle favorite button click
   */
  handleFavoriteClick() {
    if (this.onFavoriteToggle) {
      this.onFavoriteToggle(this.accountData.accountId);
    }
  }

  /**
   * Get Hungarian building name
   * @param {string} building - Building key
   * @returns {string}
   */
  getBuildingNameHu(building) {
    const names = {
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
      stone: 'Agyagbánya',
      iron: 'Vasbánya',
      farm: 'Farm',
      storage: 'Raktár',
      hide: 'Rejtekely',
      wall: 'Fal'
    };
    return names[building] || building;
  }

  /**
   * Get the card DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }
}
