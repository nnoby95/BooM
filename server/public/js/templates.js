/**
 * Template Manager
 * Handles Building and Recruitment template CRUD operations
 */

class TemplateManager {
  constructor(ws) {
    this.ws = ws;
    this.buildingTemplates = [];
    this.recruitmentTemplates = [];
    this.currentEditingTemplate = null;
    this.currentEditingType = null;

    this.init();
  }

  init() {
    // Load templates from server
    this.loadTemplates();

    // Setup WebSocket listeners
    this.setupWebSocketListeners();
  }

  /**
   * Load all templates from server
   */
  loadTemplates() {
    this.ws.send(JSON.stringify({
      type: 'getTemplates',
      templateType: 'all'
    }));
  }

  /**
   * Setup WebSocket message listeners
   */
  setupWebSocketListeners() {
    // Listen for template responses
    window.addEventListener('wsMessage', (event) => {
      const message = event.detail;

      switch (message.type) {
        case 'templates':
          this.handleTemplatesReceived(message);
          break;
        case 'templateCreated':
          this.handleTemplateCreated(message);
          break;
        case 'templateUpdated':
          this.handleTemplateUpdated(message);
          break;
        case 'templateDeleted':
          this.handleTemplateDeleted(message);
          break;
      }
    });
  }

  /**
   * Handle templates received from server
   */
  handleTemplatesReceived(message) {
    if (message.templates.building) {
      this.buildingTemplates = message.templates.building;
    }
    if (message.templates.recruitment) {
      this.recruitmentTemplates = message.templates.recruitment;
    }

    // Trigger update events
    window.dispatchEvent(new CustomEvent('templatesUpdated', {
      detail: {
        building: this.buildingTemplates,
        recruitment: this.recruitmentTemplates
      }
    }));

    console.log(`✅ Loaded ${this.buildingTemplates.length} building templates, ${this.recruitmentTemplates.length} recruitment templates`);
  }

  /**
   * Handle template created
   */
  handleTemplateCreated(message) {
    const { templateType, template } = message;

    if (templateType === 'building') {
      this.buildingTemplates.push(template);
    } else if (templateType === 'recruitment') {
      this.recruitmentTemplates.push(template);
    }

    window.dispatchEvent(new CustomEvent('templateCreated', {
      detail: { templateType, template }
    }));

    this.showToast(`Sablon létrehozva: ${template.name}`, 'success');
  }

  /**
   * Handle template updated
   */
  handleTemplateUpdated(message) {
    const { templateType, template } = message;

    if (templateType === 'building') {
      const index = this.buildingTemplates.findIndex(t => t.id === template.id);
      if (index !== -1) {
        this.buildingTemplates[index] = template;
      }
    } else if (templateType === 'recruitment') {
      const index = this.recruitmentTemplates.findIndex(t => t.id === template.id);
      if (index !== -1) {
        this.recruitmentTemplates[index] = template;
      }
    }

    window.dispatchEvent(new CustomEvent('templateUpdated', {
      detail: { templateType, template }
    }));

    this.showToast(`Sablon frissítve: ${template.name}`, 'success');
  }

  /**
   * Handle template deleted
   */
  handleTemplateDeleted(message) {
    const { templateType, id } = message;

    if (templateType === 'building') {
      this.buildingTemplates = this.buildingTemplates.filter(t => t.id !== id);
    } else if (templateType === 'recruitment') {
      this.recruitmentTemplates = this.recruitmentTemplates.filter(t => t.id !== id);
    }

    window.dispatchEvent(new CustomEvent('templateDeleted', {
      detail: { templateType, id }
    }));

    this.showToast('Sablon törölve', 'success');
  }

  /**
   * Create new building template
   */
  createBuildingTemplate(data) {
    this.ws.send(JSON.stringify({
      type: 'createTemplate',
      templateType: 'building',
      data
    }));
  }

  /**
   * Create new recruitment template
   */
  createRecruitmentTemplate(data) {
    this.ws.send(JSON.stringify({
      type: 'createTemplate',
      templateType: 'recruitment',
      data
    }));
  }

  /**
   * Update template
   */
  updateTemplate(templateType, id, updates) {
    this.ws.send(JSON.stringify({
      type: 'updateTemplate',
      templateType,
      id,
      updates
    }));
  }

