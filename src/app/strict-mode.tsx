import { Text } from '../components/Typography';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../components/Icon';
import { pluralForm } from '../utils/plural';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { ActionButton, BackButton, Card, HeroCard, Note, Screen, Sheet, SheetActions } from '../components/ui';
import { AppIcon } from '../components/AppIcon';
import { appCatalog } from '../features/apps/catalog';
import { useAppStore, supportedAppIds } from '../store/appStore';
import { useAppTheme } from '../theme';
import { useSubscription } from '../hooks/useSubscription';
import { useStrictMode } from '../hooks/useStrictMode';
import { canUseFeature } from '../services/subscription/subscriptionService';
import { endStrictModeEarly, startStrictMode } from '../services/strict-mode/strictModeController';
import type { SocialAppId } from '../types/app';
import { useWellbeingStore } from '../store/wellbeingStore';

const durations = [30, 60, 120] as const;
const durationLabel: Record<number, string> = { 30: 'thirtyMin', 60: 'oneHour', 120: 'twoHours', 240: 'fourHours' };
const pad = (n: number) => String(n).padStart(2, '0');

export default function StrictModeScreen() {
  const { t, i18n } = useTranslation();
  const c = useAppTheme();
  const isPro = useSubscription().isPro;
  const nativeApps = useWellbeingStore((state) => state.nativeApps);
  const availableApps = [...new Set([...supportedAppIds, ...nativeApps])];
  const { session, now, remainingMs, active } = useStrictMode();
  const [appsOpen, setAppsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('90');
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [selectedApps, setSelectedApps] = useState<SocialAppId[]>(() => supportedAppIds.filter((id) => useAppStore.getState().apps[id].enabled));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emergencyStartedAt, setEmergencyStartedAt] = useState<number | null>(null);
  const emergencyRemaining = emergencyStartedAt ? Math.max(0, 30 - Math.floor((now - emergencyStartedAt) / 1000)) : 0;
  const startsAtLabel = session?.endsAt ? new Date(session.endsAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) : '';
  const protectedApps = session ? (session.protectedPlatforms ?? session.appIds) : selectedApps;
  const durationText = useMemo(() => {
    const total = Math.floor(remainingMs / 1000);
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  }, [remainingMs]);

  const toggleApp = (id: SocialAppId) => {
    if (!availableApps.includes(id) || active) return;
    setSelectedApps((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const askStart = () => {
    if (!canUseFeature(isPro, 'strictMode')) { router.push({ pathname: '/pro', params: { source: 'strict_mode' } }); return; }
    if (!selectedApps.length) { Alert.alert(t('strict'), t('strictSelectOne')); return; }
    if (!Number.isInteger(selectedDuration) || selectedDuration < 1 || selectedDuration > 1440) { Alert.alert(t('strict'), t('wellbeing.invalid')); return; }
    if (Platform.OS === 'ios' && selectedDuration < 15 && selectedApps.some((id) => nativeApps.includes(id))) { Alert.alert(t('strict'), t('wellbeing.nativeMinimum')); return; }
    setConfirmOpen(true);
  };
  const confirmStart = () => {
    setConfirmOpen(false);
    void startStrictMode({ durationMinutes: selectedDuration, protectedPlatforms: selectedApps }).then(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }).catch(() => {
      Alert.alert(t('strict'), t('strictStartFailed'));
    });
  };
  const durationName = (minutes: number) => durationLabel[minutes] ? t(durationLabel[minutes]) : t('wellbeing.minutes', { count: minutes });
  const isCustom = !(durations as readonly number[]).includes(selectedDuration);
  const hourWords = t('ui.hourWords', { returnObjects: true }) as string[];
  const minuteWords = t('ui.minuteWords', { returnObjects: true }) as string[];
  const options = [
    { id: 30, num: '30', unit: pluralForm(i18n.language, 30, minuteWords) },
    { id: 60, num: '1', unit: pluralForm(i18n.language, 1, hourWords) },
    { id: 120, num: '2', unit: pluralForm(i18n.language, 2, hourWords) },
    { id: -1, num: isCustom ? String(selectedDuration) : t('ui.custom'), unit: isCustom ? pluralForm(i18n.language, selectedDuration, minuteWords) : t('ui.customUnit') },
  ];
  const beginEmergency = () => Alert.alert(t('strictEmergency'), t('strictEmergencyDescription'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('strictEmergencyWait'), onPress: () => setEmergencyStartedAt(Date.now()) },
  ]);
  const finishEmergency = () => Alert.alert(t('strictEmergency'), t('strictEmergencyConfirm'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('strictEmergency'), style: 'destructive', onPress: () => { setEmergencyStartedAt(null); void endStrictModeEarly(); } },
  ]);

  return (
    <Screen glow={c.isDark ? 420 : 380} contentStyle={{ gap: 0 }} footer={!active ? <ActionButton title={t('strictStart')} icon={<Icon name="lock" size={20} color="#FFFFFF" strokeWidth={2} />} onPress={askStart} disabled={!selectedApps.length} /> : undefined}>
      <View style={{ marginTop: 2 }}><BackButton label={t('back')} /></View>

      {active && session ? (
        <View style={{ marginTop: 20, gap: 14 }}>
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.12 }}>{t('strict')}</Text>
          <HeroCard style={{ gap: 12 }}>
            <Text style={{ color: c.onHero, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{t('ui.strictRemaining')}</Text>
            <Text accessibilityRole="timer" accessibilityLabel={t('strictCountdown', { time: durationText })} style={{ color: '#FFFFFF', fontSize: 48, lineHeight: 52, fontWeight: '800', letterSpacing: -1.2 }}>{durationText}</Text>
            <Text style={{ color: c.onHero, fontSize: 13, fontWeight: '600' }}>{t('strictEndsAt', { time: startsAtLabel })}</Text>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{t('strictProtectedApps')}</Text>
            {protectedApps.map((id) => (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AppIcon appId={id} size={26} />
                <Text style={{ color: '#FFFFFF', flex: 1, fontSize: 15, fontWeight: '700' }}>{appCatalog[id].name}</Text>
                <Icon name="check" size={18} color="#A8F7DC" strokeWidth={3} />
              </View>
            ))}
          </HeroCard>
          <Note tone="accent" icon="clock">{t('ui.strictLockNote')}</Note>
          {emergencyStartedAt ? (
            <Card style={{ gap: 10 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{t('strictEmergencyWait')}</Text>
              <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{t('strictEmergencyCountdown', { seconds: emergencyRemaining })}</Text>
              {emergencyRemaining === 0 ? <ActionButton title={t('strictEmergency')} variant="destructive" onPress={finishEmergency} /> : null}
            </Card>
          ) : (
            <Pressable accessibilityRole="button" onPress={beginEmergency} style={{ alignSelf: 'center', padding: 10 }}>
              <Text style={{ color: c.text2, fontSize: 13, fontWeight: '600' }}>{t('strictEmergency')}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <View style={{ width: 112, height: 112 }}>
              <View pointerEvents="none" style={{ position: 'absolute', left: c.isDark ? -34 : -18, top: c.isDark ? -34 : -18, width: c.isDark ? 180 : 148, height: c.isDark ? 180 : 148, borderRadius: 90, backgroundImage: c.lockHalo }} />
              <View style={{ width: 112, height: 112, borderRadius: 36, backgroundImage: c.grad, boxShadow: c.glow, alignItems: 'center', justifyContent: 'center' }}><Icon name="lockDot" size={52} color="#FFFFFF" strokeWidth={1.8} /></View>
            </View>
          </View>
          <Text accessibilityRole="header" style={{ marginTop: 26, textAlign: 'center', color: c.text, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.12 }}>{t('strict')}</Text>
          <Text style={{ marginTop: 10, marginHorizontal: 20, textAlign: 'center', color: c.text2, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>{t('ui.strictBody')}</Text>

          <View accessibilityRole="radiogroup" style={{ marginTop: 44, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {options.map((option) => {
              const selected = option.id === -1 ? isCustom : selectedDuration === option.id;
              return <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.num} ${option.unit}`}
                onPress={() => { void Haptics.selectionAsync(); if (option.id === -1) setCustomOpen(true); else setSelectedDuration(option.id); }}
                style={({ pressed }) => ({ width: '47%', flexGrow: 1, height: 92, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: selected ? undefined : c.card, backgroundImage: selected ? c.grad : undefined, boxShadow: selected ? c.glow : c.sh, opacity: pressed ? 0.85 : 1 })}
              >
                <Text style={{ color: selected ? '#FFFFFF' : c.text, fontSize: option.id === -1 && !isCustom ? 22 : 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.9 }}>{option.num}</Text>
                <Text style={{ color: selected ? '#FFFFFF' : c.text, opacity: 0.85, fontSize: 14, lineHeight: 18, fontWeight: '700' }}>{option.unit}</Text>
              </Pressable>;
            })}
          </View>

          <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: c.soft, boxShadow: c.ringSoft || undefined }}>
            <Icon name="clock" size={22} color={c.ink} />
            <Text style={{ flex: 1, color: c.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' }}>{t('ui.strictLockNote')}</Text>
          </View>

          {nativeApps.length > 0 ? <View style={{ marginTop: 12, gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: appsOpen }} onPress={() => setAppsOpen(!appsOpen)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, borderRadius: 22, backgroundColor: c.card, boxShadow: c.sh }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>{selectedApps.map((id) => <AppIcon key={id} appId={id} size={26} />)}</View>
              <Text style={{ flex: 1, color: c.text2, fontSize: 13, fontWeight: '600' }}>{t('strictProtectedApps')}</Text>
              <View style={{ transform: [{ rotate: appsOpen ? '-90deg' : '90deg' }] }}><Icon name="chevron" size={18} color={c.text3} strokeWidth={2.2} /></View>
            </Pressable>
            {appsOpen ? <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
              {availableApps.map((id, index) => {
                const selected = selectedApps.includes(id);
                return <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleApp(id)} style={{ minHeight: index === 0 ? 52 : 53, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.line }}>
                  <AppIcon appId={id} size={36} />
                  <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '700' }}>{appCatalog[id].name}</Text>
                  <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: selected ? c.accent : c.off, backgroundColor: selected ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{selected ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3.4} /> : null}</View>
                </Pressable>;
              })}
            </View> : null}
          </View> : null}
        </>
      )}

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('ui.strictConfirmTitle')} message={t('ui.strictConfirmBody', { duration: durationName(selectedDuration) })}>
        <SheetActions cancel={t('ui.strictCancel')} confirm={t('ui.strictConfirm')} onCancel={() => setConfirmOpen(false)} onConfirm={confirmStart} />
      </Sheet>

      <Sheet visible={customOpen} onClose={() => setCustomOpen(false)} title={t('custom')} message={t('durationRange')}>
        <TextInput accessibilityLabel={t('custom')} autoFocus keyboardType="number-pad" value={customMinutes} onChangeText={setCustomMinutes} maxLength={4} style={{ color: c.text, backgroundColor: c.card2, borderRadius: 16, height: 52, paddingHorizontal: 16, fontSize: 20, fontFamily: 'Manrope-700' }} />
        <SheetActions cancel={t('ui.strictCancel')} confirm={t('save')} onCancel={() => setCustomOpen(false)} onConfirm={() => { const value = Number(customMinutes); if (Number.isInteger(value) && value >= 1 && value <= 1440) { setSelectedDuration(value); setCustomOpen(false); } else Alert.alert(t('custom'), t('durationRange')); }} />
      </Sheet>
    </Screen>
  );
}
