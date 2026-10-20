import { forgetAccountSession } from '../backend/accountSession';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { useStatisticsStore } from '../../store/statisticsStore';
import { bundledRemoteBlockerConfig, useRemoteBlockerConfigStore } from '../../store/remoteBlockerConfigStore';
import { endSession, resetSessionTracker } from '../analytics/sessionTracker';
import { getAnalyticsStorage, resetAnalyticsCache } from '../analytics/eventStore';
import { resetBlockedAttemptDedup } from '../analytics/localAnalytics';
import { protectionBridge } from '../protection/nativeBridge';
import { resetProtectionController } from '../protection/controller';
import { reconcileStrictModeState } from '../strict-mode/strictModeController';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { resetRemoteBlockerConfig } from '../remote-config/remoteBlockerConfig';
import { setAnalyticsConsent } from '../analytics/productAnalytics';
import { releaseAllBrowsers } from '../../store/browserHostStore';

let clearing = false;
export function isClearingFocusUpData() { return clearing; }

/** Called only after in-app confirmation. Never clears unrelated storage. */
export async function clearFocusUpData(): Promise<{ browserDataCleared: boolean }> {
  if (clearing) throw new Error('Clear already in progress');
  clearing = true;
  try {
  // Stop replay before account/settings cleanup can expose another user's UI.
  await setAnalyticsConsent(false);
  await forgetAccountSession();
  resetRemoteBlockerConfig();
  await reconcileStrictModeState();
  await endSession();
  // Kept-alive pages would otherwise keep the cleared site data in memory.
  releaseAllBrowsers();
  await getAnalyticsStorage();
  await protectionBridge.reset();
  const browserDataCleared = await protectionBridge.clearBrowserData();
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(notifications.filter((item) => item.identifier.startsWith('focusup-') || item.content.data?.kind === 'strict-mode-end').map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  resetSessionTracker(); resetAnalyticsCache(); resetBlockedAttemptDedup(); resetProtectionController();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useWellbeingStore.setState(useWellbeingStore.getInitialState(), true);
  useStatisticsStore.setState({ selectedPeriod: 'day', revision: 0 });
  useProtectionStatusStore.setState(useProtectionStatusStore.getInitialState(), true);
  useRemoteBlockerConfigStore.getState().setConfig(bundledRemoteBlockerConfig, 'bundled');
  // Keep the opt-out across reset and the next cold start.
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => (key.startsWith('focusup-') || key.startsWith('@focusup/')) && key !== '@focusup/observability-consent');
  await AsyncStorage.multiRemove(keys);
  return { browserDataCleared };
  } finally { clearing = false; }
}
