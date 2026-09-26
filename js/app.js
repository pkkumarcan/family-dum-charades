/**
 * UI Controller & Application Coordinator for Family Dum Charades
 * Coordinates centralized gameState, screen navigation, debounced touch handling,
 * and category/settings/history modal interactions.
 */

class AppController {
  constructor() {
    this.prepTimerId = null;
    this.prepSecondsRemaining = 30;
    this.actingTimerId = null;
    this.actingSecondsRemaining = 60;
    this.totalPrepTime = 30;
    this.totalActingTime = 60;

    this.currentScreen = 'screen-start';
    this.isActionLocked = false; // Debounce lock to prevent rapid double-tap bugs
  }

  async init() {
    this.bindDomElements();
    this.attachEventListeners();
    this.initPWA();

    try {
      window.GameEngine.initFromStorage();
      await window.GameEngine.loadPrompts();

      this.renderCategoryChecklist();
      this.syncFilterUI();
      this.updateStatsBar();
      this.loadSettingsToModal();

      // Ensure privacy by clearing any residual prompt text in the DOM on fresh load
      this.clearAllPromptDOM();
    } catch (e) {
      console.error('[App] Initialization error:', e);
      alert('Could not load prompts data. Please check data/prompts.json');
    }
  }

  bindDomElements() {
    // Screens
    this.screens = {
      start: document.getElementById('screen-start'),
      privatePrompt: document.getElementById('screen-prompt-private'),
      preparation: document.getElementById('screen-preparation'),
      acting: document.getElementById('screen-acting'),
      nextPlayer: document.getElementById('screen-next-player')
    };

    // Privacy Views
    this.privacyShield = document.getElementById('privacy-shield');
    this.revealedPrompt = document.getElementById('revealed-prompt-box');

    // Modals
    this.categoriesModal = document.getElementById('modal-categories');
    this.settingsModal = document.getElementById('modal-settings');
    this.historyModal = document.getElementById('modal-history');
    this.peekModal = document.getElementById('modal-peek');

    // Display & Summary Elements
    this.statBankTotal = document.getElementById('stat-bank-total');
    this.statEligible = document.getElementById('stat-eligible');
    this.statUsed = document.getElementById('stat-used');
    this.categorySummaryText = document.getElementById('category-summary-text');
    this.categoriesChecklist = document.getElementById('categories-checklist');

    // Prompt Card Elements
    this.revealedCatIcon = document.getElementById('revealed-cat-icon');
    this.revealedCatName = document.getElementById('revealed-cat-name');
    this.revealedPromptText = document.getElementById('revealed-prompt-text');
    this.revealedDiff = document.getElementById('revealed-diff-badge');
    this.revealedImage = document.getElementById('revealed-image');
    this.revealedImageWrapper = document.getElementById('revealed-image-wrapper');

    // Preparation Elements
    this.prepPromptText = document.getElementById('prep-prompt-text');
    this.prepCatIcon = document.getElementById('prep-cat-icon');
    this.prepCatName = document.getElementById('prep-cat-name');
    this.prepTimerNumber = document.getElementById('prep-timer-number');
    this.prepCircleProgress = document.getElementById('prep-circle-progress');
    this.prepImage = document.getElementById('prep-image');
    this.prepImageWrapper = document.getElementById('prep-image-wrapper');

    // Acting Elements
    this.actingTimerText = document.getElementById('acting-timer-text');
    this.actingTimerBar = document.getElementById('acting-timer-bar');

    // Peek Elements
    this.peekCatIcon = document.getElementById('peek-cat-icon');
    this.peekCatName = document.getElementById('peek-cat-name');
    this.peekPromptText = document.getElementById('peek-prompt-text');
    this.peekImage = document.getElementById('peek-image');
    this.peekImageWrapper = document.getElementById('peek-image-wrapper');

    // Handoff Stats
    this.handoffPlayed = document.getElementById('handoff-played');
    this.handoffCorrect = document.getElementById('handoff-correct');
    this.handoffPassed = document.getElementById('handoff-passed');

    // Status Chip
    this.offlineStatus = document.getElementById('offline-status');
  }

