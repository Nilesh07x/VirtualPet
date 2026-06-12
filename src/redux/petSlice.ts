/**
 * Pet Slice — Redux Toolkit
 *
 * Single source of truth for all pet stats.
 * MMKV persistence: every dispatch is auto-saved by the store middleware.
 *
 * Decay rules (live):
 *   Every 30 s: hunger -1, clean -1, energy -1  (energy only decays if awake)
 *   Happiness   = avg(hunger, clean, energy) — derived, never stored
 *
 * Decay rules (offline):
 *   Per 30 min elapsed: hunger -10, clean -10, energy -10
 *   Hard cap per stat: max 50 points total offline decay
 *
 * Progression:
 *   Feed:  +5 coins, +2 XP
 *   Clean: +5 coins, +2 XP
 *   Sleep: +10 coins, +5 XP  (on wake)
 *   XP thresholds: Lv1=0, Lv2=100, Lv3=200, LvN=(N-1)*100
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PetMood  = 'happy' | 'neutral' | 'sad' | 'sick' | 'sleeping';
export type PetStage = 'egg' | 'baby' | 'child' | 'teen' | 'adult' | 'elder';

export interface PetStats {
  hunger: number; // 0-100
  energy: number; // 0-100
  clean:  number; // 0-100 (renamed from hygiene)
  health: number; // 0-100
}

export interface PetState {
  name:           string;
  stage:          PetStage;
  mood:           PetMood;
  stats:          PetStats;
  xp:             number;
  evolutionCount: number;
  bornAt:         number | null;
  lastTickAt:     number | null;
  isAlive:        boolean;
  isGameStarted:  boolean;
  coins:          number;
  level:          number;
  isSleeping:     boolean;
  lastOpenedAt:   number;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const INITIAL_STATS: PetStats = {
  hunger:  60,
  energy:  60,
  clean:   60,
  health:  100,
};

const initialState: PetState = {
  name:           'My Pet',
  stage:          'baby',
  mood:           'neutral',
  stats:          INITIAL_STATS,
  xp:             0,
  evolutionCount: 0,
  bornAt:         null,
  lastTickAt:     null,
  isAlive:        true,
  isGameStarted:  false,
  coins:          0,
  level:          1,
  isSleeping:     false,
  lastOpenedAt:   Date.now(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (v: number): number => Math.min(100, Math.max(0, v));

const deriveMood = (stats: PetStats, isSleeping: boolean): PetMood => {
  if (isSleeping) return 'sleeping';
  const h = (stats.hunger + stats.clean + stats.energy) / 3;
  if (stats.health < 20) return 'sick';
  if (h < 25)            return 'sad';
  if (h >= 65)           return 'happy';
  return 'neutral';
};

/** Compute level from total XP: Level = floor(xp/100) + 1 */
const xpToLevel = (xp: number): number => Math.floor(xp / 100) + 1;

