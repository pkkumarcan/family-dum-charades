/**
 * Centralized Game Engine for Family Dum Charades
 * Manages game state, prompt validation, filtering, randomization, and score tracking.
 */

const CATEGORY_ICONS = {
  "Funny Situations": "😂",
  "One-Word & Object Prompts": "📦",
  "Bollywood People & Relations": "🎬",
  "Indian TV & Shows": "📺",
  "Bollywood Dialogues": "💬",
  "Bollywood Songs": "🎵",
  "Food, Grocery & Kitchen Items": "🍲",
  "Famous Places & Landmarks": "🌍",
  "Professions & Roles": "👷",
  "Technology & Apps": "💻",
  "Indian Weddings & Family": "💍",
  "Sports & Games": "🏏",
  "Travel & Airport": "✈️",
  "Animals with a Twist": "🐒",
  "Brands & Products": "🏷️",
  "Idioms & Phrases": "🗣️",
  "Weather & Nature": "⛈️",
  "Office & School Life": "🎒",
  "Celebrations & Holidays": "🎉",
  "Bollywood Movies": "🍿"
};

class GameEngine {
  constructor() {
    this.prompts = [];
    
    // Centralized Game State
    this.state = {
      selectedCategories: [], // Empty means All
      difficulty: 'All',      // 'All' | 'Medium' | 'Medium-Hard' | 'Hard'
      isSurpriseMe: false,

      currentPrompt: null,
      lastCategoryPicked: null,

      usedPromptIds: [],
      history: [],

      settings: {
        prepTimerSeconds: 30,
        actingTimerSeconds: 60,
        soundEnabled: true,
        vibrationEnabled: true,
        skippedPromptsCanReturn: false,
        showVisualHints: true
      },

      sessionStats: {
        played: 0,
        correct: 0,
        passed: 0
      }
    };
  }

  /**
   * Initialize state from storage
   */
  initFromStorage() {
    if (window.StorageManager) {
      const persisted = window.StorageManager.loadPersistedState();
      this.state.usedPromptIds = persisted.usedPromptIds || [];
      this.state.history = persisted.history || [];
      this.state.selectedCategories = persisted.filters?.selectedCategories || [];
      this.state.difficulty = persisted.filters?.difficulty || 'All';
      this.state.isSurpriseMe = Boolean(persisted.filters?.isSurpriseMe);
      this.state.settings = { ...this.state.settings, ...persisted.settings };
    }
  }

  /**
   * Save current state to storage
   */
  persistState() {
    if (window.StorageManager) {
      window.StorageManager.savePersistedState(this.state);
    }
  }

