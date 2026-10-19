import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SecretStorage } from './sessionManager';

const memory = new Map<string, string>();
/** Web sessions intentionally expire on page reload; no browser token persistence. */
export function secretStorage(key: string): SecretStorage {
  if (Platform.OS === 'web') return {
    read: async () => memory.get(key) ?? null,
    write: async (value) => { memory.set(key, value); },
    remove: async () => { memory.delete(key); },
  };
  return {
    read: () => SecureStore.getItemAsync(key),
    write: (value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    remove: () => SecureStore.deleteItemAsync(key),
  };
}

export function oauthSecretStorage(): SecretStorage {
  if (Platform.OS !== 'web') return secretStorage('focusup.account.oauth.v1');
  // This contains a short-lived PKCE proof, never an account session or password.
  return {
    read: async () => window.sessionStorage.getItem('focusup.oauth.v1'),
    write: async (value) => { window.sessionStorage.setItem('focusup.oauth.v1', value); },
    remove: async () => { window.sessionStorage.removeItem('focusup.oauth.v1'); },
  };
}
