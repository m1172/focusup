import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { AppIcon } from '../components/AppIcon';
import { ActionButton, Heading, Screen } from '../components/ui';
import { useAppTheme } from '../theme';
import { useWellbeingStore } from '../store/wellbeingStore';
import { useAppStore } from '../store/appStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { startTemporaryAccess } from '../services/protection/controller';
import { BREAK_MINUTES, breaksLeft, shortVideoBlockedApps } from '../services/protection/engine';
import { appCatalog } from '../features/apps/catalog';
import type { SocialAppId } from '../types/app';

/** A short break from blocking for one app. In Hard Mode, two a day. */
export default function TemporaryAccessScreen() {
  const { appId: raw } = useLocalSearchParams<{ appId?: string }>();
  const c = useAppTheme(); const { t } = useTranslation();
  const nativeApps = useWellbeingStore((s) => s.nativeApps);
  const breaks = useWellbeingStore((s) => s.breaks);
  const apps = useAppStore((s) => s.apps);
  const strict = useAppStore((s) => s.strictSession);
  const isPro = useSubscriptionStore((s) => s.isPro);
  const [openedAt] = useState(() => Date.now());
  const hardModeApps = strict && strict.endsAt > openedAt ? (strict.protectedPlatforms ?? strict.appIds) : [];
  // Any app Vaqtim blocks can take a break: the short-video apps, extra protected apps and Hard Mode's apps.
  const choices = [...new Set<SocialAppId>([...shortVideoBlockedApps(apps), ...nativeApps, ...hardModeApps])];
  const [appId, setAppId] = useState<SocialAppId>(() => raw && choices.includes(raw as SocialAppId) ? raw as SocialAppId : choices[0] ?? 'instagram');
  const [minutes, setMinutes] = useState<number>(BREAK_MINUTES[0]);
  const [busy, setBusy] = useState(false);
  const inHardMode = hardModeApps.includes(appId);
  const left = breaksLeft(breaks, new Date(openedAt));
  const blocked = inHardMode && left === 0;

  const allow = async () => {
    if (busy || blocked) return;
    if (!isPro) { router.back(); router.push('/pro'); return; }
    setBusy(true);
    try { await startTemporaryAccess(appId, minutes); router.back(); }
    catch (error) {
      const reason = error instanceof Error ? error.message : 'failed';
      const message = reason === 'noBreaksLeft' ? 'ui.noBreaksLeft' : reason === 'strictActive' ? 'strictCannotChange' : `wellbeing.${['nativeUnavailable', 'selectProtectedApp'].includes(reason) ? reason : 'failed'}`;
      Alert.alert(t('ui.takeBreak'), t(message));
    } finally { setBusy(false); }
  };

  return <Screen contentStyle={{ gap: 18, paddingTop: 16 }}>
    <View style={{ width: 48, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: c.faint + '66', marginBottom: 8 }} />
    <Heading title={t('ui.takeBreak')} subtitle={t('ui.breakBody')} />
    {choices.length > 1 ? <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
      {choices.map((id) => {
        const selected = id === appId;
        return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={appCatalog[id].name} onPress={() => setAppId(id)}
          style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 20, backgroundColor: selected ? c.soft : c.card, borderWidth: 2, borderColor: selected ? c.accent : 'transparent' }}>
          <AppIcon appId={id} size={32} />
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>{appCatalog[id].name}</Text>
        </Pressable>;
      })}
    </View> : null}
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
      {BREAK_MINUTES.map((duration) => {
        const selected = minutes === duration;
        const label = t('wellbeing.minutes', { count: duration });
        return <Pressable key={duration} accessibilityRole="radio" accessibilityState={{ selected, disabled: busy }} accessibilityLabel={label} disabled={busy} onPress={() => setMinutes(duration)}
          style={{ flex: 1, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? undefined : c.card, backgroundImage: selected ? c.grad : undefined, boxShadow: selected ? c.glow : c.sh }}>
          <Text style={{ color: selected ? '#FFFFFF' : c.text, fontSize: 16, fontWeight: '800' }}>{label}</Text>
        </Pressable>;
      })}
    </View>
    {inHardMode ? <Text style={{ color: blocked ? c.red : c.muted, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{left > 0 ? t('ui.breaksLeft', { count: left }) : t('ui.noBreaksLeft')}</Text> : null}
    <ActionButton title={t('design.allow')} disabled={busy || blocked || choices.length === 0} onPress={() => { void allow(); }} />
    <ActionButton ghost title={t('cancel')} disabled={busy} onPress={() => router.back()} />
  </Screen>;
}
