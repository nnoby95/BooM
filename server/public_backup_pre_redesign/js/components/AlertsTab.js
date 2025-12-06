/**
 * AlertsTab Component
 * Displays incoming attacks and recent events
 */

class AlertsTab extends Component {
  constructor(containerSelector) {
    super(containerSelector);
    this.state = {
      incomingAttacks: [],
      events: [],
      acknowledgedAttacks: new Set()
    };

    // Update countdowns every second
    this.countdownInterval = setInterval(() => {
      if (this.state.incomingAttacks.length > 0) {
        this.updateCountdowns();
      }
    }, 1000);
  }

  /**
   * Update the alerts with new data
   */
  update(accounts) {
    // Extract incoming attacks from all accounts
    const attacks = [];
    accounts.forEach(account => {
      if (account.data && account.data.incomingAttacks) {
        account.data.incomingAttacks.forEach(attack => {
          attacks.push({
            ...attack,
            accountId: account.accountId,
            accountName: account.data.accountName || account.accountId,
            villageName: account.data.villageName || 'Falu',
            coords: account.data.coords || 'N/A'
          });
        });
      }
    });

    // Sort by arrival time (soonest first)
    attacks.sort((a, b) => a.arrivalTime - b.arrivalTime);

    // Filter out acknowledged attacks
    const activeAttacks = attacks.filter(attack =>
      !this.state.acknowledgedAttacks.has(attack.id || `${attack.accountId}-${attack.arrivalTime}`)
    );

    this.setState({ incomingAttacks: activeAttacks });
  }

  /**
   * Add event to the log
   */
  addEvent(event) {
    const events = [...this.state.events];
    events.unshift({
      ...event,
      timestamp: event.timestamp || Date.now()
    });

    // Keep last 50 events
    if (events.length > 50) {
      events.splice(50);
    }

    this.setState({ events });
  }

  /**
   * Get priority level based on time remaining
   */
  getPriority(arrivalTime) {
    const now = Date.now();
    const remaining = arrivalTime - now;
    const minutes = remaining / 60000;

    if (minutes < 10) return { level: 'urgent', emoji: '🔴', label: 'SÜRGŐS' };
    if (minutes < 60) return { level: 'warning', emoji: '🟡', label: '' };
    return { level: 'safe', emoji: '🟢', label: '' };
  }

  /**
   * Get attack size label
   */
  getAttackSize(units) {
    if (!units) return 'Ismeretlen';
    const total = Object.values(units).reduce((sum, count) => sum + count, 0);

    if (total > 5000) return 'Hatalmas támadás';
    if (total > 1000) return 'Nagy támadás';
    if (total > 200) return 'Közepes';
    return 'Kicsi';
  }

  /**
   * Acknowledge an attack (hide it)
   */
  acknowledgeAttack(attack) {
    const id = attack.id || `${attack.accountId}-${attack.arrivalTime}`;
    const acknowledged = new Set(this.state.acknowledgedAttacks);
    acknowledged.add(id);

    this.setState({ acknowledgedAttacks: acknowledged });
  }

  /**
   * Open account detail panel
   */
  openAccount(accountId) {
    // Trigger detail panel open via app.js
    if (window.detailPanel) {
      // Find account data
      const account = window.accounts?.find(a => a.accountId === accountId);
      if (account) {
        window.detailPanel.show(account);
      }
    }
  }

