/**
 * Base Component Class
 * Provides common functionality for all UI components
 */

class Component {
  constructor(containerSelector) {
    this.container = typeof containerSelector === 'string'
      ? document.querySelector(containerSelector)
      : containerSelector;
    this.state = {};
    this.listeners = [];
  }

  /**
   * Set component state and trigger re-render
   * @param {Object} newState - New state to merge with existing state
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  /**
   * Get current state
   * @returns {Object} Current component state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Render the component (override in subclass)
   */
  render() {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Mount the component to the DOM
   */
  mount() {
    if (!this.container) {
      console.error('Component container not found');
      return;
    }
    this.render();
  }

  /**
   * Unmount and cleanup the component
   */
  destroy() {
    // Remove all event listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Add event listener with automatic cleanup
   * @param {HTMLElement} element - Element to attach listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.push({ element, event, handler });
  }

  /**
   * Create element helper
   * @param {string} tag - HTML tag name
   * @param {Object} attrs - Element attributes
   * @param {string|HTMLElement|Array} children - Child content
   * @returns {HTMLElement}
   */
  createElement(tag, attrs = {}, children = null) {
    const element = document.createElement(tag);

    // Set attributes
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        const event = key.slice(2).toLowerCase();
        this.addEventListener(element, event, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });

    // Append children
    if (children !== null) {
      if (typeof children === 'string') {
        element.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof HTMLElement) {
            element.appendChild(child);
          }
        });
      } else if (children instanceof HTMLElement) {
        element.appendChild(children);
      }
    }

    return element;
  }

  /**
   * Format number with thousands separator
   * @param {number} num - Number to format
   * @returns {string}
   */
  formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format timestamp to relative time
   * @param {number} timestamp - Unix timestamp
   * @returns {string}
   */
  formatRelativeTime(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return `${seconds}mp`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}p`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}ó`;
    return `${Math.floor(seconds / 86400)}n`;
  }

  /**
   * Format time until arrival
   * @param {number} timestamp - Unix timestamp
   * @returns {string}
   */
  formatCountdown(timestamp) {
    const seconds = Math.floor((timestamp - Date.now()) / 1000);

    if (seconds < 0) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get resource icon class
   * @param {string} resource - Resource type
   * @returns {string}
   */
  getResourceIconClass(resource) {
    const icons = {
      wood: 'wood',
      clay: 'clay',
      iron: 'iron',
      population: 'population',
      storage: 'storage'
    };
    return `resource-icon ${icons[resource] || ''}`;
  }

  /**
   * Get building icon URL
   * @param {string} building - Building type
   * @returns {string}
   */
  getBuildingIcon(building) {
    const baseUrl = 'https://dshu.innogamescdn.com/asset/2a2f957f/graphic/buildings';
    return `${baseUrl}/${building}.png`;
  }

  /**
   * Get unit icon URL
   * @param {string} unit - Unit type
   * @returns {string}
   */
  getUnitIcon(unit) {
    const baseUrl = 'https://dshu.innogamescdn.com/asset/2a2f957f/graphic/unit';
    return `${baseUrl}/unit_${unit}.png`;
  }

  /**
   * Create progress bar element
   * @param {number} current - Current value
   * @param {number} max - Maximum value
   * @param {string} type - Resource type for coloring
   * @returns {HTMLElement}
   */
  createProgressBar(current, max, type = '') {
    const percentage = Math.min(100, (current / max) * 100);

    const bar = this.createElement('div', { className: 'progress-bar' });
    const fill = this.createElement('div', {
      className: `progress-bar-fill ${type}`,
      style: { width: `${percentage}%` }
    });

    bar.appendChild(fill);
    return bar;
  }
}
