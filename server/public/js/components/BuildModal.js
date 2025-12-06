/**
 * BuildModal Component
 * Modal for building construction with building selection grid
 */

class BuildModal extends Modal {
  constructor(accountData, onBuild) {
    super('🏗️ Építés', { width: '700px' });
    this.accountData = accountData;
    this.onBuild = onBuild;
    this.selectedBuilding = null;
    this.levels = 1;

    // Building definitions
    this.buildings = [
      { key: 'main', name: 'Főépület', category: 'main' },
      { key: 'barracks', name: 'Kaszárnya', category: 'military' },
      { key: 'stable', name: 'Istálló', category: 'military' },
      { key: 'garage', name: 'Műhely', category: 'military' },
      { key: 'snob', name: 'Akadémia', category: 'military' },
      { key: 'smith', name: 'Kovács', category: 'military' },
      { key: 'place', name: 'Gyülekezőhely', category: 'military' },
      { key: 'statue', name: 'Szobor', category: 'other' },
      { key: 'market', name: 'Piac', category: 'economy' },
      { key: 'wood', name: 'Favágó', category: 'resource' },
      { key: 'stone', name: 'Agyagbánya', category: 'resource' },
      { key: 'iron', name: 'Vasbánya', category: 'resource' },
      { key: 'farm', name: 'Farm', category: 'resource' },
      { key: 'storage', name: 'Raktár', category: 'resource' },
      { key: 'hide', name: 'Rejtekely', category: 'defense' },
      { key: 'wall', name: 'Fal', category: 'defense' }
    ];
  }

  /**
   * Render modal body
   */
  renderBody(body) {
    // Info text
    const info = this.createElement('div', {
      className: 'info',
      style: { marginBottom: 'var(--spacing-md)', fontSize: '11px' }
    }, `Válassz épületet a ${this.accountData.data.villageName || 'falu'} faluban való építéshez.`);
    body.appendChild(info);

    // Building selection grid
    const grid = this.createElement('div', {
      className: 'buildings-grid',
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-md)'
      }
    });

    this.buildings.forEach(building => {
      const currentLevel = this.accountData.data.buildings?.[building.key] || 0;
      const card = this.createBuildingCard(building, currentLevel);
      grid.appendChild(card);
    });

    body.appendChild(grid);

    // Level selector (shown when building is selected)
    const levelContainer = this.createElement('div', {
      id: 'level-selector-container',
      style: { display: 'none', marginTop: 'var(--spacing-md)' }
    });

    const levelLabel = this.createElement('label', {
      style: { display: 'block', marginBottom: 'var(--spacing-xs)', fontWeight: 'bold' }
    }, 'Szintek száma:');
    levelContainer.appendChild(levelLabel);

    const levelInput = this.createElement('input', {
      type: 'number',
      id: 'build-levels-input',
      className: 'form-control',
      value: '1',
      min: '1',
      max: '10',
      style: { width: '100px' }
    });
    levelContainer.appendChild(levelInput);

    body.appendChild(levelContainer);
  }

  /**
   * Create building card
   */
  createBuildingCard(building, currentLevel) {
    const card = this.createElement('div', {
      className: 'building-card',
      style: {
        padding: 'var(--spacing-sm)',
        background: 'rgba(255, 255, 255, 0.5)',
        border: '2px solid var(--tw-border-light)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all var(--transition-fast)',
        position: 'relative'
      },
      onClick: () => this.selectBuilding(building.key)
    });

    // Icon
    const icon = this.createElement('img', {
      src: this.getBuildingIcon(building.key),
      alt: building.name,
      style: {
        width: '48px',
        height: '48px',
        display: 'block',
        margin: '0 auto var(--spacing-xs)'
      }
    });
    card.appendChild(icon);

    // Level badge
    const levelBadge = this.createElement('div', {
      style: {
        position: 'absolute',
        top: '4px',
        right: '4px',
        background: 'var(--tw-bg-dark)',
        color: 'white',
        padding: '2px 6px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '10px',
        fontWeight: 'bold'
      }
    }, currentLevel.toString());
    card.appendChild(levelBadge);

    // Name
    const name = this.createElement('div', {
      style: { fontSize: '11px', fontWeight: 'bold', color: 'var(--tw-text-dark)' }
    }, building.name);
    card.appendChild(name);

    // Store building key
    card.dataset.building = building.key;

    return card;
  }

  /**
   * Select a building
   */
  selectBuilding(buildingKey) {
    this.selectedBuilding = buildingKey;

    // Update card styling
    const cards = this.modal.querySelectorAll('.building-card');
    cards.forEach(card => {
      if (card.dataset.building === buildingKey) {
        card.style.borderColor = 'var(--tw-btn-green)';
        card.style.background = 'rgba(93, 126, 30, 0.1)';
        card.style.transform = 'scale(1.05)';
      } else {
        card.style.borderColor = 'var(--tw-border-light)';
        card.style.background = 'rgba(255, 255, 255, 0.5)';
        card.style.transform = 'scale(1)';
      }
    });

    // Show level selector
    const levelContainer = this.modal.querySelector('#level-selector-container');
    if (levelContainer) {
      levelContainer.style.display = 'block';
    }
  }

  /**
   * Get submit button text
   */
  getSubmitButtonText() {
    return 'Építés Indítása';
  }

  /**
   * Handle submit
   */
  async handleSubmit() {
    if (!this.selectedBuilding) {
      this.showError('Válassz egy épületet!');
      return;
    }

    const levelsInput = this.modal.querySelector('#build-levels-input');
    const levels = parseInt(levelsInput?.value || 1);

    if (levels < 1 || levels > 10) {
      this.showError('A szintek száma 1 és 10 között kell legyen!');
      return;
    }

    this.hideError();
    this.showLoading('Építési parancs küldése...');

    try {
      // Call the onBuild callback
      if (this.onBuild) {
        await this.onBuild({
          accountId: this.accountData.accountId,
          building: this.selectedBuilding,
          levels: levels
        });
      }

      // Close modal on success
      this.hideLoading();
      this.close();
    } catch (error) {
      this.hideLoading();
      this.showError(error.message || 'Hiba történt az építés indítása során!');
    }
  }
}
