/**
 * Template Executor Service
 * Executes building and recruitment templates on accounts
 */

const templateManager = require('../state/templates');
const { accountState } = require('../state/accounts');
const { logger } = require('../utils/logger');

// Building prerequisites and max levels
const BUILDING_DATA = {
  main: { maxLevel: 30, requires: {} },
  barracks: { maxLevel: 25, requires: { main: 3 } },
  stable: { maxLevel: 20, requires: { main: 10, barracks: 5, smith: 5 } },
  garage: { maxLevel: 15, requires: { main: 10, smith: 10 } },
  smith: { maxLevel: 20, requires: { main: 5, barracks: 1 } },
  market: { maxLevel: 25, requires: { main: 3, storage: 2 } },
  wood: { maxLevel: 30, requires: {} },
  stone: { maxLevel: 30, requires: {} },
  iron: { maxLevel: 30, requires: {} },
  farm: { maxLevel: 30, requires: {} },
  storage: { maxLevel: 30, requires: {} },
  wall: { maxLevel: 20, requires: { barracks: 1 } },
  hide: { maxLevel: 10, requires: {} },
  statue: { maxLevel: 1, requires: {} },
  place: { maxLevel: 1, requires: {} },
  snob: { maxLevel: 1, requires: { main: 20, market: 10, smith: 20 } },
  church: { maxLevel: 1, requires: { main: 5, farm: 5 } },
  church_f: { maxLevel: 1, requires: { main: 5, farm: 5 } },
  watchtower: { maxLevel: 20, requires: {} }
};

// Simplified building costs (for estimation)
const BASE_COSTS = {
  main: { wood: 90, stone: 80, iron: 70 },
  barracks: { wood: 200, stone: 170, iron: 90 },
  stable: { wood: 270, stone: 240, iron: 260 },
  garage: { wood: 300, stone: 240, iron: 260 },
  smith: { wood: 220, stone: 180, iron: 240 },
  market: { wood: 100, stone: 100, iron: 100 },
  wood: { wood: 50, stone: 60, iron: 40 },
  stone: { wood: 65, stone: 50, iron: 40 },
  iron: { wood: 75, stone: 65, iron: 70 },
  farm: { wood: 45, stone: 40, iron: 30 },
  storage: { wood: 60, stone: 50, iron: 40 },
  wall: { wood: 50, stone: 100, iron: 20 },
  hide: { wood: 50, stone: 60, iron: 50 }
};

class TemplateExecutor {
  constructor() {
    this.activeExecutions = new Map(); // Track active executions per account
  }

  /**
   * Execute building template for an account
   * @param {string} accountId - Account ID
   * @param {string} templateId - Template ID
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution result
   */
  async executeForAccount(accountId, templateId, options = {}) {
    const account = accountState.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const template = templateManager.getTemplateById(templateId, 'building');
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const { maxOperations = 2, autoStorage = true, autoFarm = true } = options;

    // Check if already executing
    if (this.activeExecutions.has(accountId)) {
      return {
        status: 'busy',
        message: 'Account is already executing a template'
      };
    }

    this.activeExecutions.set(accountId, { templateId, startedAt: Date.now() });

    try {
      const results = [];

      for (let i = 0; i < maxOperations; i++) {
        const result = await this.executeNextStep(account, template, {
          autoStorage: template.rules?.autoStorage ?? autoStorage,
          autoFarm: template.rules?.autoFarm ?? autoFarm
        });

        results.push(result);

        // Stop if completed or blocked
        if (result.status === 'completed' || result.status === 'blocked' || result.status === 'error') {
          break;
        }
      }

      return {
        status: 'success',
        accountId,
        templateId,
        results
      };

    } finally {
      this.activeExecutions.delete(accountId);
    }
  }

