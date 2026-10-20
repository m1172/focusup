import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { clearFocusUpData } from '../clearFocusUpData';
import { protectionBridge } from '../../protection/nativeBridge';
import { forgetAccountSession } from '../../backend/accountSession';

jest.mock('../../backend/accountSession', () => ({ forgetAccountSession: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-notifications', () => ({ getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([{ identifier: 'focusup-wellbeing:access', content: { data: {} } }, { identifier: 'store-other', content: { data: { kind: 'unrelated' } } }]), cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../protection/nativeBridge', () => ({ protectionBridge: { reset: jest.fn().mockResolvedValue(undefined), clearBrowserData: jest.fn().mockResolvedValue(true) } }));
jest.mock('../../protection/controller', () => ({ resetProtectionController: jest.fn() }));
jest.mock('../../strict-mode/strictModeController', () => ({ reconcileStrictModeState: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../analytics/sessionTracker', () => ({ endSession: jest.fn().mockResolvedValue(undefined), resetSessionTracker: jest.fn() }));

it('clears FocusUp-owned storage and reminders while preserving unrelated data and store identity', async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('revenuecat-customer', 'store-owned');
  await AsyncStorage.setItem('unrelated-preferences', 'keep');
  await AsyncStorage.setItem('@focusup/local-analytics/events', '[]');
  await AsyncStorage.setItem('focusup-preferences-v1', '{}');
  const result = await clearFocusUpData();
  expect(result.browserDataCleared).toBe(true);
  expect(forgetAccountSession).toHaveBeenCalled();
  expect(protectionBridge.reset).toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@focusup/local-analytics/events')).toBeNull();
  expect(await AsyncStorage.getItem('@focusup/observability-consent')).toBe('denied');
  expect(await AsyncStorage.getItem('revenuecat-customer')).toBe('store-owned');
  expect(await AsyncStorage.getItem('unrelated-preferences')).toBe('keep');
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('focusup-wellbeing:access');
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('store-other');
});
