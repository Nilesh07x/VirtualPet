/**
 * SoundManager
 *
 * Singleton that owns every Sound instance for the lifetime of the app.
 * Call `SoundManager.init()` once on startup; after that call `play*()`
 * anywhere without worrying about loading or lifecycle.
 *
 * Android note: react-native-sound reads files from
 *   android/app/src/main/res/raw/  (no path prefix needed, BasePath = '').
 */

import Sound from 'react-native-sound';

// Enable playback in silence mode (iOS)
Sound.setCategory('Playback');

type SoundKey = 'tap' | 'eat' | 'soap_shampoo' | 'towel' | 'sleep' | 'happy' | 'levelup';

class SoundManagerClass {
  private sounds: Partial<Record<SoundKey, Sound>> = {};
  private _isMuted = false;
  private _sleepSound: Sound | null = null;

  // ── Init ───────────────────────────────────────────────────────────────────

  /**
   * Preload all sounds once. Safe to call multiple times (no-op if already loaded).
   * Must be called before any play*() method.
   */
  init(): void {
    const files: Record<SoundKey, string> = {
      tap:          'tap.mp3',
      eat:          'eat.mp3',
      soap_shampoo: 'soap_shampoo.mp3',
      towel:        'towel.mp3',
      sleep:        'sleep.mp3',
      happy:        'happy.mp3',
      levelup:      'levelup.mp3',
    };

    (Object.keys(files) as SoundKey[]).forEach((key) => {
      if (this.sounds[key]) return; // already loaded
      const s = new Sound(files[key], Sound.MAIN_BUNDLE, (err) => {
        if (err) {
          console.warn(`[SoundManager] Failed to load ${files[key]}:`, err);
        }
      });
      this.sounds[key] = s;
    });
  }

  // ── Mute control ──────────────────────────────────────────────────────────

  setMuted(muted: boolean): void {
    this._isMuted = muted;
    if (muted) {
      this._sleepSound?.stop();
    }
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  // ── Private helper ────────────────────────────────────────────────────────

  private play(key: SoundKey, volume = 1.0, loop = false): void {
    if (this._isMuted) return;
    const s = this.sounds[key];
    if (!s) return;
    s.stop(() => {
      s.setVolume(volume);
      s.setNumberOfLoops(loop ? -1 : 0);
      s.play((success) => {
        if (!success) {
          // Reset on Android decoder error so next play works
          s.reset();
        }
      });
    });
  }

  // ── Public play helpers ────────────────────────────────────────────────────

  playTap(): void         { this.play('tap',          0.8); }
  playEat(): void         { this.play('eat',          1.0); }
  playSoapShampoo(): void { this.play('soap_shampoo', 1.0); }
  playTowel(): void       { this.play('towel',        1.0); }
  
  playHappy(onComplete?: () => void): void {
    const s = this.sounds.happy;
    const duration = s ? s.getDuration() : 2.5; // fallback to 2.5s if not loaded
    const durationMs = Math.max(500, duration * 1000);

    if (this._isMuted) {
      setTimeout(() => {
        onComplete?.();
      }, durationMs);
      return;
    }

    if (!s) {
      onComplete?.();
      return;
    }

    s.stop(() => {
      s.setVolume(1.0);
      s.setNumberOfLoops(0);
      s.play((success) => {
        if (!success) {
          s.reset();
        }
        onComplete?.();
      });
    });
  }

  playLevelUp(): void     { this.play('levelup',      1.0); }

  /**
   * Start the sleep ambient sound, looped at low volume.
   * Stops any previous sleep sound first.
   */
  playSleep(): void {
    if (this._isMuted) return;
    const s = this.sounds.sleep;
    if (!s) return;
    s.stop(() => {
      s.setVolume(0.25);
      s.setNumberOfLoops(-1); // infinite loop
      s.play();
    });
    this._sleepSound = s;
  }

  /**
   * Stop the sleep ambient sound gracefully.
   */
  stopSleep(): void {
    this._sleepSound?.stop();
    this._sleepSound = null;
  }

  /**
   * Stop the happy sound immediately.
   */
  stopHappy(): void {
    this.sounds.happy?.stop();
  }

  /**
   * Stop all currently playing sounds immediately.
   * Use before navigating away to prevent audio leak.
   */
  stopAll(): void {
    this.stopSleep();
    (Object.keys(this.sounds) as SoundKey[]).forEach((k) => {
      this.sounds[k]?.stop();
    });
  }

  /**
   * Release all Sound objects (call when the app is fully unmounted).
   * In practice, this is rarely needed in RN but provided for completeness.
   */
  destroy(): void {
    this.stopSleep();
    (Object.keys(this.sounds) as SoundKey[]).forEach((k) => {
      this.sounds[k]?.release();
    });
    this.sounds = {};
  }
}

/** Singleton instance — import this anywhere in the app. */
const SoundManager = new SoundManagerClass();
export default SoundManager;
