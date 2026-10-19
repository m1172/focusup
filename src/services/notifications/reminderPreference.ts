import { Alert } from 'react-native';
import i18n from '../../i18n';
import { useAppStore } from '../../store/appStore';
import { requestNotificationPermission } from './notificationService';

export async function requestWellbeingReminders(): Promise<boolean> {
  const accepted = useAppStore.getState().completionNotifications || await new Promise<boolean>((resolve) => Alert.alert(i18n.t('wellbeing.notificationPermissionTitle'), i18n.t('wellbeing.notificationPermissionBody'), [{ text: i18n.t('cancel'), style: 'cancel', onPress: () => resolve(false) }, { text: i18n.t('continue'), onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
  if (!accepted) return false;
  const granted = await requestNotificationPermission();
  if (granted) useAppStore.getState().setCompletionNotifications(true);
  return granted;
}