  /**
   * Load and validate prompts.json
   */
  async loadPrompts() {
    try {
      const response = await fetch('./data/prompts.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rawData = await response.json();
      
      if (!Array.isArray(rawData)) {
        throw new Error('Prompts data is not an array.');
      }

      // Robust Validation: skip malformed rows gracefully
      this.prompts = [];
      let skippedCount = 0;

      rawData.forEach((item, index) => {
        if (item && typeof item === 'object' && item.id && item.prompt && item.category) {
          const record = {
            id: String(item.id).trim(),
            category: String(item.category).trim(),
            prompt: String(item.prompt).trim(),
            difficulty: item.difficulty ? String(item.difficulty).trim() : 'Medium',
            status: item.status ? String(item.status).trim() : 'Keep'
          };
          if (item.image) {
            record.image = String(item.image).trim();
          }
          if (item.actingHint) {
            record.actingHint = String(item.actingHint).trim();
          }
          this.prompts.push(record);
        } else {
          skippedCount++;
        }
      });

      if (skippedCount > 0) {
        console.warn(`[GameEngine] Gracefully skipped ${skippedCount} malformed prompt rows.`);
      }

      console.log(`[GameEngine] Loaded ${this.prompts.length} valid prompts.`);
      return this.prompts;
    } catch (e) {
      console.error('[GameEngine] Failed to load prompts:', e);
      throw e;
    }
  }

  getAllCategories() {
    const set = new Set();
    this.prompts.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }

  getCategoryIcon(category) {
    return CATEGORY_ICONS[category] || "🎭";
  }

  /**
   * Get eligible prompts based on active filters and used state
   */
  getEligiblePrompts(includeUsed = false) {
    return this.prompts.filter(p => {
      if (p.status && p.status.toLowerCase() !== 'keep') return false;

      // Category filter (empty means All)
      if (this.state.selectedCategories.length > 0 && !this.state.selectedCategories.includes(p.category)) {
        return false;
      }

      // Difficulty filter
      if (this.state.difficulty !== 'All' && p.difficulty !== this.state.difficulty) {
        return false;
      }

      // Used filter
      if (!includeUsed && this.state.usedPromptIds.includes(p.id)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Select next random prompt
   */
  selectRandomPrompt() {
    const eligible = this.getEligiblePrompts(false);

    if (eligible.length === 0) {
      return null;
    }

    if (eligible.length === 1) {
      this.state.currentPrompt = eligible[0];
      this.state.lastCategoryPicked = this.state.currentPrompt.category;
      return this.state.currentPrompt;
    }

    // Try to avoid immediately repeating the same category where possible
    let candidates = eligible;
    if (this.state.lastCategoryPicked) {
      const diffCategoryCandidates = eligible.filter(p => p.category !== this.state.lastCategoryPicked);
      if (diffCategoryCandidates.length > 0) {
        candidates = diffCategoryCandidates;
      }
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    this.state.currentPrompt = candidates[randomIndex];
    this.state.lastCategoryPicked = this.state.currentPrompt.category;

    return this.state.currentPrompt;
  }

  /**
   * Mark current prompt as used
   */
  markCurrentPromptUsed() {
    if (this.state.currentPrompt) {
      const id = this.state.currentPrompt.id;
      if (!this.state.usedPromptIds.includes(id)) {
        this.state.usedPromptIds.push(id);
        this.persistState();
      }
    }
  }

  /**
   * Handle Skip explicitly:
   * - Default: Marks prompt used immediately and draws next prompt.
   * - If return enabled: Does not mark used.
   */
  handleSkip() {
    if (!this.state.currentPrompt) return;

    if (this.state.settings.skippedPromptsCanReturn) {
      // Returned to pool (not marked used)
    } else {
      // Marked as used so it won't repeat immediately
      this.markCurrentPromptUsed();
    }
  }

  /**
   * Record acting round outcome (Correct / Passed)
   */
  recordResult(result) {
    if (!this.state.currentPrompt) return;

    this.markCurrentPromptUsed();
    this.state.sessionStats.played += 1;
    if (result === 'correct') {
      this.state.sessionStats.correct += 1;
    } else {
      this.state.sessionStats.passed += 1;
    }

    this.state.history.unshift({
      id: this.state.currentPrompt.id,
      prompt: this.state.currentPrompt.prompt,
      category: this.state.currentPrompt.category,
      difficulty: this.state.currentPrompt.difficulty,
      result: result,
      timestamp: Date.now()
    });

    // Cap history at 300 items
    if (this.state.history.length > 300) {
      this.state.history.length = 300;
    }

    this.persistState();
  }

  getCounts() {
    const totalMatching = this.getEligiblePrompts(true).length;
    const remainingEligible = this.getEligiblePrompts(false).length;
    const usedCount = totalMatching - remainingEligible;

    return {
      totalMatching,
      remainingEligible,
      usedCount,
      totalBank: this.prompts.length,
      allUsedCount: this.state.usedPromptIds.length
    };
  }

  resetUsedPrompts() {
    if (window.StorageManager) {
      window.StorageManager.clearUsedPrompts(this.state);
    } else {
      this.state.usedPromptIds = [];
    }
  }

  clearHistory() {
    if (window.StorageManager) {
      window.StorageManager.clearHistory(this.state);
    } else {
      this.state.history = [];
    }
  }

  resetAllData() {
    if (window.StorageManager) {
      window.StorageManager.resetAll(this.state);
    } else {
      this.state.usedPromptIds = [];
      this.state.history = [];
      this.state.selectedCategories = [];
      this.state.difficulty = 'All';
    }
  }
}

window.GameEngine = new GameEngine();
