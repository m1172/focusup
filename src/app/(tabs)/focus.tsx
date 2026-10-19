import { Text } from '../../components/Typography';
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ActionButton, Card, Heading, Screen, SettingRow } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { protectionBridge } from '../../services/protection/nativeBridge';
import { endTemporaryAccess, reconcileProtection } from '../../services/protection/controller';
import { appCatalog } from '../../features/apps/catalog';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';

export default function FocusScreen() {
  const { t } = useTranslation(); const c = useAppTheme();
  const temporary = useWellbeingStore((state) => state.temporary);
  const [now, setNow] = useState(() => Date.now());
  const authorized = useProtectionStatusStore((state) => state.status.supported && state.status.authorized);
  useFocusEffect(useCallback(() => { void protectionBridge.getStatus().then(useProtectionStatusStore.getState().setStatus); void reconcileProtection().catch(() => undefined); }, []));
  useEffect(() => { if (!temporary) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [temporary]);
  const remaining = Math.max(0, Math.ceil(((temporary?.endsAt ?? now) - now) / 1000));
  return <Screen><Heading title={t('wellbeing.focus')} subtitle={t('wellbeing.subtitle')} /><Card gradient><Ionicons name="leaf-outline" size={28} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '800', lineHeight: 32 }}>{t('wellbeing.title')}</Text><Text style={{ color: '#EFEAFF', lineHeight: 20 }}>{t(authorized ? 'wellbeing.nativeVerified' : 'wellbeing.nativeHint')}</Text><ActionButton secondary title={t('wellbeing.setup')} onPress={() => router.push('/protection')} /></Card>
    {temporary && remaining > 0 ? <Card><Heading title={appCatalog[temporary.platform].name} subtitle={t('wellbeing.temporary')} /><Text accessibilityRole="timer" style={{ color: c.primary, fontSize: 36, fontWeight: '800' }}>{t('wellbeing.accessRemaining', { time: `${Math.floor(remaining / 60)}`.padStart(2, '0') + ':' + `${remaining % 60}`.padStart(2, '0') })}</Text><ActionButton secondary title={t('wellbeing.endAccess')} onPress={() => { void endTemporaryAccess().catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed'))); }} /></Card> : null}
    <Card style={{ paddingVertical: 4 }}>{[{ title: 'wellbeing.nativeTitle', route: '/protection' as const, icon: 'shield-checkmark-outline' as const }, { title: 'schedules', route: '/schedule' as const, icon: 'calendar-outline' as const }, { title: 'wellbeing.sleep', route: '/sleep' as const, icon: 'moon-outline' as const }, { title: 'strict', route: '/strict-mode' as const, icon: 'lock-closed-outline' as const }].map((item, index) => <SettingRow key={item.route} title={t(item.title)} onPress={() => router.push(item.route)} right={<View style={{ flexDirection: 'row', gap: 10 }}><Ionicons name={item.icon} color={c.primary} size={23} /><Ionicons name="chevron-forward" size={18} color={c.faint} /></View>} last={index === 3} />)}</Card><ActionButton secondary title={t('wellbeing.capabilities')} onPress={() => router.push('/capabilities')} /></Screen>;
}
