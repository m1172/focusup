import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../../i18n';
import { useFamilyStore } from '../../store/familyStore';

/**
 * Google Play's monitoring-app rules: while a phone is supervised, Android shows a notification that
 * stays until supervision ends, so the child always knows. iOS shows Apple's own Screen Time notice.
 */
const ID = 'family-supervision';
const CHANNEL = 'family-supervision';

export async function showSupervisionNotice(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: i18n.t('family.child.noticeChannel'), importance: AndroidImportance.LOW, showBadge: false });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title: i18n.t('family.child.noticeTitleOn'), body: i18n.t('family.child.noticeBodyOn'), sticky: true, autoDismiss: false, data: { kind: 'family-supervision', route: '/family/supervised' } },
      trigger: { channelId: CHANNEL },
    });
  } catch { /* The supervised screen shows the same disclosure. */ }
}

export async function hideSupervisionNotice(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try { await Notifications.dismissNotificationAsync(ID); } catch { /* Already gone. */ }
}

/** Keeps the notice in step with the phone's role. Returns a cleanup function. */
export function startSupervisionNotice(): () => void {
  const sync = (role: string) => { void (role === 'child' ? showSupervisionNotice() : hideSupervisionNotice()); };
  const unsubscribe = useFamilyStore.subscribe((state, previous) => { if (state.role !== previous.role) sync(state.role); });
  const hydration = useFamilyStore.persist.onFinishHydration((state) => sync(state.role));
  if (useFamilyStore.persist.hasHydrated()) sync(useFamilyStore.getState().role);
  return () => { unsubscribe(); hydration(); };
}
