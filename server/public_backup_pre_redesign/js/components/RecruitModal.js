/**
 * RecruitModal Component
 * Modal for recruiting troops with building-specific sections
 */

class RecruitModal extends Modal {
  constructor(accountData, onRecruit) {
    super('👥 Toborzás', { width: '700px' });
    this.accountData = accountData;
    this.onRecruit = onRecruit;
    this.selectedBuilding = 'barracks'; // Default

    // Unit definitions by building
    this.units = {
      barracks: [
        { key: 'spear', name: 'Lándzsás', icon: 'spear' },
        { key: 'sword', name: 'Kardos', icon: 'sword' },
        { key: 'axe', name: 'Fejszés', icon: 'axe' },
        { key: 'archer', name: 'Íjász', icon: 'archer' },
      ],
      stable: [
        { key: 'spy', name: 'Felderítő', icon: 'spy' },
        { key: 'light', name: 'Könnyűlovas', icon: 'light' },
        { key: 'marcher', name: 'Lovasíjász', icon: 'marcher' },
        { key: 'heavy', name: 'Nehézlovas', icon: 'heavy' }
      ],
      garage: [
        { key: 'ram', name: 'Faltörő Kos', icon: 'ram' },
        { key: 'catapult', name: 'Katapult', icon: 'catapult' }
      ],
      snob: [
        { key: 'snob', name: 'Nemes', icon: 'snob' }
      ]
    };

    this.buildingNames = {
      barracks: 'Kaszárnya',
      stable: 'Istálló',
      garage: 'Műhely',
      snob: 'Akadémia'
    };
  }

  /**
   * Render modal body
   */
  renderBody(body) {
    // Info text
    const info = this.createElement('div', {
      className: 'info',
      style: { marginBottom: 'var(--spacing-md)', fontSize: '11px' }
    }, `Válassz épületet és add meg a toborzandó egységek számát.`);
    body.appendChild(info);

    // Building tabs
    const tabs = this.createElement('div', {
      className: 'tabs',
      style: { marginBottom: 'var(--spacing-md)' }
    });

    Object.keys(this.units).forEach(buildingKey => {
      const buildingLevel = this.accountData.data.buildings?.[buildingKey] || 0;
      const disabled = buildingLevel === 0;

      const tab = this.createElement('button', {
        className: `tab-button ${buildingKey === this.selectedBuilding ? 'active' : ''} ${disabled ? 'disabled' : ''}`,
        dataset: { building: buildingKey },
        disabled: disabled,
        onClick: () => {
          if (!disabled) {
            this.selectBuilding(buildingKey);
          }
        },
        style: disabled ? { opacity: '0.5', cursor: 'not-allowed' } : {}
      }, `${this.buildingNames[buildingKey]} (${buildingLevel})`);
      tabs.appendChild(tab);
    });

    body.appendChild(tabs);

    // Unit selection container
    const unitsContainer = this.createElement('div', {
      id: 'units-container'
    });
    body.appendChild(unitsContainer);

    // Render initial building units
    this.renderUnits(unitsContainer);
  }

  /**
   * Select a building
   */
  selectBuilding(buildingKey) {
    this.selectedBuilding = buildingKey;

    // Update tabs
    const tabs = this.modal.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
      if (tab.dataset.building === buildingKey) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Re-render units
    const unitsContainer = this.modal.querySelector('#units-container');
    if (unitsContainer) {
      unitsContainer.innerHTML = '';
      this.renderUnits(unitsContainer);
    }
  }

  /**
   * Render units for selected building
   */
  renderUnits(container) {
    const units = this.units[this.selectedBuilding] || [];

    if (units.length === 0) {
      const empty = this.createElement('p', {
        style: { textAlign: 'center', color: '#999', padding: 'var(--spacing-lg)' }
      }, 'Nincs elérhető egység ebben az épületben.');
      container.appendChild(empty);
      return;
    }

    const grid = this.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--spacing-md)'
      }
    });

    units.forEach(unit => {
      const card = this.createUnitCard(unit);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  /**
   * Create unit recruitment card
   */
  createUnitCard(unit) {
    const card = this.createElement('div', {
      style: {
        padding: 'var(--spacing-md)',
        background: 'rgba(255, 255, 255, 0.5)',
        border: '1px solid var(--tw-border-light)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)'
      }
    });

    // Icon
    const icon = this.createElement('img', {
      src: this.getUnitIcon(unit.icon),
      alt: unit.name,
      style: {
        width: '48px',
        height: '48px',
        flexShrink: '0'
      }
    });
    card.appendChild(icon);

    // Info container
    const infoContainer = this.createElement('div', {
      style: { flex: '1' }
    });

    // Name
    const name = this.createElement('div', {
      style: { fontWeight: 'bold', marginBottom: 'var(--spacing-xs)' }
    }, unit.name);
    infoContainer.appendChild(name);

    // Input group
    const inputGroup = this.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }
    });

    const label = this.createElement('label', {
      style: { fontSize: '11px' }
    }, 'Mennyiség:');
    inputGroup.appendChild(label);

    const input = this.createElement('input', {
      type: 'number',
      className: 'form-control unit-input',
      dataset: { unitKey: unit.key, building: this.selectedBuilding },
      value: '0',
      min: '0',
      max: '1000',
      style: { width: '120px', padding: '6px' }
    });
    inputGroup.appendChild(input);

    infoContainer.appendChild(inputGroup);
    card.appendChild(infoContainer);

    return card;
  }

  /**
   * Get submit button text
   */
  getSubmitButtonText() {
    return 'Toborzás Indítása';
  }

  /**
   * Handle submit
   */
  async handleSubmit() {
    // Collect units
    const units = {};
    const inputs = this.modal.querySelectorAll('.unit-input');
    let totalUnits = 0;

    inputs.forEach(input => {
      const key = input.dataset.unitKey;
      const building = input.dataset.building;
      const count = parseInt(input.value || 0);

      // Only include units from currently selected building
      if (building === this.selectedBuilding && count > 0) {
        units[key] = count;
        totalUnits += count;
      }
    });

    if (totalUnits === 0) {
      this.showError('Add meg legalább egy egység számát!');
      return;
    }

    this.hideError();
    this.showLoading('Toborzási parancs küldése...');

    try {
      // Call the onRecruit callback
      if (this.onRecruit) {
        await this.onRecruit({
          accountId: this.accountData.accountId,
          building: this.selectedBuilding,
          units: units
        });
      }

      // Close modal on success
      this.hideLoading();
      this.close();
    } catch (error) {
      this.hideLoading();
      this.showError(error.message || 'Hiba történt a toborzás indítása során!');
    }
  }
}