  /**
   * Open support modal for account
   */
  openSupportModal(accountId) {
    const account = window.accounts?.find(a => a.accountId === accountId);
    if (account && window.AttackModal) {
      const modal = new AttackModal(account, 'support', async (sendData) => {
        const response = await fetch('/api/commands/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sendData)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send support');
        }

        // Add event
        this.addEvent({
          icon: '🛡️',
          accountName: account.data.accountName,
          message: `Támogatás elküldve: ${sendData.targetCoords}`
        });
      });
      modal.open();
    }
  }

  /**
   * Update countdown timers
   */
  updateCountdowns() {
    const countdownElements = this.container.querySelectorAll('[data-countdown]');
    countdownElements.forEach(el => {
      const arrivalTime = parseInt(el.dataset.countdown);
      const countdown = this.formatCountdown(arrivalTime);
      el.textContent = `Érkezik ${countdown}`;
    });
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return null;

    this.container.innerHTML = '';
    this.container.className = 'alerts-tab';

    // Incoming Attacks Section
    const attacksSection = this.createElement('div', {
      className: 'tw-section',
      style: { marginBottom: 'var(--spacing-lg)' }
    });

    const attacksHeader = this.createElement('h3', {
      className: 'section-title',
      style: {
        marginBottom: 'var(--spacing-md)',
        fontSize: '12px',
        fontWeight: 'bold',
        color: 'var(--tw-text-dark)'
      }
    }, `Aktív Bejövő Támadások (${this.state.incomingAttacks.length})`);
    attacksSection.appendChild(attacksHeader);

    if (this.state.incomingAttacks.length === 0) {
      const noAttacks = this.createElement('div', {
        className: 'info-box',
        style: {
          padding: 'var(--spacing-md)',
          background: 'rgba(93, 126, 30, 0.1)',
          border: '1px solid var(--tw-btn-green)',
          borderRadius: 'var(--radius-sm)',
          textAlign: 'center',
          color: 'var(--tw-text-dark)'
        }
      }, '✅ Nincs aktív bejövő támadás');
      attacksSection.appendChild(noAttacks);
    } else {
      const attacksList = this.createElement('div', {
        className: 'attacks-list',
        style: { display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }
      });

      this.state.incomingAttacks.forEach(attack => {
        const attackCard = this.createAttackCard(attack);
        attacksList.appendChild(attackCard);
      });

      attacksSection.appendChild(attacksList);
    }

    this.container.appendChild(attacksSection);

    // Events Section
    const eventsSection = this.createElement('div', {
      className: 'tw-section'
    });

    const eventsHeader = this.createElement('h3', {
      className: 'section-title',
      style: {
        marginBottom: 'var(--spacing-md)',
        fontSize: '12px',
        fontWeight: 'bold',
        color: 'var(--tw-text-dark)'
      }
    }, 'Események');
    eventsSection.appendChild(eventsHeader);

    const eventsList = this.createElement('div', {
      className: 'events-list',
      style: {
        background: 'rgba(255, 255, 255, 0.5)',
        border: '1px solid var(--tw-border-light)',
        borderRadius: 'var(--radius-sm)',
        padding: 'var(--spacing-md)',
        maxHeight: '300px',
        overflowY: 'auto'
      }
    });

    if (this.state.events.length === 0) {
      const noEvents = this.createElement('div', {
        style: { textAlign: 'center', color: '#999', padding: 'var(--spacing-md)' }
      }, 'Még nincsenek események');
      eventsList.appendChild(noEvents);
    } else {
      this.state.events.forEach(event => {
        const eventRow = this.createEventRow(event);
        eventsList.appendChild(eventRow);
      });
    }

    eventsSection.appendChild(eventsList);
    this.container.appendChild(eventsSection);

    return this.container;
  }

  /**
   * Create attack card
   */
  createAttackCard(attack) {
    const priority = this.getPriority(attack.arrivalTime);

    const card = this.createElement('div', {
      className: `attack-card priority-${priority.level}`,
      style: {
        padding: 'var(--spacing-md)',
        background: 'rgba(255, 255, 255, 0.8)',
        border: `2px solid ${priority.level === 'urgent' ? '#d9534f' : priority.level === 'warning' ? '#f0ad4e' : '#5cb85c'}`,
        borderRadius: 'var(--radius-sm)'
      }
    });

    // Priority and countdown header
    const header = this.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-sm)',
        fontWeight: 'bold',
        fontSize: '12px'
      }
    });

    const priorityLabel = this.createElement('div', {
      style: { color: priority.level === 'urgent' ? '#d9534f' : priority.level === 'warning' ? '#f0ad4e' : '#5cb85c' }
    }, `${priority.emoji} ${priority.label}`);
    header.appendChild(priorityLabel);

    const countdown = this.createElement('div', {
      dataset: { countdown: attack.arrivalTime.toString() },
      style: { color: 'var(--tw-text-dark)' }
    }, `Érkezik ${this.formatCountdown(attack.arrivalTime)}`);
    header.appendChild(countdown);

    card.appendChild(header);

    // Attack details
    const details = this.createElement('div', {
      style: {
        background: 'rgba(255, 255, 255, 0.6)',
        padding: 'var(--spacing-sm)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 'var(--spacing-sm)'
      }
    });

    const target = this.createElement('div', {
      style: { marginBottom: '4px', fontSize: '11px' }
    }, `Cél: ${attack.accountName} - ${attack.villageName} (${attack.coords})`);
    details.appendChild(target);

    const source = this.createElement('div', {
      style: { marginBottom: '4px', fontSize: '11px' }
    }, `Honnan: ${attack.sourceCoords || 'Ismeretlen'}${attack.sourceTribe ? ` (${attack.sourceTribe} - ${attack.sourcePlayer})` : ''}`);
    details.appendChild(source);

    const size = this.createElement('div', {
      style: { fontSize: '11px' }
    }, `Méret: ${this.getAttackSize(attack.units)}`);
    details.appendChild(size);

    card.appendChild(details);

    // Action buttons
    const actions = this.createElement('div', {
      style: {
        display: 'flex',
        gap: 'var(--spacing-sm)',
        flexWrap: 'wrap'
      }
    });

    const viewBtn = this.createElement('button', {
      className: 'btn btn-sm btn-brown',
      onClick: () => this.openAccount(attack.accountId)
    }, '👁️ Megnyit');
    actions.appendChild(viewBtn);

    const supportBtn = this.createElement('button', {
      className: 'btn btn-sm btn-primary',
      onClick: () => this.openSupportModal(attack.accountId)
    }, '🛡️ Támogatás küldése');
    actions.appendChild(supportBtn);

    const ackBtn = this.createElement('button', {
      className: 'btn btn-sm btn-brown',
      onClick: () => this.acknowledgeAttack(attack)
    }, '✓ Nyugtázás');
    actions.appendChild(ackBtn);

    card.appendChild(actions);

    return card;
  }

  /**
   * Create event row
   */
  createEventRow(event) {
    const row = this.createElement('div', {
      style: {
        padding: 'var(--spacing-xs) 0',
        borderBottom: '1px solid var(--tw-border-light)',
        fontSize: '11px',
        color: 'var(--tw-text-dark)'
      }
    });

    const time = this.createElement('span', {
      style: { marginRight: 'var(--spacing-sm)', color: '#666' }
    }, this.formatTime(event.timestamp));
    row.appendChild(time);

    row.appendChild(document.createTextNode(` ${event.icon || '📌'}  `));

    const accountName = this.createElement('span', {
      style: { fontWeight: 'bold', marginRight: 'var(--spacing-xs)' }
    }, event.accountName || '');
    row.appendChild(accountName);

    row.appendChild(document.createTextNode(event.message || ''));

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

  /**
   * Cleanup on destroy
   */
  destroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    super.destroy();
  }
}
