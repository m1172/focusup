import { PRO_ENABLED } from '../../config/release';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus, SchedulableTriggerInputTypes } from 'expo-notifications';
import i18n from '../../i18n';
import { captureProductEvent } from '../analytics/productAnalytics';

const STRICT_END_KIND = 'strict-mode-end';
let channelReady: Promise<void> | null = null;
let scheduledEndAt: number | null = null;

let foregroundFilter: ((notification: Notifications.Notification) => boolean) | null = null;
/** Lets a screen that already shows a notification's content keep it out of the banner. */
export function setForegroundNotificationFilter(filter: typeof foregroundFilter): void { foregroundFilter = filter; }

export function initializeNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const show = !foregroundFilter?.(notification);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
    },
  });
}

/** Android shows nothing (and issues no push token) until a channel exists; pushes name this one. */
export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android' && !channelReady) {
    channelReady = Notifications.setNotificationChannelAsync('default', { name: 'FocusUp', importance: AndroidImportance.DEFAULT, vibrationPattern: [0, 180, 100, 180], lightColor: '#6C47FF' }).then(() => undefined, (error) => { channelReady = null; throw error; });
  }
  await channelReady;
}

export async function requestNotificationPermission(): Promise<boolean> {
  let requested = false;
  try {
    await ensureNotificationChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== IosAuthorizationStatus.PROVISIONAL) {
      requested = true;
      captureProductEvent('notification_permission_requested');
      permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } });
    }
    const granted = permission.granted || permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    captureProductEvent('notification_permission_result', { requested, granted, status: permission.status });
    return granted;
  } catch { captureProductEvent('notification_permission_result', { requested, granted: false, status: 'error' }); return false; }
}

export async function scheduleStrictModeCompletion(endsAt: number): Promise<void> {
  if (!PRO_ENABLED) { await cancelStrictModeCompletion(); return; }
  try {
    if (scheduledEndAt === endsAt) return;
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== IosAuthorizationStatus.PROVISIONAL) return;
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    const existing = requests.find((item) => item.content.data?.kind === STRICT_END_KIND && item.content.data?.endsAt === endsAt);
    if (existing) { scheduledEndAt = endsAt; return; }
    await cancelStrictModeCompletion();
    const seconds = Math.floor((endsAt - Date.now()) / 1000);
    if (seconds < 1) return;
    await Notifications.scheduleNotificationAsync({
      content: { title: i18n.t('strictNotificationTitle'), body: i18n.t('strictNotificationBody'), data: { kind: STRICT_END_KIND, endsAt, route: '/strict-mode' } },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(endsAt), channelId: 'default' },
    });
    scheduledEndAt = endsAt;
  } catch { /* Notification failure must never interrupt a protection session. */ }
}

export async function cancelStrictModeCompletion(): Promise<void> {
  try {
    scheduledEndAt = null;
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(requests.filter((item) => item.content.data?.kind === STRICT_END_KIND).map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  } catch { /* Notifications are optional; the timestamp remains authoritative. */ }
}
