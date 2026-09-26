/**
 * Centralized Storage Manager for Family Dum Charades
 * Safely persists filters, settings, used prompts, and history (capped at 300 items).
 * Provides robust fallbacks for iOS Private Browsing and storage errors.
 */

const STORAGE_KEYS = {
  GAME_STATE: 'fdc_game_state_v1'
};

const DEFAULT_SETTINGS = {
  prepTimerSeconds: 30,
  actingTimerSeconds: 60,
  soundEnabled: true,
  vibrationEnabled: true,
  skippedPromptsCanReturn: false,
  showVisualHints: true
};

const DEFAULT_PERSISTED_STATE = {
  usedPromptIds: [],
  history: [],
  filters: {
    selectedCategories: [], // Empty means All
    difficulty: 'All',
    isSurpriseMe: false
  },
  settings: DEFAULT_SETTINGS
};

const StorageManager = {
  /**
   * Check if localStorage is available and writable
   */
  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Load full persisted state
   */
  loadPersistedState() {
    if (!this.isStorageAvailable()) {
      return JSON.parse(JSON.stringify(DEFAULT_PERSISTED_STATE));
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_PERSISTED_STATE));

      const parsed = JSON.parse(raw);
      return {
        usedPromptIds: Array.isArray(parsed.usedPromptIds) ? parsed.usedPromptIds : [],
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, 300) : [],
        filters: {
          selectedCategories: Array.isArray(parsed.filters?.selectedCategories) ? parsed.filters.selectedCategories : [],
          difficulty: parsed.filters?.difficulty || 'All',
          isSurpriseMe: Boolean(parsed.filters?.isSurpriseMe)
        },
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {})
        }
      };
    } catch (e) {
      console.warn('[StorageManager] Error reading storage, using defaults:', e);
      return JSON.parse(JSON.stringify(DEFAULT_PERSISTED_STATE));
    }
  },

  /**
   * Get settings object directly
   */
  getSettings() {
    return this.loadPersistedState().settings || DEFAULT_SETTINGS;
  },

  /**
   * Save full state or partial updates
   */
  savePersistedState(state) {
    if (!this.isStorageAvailable()) return;

    try {
      const payload = {
        usedPromptIds: state.usedPromptIds || [],
        history: (state.history || []).slice(0, 300), // Cap at 300 entries max
        filters: {
          selectedCategories: state.selectedCategories || [],
          difficulty: state.difficulty || 'All',
          isSurpriseMe: Boolean(state.isSurpriseMe)
        },
        settings: state.settings || DEFAULT_SETTINGS
      };
      localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(payload));
    } catch (e) {
      console.warn('[StorageManager] Failed to write to localStorage:', e);
    }
  },

  /**
   * Clear used prompts only
   */
  clearUsedPrompts(state) {
    state.usedPromptIds = [];
    this.savePersistedState(state);
  },

  /**
   * Clear history only
   */
  clearHistory(state) {
    state.history = [];
    this.savePersistedState(state);
  },

  /**
   * Reset all app data
   */
  resetAll(state) {
    state.usedPromptIds = [];
    state.history = [];
    state.selectedCategories = [];
    state.difficulty = 'All';
    state.isSurpriseMe = false;
    state.settings = { ...DEFAULT_SETTINGS };
    state.sessionStats = { played: 0, correct: 0, passed: 0 };
    this.savePersistedState(state);
  }
};

window.StorageManager = StorageManager;