const awardCoins = (state: PetState, amount: number): void => {
  state.coins += amount;
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const petSlice = createSlice({
  name: 'pet',
  initialState,
  reducers: {

    // ── Lifecycle ────────────────────────────────────────────────────────────

    startGame: (state, action: PayloadAction<{ name: string }>) => {
      state.name          = action.payload.name.trim() || 'My Pet';
      state.stage         = 'baby';
      state.stats         = { ...INITIAL_STATS };
      state.xp            = 0;
      state.evolutionCount= 0;
      state.bornAt        = Date.now();
      state.lastTickAt    = Date.now();
      state.isAlive       = true;
      state.isGameStarted = true;
      state.coins         = 0;
      state.level         = 1;
      state.isSleeping    = false;
      state.lastOpenedAt  = Date.now();
      state.mood          = deriveMood(state.stats, false);
    },

    resetPet: () => ({ ...initialState, lastOpenedAt: Date.now() }),

    // ── Care Actions ─────────────────────────────────────────────────────────

    /**
     * Feed the pet.
     * +hunger, +health, +5 coins, +2 XP
     */
    feedPet: (state, action: PayloadAction<{ amount?: number } | undefined>) => {
      if (state.isSleeping) return;
      const amount = action.payload?.amount ?? 10;
      state.stats.hunger = clamp(state.stats.hunger + amount);
      state.stats.health = clamp(state.stats.health + 1);
      state.xp   += 2;
      state.level = xpToLevel(state.xp);
      awardCoins(state, 5);
      state.mood = deriveMood(state.stats, state.isSleeping);
    },

    /**
     * Clean the pet.
     * +clean, +health, +5 coins, +2 XP
     */
    cleanPet: (state) => {
      if (state.isSleeping) return;
      state.stats.clean  = clamp(state.stats.clean + 10);
      state.stats.health = clamp(state.stats.health + 1);
      state.xp   += 2;
      state.level = xpToLevel(state.xp);
      awardCoins(state, 5);
      state.mood = deriveMood(state.stats, state.isSleeping);
    },

    /** Put the pet to sleep */
    sleepPet: (state) => {
      if (state.isSleeping) return;
      state.isSleeping = true;
      state.mood = 'sleeping';
    },

    /** Wake the pet up — awards sleep bonus */
    wakePet: (state) => {
      if (!state.isSleeping) return;
      state.isSleeping = false;
      state.xp   += 5;
      state.level = xpToLevel(state.xp);
      awardCoins(state, 10);
      state.mood = deriveMood(state.stats, false);
    },

    /**
     * Gradually recover energy while sleeping.
     * Called every 2 s from SleepScreen: +5 energy per call.
     */
    recoverEnergy: (state) => {
      if (!state.isSleeping) return;
      state.stats.energy = clamp(state.stats.energy + 5);
    },

    playWithPet: (state) => {
      if (state.isSleeping) return;
      state.stats.energy = clamp(state.stats.energy - 5);
      state.xp   += 3;
      state.level = xpToLevel(state.xp);
      awardCoins(state, 5);
      state.mood = deriveMood(state.stats, state.isSleeping);
    },

    addCoins: (state, action: PayloadAction<number>) => {
      awardCoins(state, action.payload);
    },

    // ── Decay ────────────────────────────────────────────────────────────────

    /**
     * Live decay tick — called every 30 s by usePetDecay.
     * Decrements hunger, clean, energy by 1 each.
     */
    applyStatDecay: (state) => {
      if (!state.isAlive) return;

      state.stats.hunger = clamp(state.stats.hunger - 1);
      state.stats.clean  = clamp(state.stats.clean - 1);
      if (!state.isSleeping) {
        state.stats.energy = clamp(state.stats.energy - 1);
      }

      // Health penalty if critically low
      const crits = [state.stats.hunger, state.stats.energy, state.stats.clean]
        .filter(s => s < 20).length;
      if (crits > 0) {
        state.stats.health = clamp(state.stats.health - crits * 0.5);
      }

      state.lastTickAt = Date.now();
      state.mood = deriveMood(state.stats, state.isSleeping);

      if (state.stats.health <= 0) {
        state.isAlive    = false;
        state.isSleeping = false;
        state.mood       = 'sad';
      }
    },

    /**
     * Offline decay — called once on app open.
     * Rule: per 30 min elapsed offline → -10 per stat.
     * Hard cap: max 50 decay per stat regardless of how long app was closed.
     */
    applyOfflineDecay: (state) => {
      if (!state.isAlive) return;

      const now        = Date.now();
      const elapsedMs  = now - state.lastOpenedAt;
      const intervals  = Math.floor(elapsedMs / (2 * 60_000)); // per 30 min
      if (intervals < 1) {
        state.lastOpenedAt = now;
        return;
      }

      const decay = Math.min(intervals , 30);
      state.stats.hunger = clamp(state.stats.hunger - decay);
      state.stats.clean  = clamp(state.stats.clean - decay);
      state.stats.energy = clamp(state.stats.energy - decay);

      const crits = [state.stats.hunger, state.stats.energy, state.stats.clean]
        .filter(s => s < 20).length;
      if (crits > 0) {
        state.stats.health = clamp(state.stats.health - crits * 2);
      }

      state.lastOpenedAt = now;
      state.lastTickAt   = now;
      state.mood = deriveMood(state.stats, state.isSleeping);

      if (state.stats.health <= 0) {
        state.isAlive    = false;
        state.isSleeping = false;
        state.mood       = 'sad';
      }
    },

    evolvePet: (state) => {
      const stages: PetStage[] = ['egg', 'baby', 'child', 'teen', 'adult', 'elder'];
      const i = stages.indexOf(state.stage);
      if (i < stages.length - 1) {
        state.stage          = stages[i + 1];
        state.evolutionCount+= 1;
        state.xp            += 50;
        state.level          = xpToLevel(state.xp);
        awardCoins(state, 20);
      }
    },

    renamePet: (state, action: PayloadAction<{ name: string }>) => {
      state.name = action.payload.name.trim();
    },

    recordAppOpen: (state) => {
      state.lastOpenedAt = Date.now();
    },
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const {
  startGame,
  resetPet,
  feedPet,
  cleanPet,
  sleepPet,
  wakePet,
  recoverEnergy,
  playWithPet,
  addCoins,
  applyStatDecay,
  applyOfflineDecay,
  evolvePet,
  renamePet,
  recordAppOpen,
} = petSlice.actions;

// Selectors
export const selectPet               = (s: RootState): PetState => s.pet;
export const selectHunger            = (s: RootState): number   => Math.round(s.pet.stats.hunger);
export const selectEnergy            = (s: RootState): number   => Math.round(s.pet.stats.energy);
export const selectClean             = (s: RootState): number   => Math.round(s.pet.stats.clean);
export const selectHealth            = (s: RootState): number   => Math.round(s.pet.stats.health);
export const selectComputedHappiness = (s: RootState): number   =>
  Math.round((s.pet.stats.hunger + s.pet.stats.clean + s.pet.stats.energy) / 3);
export const selectHappiness         = selectComputedHappiness;
export const selectCoins             = (s: RootState): number   => s.pet.coins;
export const selectLevel             = (s: RootState): number   => s.pet.level;
export const selectXp                = (s: RootState): number   => s.pet.xp;
export const selectMood              = (s: RootState): PetMood  => s.pet.mood;
export const selectStage             = (s: RootState): PetStage => s.pet.stage;
export const selectIsSleeping        = (s: RootState): boolean  => s.pet.isSleeping;
export const selectIsAlive           = (s: RootState): boolean  => s.pet.isAlive;
export const selectIsGameStarted     = (s: RootState): boolean  => s.pet.isGameStarted;
export const selectLastOpenedAt      = (s: RootState): number   => s.pet.lastOpenedAt;

/** XP needed to reach next level */
export const selectXpToNextLevel = (s: RootState): number =>
  s.pet.level * 100 - s.pet.xp;

export default petSlice.reducer;
