/**
 * SettingsTab Component
 * Dashboard settings and configuration
 */

class SettingsTab extends Component {
  constructor(containerSelector) {
    super(containerSelector);

    // Load settings from localStorage or use defaults
    const savedSettings = this.loadSettings();
    this.state = {
      settings: {
        // Connection
        serverUrl: savedSettings.serverUrl || window.location.origin,
        apiKey: savedSettings.apiKey || '',
        connectionStatus: 'connected',
        ping: 0,

        // Timing (Anti-Detection)
        globalDelayMin: savedSettings.globalDelayMin || 5,
        globalDelayMax: savedSettings.globalDelayMax || 15,
        accountCooldown: savedSettings.accountCooldown || 30,
        reportingFrequency: savedSettings.reportingFrequency || 60,

        // Alerts
        soundEnabled: savedSettings.soundEnabled !== false,
        browserNotifications: savedSettings.browserNotifications !== false,
        flashingTitle: savedSettings.flashingTitle !== false,
        alertSound: savedSettings.alertSound || 'tw-beep',
        alertVolume: savedSettings.alertVolume || 80,

        // Display
        theme: savedSettings.theme || 'tw',
        cardSize: savedSettings.cardSize || 'normal',
        sortBy: savedSettings.sortBy || 'favorites-name',
        favoritesFirst: savedSettings.favoritesFirst !== false,
        hideOffline: savedSettings.hideOffline || false
      },
      showApiKey: false,
      hasUnsavedChanges: false
    };

    // Update ping periodically
    this.pingInterval = setInterval(() => this.updatePing(), 5000);
    this.updatePing();
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem('tw-controller-settings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load settings:', e);
      return {};
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem('tw-controller-settings', JSON.stringify(this.state.settings));
      this.setState({ hasUnsavedChanges: false });

      // Show success message
      this.showSuccessMessage('Beállítások mentve!');

      // Apply settings
      this.applySettings();
    } catch (e) {
      console.error('Failed to save settings:', e);
      alert('Hiba a beállítások mentése során!');
    }
  }

  /**
   * Apply settings to the application
   */
  applySettings() {
    const settings = this.state.settings;

    // Apply display settings
    if (window.app && window.app.applyDisplaySettings) {
      window.app.applyDisplaySettings({
        sortBy: settings.sortBy,
        favoritesFirst: settings.favoritesFirst,
        hideOffline: settings.hideOffline,
        cardSize: settings.cardSize
      });
    }

    // Apply alert settings
    if (window.app && window.app.applyAlertSettings) {
      window.app.applyAlertSettings({
        soundEnabled: settings.soundEnabled,
        browserNotifications: settings.browserNotifications,
        flashingTitle: settings.flashingTitle,
        alertSound: settings.alertSound,
        alertVolume: settings.alertVolume
      });
    }
  }

  /**
   * Update a setting
   */
  updateSetting(key, value) {
    const settings = { ...this.state.settings };
    settings[key] = value;
    this.setState({ settings, hasUnsavedChanges: true });
  }

  /**
   * Update ping
   */
  async updatePing() {
    const startTime = Date.now();
    try {
      await fetch('/api/ping');
      const ping = Date.now() - startTime;
      const settings = { ...this.state.settings };
      settings.ping = ping;
      settings.connectionStatus = 'connected';
      this.setState({ settings });
    } catch (e) {
      const settings = { ...this.state.settings };
      settings.connectionStatus = 'disconnected';
      this.setState({ settings });
    }
  }

  /**
   * Test alert sound
   */
  testAlertSound() {
    // Play alert sound (would need actual audio implementation)
    alert('🔊 Alert sound: ' + this.state.settings.alertSound);
  }

  /**
   * Export settings
   */
  exportSettings() {
    const dataStr = JSON.stringify(this.state.settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tw-controller-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import settings
   */
  importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            this.setState({ settings: imported, hasUnsavedChanges: true });
            alert('Beállítások importálva! Ne felejtsd el menteni.');
          } catch (e) {
            alert('Hiba az importálás során!');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  /**
   * Clear all data
   */
  clearAllData() {
    if (confirm('⚠️ Ez törli az ÖSSZES beállítást és adatot! Biztos folytatod?')) {
      if (confirm('Utolsó figyelmeztetés! Ez nem visszavonható!')) {
        localStorage.clear();
        alert('Minden adat törölve. Az oldal újratöltődik.');
        window.location.reload();
      }
    }
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    const toast = this.createElement('div', {
      style: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: 'var(--spacing-md)',
        background: 'var(--tw-btn-green)',
        color: 'white',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: '10000',
        fontSize: '12px',
        fontWeight: 'bold'
      }
    }, `✓ ${message}`);

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /**
   * Render the component
   */
  render() {
    if (!this.container) return null;

    this.container.innerHTML = '';
    this.container.className = 'settings-tab';

    const settings = this.state.settings;

    // Connection Section
    const connectionSection = this.createSection('Kapcsolat', [
      this.createFormGroup('Szerver URL:', this.createElement('input', {
        type: 'text',
        className: 'form-control',
        value: settings.serverUrl,
        onInput: (e) => this.updateSetting('serverUrl', e.target.value),
        style: { width: '400px' }
      })),
      this.createFormGroup('API Kulcs:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }
        });

        const input = this.createElement('input', {
          type: this.state.showApiKey ? 'text' : 'password',
          className: 'form-control',
          value: settings.apiKey,
          onInput: (e) => this.updateSetting('apiKey', e.target.value),
          style: { width: '300px' }
        });
        container.appendChild(input);

        const toggleBtn = this.createElement('button', {
          className: 'btn btn-sm btn-brown',
          onClick: () => this.setState({ showApiKey: !this.state.showApiKey })
        }, this.state.showApiKey ? '👁️ Elrejt' : '👁️ Mutat');
        container.appendChild(toggleBtn);

        return container;
      })()),
      this.createFormGroup('', (() => {
        const status = this.createElement('div', {
          style: { fontSize: '11px', color: 'var(--tw-text-dark)' }
        });

        const statusDot = settings.connectionStatus === 'connected' ? '●' : '○';
        const statusColor = settings.connectionStatus === 'connected' ? 'var(--status-online)' : '#d9534f';
        const statusText = settings.connectionStatus === 'connected' ? 'Csatlakozva' : 'Kapcsolat megszakadt';

        status.innerHTML = `<span style="color: ${statusColor}">${statusDot}</span> ${statusText} | Ping: ${settings.ping}ms`;
        return status;
      })())
    ]);
    this.container.appendChild(connectionSection);

    // Timing Section
    const timingSection = this.createSection('Időzítések (Anti-Detection)', [
      this.createFormGroup('Globális késleltetés műveletek között:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }
        });

        container.appendChild(document.createTextNode('Min: '));
        const minInput = this.createElement('input', {
          type: 'number',
          className: 'form-control',
          value: settings.globalDelayMin.toString(),
          min: '1',
          max: '60',
          onInput: (e) => this.updateSetting('globalDelayMin', parseInt(e.target.value)),
          style: { width: '60px' }
        });
        container.appendChild(minInput);

        container.appendChild(document.createTextNode(' mp    Max: '));
        const maxInput = this.createElement('input', {
          type: 'number',
          className: 'form-control',
          value: settings.globalDelayMax.toString(),
          min: '1',
          max: '60',
          onInput: (e) => this.updateSetting('globalDelayMax', parseInt(e.target.value)),
          style: { width: '60px' }
        });
        container.appendChild(maxInput);

        container.appendChild(document.createTextNode(' mp       '));
        const hint = this.createElement('span', {
          style: { color: '#666', fontSize: '10px' }
        }, '(ajánlott: 5-15)');
        container.appendChild(hint);

        return container;
      })()),
      this.createFormGroup('Fiók lehűlési idő művelet után:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }
        });

        const input = this.createElement('input', {
          type: 'number',
          className: 'form-control',
          value: settings.accountCooldown.toString(),
          min: '10',
          max: '300',
          onInput: (e) => this.updateSetting('accountCooldown', parseInt(e.target.value)),
          style: { width: '60px' }
        });
        container.appendChild(input);

        container.appendChild(document.createTextNode(' másodperc       '));
        const hint = this.createElement('span', {
          style: { color: '#666', fontSize: '10px' }
        }, '(ajánlott: 30)');
        container.appendChild(hint);

        return container;
      })()),
      this.createFormGroup('Adat jelentési gyakoriság:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }
        });

        const input = this.createElement('input', {
          type: 'number',
          className: 'form-control',
          value: settings.reportingFrequency.toString(),
          min: '30',
          max: '300',
          onInput: (e) => this.updateSetting('reportingFrequency', parseInt(e.target.value)),
          style: { width: '60px' }
        });
        container.appendChild(input);

        container.appendChild(document.createTextNode(' másodperc       '));
        const hint = this.createElement('span', {
          style: { color: '#666', fontSize: '10px' }
        }, '(ajánlott: 55-70)');
        container.appendChild(hint);

        return container;
      })())
    ]);
    this.container.appendChild(timingSection);

    // Alerts Section
    const alertsSection = this.createSection('Riasztások', [
      this.createCheckbox('Hangjelzés bejövő támadásnál', settings.soundEnabled, (checked) =>
        this.updateSetting('soundEnabled', checked)
      ),
      this.createCheckbox('Böngésző értesítések', settings.browserNotifications, (checked) =>
        this.updateSetting('browserNotifications', checked)
      ),
      this.createCheckbox('Villogó cím támadásnál', settings.flashingTitle, (checked) =>
        this.updateSetting('flashingTitle', checked)
      ),
      this.createFormGroup('Riasztási hang:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }
        });

        const select = this.createElement('select', {
          className: 'form-control',
          onChange: (e) => this.updateSetting('alertSound', e.target.value),
          style: { width: '150px' }
        });

        const sounds = [
          { value: 'tw-beep', label: 'TW Beep' },
          { value: 'bell', label: 'Bell' },
          { value: 'alarm', label: 'Alarm' }
        ];

        sounds.forEach(sound => {
          const option = this.createElement('option', { value: sound.value }, sound.label);
          if (sound.value === settings.alertSound) {
            option.selected = true;
          }
          select.appendChild(option);
        });

        container.appendChild(select);

        const testBtn = this.createElement('button', {
          className: 'btn btn-sm btn-brown',
          onClick: () => this.testAlertSound()
        }, '▶️ Teszt');
        container.appendChild(testBtn);

        return container;
      })()),
      this.createFormGroup('Hangerő:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }
        });

        const slider = this.createElement('input', {
          type: 'range',
          min: '0',
          max: '100',
          value: settings.alertVolume.toString(),
          onInput: (e) => this.updateSetting('alertVolume', parseInt(e.target.value)),
          style: { width: '200px' }
        });
        container.appendChild(slider);

        const label = this.createElement('span', {
          style: { fontSize: '11px', minWidth: '40px' }
        }, `${settings.alertVolume}%`);
        container.appendChild(label);

        return container;
      })())
    ]);
    this.container.appendChild(alertsSection);

    // Display Section
    const displaySection = this.createSection('Megjelenés', [
      this.createFormGroup('Téma:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-md)' }
        });

        const themes = [
          { value: 'tw', label: 'Tribal Wars' },
          { value: 'dark', label: 'Sötét' },
          { value: 'light', label: 'Világos' }
        ];

        themes.forEach(theme => {
          const label = this.createRadio(theme.label, settings.theme === theme.value, () =>
            this.updateSetting('theme', theme.value)
          );
          container.appendChild(label);
        });

        return container;
      })()),
      this.createFormGroup('Kártya méret:', (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-md)' }
        });

        const sizes = [
          { value: 'small', label: 'Kicsi' },
          { value: 'normal', label: 'Normál' },
          { value: 'large', label: 'Nagy' }
        ];

        sizes.forEach(size => {
          const label = this.createRadio(size.label, settings.cardSize === size.value, () =>
            this.updateSetting('cardSize', size.value)
          );
          container.appendChild(label);
        });

        return container;
      })()),
      this.createFormGroup('Rendezés:', this.createElement('select', {
        className: 'form-control',
        onChange: (e) => this.updateSetting('sortBy', e.target.value),
        style: { width: '200px' }
      }, [
        this.createElement('option', { value: 'favorites-name', selected: settings.sortBy === 'favorites-name' }, 'Kedvencek + Név'),
        this.createElement('option', { value: 'name', selected: settings.sortBy === 'name' }, 'Név'),
        this.createElement('option', { value: 'status', selected: settings.sortBy === 'status' }, 'Státusz'),
        this.createElement('option', { value: 'points', selected: settings.sortBy === 'points' }, 'Pontszám')
      ])),
      this.createCheckbox('Kedvencek mindig elöl', settings.favoritesFirst, (checked) =>
        this.updateSetting('favoritesFirst', checked)
      ),
      this.createCheckbox('Offline fiókok elrejtése', settings.hideOffline, (checked) =>
        this.updateSetting('hideOffline', checked)
      )
    ]);
    this.container.appendChild(displaySection);

    // Templates Section
    const templatesSection = this.createSection('Sablonok Kezelése', [
      (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)' }
        });

        const buildTemplatesBtn = this.createElement('button', {
          className: 'btn btn-brown',
          onClick: () => {
            // Switch to templates tab
            if (window.app && window.app.switchTab) {
              window.app.switchTab('templates');
            }
          }
        }, '🏗️ Építési Sablonok');
        container.appendChild(buildTemplatesBtn);

        const recruitTemplatesBtn = this.createElement('button', {
          className: 'btn btn-brown',
          onClick: () => {
            // Switch to templates tab
            if (window.app && window.app.switchTab) {
              window.app.switchTab('templates');
            }
          }
        }, '👥 Toborzási Sablonok');
        container.appendChild(recruitTemplatesBtn);

        return container;
      })()
    ]);
    this.container.appendChild(templatesSection);

    // Data Section
    const dataSection = this.createSection('Adatok', [
      (() => {
        const container = this.createElement('div', {
          style: { display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }
        });

        const exportBtn = this.createElement('button', {
          className: 'btn btn-brown',
          onClick: () => this.exportSettings()
        }, '📥 Export beállítások');
        container.appendChild(exportBtn);

        const importBtn = this.createElement('button', {
          className: 'btn btn-brown',
          onClick: () => this.importSettings()
        }, '📤 Import beállítások');
        container.appendChild(importBtn);

        const clearBtn = this.createElement('button', {
          className: 'btn btn-brown',
          onClick: () => this.clearAllData(),
          style: { marginLeft: 'var(--spacing-md)' }
        }, '🗑️ Minden adat törlése');
        container.appendChild(clearBtn);

        const warning = this.createElement('span', {
          style: { color: '#d9534f', fontSize: '11px', marginLeft: 'var(--spacing-sm)' }
        }, '⚠️ Nem visszavonható!');
        container.appendChild(warning);

        return container;
      })()
    ]);
    this.container.appendChild(dataSection);

    // Save Button
    const saveSection = this.createElement('div', {
      style: {
        marginTop: 'var(--spacing-lg)',
        textAlign: 'center'
      }
    });

    const saveBtn = this.createElement('button', {
      className: 'btn btn-primary',
      onClick: () => this.saveSettings(),
      style: {
        padding: 'var(--spacing-md) var(--spacing-xl)',
        fontSize: '13px',
        fontWeight: 'bold'
      },
      disabled: !this.state.hasUnsavedChanges
    }, '💾 BEÁLLÍTÁSOK MENTÉSE');
    saveSection.appendChild(saveBtn);

    if (this.state.hasUnsavedChanges) {
      const unsavedNote = this.createElement('div', {
        style: {
          marginTop: 'var(--spacing-sm)',
          color: '#f0ad4e',
          fontSize: '11px'
        }
      }, '⚠️ Nem mentett változások vannak');
      saveSection.appendChild(unsavedNote);
    }

    this.container.appendChild(saveSection);

    return this.container;
  }

  /**
   * Create section
   */
  createSection(title, children) {
    const section = this.createElement('div', {
      className: 'tw-section',
      style: {
        marginBottom: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        background: 'rgba(255, 255, 255, 0.3)',
        border: '1px solid var(--tw-border-light)',
        borderRadius: 'var(--radius-sm)'
      }
    });

    const header = this.createElement('h3', {
      style: {
        marginBottom: 'var(--spacing-md)',
        fontSize: '12px',
        fontWeight: 'bold',
        color: 'var(--tw-text-dark)',
        borderBottom: '1px solid var(--tw-border-light)',
        paddingBottom: 'var(--spacing-xs)'
      }
    }, title);
    section.appendChild(header);

    children.forEach(child => {
      if (child) section.appendChild(child);
    });

    return section;
  }

  /**
   * Create form group
   */
  createFormGroup(label, input) {
    const group = this.createElement('div', {
      className: 'form-group',
      style: { marginBottom: 'var(--spacing-md)' }
    });

    if (label) {
      const labelEl = this.createElement('label', {
        style: {
          display: 'block',
          marginBottom: 'var(--spacing-xs)',
          fontSize: '11px',
          fontWeight: 'bold'
        }
      }, label);
      group.appendChild(labelEl);
    }

    group.appendChild(input);

    return group;
  }

  /**
   * Create checkbox
   */
  createCheckbox(label, checked, onChange) {
    const container = this.createElement('div', {
      style: { marginBottom: 'var(--spacing-sm)' }
    });

    const labelEl = this.createElement('label', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        cursor: 'pointer',
        fontSize: '11px'
      }
    });

    const checkbox = this.createElement('input', {
      type: 'checkbox',
      checked: checked,
      onChange: (e) => onChange(e.target.checked)
    });
    labelEl.appendChild(checkbox);
    labelEl.appendChild(document.createTextNode(label));

    container.appendChild(labelEl);
    return container;
  }

  /**
   * Create radio button
   */
  createRadio(label, checked, onChange) {
    const labelEl = this.createElement('label', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        cursor: 'pointer',
        fontSize: '11px'
      }
    });

    const radio = this.createElement('input', {
      type: 'radio',
      checked: checked,
      onChange: onChange
    });
    labelEl.appendChild(radio);
    labelEl.appendChild(document.createTextNode(label));

    return labelEl;
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    super.destroy();
  }
}
