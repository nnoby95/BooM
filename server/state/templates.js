const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TEMPLATES_FILE = path.join(__dirname, '../data/templates.json');

class TemplateManager {
  constructor() {
    this.templates = {
      building: [],
      recruitment: []
    };
    this.load();
  }

  /**
   * Load templates from disk
   */
  load() {
    try {
      if (fs.existsSync(TEMPLATES_FILE)) {
        const data = fs.readFileSync(TEMPLATES_FILE, 'utf8');
        this.templates = JSON.parse(data);
        console.log(`✅ Loaded ${this.templates.building.length} building templates, ${this.templates.recruitment.length} recruitment templates`);
      } else {
        this.createDefaultTemplates();
        this.save();
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      this.createDefaultTemplates();
    }
  }

  /**
   * Save templates to disk
   */
  save() {
    try {
      const dir = path.dirname(TEMPLATES_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(this.templates, null, 2));
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }

  /**
   * Create default templates
   */
  createDefaultTemplates() {
    // Default building template - Basic village
    const basicVillage = {
      id: uuidv4(),
      name: 'Alap falu',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rawInput: 'MINES 1; main 2; farm 2; MINES 2; storage 3; farm 3; MINES 3; main 3; barracks 1; market 1; MINES 4; market 2; main 5; barracks 3; smith 1; storage 4; farm 4; MINES 8; storage 5; main 7; farm 5; MINES 10; storage 6; main 10; farm 6',
      steps: [],
      totalSteps: 0,
      finalLevels: {},
      rules: {
        autoStorage: true,
        autoFarm: true
      }
    };

    // Parse the template
    const parsed = this.parseBuildingTemplate(basicVillage.rawInput);
    basicVillage.steps = parsed.steps;
    basicVillage.totalSteps = parsed.steps.length;
    basicVillage.finalLevels = parsed.finalLevels;

    this.templates.building.push(basicVillage);

    // Default offensive recruitment template
    const offensiveArmy = {
      id: uuidv4(),
      name: 'Offenzív csapat',
      type: 'offensive',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      targets: {
        spear: 0,
        sword: 0,
        axe: 6000,
        archer: 0,
        spy: 0,
        light: 3000,
        marcher: 0,
        heavy: 0,
        ram: 300,
        catapult: 50,
        knight: 0,
        snob: 0
      },
      totalUnits: 9350,
      farmSpace: 18300
    };

    this.templates.recruitment.push(offensiveArmy);

    console.log('✅ Created default templates');
  }

  /**
   * Parse building template string into steps
   * @param {string} rawInput - Template string like "MINES 1; main 2; farm 2; ..."
   * @returns {object} - { steps: [], finalLevels: {} }
   */
  parseBuildingTemplate(rawInput) {
    const steps = [];
    const finalLevels = {};

    const parts = rawInput.split(';').map(p => p.trim()).filter(Boolean);

    for (const part of parts) {
      const match = part.match(/^(\w+)\s+(\d+)$/i);
      if (!match) {
        console.warn('Invalid template part:', part);
        continue;
      }

      const [, building, level] = match;
      const lvl = parseInt(level);

      if (building.toUpperCase() === 'MINES') {
        // MINES X expands to wood, stone, iron all to level X
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
   * Get all building templates
   */
  getBuildingTemplates() {
    return this.templates.building;
  }

  /**
   * Get all recruitment templates
   */
  getRecruitmentTemplates() {
    return this.templates.recruitment;
  }

  /**
   * Get template by ID
   */
  getTemplateById(id, type = 'building') {
    const templates = type === 'building' ? this.templates.building : this.templates.recruitment;
    return templates.find(t => t.id === id);
  }

  /**
   * Create new building template
   */
  createBuildingTemplate(data) {
    const template = {
      id: uuidv4(),
      name: data.name || 'Névtelen sablon',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rawInput: data.rawInput,
      steps: [],
      totalSteps: 0,
      finalLevels: {},
      rules: {
        autoStorage: data.rules?.autoStorage ?? true,
        autoFarm: data.rules?.autoFarm ?? true
      }
    };

    // Parse the template
    const parsed = this.parseBuildingTemplate(template.rawInput);
    template.steps = parsed.steps;
    template.totalSteps = parsed.steps.length;
    template.finalLevels = parsed.finalLevels;

    this.templates.building.push(template);
    this.save();

    return template;
  }

  /**
   * Create new recruitment template
   */
  createRecruitmentTemplate(data) {
    const targets = data.targets || {};
    let totalUnits = 0;
    let farmSpace = 0;

    // Calculate totals
    const farmCosts = {
      spear: 1, sword: 1, axe: 1, archer: 1,
      spy: 2, light: 4, marcher: 5, heavy: 6,
      ram: 5, catapult: 8, knight: 10, snob: 100
    };

    for (const [unit, count] of Object.entries(targets)) {
      totalUnits += count;
      farmSpace += count * (farmCosts[unit] || 1);
    }

    const template = {
      id: uuidv4(),
      name: data.name || 'Névtelen sablon',
      type: data.type || 'other',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      targets,
      totalUnits,
      farmSpace
    };

    this.templates.recruitment.push(template);
    this.save();

    return template;
  }

  /**
   * Update building template
   */
  updateBuildingTemplate(id, updates) {
    const template = this.getTemplateById(id, 'building');
    if (!template) {
      throw new Error('Template not found');
    }

    // Update fields
    if (updates.name !== undefined) template.name = updates.name;
    if (updates.rawInput !== undefined) {
      template.rawInput = updates.rawInput;
      const parsed = this.parseBuildingTemplate(updates.rawInput);
      template.steps = parsed.steps;
      template.totalSteps = parsed.steps.length;
      template.finalLevels = parsed.finalLevels;
    }
    if (updates.rules !== undefined) {
      template.rules = { ...template.rules, ...updates.rules };
    }

    template.updatedAt = Date.now();
    this.save();

    return template;
  }

  /**
   * Update recruitment template
   */
  updateRecruitmentTemplate(id, updates) {
    const template = this.getTemplateById(id, 'recruitment');
    if (!template) {
      throw new Error('Template not found');
    }

    // Update fields
    if (updates.name !== undefined) template.name = updates.name;
    if (updates.type !== undefined) template.type = updates.type;
    if (updates.targets !== undefined) {
      template.targets = updates.targets;

      // Recalculate totals
      let totalUnits = 0;
      let farmSpace = 0;
      const farmCosts = {
        spear: 1, sword: 1, axe: 1, archer: 1,
        spy: 2, light: 4, marcher: 5, heavy: 6,
        ram: 5, catapult: 8, knight: 10, snob: 100
      };

      for (const [unit, count] of Object.entries(template.targets)) {
        totalUnits += count;
        farmSpace += count * (farmCosts[unit] || 1);
      }

      template.totalUnits = totalUnits;
      template.farmSpace = farmSpace;
    }

    template.updatedAt = Date.now();
    this.save();

    return template;
  }

  /**
   * Delete template
   */
  deleteTemplate(id, type = 'building') {
    const templates = type === 'building' ? this.templates.building : this.templates.recruitment;
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) {
      throw new Error('Template not found');
    }

    templates.splice(index, 1);
    this.save();

    return true;
  }

  /**
   * Duplicate template
   */
  duplicateTemplate(id, type = 'building') {
    const original = this.getTemplateById(id, type);
    if (!original) {
      throw new Error('Template not found');
    }

    const duplicate = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      name: `${original.name} (másolat)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (type === 'building') {
      this.templates.building.push(duplicate);
    } else {
      this.templates.recruitment.push(duplicate);
    }

    this.save();
    return duplicate;
  }
}

// Export singleton instance
const templateManager = new TemplateManager();
module.exports = templateManager;