  /**
   * Execute next step in building template
   * @param {object} account - Account object
   * @param {object} template - Template object
   * @param {object} options - Options
   * @returns {Promise<object>} Step result
   */
  async executeNextStep(account, template, options = {}) {
    const currentStep = account.buildingTemplateStep || 0;

    // Check if template is completed
    if (currentStep >= template.steps.length) {
      return {
        status: 'completed',
        message: 'Sablon teljesítve!',
        progress: `${currentStep}/${template.steps.length}`
      };
    }

    const step = template.steps[currentStep];
    const currentLevel = account.buildings?.[step.building] || 0;

    logger.debug('Executing template step', {
      accountId: account.accountId,
      step: currentStep,
      building: step.building,
      targetLevel: step.level,
      currentLevel
    });

    // Check if already at or above target level
    if (currentLevel >= step.level) {
      // Skip to next step
      account.buildingTemplateStep = currentStep + 1;

      return {
        status: 'skipped',
        message: `${step.building} már ${currentLevel} szinten van`,
        building: step.building,
        currentLevel,
        targetLevel: step.level,
        nextStep: currentStep + 1,
        progress: `${currentStep + 1}/${template.steps.length}`
      };
    }

    // Check prerequisites
    const buildingInfo = BUILDING_DATA[step.building];
    if (buildingInfo?.requires) {
      for (const [reqBuilding, reqLevel] of Object.entries(buildingInfo.requires)) {
        const hasLevel = account.buildings?.[reqBuilding] || 0;
        if (hasLevel < reqLevel) {
          return {
            status: 'blocked',
            message: `Követelmény hiányzik: ${reqBuilding} ${reqLevel} szint`,
            missing: { building: reqBuilding, level: reqLevel, has: hasLevel },
            progress: `${currentStep}/${template.steps.length}`
          };
        }
      }
    }

    // Estimate building cost
    const cost = this.estimateCost(step.building, currentLevel + 1);
    const { resources } = account;

    // Check if resources are sufficient
    if (!resources || resources.wood < cost.wood || resources.clay < cost.clay || resources.iron < cost.iron) {
      // Check if auto-storage should trigger
      if (options.autoStorage && this.shouldUpgradeStorage(account, cost)) {
        logger.info('Auto-triggering storage upgrade', { accountId: account.accountId });
        return this.executeStorageUpgrade(account);
      }

      return {
        status: 'blocked',
        message: 'Nincs elég nyersanyag',
        needed: cost,
        have: {
          wood: resources?.wood || 0,
          clay: resources?.clay || 0,
          iron: resources?.iron || 0
        },
        progress: `${currentStep}/${template.steps.length}`
      };
    }

    // Check population
    if (options.autoFarm && resources.population?.used >= (resources.population?.max - 5)) {
      logger.info('Auto-triggering farm upgrade', { accountId: account.accountId });
      return this.executeFarmUpgrade(account);
    }

    // Check building queue
    const queueLength = account.buildingQueue?.length || 0;
    if (queueLength >= 2) {
      return {
        status: 'blocked',
        message: 'Építési sor tele (2/2)',
        progress: `${currentStep}/${template.steps.length}`
      };
    }

    // Execute build command
    try {
      await this.sendBuildCommand(account.accountId, step.building, currentLevel + 1);

      // Update step on success
      account.buildingTemplateStep = currentStep + 1;

      return {
        status: 'success',
        message: `${step.building} ${currentLevel + 1} elindítva`,
        building: step.building,
        level: currentLevel + 1,
        nextStep: currentStep + 1,
        progress: `${currentStep + 1}/${template.steps.length}`
      };

    } catch (error) {
      logger.error('Failed to execute build command', {
        accountId: account.accountId,
        building: step.building,
        error: error.message
      });

      return {
        status: 'error',
        message: error.message,
        building: step.building,
        progress: `${currentStep}/${template.steps.length}`
      };
    }
  }

  /**
   * Estimate building cost
   * @param {string} building - Building name
   * @param {number} level - Target level
   * @returns {object} Cost estimate
   */
  estimateCost(building, level) {
    const base = BASE_COSTS[building] || { wood: 100, stone: 100, iron: 100 };
    const factor = Math.pow(1.26, level - 1);

    return {
      wood: Math.floor(base.wood * factor),
      clay: Math.floor(base.stone * factor),
      iron: Math.floor(base.iron * factor)
    };
  }

  /**
   * Check if storage should be upgraded
   * @param {object} account - Account object
   * @param {object} neededCost - Needed resources
   * @returns {boolean} Should upgrade
   */
  shouldUpgradeStorage(account, neededCost) {
    const maxNeeded = Math.max(neededCost.wood, neededCost.clay, neededCost.iron);
    const storage = account.resources?.storage || 0;
    return maxNeeded > storage * 0.95;
  }

