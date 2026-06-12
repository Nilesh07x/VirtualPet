/**
 * Settings Slice — Redux Toolkit
 *
 * Persists user preferences to MMKV.
 * Currently manages:
 *   - isMuted: whether all in-game sounds are silenced
 */

import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface SettingsState {
  isMuted: boolean;
  isHapticsEnabled: boolean;
}

const initialState: SettingsState = {
  isMuted: false,
  isHapticsEnabled: true,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
    },
    setMuted: (state, action: { payload: boolean }) => {
      state.isMuted = action.payload;
    },
    toggleHaptics: (state) => {
      state.isHapticsEnabled = !state.isHapticsEnabled;
    },
    setHapticsEnabled: (state, action: { payload: boolean }) => {
      state.isHapticsEnabled = action.payload;
    },
  },
});

export const { toggleMute, setMuted, toggleHaptics, setHapticsEnabled } = settingsSlice.actions;

export const selectIsMuted = (s: RootState): boolean => s.settings.isMuted;
export const selectIsHapticsEnabled = (s: RootState): boolean => s.settings.isHapticsEnabled;

export default settingsSlice.reducer;
