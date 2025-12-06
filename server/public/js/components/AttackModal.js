/**
 * AttackModal Component
 * Modal for sending troops (attack or support)
 */

class AttackModal extends Modal {
  constructor(accountData, sendType, onSend) {
    const title = sendType === 'support' ? '🛡️ Támogatás Küldése' : '⚔️ Támadás Indítása';
    super(title, { width: '700px' });
    this.accountData = accountData;
    this.sendType = sendType; // 'attack' or 'support'
    this.onSend = onSend;

    // Troop definitions
    this.troops = [
      { key: 'spear', name: 'Lándzsás', icon: 'spear' },
      { key: 'sword', name: 'Kardos', icon: 'sword' },
      { key: 'axe', name: 'Fejszés', icon: 'axe' },
      { key: 'archer', name: 'Íjász', icon: 'archer' },
      { key: 'spy', name: 'Felderítő', icon: 'spy' },
      { key: 'light', name: 'Könnyűlovas', icon: 'light' },
      { key: 'marcher', name: 'Lovasíjász', icon: 'marcher' },
      { key: 'heavy', name: 'Nehézlovas', icon: 'heavy' },
      { key: 'ram', name: 'Faltörő', icon: 'ram' },
      { key: 'catapult', name: 'Katapult', icon: 'catapult' },
      { key: 'knight', name: 'Lovag', icon: 'knight' },
      { key: 'snob', name: 'Nemes', icon: 'snob' }
    ];
  }

  /**
   * Render modal body
   */
  renderBody(body) {
    // Info text
    const actionText = this.sendType === 'support' ? 'támogatást' : 'támadást';
    const info = this.createElement('div', {
      className: 'info',
      style: { marginBottom: 'var(--spacing-md)', fontSize: '11px' }
    }, `Küldj ${actionText} innen: ${this.accountData.data.villageName || 'falu'} (${this.accountData.data.coords || 'N/A'})`);
    body.appendChild(info);

    // Target coordinates
    const coordsGroup = this.createElement('div', {
      className: 'form-group'
    });

    const coordsLabel = this.createElement('label', {}, 'Célkoordináták:');
    coordsGroup.appendChild(coordsLabel);

    const coordsInput = this.createElement('input', {
      type: 'text',
      id: 'target-coords-input',
      className: 'form-control',
      placeholder: '500|500',
      style: { width: '150px' }
    });
    coordsGroup.appendChild(coordsInput);

    body.appendChild(coordsGroup);

    // Troops selection grid
    const troopsTitle = this.createElement('h4', {
      style: {
        marginTop: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-sm)',
        fontSize: '12px',
        fontWeight: 'bold'
      }
    }, 'Csapatok:');
    body.appendChild(troopsTitle);

    const troopsGrid = this.createElement('div', {
      className: 'troops-selection-grid',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-md)'
      }
    });

    this.troops.forEach(troop => {
      const available = this.accountData.data.troops?.[troop.key] || 0;
      const card = this.createTroopCard(troop, available);
      troopsGrid.appendChild(card);
    });

    body.appendChild(troopsGrid);

    // Quick actions
    const actionsDiv = this.createElement('div', {
      style: {
        display: 'flex',
        gap: 'var(--spacing-sm)',
        marginTop: 'var(--spacing-sm)'
      }
    });

    const selectAllBtn = this.createElement('button', {
      className: 'btn btn-sm btn-brown',
      onClick: () => this.selectAllTroops()
    }, 'Összes Kiválasztása');
    actionsDiv.appendChild(selectAllBtn);

    const clearBtn = this.createElement('button', {
      className: 'btn btn-sm btn-brown',
      onClick: () => this.clearAllTroops()
    }, 'Törlés');
    actionsDiv.appendChild(clearBtn);

    body.appendChild(actionsDiv);
  }

  /**
   * Create troop selection card
   */
  createTroopCard(troop, available) {
    const card = this.createElement('div', {
      className: 'troop-card',
      style: {
        padding: 'var(--spacing-sm)',
        background: 'rgba(255, 255, 255, 0.5)',
        border: '1px solid var(--tw-border-light)',
        borderRadius: 'var(--radius-sm)',
        textAlign: 'center'
      }
    });

    // Icon
    const icon = this.createElement('img', {
      src: this.getUnitIcon(troop.icon),
      alt: troop.name,
      style: {
        width: '32px',
        height: '32px',
        display: 'block',
        margin: '0 auto var(--spacing-xs)'
      }
    });
    card.appendChild(icon);

    // Name
    const name = this.createElement('div', {
      style: { fontSize: '10px', marginBottom: 'var(--spacing-xs)' }
    }, troop.name);
    card.appendChild(name);

    // Available count
    const availableText = this.createElement('div', {
      style: { fontSize: '10px', color: '#666', marginBottom: 'var(--spacing-xs)' }
    }, `Elérhető: ${this.formatNumber(available)}`);
    card.appendChild(availableText);

    // Input
    const input = this.createElement('input', {
      type: 'number',
      className: 'form-control troop-input',
      dataset: { troopKey: troop.key },
      value: '0',
      min: '0',
      max: available.toString(),
      style: {
        width: '100%',
        padding: '4px',
        fontSize: '11px',
        textAlign: 'center'
      }
    });
    card.appendChild(input);

    return card;
  }

  /**
   * Select all available troops
   */
  selectAllTroops() {
    const inputs = this.modal.querySelectorAll('.troop-input');
    inputs.forEach(input => {
      const max = parseInt(input.getAttribute('max') || 0);
      input.value = max;
    });
  }

  /**
   * Clear all troop selections
   */
  clearAllTroops() {
    const inputs = this.modal.querySelectorAll('.troop-input');
    inputs.forEach(input => {
      input.value = '0';
    });
  }

  /**
   * Get submit button text
   */
  getSubmitButtonText() {
    return this.sendType === 'support' ? 'Támogatás Küldése' : 'Támadás Indítása';
  }

  /**
   * Handle submit
   */
  async handleSubmit() {
    // Validate coordinates
    const coordsInput = this.modal.querySelector('#target-coords-input');
    const coords = coordsInput?.value?.trim();

    if (!coords || !/^\d+\|\d+$/.test(coords)) {
      this.showError('Érvényes koordinátákat adj meg (pl. 500|500)!');
      return;
    }

    // Collect troops
    const troops = {};
    const inputs = this.modal.querySelectorAll('.troop-input');
    let totalTroops = 0;

    inputs.forEach(input => {
      const key = input.dataset.troopKey;
      const count = parseInt(input.value || 0);
      if (count > 0) {
        troops[key] = count;
        totalTroops += count;
      }
    });

    if (totalTroops === 0) {
      this.showError('Válassz legalább egy egységet!');
      return;
    }

    this.hideError();
    this.showLoading('Parancs küldése...');

    try {
      // Call the onSend callback
      if (this.onSend) {
        await this.onSend({
          accountId: this.accountData.accountId,
          targetCoords: coords,
          troops: troops,
          sendType: this.sendType
        });
      }

      // Close modal on success
      this.hideLoading();
      this.close();
    } catch (error) {
      this.hideLoading();
      this.showError(error.message || 'Hiba történt a parancs küldése során!');
    }
  }
}
