import { PRO_ENABLED } from '../../config/release';
import { getDailyActivityTimeline } from '../../services/analytics/activityTimeline';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon, type IconName } from '../../components/Icon';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, CircleButton, Screen, SectionTitle, StatusDot } from '../../components/ui';
import { HeroBars, HeroCard, HeroDuration, HeroTrend } from '../../components/HeroStat';
import { AVAILABLE_APPS, appCatalog } from '../../features/apps/catalog';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { getLocalAnalytics } from '../../services/analytics/localAnalytics';
import { getDailyStatistics, getWeeklyStatistics, getPreviousPeriodStatistics, getSafeComparisonPercent, getActiveDayCount } from '../../services/analytics/statisticsCalculator';
import { useStatisticsStore } from '../../store/statisticsStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { getEffectiveAppConfig } from '../../services/blockers/effective';
import { useOnboardingStore } from '../../store/onboardingStore';
import { appDailySavings, savedSoFar, usualMinutes, type SavingsAppId, type UsualMinutes } from '../../features/savings/savings';
import { formatDuration } from '../../utils/formatDuration';

const apps = AVAILABLE_APPS;
const slots = [6, 9, 12, 15, 18, 21];
const featureName: Record<SavingsAppId, string> = { instagram: 'Reels', youtube: 'Shorts' };

type TodayStats = { usedMs: number; perApp: Partial<Record<SavingsAppId, { usedMs: number; blocked: number }>> };