  attachEventListeners() {
    // Top Bar Modals
    document.getElementById('btn-open-settings')?.addEventListener('click', () => this.openModal('settings'));
    document.getElementById('btn-open-history')?.addEventListener('click', () => {
      this.renderHistoryList();
      this.openModal('history');
    });

    // Close Modals
    document.getElementById('btn-close-settings')?.addEventListener('click', () => this.closeModal('settings'));
    document.getElementById('btn-close-history')?.addEventListener('click', () => this.closeModal('history'));
    // Category Modal Done / Close
    document.getElementById('btn-close-categories')?.addEventListener('click', () => {
      this.applyCategoryChecklistState();
      this.closeModal('categories');
    });
    document.getElementById('btn-apply-categories')?.addEventListener('click', () => {
      this.applyCategoryChecklistState();
      this.closeModal('categories');
    });

    // Category Modal Open
    document.getElementById('btn-open-categories')?.addEventListener('click', () => {
      this.renderCategoryChecklist();
      this.openModal('categories');
    });

    // Category Select All
    document.getElementById('btn-select-all-cats')?.addEventListener('click', () => {
      this.categoriesChecklist?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
      });
      this.categoriesChecklist?.querySelectorAll('.checklist-item').forEach(el => {
        el.classList.add('checked');
      });
      this.applyCategoryChecklistState();
    });

    // Category Clear All (unchecks all immediately so user can easily tap 1 or 2)
    document.getElementById('btn-clear-all-cats')?.addEventListener('click', () => {
      this.categoriesChecklist?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      this.categoriesChecklist?.querySelectorAll('.checklist-item').forEach(el => {
        el.classList.remove('checked');
      });
      this.applyCategoryChecklistState();
    });

    // Modal Background Click Closes
    [this.settingsModal, this.historyModal, this.categoriesModal].forEach(modal => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Difficulty filter buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const diff = e.currentTarget.dataset.diff;
        window.GameEngine.state.difficulty = diff;
        window.GameEngine.persistState();
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.updateStatsBar();
      });
    });

    // Surprise Me Toggle
    const surpriseToggle = document.getElementById('toggle-surprise-me');
    surpriseToggle?.addEventListener('change', (e) => {
      window.GameEngine.state.isSurpriseMe = e.target.checked;
      if (window.GameEngine.state.isSurpriseMe) {
        window.GameEngine.state.selectedCategories = [];
        window.GameEngine.state.difficulty = 'All';
      }
      window.GameEngine.persistState();
      this.syncFilterUI();
      this.updateStatsBar();
    });

    // SCREEN 1: Give Me a Prompt / Start Game (Debounced)
    document.getElementById('btn-give-prompt')?.addEventListener('click', () => {
      this.withDebounce(() => {
        window.AudioManager.ensureContext();
        this.startTurn();
      });
    });

    // SCREEN 2: Reveal My Prompt
    document.getElementById('btn-reveal-prompt')?.addEventListener('click', () => {
      this.withDebounce(() => {
        window.AudioManager.ensureContext();
        this.revealPromptUI();
      });
    });

    // SCREEN 2: Start Preparation
    document.getElementById('btn-start-prep')?.addEventListener('click', () => {
      this.withDebounce(() => {
        this.goToPreparationScreen();
      });
    });

    // SCREEN 2: Skip prompt
    document.getElementById('btn-skip-prompt')?.addEventListener('click', () => {
      this.withDebounce(() => {
        window.AudioManager.playPass();
        window.GameEngine.handleSkip();
        this.startTurn(); // Draw another prompt immediately
      });
    });

    // SCREEN 2: Back to Start
    document.getElementById('btn-back-to-start')?.addEventListener('click', () => {
      this.showScreen('screen-start');
      this.clearAllPromptDOM();
      this.updateStatsBar();
    });

    // SCREEN 3: I'm Ready (Jump to Acting)
    document.getElementById('btn-prep-ready')?.addEventListener('click', () => {
      this.withDebounce(() => {
        this.stopPrepTimer();
        this.goToActingScreen();
      });
    });

    // SCREEN 3: Skip
    document.getElementById('btn-prep-skip')?.addEventListener('click', () => {
      this.withDebounce(() => {
        this.stopPrepTimer();
        window.AudioManager.playPass();
        window.GameEngine.handleSkip();
        this.startTurn();
      });
    });

    // SCREEN 4 (Acting): Correct
    document.getElementById('btn-acting-correct')?.addEventListener('click', () => {
      this.withDebounce(() => {
        this.stopActingTimer();
        window.AudioManager.playSuccess();
        window.GameEngine.recordResult('correct');
        this.goToNextPlayerScreen();
      });
    });

    // SCREEN 4 (Acting): Pass / Skip
    document.getElementById('btn-acting-pass')?.addEventListener('click', () => {
      this.withDebounce(() => {
        this.stopActingTimer();
        window.AudioManager.playPass();
        window.GameEngine.recordResult('passed');
        this.goToNextPlayerScreen();
      });
    });

    // SCREEN 4 (Acting): Show Prompt Again (Peek)
    document.getElementById('btn-acting-peek')?.addEventListener('click', () => {
      this.showPeekModal();
    });

    // Close Peek Modal
    document.getElementById('btn-close-peek')?.addEventListener('click', () => {
      this.closePeekModal();
    });

    // SCREEN 5 (Next Player): Next Prompt
    document.getElementById('btn-next-prompt')?.addEventListener('click', () => {
      this.withDebounce(() => {
        this.startTurn();
      });
    });

    // SCREEN 5 (Next Player): Back to Main Menu
    document.getElementById('btn-handoff-menu')?.addEventListener('click', () => {
      this.showScreen('screen-start');
      this.clearAllPromptDOM();
      this.updateStatsBar();
    });

    // Settings inputs
    this.bindSettingsEvents();
  }

  withDebounce(action) {
    if (this.isActionLocked) return;
    this.isActionLocked = true;
    try {
      action();
    } finally {
      setTimeout(() => {
        this.isActionLocked = false;
      }, 250);
    }
  }

  showScreen(screenId) {
    this.currentScreen = screenId;
    Object.values(this.screens).forEach(scr => {
      if (scr) scr.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
    }
  }

  renderCategoryChecklist() {
    if (!this.categoriesChecklist) return;
    const categories = window.GameEngine.getAllCategories();
    this.categoriesChecklist.innerHTML = '';

    const selected = window.GameEngine.state.selectedCategories;
    const isAllSelected = selected.length === 0;

    categories.forEach(cat => {
      const item = document.createElement('div');
      const isChecked = isAllSelected || selected.includes(cat);
      item.className = 'checklist-item' + (isChecked ? ' checked' : '');

      const safeId = `chk-cat-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`;

      item.innerHTML = `
        <div class="checklist-item-left">
          <span class="checklist-item-icon">${window.GameEngine.getCategoryIcon(cat)}</span>
          <span class="checklist-item-name">${cat}</span>
        </div>
        <div class="checklist-item-right">
          <button class="btn-only-category" type="button" aria-label="Select only ${cat}">Only</button>
          <input type="checkbox" id="${safeId}" value="${cat}" ${isChecked ? 'checked' : ''}>
        </div>
      `;

      const checkbox = item.querySelector('input[type="checkbox"]');
      const onlyBtn = item.querySelector('.btn-only-category');

      // Clicking row toggles checkbox (unless clicking "Only")
      item.addEventListener('click', (e) => {
        if (e.target === onlyBtn) return;
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        if (checkbox.checked) {
          item.classList.add('checked');
        } else {
          item.classList.remove('checked');
        }
        this.applyCategoryChecklistState();
      });

      // Clicking "Only" selects ONLY this category
      onlyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.categoriesChecklist.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = (cb.value === cat);
        });
        this.categoriesChecklist.querySelectorAll('.checklist-item').forEach(el => {
          el.classList.remove('checked');
        });
        item.classList.add('checked');
        this.applyCategoryChecklistState();
      });

      this.categoriesChecklist.appendChild(item);
    });
  }

  applyCategoryChecklistState() {
    if (!this.categoriesChecklist) return;
    const checkboxes = this.categoriesChecklist.querySelectorAll('input[type="checkbox"]');
    const checked = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    const all = window.GameEngine.getAllCategories();

    // If 0 checked or all checked, treat as All Categories ([])
    if (checked.length === 0 || checked.length === all.length) {
      window.GameEngine.state.selectedCategories = [];
    } else {
      window.GameEngine.state.selectedCategories = checked;
    }

    window.GameEngine.persistState();
    this.syncFilterUI();
    this.updateStatsBar();
  }

  syncChecklistUI() {
    const selected = window.GameEngine.state.selectedCategories;
    const isAllSelected = selected.length === 0;

    this.categoriesChecklist?.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const isChecked = isAllSelected || selected.includes(cb.value);
      cb.checked = isChecked;
      const row = cb.closest('.checklist-item');
      if (row) {
        if (isChecked) row.classList.add('checked');
        else row.classList.remove('checked');
      }
    });
  }

  syncFilterUI() {
    const allCats = window.GameEngine.getAllCategories();
    const sel = window.GameEngine.state.selectedCategories;

    if (this.categorySummaryText) {
      if (sel.length === 0 || sel.length === allCats.length) {
        this.categorySummaryText.textContent = `All Categories (${allCats.length})`;
      } else if (sel.length === 1) {
        this.categorySummaryText.textContent = `${sel[0]} (1)`;
      } else {
        this.categorySummaryText.textContent = `${sel.length} Categories Selected`;
      }
    }

    document.querySelectorAll('.diff-btn').forEach(btn => {
      if (btn.dataset.diff === window.GameEngine.state.difficulty) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const surpriseCheckbox = document.getElementById('toggle-surprise-me');
    if (surpriseCheckbox) surpriseCheckbox.checked = window.GameEngine.state.isSurpriseMe;
  }

  updateStatsBar() {
    const counts = window.GameEngine.getCounts();
    if (this.statBankTotal) this.statBankTotal.textContent = counts.totalBank;
    if (this.statEligible) this.statEligible.textContent = counts.remainingEligible;
    if (this.statUsed) this.statUsed.textContent = counts.allUsedCount;

    const exhaustedNotice = document.getElementById('exhausted-notice');
    const startPromptBtn = document.getElementById('btn-give-prompt');
    if (exhaustedNotice && startPromptBtn) {
      if (counts.remainingEligible === 0) {
        exhaustedNotice.classList.add('show');
        startPromptBtn.textContent = '🔄 Reset Used & Play';
      } else {
        exhaustedNotice.classList.remove('show');
        startPromptBtn.textContent = '🎲 Give Me a Prompt';
      }
    }
  }

  startTurn() {
    const counts = window.GameEngine.getCounts();
    if (counts.remainingEligible === 0) {
      const confirmReset = confirm('No unused prompts remain for your current filters! Would you like to reset used prompts and continue?');
      if (confirmReset) {
        window.GameEngine.resetUsedPrompts();
        this.updateStatsBar();
      } else {
        return;
      }
    }

    const prompt = window.GameEngine.selectRandomPrompt();
    if (!prompt) {
      alert('No prompt found. Please check your category filters.');
      return;
    }

    // Prepare Privacy Screen state: hide revealed card, show privacy shield
    if (this.privacyShield) this.privacyShield.style.display = 'flex';
    if (this.revealedPrompt) this.revealedPrompt.style.display = 'none';

    this.showScreen('screen-prompt-private');
  }

  revealPromptUI() {
    const prompt = window.GameEngine.state.currentPrompt;
    if (!prompt) return;

    if (this.revealedCatIcon) this.revealedCatIcon.textContent = window.GameEngine.getCategoryIcon(prompt.category);
    if (this.revealedCatName) this.revealedCatName.textContent = prompt.category;
    if (this.revealedPromptText) this.revealedPromptText.textContent = prompt.prompt;
    if (this.revealedDiff) this.revealedDiff.textContent = prompt.difficulty;

    // Visual Hint handling
    const showVisual = window.GameEngine.state.settings.showVisualHints !== false;
    if (prompt.image && showVisual) {
      if (this.revealedImage) {
        this.revealedImage.src = prompt.image;
        this.revealedImage.alt = prompt.prompt;
      }
      if (this.revealedImageWrapper) this.revealedImageWrapper.style.display = 'flex';
    } else {
      if (this.revealedImage) this.revealedImage.src = '';
      if (this.revealedImageWrapper) this.revealedImageWrapper.style.display = 'none';
    }

    if (this.privacyShield) this.privacyShield.style.display = 'none';
    if (this.revealedPrompt) this.revealedPrompt.style.display = 'flex';
  }

  goToPreparationScreen() {
    const prompt = window.GameEngine.state.currentPrompt;
    if (!prompt) return;

    const settings = window.GameEngine.state.settings;
    this.totalPrepTime = settings.prepTimerSeconds || 30;
    this.prepSecondsRemaining = this.totalPrepTime;

    if (this.prepPromptText) this.prepPromptText.textContent = prompt.prompt;
    if (this.prepCatIcon) this.prepCatIcon.textContent = window.GameEngine.getCategoryIcon(prompt.category);
    if (this.prepCatName) this.prepCatName.textContent = prompt.category;

    // Visual hint in preparation
    const showVisual = window.GameEngine.state.settings.showVisualHints !== false;
    if (prompt.image && showVisual) {
      if (this.prepImage) {
        this.prepImage.src = prompt.image;
        this.prepImage.alt = prompt.prompt;
      }
      if (this.prepImageWrapper) this.prepImageWrapper.style.display = 'flex';
    } else {
      if (this.prepImage) this.prepImage.src = '';
      if (this.prepImageWrapper) this.prepImageWrapper.style.display = 'none';
    }

    this.updatePrepTimerUI();
    this.showScreen('screen-preparation');
    this.startPrepTimer();
  }

  startPrepTimer() {
    this.stopPrepTimer();
    this.prepTimerId = setInterval(() => {
      this.prepSecondsRemaining--;
      this.updatePrepTimerUI();

      if (this.prepSecondsRemaining <= 3 && this.prepSecondsRemaining > 0) {
        window.AudioManager.playTick();
      }

      if (this.prepSecondsRemaining <= 0) {
        this.stopPrepTimer();
        window.AudioManager.playTimeUp();
        this.goToActingScreen();
      }
    }, 1000);
  }

  stopPrepTimer() {
    if (this.prepTimerId) {
      clearInterval(this.prepTimerId);
      this.prepTimerId = null;
    }
  }

  updatePrepTimerUI() {
    if (this.prepTimerNumber) {
      this.prepTimerNumber.textContent = this.prepSecondsRemaining;
    }

    if (this.prepCircleProgress) {
      const circumference = 2 * Math.PI * 65; // ~408.4
      const progress = this.prepSecondsRemaining / this.totalPrepTime;
      const offset = circumference * (1 - progress);
      this.prepCircleProgress.style.strokeDashoffset = offset;

      if (this.prepSecondsRemaining <= 5) {
        this.prepCircleProgress.classList.add('danger');
      } else {
        this.prepCircleProgress.classList.remove('danger');
      }
    }
  }

  goToActingScreen() {
    const settings = window.GameEngine.state.settings;
    this.totalActingTime = settings.actingTimerSeconds || 60;
    this.actingSecondsRemaining = this.totalActingTime;

    // Strict DOM privacy: clear prompt text and image from previous views
    if (this.prepPromptText) this.prepPromptText.textContent = '';
    if (this.revealedPromptText) this.revealedPromptText.textContent = '';
    if (this.prepImage) this.prepImage.src = '';
    if (this.prepImageWrapper) this.prepImageWrapper.style.display = 'none';
    if (this.revealedImage) this.revealedImage.src = '';
    if (this.revealedImageWrapper) this.revealedImageWrapper.style.display = 'none';

    this.updateActingTimerUI();
    this.showScreen('screen-acting');
    this.startActingTimer();
  }

  startActingTimer() {
    this.stopActingTimer();
    this.actingTimerId = setInterval(() => {
      this.actingSecondsRemaining--;
      this.updateActingTimerUI();

      if (this.actingSecondsRemaining <= 5 && this.actingSecondsRemaining > 0) {
        window.AudioManager.playTick();
      }

      if (this.actingSecondsRemaining <= 0) {
        this.stopActingTimer();
        window.AudioManager.playTimeUp();
      }
    }, 1000);
  }

  stopActingTimer() {
    if (this.actingTimerId) {
      clearInterval(this.actingTimerId);
      this.actingTimerId = null;
    }
  }

  updateActingTimerUI() {
    const mins = Math.floor(this.actingSecondsRemaining / 60);
    const secs = this.actingSecondsRemaining % 60;
    const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    if (this.actingTimerText) {
      this.actingTimerText.textContent = formatted;
    }

    if (this.actingTimerBar) {
      const percentage = (this.actingSecondsRemaining / this.totalActingTime) * 100;
      this.actingTimerBar.style.width = `${Math.max(0, percentage)}%`;
    }
  }

  showPeekModal() {
    const prompt = window.GameEngine.state.currentPrompt;
    if (!prompt || !this.peekModal) return;

    if (this.peekCatIcon) this.peekCatIcon.textContent = window.GameEngine.getCategoryIcon(prompt.category);
    if (this.peekCatName) this.peekCatName.textContent = prompt.category;
    if (this.peekPromptText) this.peekPromptText.textContent = prompt.prompt;

    const showVisual = window.GameEngine.state.settings.showVisualHints !== false;
    if (prompt.image && showVisual) {
      if (this.peekImage) {
        this.peekImage.src = prompt.image;
        this.peekImage.alt = prompt.prompt;
      }
      if (this.peekImageWrapper) this.peekImageWrapper.style.display = 'flex';
    } else {
      if (this.peekImage) this.peekImage.src = '';
      if (this.peekImageWrapper) this.peekImageWrapper.style.display = 'none';
    }

    this.peekModal.classList.add('active');
  }

  closePeekModal() {
    if (this.peekModal) {
      this.peekModal.classList.remove('active');
      if (this.peekPromptText) this.peekPromptText.textContent = '';
      if (this.peekImage) this.peekImage.src = '';
      if (this.peekImageWrapper) this.peekImageWrapper.style.display = 'none';
    }
  }

  goToNextPlayerScreen() {
    const stats = window.GameEngine.state.sessionStats;
    if (this.handoffPlayed) this.handoffPlayed.textContent = stats.played;
    if (this.handoffCorrect) this.handoffCorrect.textContent = stats.correct;
    if (this.handoffPassed) this.handoffPassed.textContent = stats.passed;

    // Strict privacy cleanup: completely sanitize DOM and active turn state
    window.GameEngine.state.currentPrompt = null;
    this.clearAllPromptDOM();

    this.showScreen('screen-next-player');
  }

  clearAllPromptDOM() {
    if (this.revealedPromptText) this.revealedPromptText.textContent = '';
    if (this.prepPromptText) this.prepPromptText.textContent = '';
    if (this.peekPromptText) this.peekPromptText.textContent = '';

    if (this.revealedImage) this.revealedImage.src = '';
    if (this.revealedImageWrapper) this.revealedImageWrapper.style.display = 'none';

    if (this.prepImage) this.prepImage.src = '';
    if (this.prepImageWrapper) this.prepImageWrapper.style.display = 'none';

    if (this.peekImage) this.peekImage.src = '';
    if (this.peekImageWrapper) this.peekImageWrapper.style.display = 'none';
  }

  openModal(type) {
    if (type === 'settings' && this.settingsModal) {
      this.loadSettingsToModal();
      this.settingsModal.classList.add('active');
    } else if (type === 'history' && this.historyModal) {
      this.historyModal.classList.add('active');
    } else if (type === 'categories' && this.categoriesModal) {
      this.categoriesModal.classList.add('active');
    }
  }

  closeModal(type) {
    if (type === 'settings' && this.settingsModal) {
      this.settingsModal.classList.remove('active');
    } else if (type === 'history' && this.historyModal) {
      this.historyModal.classList.remove('active');
    } else if (type === 'categories' && this.categoriesModal) {
      this.categoriesModal.classList.remove('active');
    }
  }

  bindSettingsEvents() {
    const selPrep = document.getElementById('setting-prep-time');
    const selActing = document.getElementById('setting-acting-time');
    const togSound = document.getElementById('setting-sound');
    const togVibe = document.getElementById('setting-vibration');
    const togVisual = document.getElementById('setting-visual-hints');
    const togSkipReturn = document.getElementById('setting-skip-return');

    selPrep?.addEventListener('change', (e) => {
      window.GameEngine.state.settings.prepTimerSeconds = parseInt(e.target.value, 10);
      window.GameEngine.persistState();
    });

    selActing?.addEventListener('change', (e) => {
      window.GameEngine.state.settings.actingTimerSeconds = parseInt(e.target.value, 10);
      window.GameEngine.persistState();
    });

    togSound?.addEventListener('change', (e) => {
      window.GameEngine.state.settings.soundEnabled = e.target.checked;
      window.GameEngine.persistState();
    });

    togVibe?.addEventListener('change', (e) => {
      window.GameEngine.state.settings.vibrationEnabled = e.target.checked;
      window.GameEngine.persistState();
    });

    togVisual?.addEventListener('change', (e) => {
      window.GameEngine.state.settings.showVisualHints = e.target.checked;
      window.GameEngine.persistState();
    });

    togSkipReturn?.addEventListener('change', (e) => {
      window.GameEngine.state.settings.skippedPromptsCanReturn = e.target.checked;
      window.GameEngine.persistState();
    });

    // Reset Used Prompts
    document.getElementById('btn-reset-used-prompts')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all used prompts? They will become eligible again.')) {
        window.GameEngine.resetUsedPrompts();
        this.updateStatsBar();
        alert('Used prompts have been reset!');
      }
    });

    // Reset All Game Data
    document.getElementById('btn-reset-all-data')?.addEventListener('click', () => {
      if (confirm('Reset entire app? This will clear history, used prompts, and restore default settings.')) {
        window.GameEngine.resetAllData();
        this.loadSettingsToModal();
        this.syncFilterUI();
        this.updateStatsBar();
        this.renderHistoryList();
        alert('All app data has been reset to defaults.');
      }
    });

    // Clear History Button
    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      if (confirm('Clear all game history?')) {
        window.GameEngine.clearHistory();
        this.renderHistoryList();
      }
    });
  }

  loadSettingsToModal() {
    const settings = window.GameEngine.state.settings;
    const selPrep = document.getElementById('setting-prep-time');
    const selActing = document.getElementById('setting-acting-time');
    const togSound = document.getElementById('setting-sound');
    const togVibe = document.getElementById('setting-vibration');
    const togVisual = document.getElementById('setting-visual-hints');
    const togSkipReturn = document.getElementById('setting-skip-return');

    if (selPrep) selPrep.value = settings.prepTimerSeconds.toString();
    if (selActing) selActing.value = settings.actingTimerSeconds.toString();
    if (togSound) togSound.checked = settings.soundEnabled;
    if (togVibe) togVibe.checked = settings.vibrationEnabled;
    if (togVisual) togVisual.checked = settings.showVisualHints !== false;
    if (togSkipReturn) togSkipReturn.checked = settings.skippedPromptsCanReturn;
  }

  renderHistoryList() {
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    const history = window.GameEngine.state.history;
    if (history.length === 0) {
      listContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No games played yet.</div>';
      return;
    }

    listContainer.innerHTML = history.map(item => {
      const isCorrect = item.result === 'correct';
      const badgeClass = isCorrect ? 'history-badge-correct' : 'history-badge-passed';
      const badgeText = isCorrect ? '✅ Correct' : '⏭️ Passed';
      const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="history-item">
          <div>
            <div class="history-item-prompt">${item.prompt}</div>
            <div class="history-item-cat">${item.category} • ${timeStr}</div>
          </div>
          <span class="${badgeClass}">${badgeText}</span>
        </div>
      `;
    }).join('');
  }

  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js', { scope: './' })
          .then(reg => {
            console.log('[PWA] ServiceWorker registered scope:', reg.scope);
            if (this.offlineStatus) {
              this.offlineStatus.innerHTML = '<span class="status-dot"></span> Ready';
            }
          })
          .catch(err => {
            console.warn('[PWA] ServiceWorker registration failed:', err);
          });
      });
    }

    window.addEventListener('online', () => {
      if (this.offlineStatus) {
        this.offlineStatus.innerHTML = '<span class="status-dot"></span> Online';
      }
    });

    window.addEventListener('offline', () => {
      if (this.offlineStatus) {
        this.offlineStatus.innerHTML = '<span class="status-dot" style="background: var(--accent-gold)"></span> Offline';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.App = new AppController();
  window.App.init();
});
