import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { isClearingFocusUpData } from '../privacy/clearFocusUpData';
import { accountApi, isBackendConfigured } from './accountSession';
import { restoreCloudSettings } from './restoreSettings';
import { captureSettingsBackup } from './settingsBackup';
import { SettingsSync } from './settingsSync';

// Under the "@focusup/" prefix, so "Clear FocusUp data" forgets it and the next sign-in restores from the cloud.
const recordKey = (userId: string) => `@focusup/settings-sync/${userId}`;

/** Starts automatic settings backup for the signed-in account. Returns a cleanup function. */
export function startSettingsSync(): () => void {
  if (!isBackendConfigured()) return () => undefined;
  const sync = new SettingsSync({
    getSettings: () => accountApi().getSettings(),
    saveSettings: (revision, payload) => accountApi().saveSettings(revision, payload),
    capture: captureSettingsBackup,
    restore: restoreCloudSettings,
    load: async (userId) => {
      const raw = await AsyncStorage.getItem(recordKey(userId));
      const value = raw ? JSON.parse(raw) as unknown : null;
      return value && typeof value === 'object' && typeof (value as { revision?: unknown }).revision === 'number' && typeof (value as { snapshot?: unknown }).snapshot === 'string'
        ? value as { revision: number; snapshot: string } : null;
    },
    save: (userId, record) => AsyncStorage.setItem(recordKey(userId), JSON.stringify(record)),
    log: __DEV__ ? (step, details) => console.log(`[settings-sync] ${step}`, details ?? '') : undefined,
  });
  const applyUser = () => {
    const { ready, user, recoveryRequired } = useAccountStore.getState();
    const hydrated = useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated();
    sync.setUser(ready && hydrated && user && !recoveryRequired ? user.id : null);
  };
  const settingsChanged = () => { if (!isClearingFocusUpData()) sync.notifyChanged(); };
  const unsubscribe = [
    useAccountStore.subscribe(applyUser),
    useAppStore.persist.onFinishHydration(applyUser),
    useWellbeingStore.persist.onFinishHydration(applyUser),
    useAppStore.subscribe(settingsChanged),
    useWellbeingStore.subscribe(settingsChanged),
  ];
  const appState = AppState.addEventListener('change', (state) => { if (state !== 'inactive' && !isClearingFocusUpData()) void sync.flush(); });
  applyUser();
  return () => { unsubscribe.forEach((stop) => stop()); appState.remove(); sync.setUser(null); };
}
