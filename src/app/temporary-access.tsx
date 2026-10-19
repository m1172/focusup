import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { ActionButton, Heading, RadioOptionCard, Screen } from '../components/ui';
import { useAppTheme } from '../theme';
import { useWellbeingStore } from '../store/wellbeingStore';
import { useAppStore } from '../store/appStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { startTemporaryAccess } from '../services/protection/controller';
import { isPlatformLocked } from '../services/strict-mode/strictModeController';
import { appCatalog } from '../features/apps/catalog';
import type { SocialAppId } from '../types/app';

export default function TemporaryAccessScreen() {
  const { appId: raw } = useLocalSearchParams<{ appId?: string }>();
  const nativeApps = useWellbeingStore((s) => s.nativeApps);
  const appId = (raw && Object.hasOwn(appCatalog, raw) ? raw : nativeApps[0] ?? 'instagram') as SocialAppId;
  const c = useAppTheme(); const { t } = useTranslation();
  const strict = useAppStore((s) => s.strictSession);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const [minutes, setMinutes] = useState(Platform.OS === 'ios' ? 15 : 5);
  const [busy, setBusy] = useState(false);
  const locked = isPlatformLocked(appId, strict);
  const allow = async () => {
    if (locked || busy) return;
    if (!isPro) { router.back(); router.push('/pro'); return; }
    if (!nativeApps.includes(appId)) { Alert.alert(t('design.temporaryTitle'), t('wellbeing.selectProtectedApp'), [{ text: t('cancel'), style: 'cancel' }, { text: t('wellbeing.setup'), onPress: () => { router.back(); router.push('/protection'); } }]); return; }
    setBusy(true);
    try { await startTemporaryAccess(appId, minutes); router.back(); }
    catch (error) { const reason = error instanceof Error ? error.message : 'failed'; Alert.alert(t('design.temporaryTitle'), t(reason === 'strictActive' ? 'strictCannotChange' : `wellbeing.${['nativeUnavailable', 'selectProtectedApp'].includes(reason) ? reason : 'failed'}`)); }
    finally { setBusy(false); }
  };
  return <Screen contentStyle={{ gap: 18, paddingTop: 16 }}>
    <View style={{ width: 48, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: c.faint + '66', marginBottom: 8 }} />
    <Heading title={t('design.temporaryTitle')} subtitle={t('design.temporaryBody')} />
    <View style={{ gap: 10 }}>{[5, 10, 15].map((duration) => <RadioOptionCard key={duration} selected={minutes === duration} title={t('wellbeing.minutes', { count: duration })} disabled={busy || (Platform.OS === 'ios' && duration < 15)} onPress={() => setMinutes(duration)} />)}</View>
    {Platform.OS === 'ios' ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('wellbeing.nativeMinimum')}</Text> : null}
    {locked ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('strictCannotChange')}</Text> : null}
    <ActionButton title={t('design.allow')} disabled={busy || locked} onPress={() => { void allow(); }} /><ActionButton ghost title={t('cancel')} disabled={busy} onPress={() => router.back()} />
  </Screen>;
}