  /**
   * Execute storage upgrade
   * @param {object} account - Account object
   * @returns {Promise<object>} Result
   */
  async executeStorageUpgrade(account) {
    const currentLevel = account.buildings?.storage || 1;
    const targetLevel = currentLevel + 1;

    try {
      await this.sendBuildCommand(account.accountId, 'storage', targetLevel);

      return {
        status: 'success',
        message: `Raktár ${targetLevel} automatikusan elindítva`,
        building: 'storage',
        level: targetLevel,
        auto: true
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Raktár fejlesztés sikertelen: ${error.message}`,
        auto: true
      };
    }
  }

  /**
   * Execute farm upgrade
   * @param {object} account - Account object
   * @returns {Promise<object>} Result
   */
  async executeFarmUpgrade(account) {
    const currentLevel = account.buildings?.farm || 1;
    const targetLevel = currentLevel + 1;

    try {
      await this.sendBuildCommand(account.accountId, 'farm', targetLevel);

      return {
        status: 'success',
        message: `Farm ${targetLevel} automatikusan elindítva`,
        building: 'farm',
        level: targetLevel,
        auto: true
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Farm fejlesztés sikertelen: ${error.message}`,
        auto: true
      };
    }
  }

  /**
   * Send build command to account
   * @param {string} accountId - Account ID
   * @param {string} building - Building name
   * @param {number} level - Target level
   * @returns {Promise<void>}
   */
  async sendBuildCommand(accountId, building, level) {
    const account = accountState.get(accountId);
    if (!account || !account.ws) {
      throw new Error('Account not connected');
    }

    return new Promise((resolve, reject) => {
      const actionId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Send command to userscript
      const command = {
        type: 'buildBuilding',
        actionId,
        building,
        level
      };

      try {
        account.ws.send(JSON.stringify(command));
        logger.info('Build command sent', { accountId, building, level, actionId });

        // TODO: Store actionId and wait for result
        // For now, just resolve immediately
        resolve();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get execution status for account
   * @param {string} accountId - Account ID
   * @returns {object|null} Execution status
   */
  getExecutionStatus(accountId) {
    return this.activeExecutions.get(accountId) || null;
  }

  /**
   * Stop execution for account
   * @param {string} accountId - Account ID
   * @returns {boolean} Success
   */
  stopExecution(accountId) {
    return this.activeExecutions.delete(accountId);
  }

  /**
   * Preview next step for account with template
   * @param {string} accountId - Account ID
   * @param {string} templateId - Template ID
   * @returns {object} Preview result
   */
  previewNextStep(accountId, templateId) {
    const account = accountState.get(accountId);
    if (!account) {
      return { error: 'Account not found' };
    }

    const template = templateManager.getTemplateById(templateId, 'building');
    if (!template) {
      return { error: 'Template not found' };
    }

    const currentStep = account.buildingTemplateStep || 0;

    if (currentStep >= template.steps.length) {
      return {
        status: 'completed',
        message: 'Sablon teljesítve!',
        progress: `${currentStep}/${template.steps.length}`
      };
    }

    const step = template.steps[currentStep];
    const currentLevel = account.buildings?.[step.building] || 0;
    const cost = this.estimateCost(step.building, currentLevel + 1);
    const { resources } = account;

    const canExecute = resources &&
                      resources.wood >= cost.wood &&
                      resources.clay >= cost.clay &&
                      resources.iron >= cost.iron &&
                      (account.buildingQueue?.length || 0) < 2;

    // Check prerequisites
    let missingPrerequisite = null;
    const buildingInfo = BUILDING_DATA[step.building];
    if (buildingInfo?.requires) {
      for (const [reqBuilding, reqLevel] of Object.entries(buildingInfo.requires)) {
        const hasLevel = account.buildings?.[reqBuilding] || 0;
        if (hasLevel < reqLevel) {
          missingPrerequisite = { building: reqBuilding, level: reqLevel, has: hasLevel };
          break;
        }
      }
    }

    return {
      accountId,
      templateId,
      currentStep,
      totalSteps: template.steps.length,
      nextBuilding: step.building,
      nextLevel: currentLevel + 1,
      currentLevel,
      cost,
      canExecute: canExecute && !missingPrerequisite,
      missingPrerequisite,
      queueStatus: `${account.buildingQueue?.length || 0}/2`,
      progress: `${currentStep}/${template.steps.length}`
    };
  }
}

// Export singleton instance
const templateExecutor = new TemplateExecutor();
module.exports = templateExecutor;