  /**
   * Delete template
   */
  deleteTemplate(templateType, id) {
    if (!confirm('Biztosan törölni szeretnéd ezt a sablont?')) {
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'deleteTemplate',
      templateType,
      id
    }));
  }

  /**
   * Duplicate template
   */
  duplicateTemplate(templateType, id) {
    this.ws.send(JSON.stringify({
      type: 'duplicateTemplate',
      templateType,
      id
    }));
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const container = document.getElementById('toast-container') || document.body;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Open Building Template Editor Modal
   */
  openBuildingTemplateEditor(templateId = null) {
    const template = templateId ? this.buildingTemplates.find(t => t.id === templateId) : null;

    this.currentEditingTemplate = template;
    this.currentEditingType = 'building';

    this.renderBuildingTemplateEditor(template);
  }

  /**
   * Open Recruitment Template Editor Modal
   */
  openRecruitmentTemplateEditor(templateId = null) {
    const template = templateId ? this.recruitmentTemplates.find(t => t.id === templateId) : null;

    this.currentEditingTemplate = template;
    this.currentEditingType = 'recruitment';

    this.renderRecruitmentTemplateEditor(template);
  }

  /**
   * Render Building Template Editor
   */
  renderBuildingTemplateEditor(template) {
    const isEdit = template !== null;
    const modalTitle = isEdit ? 'Építési Sablon Szerkesztése' : 'Új Építési Sablon';

    const html = `
      <div class="modal-overlay active" id="template-editor-modal">
        <div class="modal large">
          <div class="modal-header">
            <h2>${modalTitle}</h2>
            <button class="btn-close" onclick="templateManager.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Sablon neve:</label>
              <input type="text" id="template-name" class="form-input"
                     value="${template ? template.name : ''}"
                     placeholder="pl: Alap falu">
            </div>

            <div class="form-group">
              <label>Építési Sorrend:</label>
              <textarea id="template-input" class="form-textarea" rows="8"
                        placeholder="MINES 1; main 2; farm 2; MINES 2; storage 3; ...">${template ? template.rawInput : ''}</textarea>
              <small class="help-text">
                Szintaxis: épület szint (pl: main 5, barracks 10)<br>
                MINES szint = bányák (wood, stone, iron) adott szintre<br>
                Pontosvesszővel (;) elválasztva
              </small>
            </div>

            <div class="form-group">
              <button class="btn btn-secondary" onclick="templateManager.validateBuildingTemplate()">
                ✓ Ellenőrzés
              </button>
            </div>

            <div id="template-analysis" class="template-analysis" style="display: none;">
              <!-- Analysis results will be inserted here -->
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="auto-storage" ${template?.rules?.autoStorage !== false ? 'checked' : ''}>
                Raktár automatikus növelése ha tele van
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="auto-farm" ${template?.rules?.autoFarm !== false ? 'checked' : ''}>
                Farm automatikus növelése ha nincs hely
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="templateManager.closeModal()">Mégse</button>
            <button class="btn btn-primary" onclick="templateManager.saveBuildingTemplate()">
              ${isEdit ? '💾 Mentés' : '➕ Létrehozás'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  /**
   * Render Recruitment Template Editor
   */
  renderRecruitmentTemplateEditor(template) {
    const isEdit = template !== null;
    const modalTitle = isEdit ? 'Toborzási Sablon Szerkesztése' : 'Új Toborzási Sablon';

    const units = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
    const unitNames = {
      spear: 'Lándzsás', sword: 'Kardos', axe: 'Fejszés', archer: 'Íjász',
      spy: 'Felderítő', light: 'Könnyűlovas', marcher: 'Lovasíjász', heavy: 'Nehézlovas',
      ram: 'Faltörő', catapult: 'Katapult', knight: 'Paladin', snob: 'Nemes'
    };

    const unitsHTML = units.map(unit => `
      <div class="unit-input-group">
        <img src="https://dshu.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png"
             alt="${unitNames[unit]}" class="unit-icon">
        <span class="unit-name">${unitNames[unit]}</span>
        <input type="number" id="unit-${unit}" class="form-input-small" min="0"
               value="${template?.targets?.[unit] || 0}">
      </div>
    `).join('');

    const html = `
      <div class="modal-overlay active" id="template-editor-modal">
        <div class="modal large">
          <div class="modal-header">
            <h2>${modalTitle}</h2>
            <button class="btn-close" onclick="templateManager.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Sablon neve:</label>
              <input type="text" id="template-name" class="form-input"
                     value="${template ? template.name : ''}"
                     placeholder="pl: Offenzív csapat">
            </div>

            <div class="form-group">
              <label>Típus:</label>
              <select id="template-type" class="form-select">
                <option value="offensive" ${template?.type === 'offensive' ? 'selected' : ''}>Offenzív</option>
                <option value="defensive" ${template?.type === 'defensive' ? 'selected' : ''}>Defenzív</option>
                <option value="mixed" ${template?.type === 'mixed' ? 'selected' : ''}>Vegyes</option>
                <option value="other" ${template?.type === 'other' ? 'selected' : ''}>Egyéb</option>
              </select>
            </div>

            <div class="form-group">
              <label>Egységek:</label>
              <div class="units-grid">
                ${unitsHTML}
              </div>
            </div>

            <div id="recruitment-summary" class="recruitment-summary">
              <!-- Summary will be calculated here -->
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="templateManager.closeModal()">Mégse</button>
            <button class="btn btn-primary" onclick="templateManager.saveRecruitmentTemplate()">
              ${isEdit ? '💾 Mentés' : '➕ Létrehozás'}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Calculate summary on input change
    const inputs = document.querySelectorAll('.unit-input-group input');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.updateRecruitmentSummary());
    });

    this.updateRecruitmentSummary();
  }

  /**
   * Validate building template
   */
  validateBuildingTemplate() {
    const rawInput = document.getElementById('template-input').value.trim();

    if (!rawInput) {
      this.showToast('Kérlek add meg az építési sorrendet', 'error');
      return;
    }

    // Parse template
    const result = this.parseBuildingTemplate(rawInput);

    // Show analysis
    const analysisDiv = document.getElementById('template-analysis');
    analysisDiv.style.display = 'block';

    if (result.steps.length === 0) {
      analysisDiv.innerHTML = `
        <div class="alert alert-error">
          ❌ Érvénytelen sablon - nincs érvényes építési lépés
        </div>
      `;
      return;
    }

    const finalLevelsHTML = Object.entries(result.finalLevels)
      .map(([building, level]) => `<span class="building-level">${building}:${level}</span>`)
      .join(' ');

    analysisDiv.innerHTML = `
      <div class="alert alert-success">
        ✅ Sablon érvényes<br>
        Összesen: ${result.steps.length} építési lépés<br><br>
        <strong>Végső szintek:</strong><br>
        ${finalLevelsHTML}
      </div>
    `;
  }

  /**
   * Parse building template (client-side validation)
   */
  parseBuildingTemplate(rawInput) {
    const steps = [];
    const finalLevels = {};

    const parts = rawInput.split(';').map(p => p.trim()).filter(Boolean);

    for (const part of parts) {
      const match = part.match(/^(\w+)\s+(\d+)$/i);
      if (!match) continue;

      const [, building, level] = match;
      const lvl = parseInt(level);

      if (building.toUpperCase() === 'MINES') {
        steps.push({ building: 'wood', level: lvl });
        steps.push({ building: 'stone', level: lvl });
        steps.push({ building: 'iron', level: lvl });
        finalLevels.wood = Math.max(finalLevels.wood || 0, lvl);
        finalLevels.stone = Math.max(finalLevels.stone || 0, lvl);
        finalLevels.iron = Math.max(finalLevels.iron || 0, lvl);
      } else {
        const buildingName = building.toLowerCase();
        steps.push({ building: buildingName, level: lvl });
        finalLevels[buildingName] = Math.max(finalLevels[buildingName] || 0, lvl);
      }
    }

    return { steps, finalLevels };
  }

  /**
   * Update recruitment summary
   */
  updateRecruitmentSummary() {
    const units = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
    const farmCosts = {
      spear: 1, sword: 1, axe: 1, archer: 1,
      spy: 2, light: 4, marcher: 5, heavy: 6,
      ram: 5, catapult: 8, knight: 10, snob: 100
    };

    let totalUnits = 0;
    let totalFarm = 0;

    units.forEach(unit => {
      const input = document.getElementById(`unit-${unit}`);
      if (input) {
        const count = parseInt(input.value) || 0;
        totalUnits += count;
        totalFarm += count * (farmCosts[unit] || 1);
      }
    });

    const summaryDiv = document.getElementById('recruitment-summary');
    summaryDiv.innerHTML = `
      <div class="alert alert-info">
        <strong>Összesítés:</strong><br>
        Egységek: ${totalUnits.toLocaleString('hu-HU')}<br>
        Farm hely: ${totalFarm.toLocaleString('hu-HU')}
      </div>
    `;
  }

  /**
   * Save building template
   */
  saveBuildingTemplate() {
    const name = document.getElementById('template-name').value.trim();
    const rawInput = document.getElementById('template-input').value.trim();
    const autoStorage = document.getElementById('auto-storage').checked;
    const autoFarm = document.getElementById('auto-farm').checked;

    if (!name) {
      this.showToast('Kérlek adj nevet a sablonnak', 'error');
      return;
    }

    if (!rawInput) {
      this.showToast('Kérlek add meg az építési sorrendet', 'error');
      return;
    }

    const data = {
      name,
      rawInput,
      rules: {
        autoStorage,
        autoFarm
      }
    };

    if (this.currentEditingTemplate) {
      // Update existing
      this.updateTemplate('building', this.currentEditingTemplate.id, data);
    } else {
      // Create new
      this.createBuildingTemplate(data);
    }

    this.closeModal();
  }

  /**
   * Save recruitment template
   */
  saveRecruitmentTemplate() {
    const name = document.getElementById('template-name').value.trim();
    const type = document.getElementById('template-type').value;

    if (!name) {
      this.showToast('Kérlek adj nevet a sablonnak', 'error');
      return;
    }

    const units = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob'];
    const targets = {};

    units.forEach(unit => {
      const input = document.getElementById(`unit-${unit}`);
      targets[unit] = parseInt(input.value) || 0;
    });

    const data = {
      name,
      type,
      targets
    };

    if (this.currentEditingTemplate) {
      // Update existing
      this.updateTemplate('recruitment', this.currentEditingTemplate.id, data);
    } else {
      // Create new
      this.createRecruitmentTemplate(data);
    }

    this.closeModal();
  }

  /**
   * Close modal
   */
  closeModal() {
    const modal = document.getElementById('template-editor-modal');
    if (modal) {
      modal.remove();
    }

    this.currentEditingTemplate = null;
    this.currentEditingType = null;
  }
}

// Global instance will be created in app.js
