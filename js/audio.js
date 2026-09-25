/**
 * Audio and Haptics Manager for Family Dum Charades
 * Uses Web Audio API synthesizers and navigator.vibrate with graceful fallbacks.
 */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Short countdown tick (e.g. 3, 2, 1)
   */
  playTick() {
    const settings = window.StorageManager ? window.StorageManager.getSettings() : { soundEnabled: true, vibrationEnabled: true };
    if (!settings.soundEnabled) return;

    try {
      this.ensureContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, this.ctx.currentTime); // E5

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);

      this.vibrate(30);
    } catch (e) {
      // Graceful ignore
    }
  }

  /**
   * Final alert sound when timer reaches 0 ("Ready to Act" or "Time's Up")
   */
  playTimeUp() {
    const settings = window.StorageManager ? window.StorageManager.getSettings() : { soundEnabled: true, vibrationEnabled: true };
    if (!settings.soundEnabled) return;

    try {
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.12); // D6
      osc.frequency.setValueAtTime(1760, now + 0.24); // A6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);

      this.vibrate([100, 50, 150]);
    } catch (e) {
      // Graceful ignore
    }
  }

  /**
   * Success chime for Correct guess
   */
  playSuccess() {
    const settings = window.StorageManager ? window.StorageManager.getSettings() : { soundEnabled: true, vibrationEnabled: true };
    if (!settings.soundEnabled) return;

    try {
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.15, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.25);
      });

      this.vibrate([50, 50, 80]);
    } catch (e) {
      // Graceful ignore
    }
  }

  /**
   * Pass / Skip tone
   */
  playPass() {
    const settings = window.StorageManager ? window.StorageManager.getSettings() : { soundEnabled: true, vibrationEnabled: true };
    if (!settings.soundEnabled) return;

    try {
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);

      this.vibrate(50);
    } catch (e) {
      // Graceful ignore
    }
  }

  /**
   * Vibration helper
   * @param {number|number[]} pattern 
   */
  vibrate(pattern) {
    const settings = window.StorageManager ? window.StorageManager.getSettings() : { vibrationEnabled: true };
    if (!settings.vibrationEnabled) return;

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }
}

window.AudioManager = new AudioManager();
