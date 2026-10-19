import { Text } from '../components/Typography';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton, ActionButton, Card, Heading, Screen, SettingRow, Toggle } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { appCatalog } from '../features/apps/catalog';
import { ALL_PLATFORMS, protectionReason } from '../services/protection/engine';
import { protectionBridge } from '../services/protection/nativeBridge';
import { reconcileProtection, resetProtectionController, startTemporaryAccess } from '../services/protection/controller';
import { useProtectionStatusStore } from '../store/protectionStatusStore';
import { useWellbeingStore } from '../store/wellbeingStore';
import { useAppStore } from '../store/appStore';
import { useSubscription } from '../hooks/useSubscription';
import { useAppTheme } from '../theme';
import type { SocialAppId } from '../types/app';
import { isPlatformLocked } from '../services/strict-mode/strictModeController';
import { canUseFeature } from '../services/subscription/subscriptionService';

export default function ProtectionScreen() {
  const { appId } = useLocalSearchParams<{ appId?: string }>();
  const { t } = useTranslation(), c = useAppTheme(); const isPro = useSubscription().isPro;
  const wellbeing = useWellbeingStore(), app = useAppStore();
  const status = useProtectionStatusStore((state) => state.status);
  const [busy, setBusy] = useState(false), [selected, setSelected] = useState<SocialAppId>(() => ALL_PLATFORMS.includes(appId as SocialAppId) ? appId as SocialAppId : 'instagram'), [minutes, setMinutes] = useState(Platform.OS === 'ios' ? '15' : '5');
  const refresh = useCallback(() => { void protectionBridge.getStatus().then(useProtectionStatusStore.getState().setStatus); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const fail = () => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed'));
  const authorize = () => Alert.alert(t('wellbeing.disclosureTitle'), t(Platform.OS === 'ios' ? 'wellbeing.disclosureIOS' : 'wellbeing.disclosureAndroid'), [{ text: t('cancel'), style: 'cancel' }, { text: t('wellbeing.authorize'), onPress: () => { void protectionBridge.requestAuthorization().then(refresh).catch(fail); } }]);
  const toggle = async (platform: SocialAppId, enabled: boolean) => {
    if (!canUseFeature(isPro, 'nativeProtection')) { router.push('/pro'); return; }
    if (isPlatformLocked(platform)) { Alert.alert(t('strictActive'), t('strictCannotChange')); return; }
    setBusy(true);
    try {
      if (enabled && (!status.supported || !status.authorized)) { Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.nativeDisabled')); return; }
      if (enabled && await protectionBridge.selectApps(platform) === 0) { Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.selectProtectedApp')); return; }
      const previous = wellbeing.nativeApps;
      wellbeing.setNativeApps(enabled ? [...previous, platform] : previous.filter((id) => id !== platform));
      try { resetProtectionController(); await reconcileProtection(enabled); } catch { wellbeing.setNativeApps(previous); throw new Error('failed'); }
      refresh();
    } catch { fail(); } finally { setBusy(false); }
  };
  if (!canUseFeature(isPro, 'nativeProtection')) return <Screen><BackButton label={t('back')} /><Heading title={t('wellbeing.nativeTitle')} subtitle={t('wellbeing.chooseNativeHint')} /><Card><Text style={{ color: c.text, lineHeight: 22 }}>{t('wellbeing.proRequired')}</Text><ActionButton title={t('subscription.viewPro')} onPress={() => router.push('/pro')} /><ActionButton secondary title={t('wellbeing.capabilities')} onPress={() => router.push('/capabilities')} /></Card></Screen>;
  return <Screen><BackButton label={t('back')} /><Heading title={t('wellbeing.nativeTitle')} subtitle={t('wellbeing.chooseNativeHint')} />
    <Card><Text style={{ color: c.text, lineHeight: 21 }}>{t(!status.supported ? 'wellbeing.nativeUnavailable' : status.authorized ? 'wellbeing.nativeVerified' : 'wellbeing.permission')}</Text>{status.supported && !status.authorized ? <ActionButton title={t('wellbeing.setup')} onPress={authorize} /> : null}</Card>
    <Card style={{ paddingVertical: 5 }}>{ALL_PLATFORMS.map((id, index) => { const reason = protectionReason(id, { baseline: wellbeing.nativeApps, routines: app.schedules, sleep: wellbeing.sleep, strict: app.strictSession, temporary: wellbeing.temporary, isPro }); return <SettingRow key={id} title={appCatalog[id].name} subtitle={t(!status.authorized ? 'wellbeing.nativeDisabled' : reason === 'temporary' ? 'wellbeing.temporary' : status.protectedPlatforms?.includes(id) ? `wellbeing.${reason}` : 'wellbeing.unprotected')} right={<Toggle label={appCatalog[id].name} value={wellbeing.nativeApps.includes(id)} disabled={busy} onChange={(value) => { void toggle(id, value); }} />} last={index === ALL_PLATFORMS.length - 1} />; })}</Card>
    <Card><Heading size="card" title={t('wellbeing.access')} subtitle={t('wellbeing.accessDescription')} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{wellbeing.nativeApps.map((id) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected === id }} onPress={() => setSelected(id)} style={{ padding: 8, borderWidth: 1, borderRadius: 12, borderColor: selected === id ? c.primary : c.border }}><AppIcon appId={id} size={30} /></Pressable>)}</View><View style={{ flexDirection: 'row', gap: 8 }}>{(Platform.OS === 'ios' ? [15, 30] : [5, 10]).map((value) => <ActionButton key={value} secondary title={t('wellbeing.minutes', { count: value })} onPress={() => setMinutes(String(value))} style={{ flex: 1 }} />)}</View><TextInput accessibilityLabel={t('wellbeing.custom')} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" maxLength={3} style={{ color: c.text, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12 }} />{Platform.OS === 'ios' ? <Text style={{ color: c.muted, fontSize: 12 }}>{t('wellbeing.nativeMinimum')}</Text> : null}<ActionButton title={t('wellbeing.access')} disabled={busy || !status.authorized || !wellbeing.nativeApps.includes(selected) || isPlatformLocked(selected)} onPress={() => { setBusy(true); void startTemporaryAccess(selected, Number(minutes)).then(() => router.replace('/(tabs)/focus')).catch(fail).finally(() => setBusy(false)); }} /></Card>
    {Platform.OS === 'ios' ? <Card><ActionButton secondary disabled={!status.supported || !status.authorized || busy || wellbeing.nativeApps.some((id) => isPlatformLocked(id))} title={t('wellbeing.allowedApps')} onPress={() => { void protectionBridge.selectApps('__allowed').then(() => { resetProtectionController(); return reconcileProtection(); }).catch(fail); }} /><Text style={{ color: c.muted, fontSize: 12 }}>{t('wellbeing.systemAllowedHint')}</Text><SettingRow title={t('wellbeing.liveActivity')} subtitle={t('wellbeing.liveActivityHint')} right={<Toggle label={t('wellbeing.liveActivity')} value={wellbeing.liveActivity} disabled={!status.supported} onChange={wellbeing.setLiveActivity} />} /></Card> : null}
    <ActionButton secondary title={t('back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/focus')} />
  </Screen>;
}
