import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import { ensureNotificationChannel, requestNotificationPermission } from './notificationService';

/** What the server pushes when the team answers in the support chat (see backend/src/edge.ts). */
export const SUPPORT_REPLY_KIND = 'support-reply';
const STORAGE_KEY = 'focusup-support-push-v1';

type PushApi = {
  saveSupportPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  removeSupportPushToken(token: string): Promise<void>;
};
/** `asked`: the support chat already showed the permission prompt on this device. */
type Saved = { asked?: boolean; registered?: { userId: string; token: string } };

export function isSupportReply(notification: Notifications.Notification | null | undefined): boolean {
  return notification?.request.content.data?.kind === SUPPORT_REPLY_KIND;
}

async function read(): Promise<Saved> {
  try {
    const value: unknown = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}');
    return value && typeof value === 'object' ? value as Saved : {};
  } catch { return {}; }
}
const write = (value: Saved) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value)).catch(() => undefined);

/**
 * Sends this device's Expo push token to the server so team replies can notify the user.
 * Without `ask` it never prompts: it registers only when notifications are already allowed.
 * With `ask` it prompts once per device (the support chat calls it when the user writes).
 * Never throws; resolves to whether the device is registered for `userId`.
 */
export async function registerSupportPush(api: PushApi, userId: string, ask = false): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    const saved = await read();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== IosAuthorizationStatus.PROVISIONAL) {
      if (!ask || saved.asked || !permission.canAskAgain) return false;
      await write({ ...saved, asked: true });
      saved.asked = true;
      if (!(await requestNotificationPermission())) return false;
    }
    await ensureNotificationChannel();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (saved.registered?.userId === userId && saved.registered.token === token) return true;
    await api.saveSupportPushToken(token, Platform.OS);
    await write({ ...saved, registered: { userId, token } });
    return true;
  } catch {
    // Offline, Expo Go on Android, or no push credentials: the chat still works by polling.
    return false;
  }
}

/** Stops replies for the signed-out account reaching this device. Bounded so sign-out never waits on the network. */
export async function unregisterSupportPush(api: PushApi | null): Promise<void> {
  const saved = await read();
  if (!saved.registered) return;
  await write({ asked: saved.asked });
  if (!api) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([api.removeSupportPushToken(saved.registered.token).catch(() => undefined), new Promise((resolve) => { timer = setTimeout(resolve, 3000); })]);
  clearTimeout(timer);
}
