import { NativeModules } from 'react-native';
import type { RootState } from '../redux/store';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Safely check if the native module is present in the native binary
const isHapticFeedbackSupported = (): boolean => {
  try {
    return !!(NativeModules && NativeModules.RNHapticFeedback);
  } catch {
    return false;
  }
};

export const triggerHaptic = (
  type: 'impactLight' | 'impactMedium' | 'notificationSuccess'
): void => {
  try {
    if (!isHapticFeedbackSupported()) {
      return;
    }

    // Lazily require store to break circular dependencies during module loading
    const { store } = require('../redux/store');
    const state = store.getState() as RootState;
    const isHapticsEnabled = state.settings.isHapticsEnabled;
    if (isHapticsEnabled) {
      // Lazily require react-native-haptic-feedback and catch if it's missing in the native binary
      const RNHaptic = require('react-native-haptic-feedback');
      const trigger = RNHaptic.default ? RNHaptic.default.trigger : RNHaptic.trigger;
      if (trigger) {
        trigger(type, options);
      }
    }
  } catch (e) {
    console.log('[Haptics] Haptic feedback not available or failed to load:', e);
  }
};

export const lightHaptic = (): void => triggerHaptic('impactLight');
export const mediumHaptic = (): void => triggerHaptic('impactMedium');
export const successHaptic = (): void => triggerHaptic('notificationSuccess');