/** One card per app: tap to open it, the slider button for its filters, and what it saved today. */
function AppCard({ appId, today, usual }: { appId: SavingsAppId; today: TodayStats; usual: UsualMinutes }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const effective = getEffectiveAppConfig(appId);
  const active = appCatalog[appId].supported && effective.enabled;
  const perDay = appDailySavings(appId, effective, usual);
  const stats = today.perApp[appId];
  const open = () => router.push({ pathname: '/browser/[appId]', params: { appId } });
  const chip = (icon: IconName, text: string, tone: 'neutral' | 'mint' | 'amber' = 'neutral') => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: tone === 'mint' ? c.mintSoft : tone === 'amber' ? c.amberSoft : c.card2 }}>
    <Icon name={icon} size={14} color={tone === 'mint' ? c.mintInk : tone === 'amber' ? c.amber : c.text2} strokeWidth={2.2} />
    <Text numberOfLines={1} style={{ color: tone === 'mint' ? c.mintInk : tone === 'amber' ? c.amber : c.text2, fontSize: 13, fontWeight: '700' }}>{text}</Text>
  </View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t('savings.open')} ${appCatalog[appId].name}`} onPress={open} style={({ pressed }) => ({ gap: 14, padding: 16, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <AppIcon appId={appId} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.36 }}>{appCatalog[appId].name}</Text>
        <StatusDot on={active} label={t(active ? 'cleaned' : 'off')} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${appCatalog[appId].name} — ${t('savings.filters')}`} hitSlop={6} onPress={() => router.push({ pathname: '/app-settings/[appId]', params: { appId } })} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft, opacity: pressed ? 0.7 : 1 })}>
        <Icon name="sliders" size={20} color={c.ink} strokeWidth={2.1} />
      </Pressable>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {perDay > 0 ? chip('sparkles', t('savings.savesPerDay', { time: formatDuration(Math.round(perDay), locale) }), 'mint') : chip('info', t('savings.notSaving', { feature: featureName[appId] }), 'amber')}
      {chip('clock', t('savings.today', { time: formatDuration(Math.round((stats?.usedMs ?? 0) / 60_000), locale) }))}
      {stats?.blocked ? chip('shieldCheck', t('savings.blocked', { count: stats.blocked })) : null}
    </View>
    <ActionButton compact arrow title={t('savings.open')} onPress={open} />
  </Pressable>;
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const appSettings = useAppStore((s) => s.apps); useAppStore((s) => s.schedules); useAppStore((s) => s.strictSession);
  useSubscriptionStore((s) => s.isPro); useWellbeingStore((s) => s.sleep);
  const source = useOnboardingStore((s) => s.source);
  const shortFormMinutes = useOnboardingStore((s) => s.shortFormMinutes);
  const measured = useOnboardingStore((s) => s.measured);
  const revision = useStatisticsStore((s) => s.revision);
  const [today, setToday] = useState<TodayStats>({ usedMs: 0, perApp: {} });
  const [comparison, setComparison] = useState<number | undefined>();
  const [bars, setBars] = useState<number[]>(Array(6).fill(0));
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => {
    if (revision < 0) return undefined;
    let active = true;
    setNow(new Date());
    // Savings grow through the day; refresh the clock while Home is visible.
    const tick = setInterval(() => setNow(new Date()), 60_000);
    void getLocalAnalytics().then((storage) => {
      if (!active) return;
      const day = getDailyStatistics(storage.daily);
      const perApp: TodayStats['perApp'] = {};
      for (const entry of day.platforms) if (entry.platform === 'instagram' || entry.platform === 'youtube') perApp[entry.platform] = { usedMs: entry.durationMs, blocked: entry.blockedAttempts };
      setToday({ usedMs: apps.reduce((sum, id) => sum + (perApp[id]?.usedMs ?? 0), 0), perApp });
      setBars(getDailyActivityTimeline(storage.events, new Date()).slice(2).map((item) => item.durationMs));
      if (PRO_ENABLED) {
        const week = getWeeklyStatistics(storage.daily);
        const previous = getPreviousPeriodStatistics(storage.daily, 'week', new Date());
        setComparison(getSafeComparisonPercent(week.cleanModeDurationMs, previous.cleanModeDurationMs, getActiveDayCount(storage.daily, previous.startDate, previous.endDate), 3));
      }
    }).catch(() => undefined);
    return () => { active = false; clearInterval(tick); };
  }, [revision]));
  const usual = useMemo(() => usualMinutes(source, shortFormMinutes, measured?.minutes ?? null), [measured, shortFormMinutes, source]);
  // appSettings is read so the card re-renders when filters change; effective config also applies routines.
  const potential = useMemo(() => apps.reduce((sum, id) => sum + appDailySavings(id, getEffectiveAppConfig(id, now), usual), 0), [appSettings, now, usual]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = savedSoFar(potential, today.usedMs, now);
  const hour = now.getHours();
  return <Screen glow={360} contentStyle={{ gap: 20 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{t('hello')}</Text>
      {PRO_ENABLED ? <View>
        <CircleButton label={t('wellbeing.notifications')} icon="bell" strokeWidth={1.9} onPress={() => router.push('/permissions')} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, boxShadow: `0px 0px 0px 2px ${c.card}` }} />
      </View> : null}
    </View>

    <HeroCard>
      <Text style={{ color: c.onHero, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{t('ui.savedPeriod.day')}</Text>
      <View style={{ marginTop: 6 }}><HeroDuration durationMs={saved * 60_000} /></View>
      <View style={{ marginTop: 6, minHeight: 22, justifyContent: 'center' }}>
        {PRO_ENABLED && comparison !== undefined ? <HeroTrend percent={comparison} label={t('ui.vsLastWeek')} /> : <Text style={{ color: c.onHero, fontSize: 13, fontWeight: '600' }}>{t('cleanModeActivity')}</Text>}
      </View>
      <View style={{ marginTop: 14 }}>
        <HeroBars height={52} barWidth={38} radius={10} accessibilityLabel={t('cleanModeUsageChart')} bars={slots.map((slot, i) => ({ key: slot, label: String(slot), value: bars[i] ?? 0, current: hour >= slot && hour < slot + 3 }))} />
      </View>
    </HeroCard>

    <View style={{ gap: 12 }}>
      <SectionTitle title={t('apps')} />
      {apps.map((appId) => <AppCard key={appId} appId={appId} today={today} usual={usual} />)}
    </View>

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, paddingHorizontal: 18, borderRadius: 22, backgroundColor: c.soft, boxShadow: c.isDark ? '0px 0px 0px 1px rgba(130,119,255,0.18)' : undefined }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkles" size={20} color={c.ink} /></View>
      <Text style={{ flex: 1, color: c.ink, fontWeight: '800', fontSize: 17, letterSpacing: -0.17 }}>{t('cleanMore')}</Text>
    </View>
  </Screen>;
}
