/**
 * Global keyboard shortcuts manager for Zen Type
 * Provides consistent keyboard navigation and quick actions
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean; // Cmd on Mac, Windows key on PC
  description: string;
  action: () => void;
  enabled?: () => boolean; // Optional condition for when shortcut is active
}

export class KeyboardManager {
  private static instance: KeyboardManager;
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isEnabled = true;
  private activeElement: Element | null = null;

  static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }

  /**
   * Register a new keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): () => void {
    const key = this.normalizeKey(shortcut);
    this.shortcuts.set(key, shortcut);

    return () => {
      this.shortcuts.delete(key);
    };
  }

  /**
   * Enable/disable all keyboard shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Initialize global keyboard listener
   */
  initialize(): void {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
    document.addEventListener('focusout', this.handleFocusOut.bind(this));
  }

  /**
   * Cleanup keyboard listeners
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.removeEventListener('focusin', this.handleFocusIn.bind(this));
    document.removeEventListener('focusout', this.handleFocusOut.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Don't interfere with form inputs, contenteditable, or when disabled
    if (!this.isEnabled || this.isInputActive() || this.shouldIgnoreKey(event)) {
      return;
    }

    const shortcut = this.findMatchingShortcut(event);
    if (shortcut) {
      event.preventDefault();
      event.stopPropagation();

      // Check if shortcut is enabled
      if (shortcut.enabled && !shortcut.enabled()) {
        return;
      }

      try {
        shortcut.action();
      } catch (error) {
        console.error('Keyboard shortcut action failed:', error);
      }
    }
  }

  private handleFocusIn(event: FocusEvent): void {
    this.activeElement = event.target as Element;
  }

  private handleFocusOut(): void {
    this.activeElement = null;
  }

  private findMatchingShortcut(event: KeyboardEvent): KeyboardShortcut | undefined {
    for (const shortcut of this.shortcuts.values()) {
      if (this.matchesShortcut(shortcut, event)) {
        return shortcut;
      }
    }
    return undefined;
  }

  private matchesShortcut(shortcut: KeyboardShortcut, event: KeyboardEvent): boolean {
    return (
      event.key.toLowerCase() === shortcut.key.toLowerCase() &&
      !!event.ctrlKey === !!shortcut.ctrl &&
      !!event.altKey === !!shortcut.alt &&
      !!event.shiftKey === !!shortcut.shift &&
      !!event.metaKey === !!shortcut.meta
    );
  }

  private normalizeKey(shortcut: KeyboardShortcut): string {
    const parts = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.meta) parts.push('meta');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }

  private isInputActive(): boolean {
    if (!this.activeElement) return false;

    const tagName = this.activeElement.tagName?.toLowerCase();
    const contentEditable = this.activeElement.getAttribute('contenteditable');
    const isFormElement = ['input', 'textarea', 'select'].includes(tagName);

    return isFormElement || contentEditable === 'true' || contentEditable === '';
  }

  private shouldIgnoreKey(event: KeyboardEvent): boolean {
    // Always allow modifier keys and function keys
    if (event.key === 'Shift' || event.key === 'Control' ||
        event.key === 'Alt' || event.key === 'Meta') {
      return false;
    }

    // Ignore if user is selecting text
    if (window.getSelection()?.toString()) {
      return true;
    }

    return false;
  }

  /**
   * Get all registered shortcuts for help display
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }
}

// Export singleton instance
export const keyboardManager = KeyboardManager.getInstance();

// Predefined shortcuts for Zen Type
export const ZEN_TYPE_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'p',
    ctrl: true,
    description: 'Toggle pause menu',
    action: () => {
      window.dispatchEvent(new CustomEvent('togglePause'));
    }
  },
  {
    key: 'r',
    ctrl: true,
    description: 'Reset current session',
    action: () => {
      window.dispatchEvent(new CustomEvent('resetSession'));
    }
  },
  {
    key: 'n',
    ctrl: true,
    description: 'Load new quote',
    action: () => {
      window.dispatchEvent(new CustomEvent('newQuote'));
    }
  },
  {
    key: 's',
    ctrl: true,
    description: 'Toggle settings',
    action: () => {
      window.dispatchEvent(new CustomEvent('toggleSettings'));
    }
  },
  {
    key: 'h',
    ctrl: true,
    description: 'Toggle help',
    action: () => {
      window.dispatchEvent(new CustomEvent('toggleHelp'));
    }
  },
  {
    key: 'e',
    ctrl: true,
    description: 'Export session',
    action: () => {
      window.dispatchEvent(new CustomEvent('exportSession'));
    }
  },
  {
    key: 'a',
    ctrl: true,
    description: 'Toggle auto-advance',
    action: () => {
      window.dispatchEvent(new CustomEvent('toggleAutoAdvance'));
    }
  },
  {
    key: '/',
    ctrl: true,
    description: 'Focus search/command palette',
    action: () => {
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }
  },
  {
    key: 'Escape',
    description: 'Close current overlay/pause menu',
    action: () => {
      // Close pause menu if open
      window.dispatchEvent(new CustomEvent('togglePause', { detail: false }));
      // Close help if open
      window.dispatchEvent(new CustomEvent('toggleHelp', { detail: false }));
      // Close settings if open
      window.dispatchEvent(new CustomEvent('toggleSettings', { detail: false }));
    }
  }
];

// Auto-register shortcuts when module loads
if (typeof window !== 'undefined') {
  // Initialize keyboard manager
  keyboardManager.initialize();

  // Register all Zen Type shortcuts
  ZEN_TYPE_SHORTCUTS.forEach(shortcut => {
    keyboardManager.register(shortcut);
  });
}
