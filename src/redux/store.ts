/**
 * Redux Store
 *
 * Configures the Redux Toolkit store with MMKV-backed state persistence.
 * Both the `pet` and `settings` slices are saved to MMKV on every dispatch
 * and rehydrated on startup — no redux-persist overhead needed.
 */

import { configureStore, Middleware } from '@reduxjs/toolkit';
import { mmkvStorageAdapter, storage } from '../storage/mmkv';
import petReducer, { PetState } from './petSlice';
import settingsReducer, { SettingsState } from './settingsSlice';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const PET_KEY      = 'pet_state';
const SETTINGS_KEY = 'settings_state';

// ---------------------------------------------------------------------------
// Explicit root type so selectors remain fully typed
// (defined before the store so slices can reference it)
// ---------------------------------------------------------------------------

export interface RootState {
  pet:      PetState;
  settings: SettingsState;
}

// ---------------------------------------------------------------------------
// MMKV Persistence Middleware
// ---------------------------------------------------------------------------

/**
 * After every dispatch: serialise both slices to MMKV and sync the
 * individual numeric keys that other parts of the app may read directly.
 */
const mmkvPersistenceMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  const result = next(action);
  const state  = storeAPI.getState() as RootState;

  // ── Pet state ──────────────────────────────────────────────────────────
  mmkvStorageAdapter.setItem(PET_KEY, JSON.stringify(state.pet));

  try {
    if (state.pet?.stats) {
      const { hunger, clean, energy } = state.pet.stats;
      const happiness = Math.round((hunger + clean + energy) / 3);
      storage.set('hunger',      Math.round(hunger));
      storage.set('clean',       Math.round(clean));
      storage.set('energy',      Math.round(energy));
      storage.set('happiness',   happiness);
      storage.set('coins',       Math.round(state.pet.coins));
      storage.set('xp',          Math.round(state.pet.xp));
      storage.set('level',       Math.round(state.pet.level));
      storage.set('lastOpenedAt',state.pet.lastOpenedAt);
    }
  } catch (e) {
    console.error('[Store] Failed to sync individual MMKV keys:', e);
  }

  // ── Settings state ─────────────────────────────────────────────────────
  mmkvStorageAdapter.setItem(SETTINGS_KEY, JSON.stringify(state.settings));

  return result;
};

// ---------------------------------------------------------------------------
// Rehydration helpers
// ---------------------------------------------------------------------------

const loadPersistedPetState = (): Partial<PetState> | undefined => {
  try {
    const serialised = mmkvStorageAdapter.getItem(PET_KEY);
    let saved: Partial<PetState> = {};
    if (serialised) {
      saved = JSON.parse(serialised) as Partial<PetState>;
    }

    // Hydrate / overwrite from individual MMKV keys if they exist
    const mHunger     = storage.getNumber('hunger');
    const mClean      = storage.getNumber('clean');
    const mEnergy     = storage.getNumber('energy');
    const mCoins      = storage.getNumber('coins');
    const mXp         = storage.getNumber('xp');
    const mLevel      = storage.getNumber('level');
    const mLastOpened = storage.getNumber('lastOpenedAt');

    if (!saved.stats) {
      saved.stats = {
        hunger: mHunger ?? 60,
        clean:  mClean  ?? 60,
        energy: mEnergy ?? 60,
        health: 100,
      };
    } else {
      if (mHunger !== undefined) saved.stats.hunger = mHunger;
      if (mClean  !== undefined) saved.stats.clean  = mClean;
      // Fallback: old schema used "hygiene"
      if (mClean === undefined && (saved.stats as unknown as Record<string, unknown>).hygiene !== undefined) {
        saved.stats.clean = (saved.stats as unknown as Record<string, unknown>).hygiene as number;
      }
      if (mEnergy !== undefined) saved.stats.energy = mEnergy;
    }

    if (mCoins      !== undefined) saved.coins        = mCoins;
    if (mXp         !== undefined) saved.xp           = mXp;
    if (mLevel      !== undefined) saved.level        = mLevel;
    if (mLastOpened !== undefined) saved.lastOpenedAt = mLastOpened;
    else if ((saved as unknown as Record<string, unknown>).lastOpenedTime !== undefined) {
      saved.lastOpenedAt = (saved as unknown as Record<string, unknown>).lastOpenedTime as number;
    }

    // Migration: ensure critical boolean fields are sane
    if (saved.isAlive === false || saved.isAlive === undefined) saved.isAlive = true;
    saved.isSleeping = false; // always wake on reload

    // Clamp stats
    if (saved.stats) {
      const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v ?? 60)));
      saved.stats.hunger = clamp(saved.stats.hunger);
      saved.stats.clean  = clamp(saved.stats.clean);
      saved.stats.energy = clamp(saved.stats.energy);
      saved.stats.health = Math.min(100, Math.max(0, Math.round(saved.stats.health ?? 100)));
    }

    return saved;
  } catch (e) {
    console.error('[Store] Failed to rehydrate pet state:', e);
    mmkvStorageAdapter.removeItem(PET_KEY);
    return undefined;
  }
};

const loadPersistedSettingsState = (): Partial<SettingsState> | undefined => {
  try {
    const serialised = mmkvStorageAdapter.getItem(SETTINGS_KEY);
    if (!serialised) return undefined;
    const parsed = JSON.parse(serialised) as Partial<SettingsState>;
    if (parsed.isHapticsEnabled === undefined) {
      parsed.isHapticsEnabled = true;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const preloadedPetState      = loadPersistedPetState();
const preloadedSettingsState = loadPersistedSettingsState();

export const store = configureStore({
  reducer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pet:      petReducer      as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    settings: settingsReducer as any,
  },
  preloadedState: {
    ...(preloadedPetState      ? { pet:      preloadedPetState      as PetState      } : {}),
    ...(preloadedSettingsState ? { settings: preloadedSettingsState as SettingsState } : {}),
  },
  middleware: (getDefaultMiddleware) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (getDefaultMiddleware as any)({ serializableCheck: false }) as ReturnType<typeof getDefaultMiddleware>;
    return base.concat(mmkvPersistenceMiddleware);
  },
});

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export type AppDispatch = typeof store.dispatch;

export default store;
