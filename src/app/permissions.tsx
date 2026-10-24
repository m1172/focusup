import { PRO_ENABLED } from '../config/release';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { BackButton, Card, Heading, Pill, Screen, SettingRow, Toggle } from '../components/ui';
import { useAppTheme } from '../theme';
import { useAppStore } from '../store/appStore';
import { useProtectionStatusStore } from '../store/protectionStatusStore';
import { protectionBridge } from '../services/protection/nativeBridge';
import { requestNotificationPermission } from '../services/notifications/notificationService';

export default function PermissionsScreen() {
  const c = useAppTheme(); const { t } = useTranslation();
  const status = useProtectionStatusStore((s) => s.status);
  const notices = useAppStore((s) => s.completionNotifications);
  const [granted, setGranted] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void protectionBridge.getStatus().then((next) => { if (active) useProtectionStatusStore.getState().setStatus(next); }).catch(() => undefined);
    void Notifications.getPermissionsAsync().then((permission) => { if (active) setGranted(permission.granted); }).catch(() => undefined);
    return () => { active = false; };
  }, []));
  const authorize = () => {
    if (status.authorized) { if (PRO_ENABLED) router.push('/protection'); return; }
    if (!status.supported) { router.push('/capabilities'); return; }
    Alert.alert(t('wellbeing.disclosureTitle'), t(Platform.OS === 'ios' ? 'wellbeing.disclosureIOS' : 'wellbeing.disclosureAndroid'), [{ text: t('cancel'), style: 'cancel' }, { text: t('wellbeing.authorize'), onPress: () => { void protectionBridge.requestAuthorization().then(() => protectionBridge.getStatus()).then(useProtectionStatusStore.getState().setStatus).catch(() => Alert.alert(t('design.permissions'), t('wellbeing.failed'))); } }]);
  };
  return <Screen contentStyle={{ gap: 18 }}><BackButton label={t('back')} /><Heading title={t('design.permissions')} />
    <View style={{ alignItems: 'center', paddingVertical: 12, gap: 12 }}><View style={{ width: 96, height: 96, borderRadius: 32, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}><Ionicons name="shield-checkmark-outline" size={52} color={c.primary} /></View><Text style={{ color: c.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{t(status.supported && status.authorized ? 'design.permissionReady' : 'design.permissions')}</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 300 }}>{t(status.supported ? 'design.permissionBody' : 'cloudAuth.freePermissions')}</Text></View>
    <Card style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
      {/* Blocking the original Instagram/YouTube apps needs this permission in every release. */}
      {status.supported ? <SettingRow icon={<Ionicons name="shield-checkmark-outline" size={23} color={c.primary} />} title={t('wellbeing.nativeTitle')} subtitle={t(status.authorized ? 'active' : 'wellbeing.permission')} onPress={authorize} right={<Pill label={t(status.authorized ? 'active' : 'wellbeing.setup')} active={status.authorized} />} /> : null}
      {PRO_ENABLED ? <><SettingRow icon={<Ionicons name="notifications-outline" size={23} color={c.primary} />} title={t('wellbeing.notifications')} subtitle={t('strictNotifications')} right={<Toggle label={t('wellbeing.notifications')} value={granted && notices} onChange={(enabled) => {
        if (!enabled) { useAppStore.getState().setCompletionNotifications(false); return; }
        void requestNotificationPermission().then((allowed) => { setGranted(allowed); if (allowed) useAppStore.getState().setCompletionNotifications(true); else Alert.alert(t('strictNotificationUnavailable'), t('strictNotificationUnavailableDescription'), [{ text: t('cancel'), style: 'cancel' }, { text: t('openSettings'), onPress: () => { void Linking.openSettings(); } }]); });
      }} />} />
      </> : null}
      <SettingRow icon={<Ionicons name="bar-chart-outline" size={23} color={c.primary} />} title={t('stats')} subtitle={t('cleanModeActivity')} right={<Pill label={t('active')} active />} last />
    </Card>
    <View style={{ borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12, backgroundColor: c.primarySoft }}><Ionicons name="lock-closed-outline" size={24} color={c.primary} /><View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>{t('design.privacyFirst')}</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('design.privacyDetail')}</Text></View></View>
  </Screen>;
}
