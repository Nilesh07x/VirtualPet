/**
 * MMKV Storage Instance
 *
 * A fast, synchronous key-value storage backed by react-native-mmkv.
 * Used for persisting Redux state and app-level data between sessions.
 */

import { createMMKV } from 'react-native-mmkv';


/**
 * Default MMKV instance used across the app.
 * Encryption can be added by providing an `encryptionKey` option.
 */
export const storage = createMMKV({
  id: 'virtual-pet-storage',
});

/**
 * A Redux-compatible storage adapter built on top of MMKV.
 * Matches the AsyncStorage API shape expected by redux-persist (if used later).
 */
export const mmkvStorageAdapter = {
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },

  getItem: (key: string): string | undefined => {
    return storage.getString(key);
  },

  removeItem: (key: string): void => {
    storage.remove(key);
  },

  clearAll: (): void => {
    storage.clearAll();
  },
};

export default storage;
