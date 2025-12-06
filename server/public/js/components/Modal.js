/**
 * Modal Base Component
 * Provides common modal functionality with TW styling
 */

class Modal extends Component {
  constructor(title, options = {}) {
    super(null); // No container needed for modals
    this.title = title;
    this.options = {
      width: options.width || '600px',
      onClose: options.onClose || null,
      closeOnOverlayClick: options.closeOnOverlayClick !== false,
      showFooter: options.showFooter !== false
    };
    this.isOpen = false;
    this.overlay = null;
    this.modal = null;
  }

  /**
   * Open the modal
   */
  open() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.render();
    document.body.style.overflow = 'hidden'; // Prevent body scroll
  }

  /**
   * Close the modal
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    document.body.style.overflow = ''; // Restore body scroll

    // Fade out animation
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.modal = null;
      }, 300);
    }

    // Call onClose callback
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * Render the modal
   */
  render() {
    // Create overlay
    this.overlay = this.createElement('div', {
      className: 'modal-overlay',
      onClick: (e) => {
        if (e.target === this.overlay && this.options.closeOnOverlayClick) {
          this.close();
        }
      }
    });

    // Create modal
    this.modal = this.createElement('div', {
      className: 'modal',
      style: { maxWidth: this.options.width }
    });

    // Header
    const header = this.createHeader();
    this.modal.appendChild(header);

    // Body
    const body = this.createElement('div', { className: 'modal-body' });
    this.renderBody(body);
    this.modal.appendChild(body);

    // Footer (if enabled)
    if (this.options.showFooter) {
      const footer = this.createFooter();
      this.modal.appendChild(footer);
    }

    // Add modal to overlay
    this.overlay.appendChild(this.modal);

    // Add to document
    document.body.appendChild(this.overlay);

    // Trigger animation
    setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
    }, 10);
  }

  /**
   * Create modal header
   */
  createHeader() {
    const header = this.createElement('div', { className: 'modal-header' });

    const title = this.createElement('div', {
      className: 'modal-title'
    }, this.title);
    header.appendChild(title);

    const closeBtn = this.createElement('button', {
      className: 'modal-close',
      onClick: () => this.close()
    }, '✕');
    header.appendChild(closeBtn);

    return header;
  }

  /**
   * Render modal body - override in subclass
   * @param {HTMLElement} body - Body container element
   */
  renderBody(body) {
    // Override in subclass
    body.innerHTML = '<p>Modal content</p>';
  }

  /**
   * Create modal footer with action buttons
   */
  createFooter() {
    const footer = this.createElement('div', { className: 'modal-footer' });

    // Cancel button
    const cancelBtn = this.createElement('button', {
      className: 'btn btn-brown',
      onClick: () => this.close()
    }, 'Mégse');
    footer.appendChild(cancelBtn);

    // Submit button
    const submitBtn = this.createElement('button', {
      className: 'btn btn-primary',
      onClick: () => this.handleSubmit()
    }, this.getSubmitButtonText());
    footer.appendChild(submitBtn);

    return footer;
  }

  /**
   * Get submit button text - override in subclass
   */
  getSubmitButtonText() {
    return 'OK';
  }

  /**
   * Handle submit - override in subclass
   */
  handleSubmit() {
    this.close();
  }

  /**
   * Show error message in modal
   */
  showError(message) {
    const body = this.modal.querySelector('.modal-body');
    let errorEl = body.querySelector('.modal-error');

    if (!errorEl) {
      errorEl = this.createElement('div', { className: 'error' });
      body.insertBefore(errorEl, body.firstChild);
    }

    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  /**
   * Hide error message
   */
  hideError() {
    const body = this.modal.querySelector('.modal-body');
    const errorEl = body.querySelector('.modal-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  /**
   * Show loading state
   */
  showLoading(message = 'Feldolgozás...') {
    const footer = this.modal.querySelector('.modal-footer');
    if (footer) {
      const buttons = footer.querySelectorAll('button');
      buttons.forEach(btn => btn.disabled = true);

      let loadingEl = footer.querySelector('.modal-loading');
      if (!loadingEl) {
        loadingEl = this.createElement('div', {
          className: 'modal-loading',
          style: { marginRight: 'auto', color: 'var(--tw-text-dark)' }
        });
        footer.insertBefore(loadingEl, footer.firstChild);
      }
      loadingEl.textContent = `⏳ ${message}`;
    }
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    const footer = this.modal.querySelector('.modal-footer');
    if (footer) {
      const buttons = footer.querySelectorAll('button');
      buttons.forEach(btn => btn.disabled = false);

      const loadingEl = footer.querySelector('.modal-loading');
      if (loadingEl) {
        loadingEl.remove();
      }
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy() {
    this.close();
    super.destroy();
  }
}
