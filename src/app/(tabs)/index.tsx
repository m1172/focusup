import { PRO_ENABLED } from '../../config/release';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon, type IconName } from '../../components/Icon';
import { AppIcon } from '../../components/AppIcon';
import { CircleButton, Screen, SectionTitle, StatusDot } from '../../components/ui';
import { HeroCard, HeroTrend } from '../../components/HeroStat';
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
import { appDailySavings, savedSoFar, usualMinutes, yearlyValue, type SavingsAppId, type UsualMinutes } from '../../features/savings/savings';
import { formatInteger, unitFor } from '../../features/onboarding/dayBudget';
import { formatDuration } from '../../utils/formatDuration';

const apps = AVAILABLE_APPS;
const featureName: Record<SavingsAppId, string> = { instagram: 'Reels', youtube: 'Shorts' };
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 96;
const RING_STROKE = 10;
const RING_R = (RING - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

type TodayStats = { usedMs: number; blocked: number; perApp: Partial<Record<SavingsAppId, { usedMs: number; blocked: number }>> };

/** "23 minut", or "1 soat 5 minut" set smaller so it always fits beside the ring. */
function SavedValue({ minutes }: { minutes: number }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const hours = Math.floor(minutes / 60);
  const size = hours > 0 ? 40 : 52;
  const number = { color: '#FFFFFF', fontSize: size, lineHeight: size + 4, fontWeight: '800' as const, letterSpacing: -0.04 * size, fontVariant: ['tabular-nums' as const] };
  const unit = { color: c.onHero, fontSize: hours > 0 ? 17 : 20, fontWeight: '700' as const };
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 5 }}>
    {hours > 0 ? <><Text style={number}>{hours}</Text><Text style={[unit, { marginRight: 6 }]}>{t('ui.hoursUnit')}</Text></> : null}
    <Text style={number}>{minutes % 60}</Text><Text style={unit}>{t('ui.minutesUnit')}</Text>
  </View>;
}

/** Share of today's possible savings already saved; fills smoothly when it changes. */
function SavingsRing({ progress }: { progress: number }) {
  const value = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => { value.set(reduceMotion ? progress : withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) })); }, [progress, reduceMotion, value]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: RING_CIRC * (1 - value.get()) }));
  return <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={RING} height={RING} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke="rgba(255,255,255,0.18)" strokeWidth={RING_STROKE} fill="none" />
      <AnimatedCircle cx={RING / 2} cy={RING / 2} r={RING_R} stroke="#A8F7DC" strokeWidth={RING_STROKE} strokeLinecap="round" fill="none" strokeDasharray={`${RING_CIRC} ${RING_CIRC}`} animatedProps={ring} />
    </Svg>
    <Text style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>{Math.round(progress * 100)}%</Text>
  </View>;
}

function HeroFact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const c = useAppTheme();
  return <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: c.heroChip }}>
    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.heroIconBg }}><Icon name={icon} size={17} color="#FFFFFF" strokeWidth={2.2} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: c.onHero, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 21, fontWeight: '800' }}>{value}</Text>
    </View>
  </View>;
}

/** Launch tile: the whole tile opens the clean app; shows how long it was used today. */
function AppTile({ appId, usedMs }: { appId: SavingsAppId; usedMs: number }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const active = appCatalog[appId].supported && getEffectiveAppConfig(appId).enabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t('savings.open')} ${appCatalog[appId].name}`} onPress={() => router.push({ pathname: '/browser/[appId]', params: { appId } })} style={({ pressed }) => ({ flex: 1, padding: 16, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <AppIcon appId={appId} size={48} />
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent, boxShadow: c.sw }}><Icon name="arrowRight" size={17} color="#FFFFFF" strokeWidth={2.4} /></View>
    </View>
    <Text numberOfLines={1} style={{ marginTop: 14, color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.3 }}>{appCatalog[appId].name}</Text>
    <View style={{ marginTop: 3 }}><StatusDot on={active} label={t(active ? 'cleaned' : 'off')} /></View>
    <View style={{ height: 1, marginVertical: 12, backgroundColor: c.line }} />
    <Text numberOfLines={1} style={{ color: c.text3, fontSize: 12, lineHeight: 16, fontWeight: '700' }}>{t('savings.todayLabel')}</Text>
    <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3 }}>{formatDuration(Math.round(usedMs / 60_000), locale)}</Text>
  </Pressable>;
}

/** One row per short-video filter: is it hiding Reels/Shorts, and what that saves. Opens the filter screen. */
function ProtectionRow({ appId, usual, last }: { appId: SavingsAppId; usual: UsualMinutes; last: boolean }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const perDay = appDailySavings(appId, getEffectiveAppConfig(appId), usual);
  const on = perDay > 0;
  const feature = featureName[appId];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${appCatalog[appId].name} ${feature} — ${t('savings.filters')}`} onPress={() => router.push({ pathname: '/app-settings/[appId]', params: { appId } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.6 : 1 })}>
    <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.mintSoft : c.amberSoft }}><Icon name={on ? 'shieldCheck' : 'eyeOff'} size={21} color={on ? c.mintInk : c.amber} strokeWidth={2.1} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, lineHeight: 21, fontWeight: '800' }}>{appCatalog[appId].name} {feature}</Text>
      <Text numberOfLines={2} style={{ color: on ? c.mintInk : c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{on ? t('savings.savesPerDay', { time: formatDuration(Math.round(perDay), locale) }) : t('savings.notSaving', { feature })}</Text>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 11, borderRadius: 15, backgroundColor: on ? c.mintSoft : c.accent }}>
      {on ? <Icon name="check" size={14} color={c.mintInk} strokeWidth={2.6} /> : null}
      <Text style={{ color: on ? c.mintInk : '#FFFFFF', fontSize: 13, fontWeight: '800' }}>{t(on ? 'savings.hidden' : 'savings.turnOn')}</Text>
    </View>
  </Pressable>;
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const appSettings = useAppStore((s) => s.apps); useAppStore((s) => s.schedules); useAppStore((s) => s.strictSession);
  useSubscriptionStore((s) => s.isPro); useWellbeingStore((s) => s.sleep);
  const source = useOnboardingStore((s) => s.source);
  const shortFormMinutes = useOnboardingStore((s) => s.shortFormMinutes);
  const measured = useOnboardingStore((s) => s.measured);
  const revision = useStatisticsStore((s) => s.revision);
  const [today, setToday] = useState<TodayStats>({ usedMs: 0, blocked: 0, perApp: {} });
  const [comparison, setComparison] = useState<number | undefined>();
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
      setToday({ usedMs: apps.reduce((sum, id) => sum + (perApp[id]?.usedMs ?? 0), 0), blocked: apps.reduce((sum, id) => sum + (perApp[id]?.blocked ?? 0), 0), perApp });
      if (PRO_ENABLED) {
        const week = getWeeklyStatistics(storage.daily);
        const previous = getPreviousPeriodStatistics(storage.daily, 'week', new Date());
        setComparison(getSafeComparisonPercent(week.cleanModeDurationMs, previous.cleanModeDurationMs, getActiveDayCount(storage.daily, previous.startDate, previous.endDate), 3));
      }
    }).catch(() => undefined);
    return () => { active = false; clearInterval(tick); };
  }, [revision]));
  const usual = useMemo(() => usualMinutes(source, shortFormMinutes, measured?.minutes ?? null), [measured, shortFormMinutes, source]);
  // appSettings is read so the screen re-renders when filters change; effective config also applies routines.
  const potential = useMemo(() => apps.reduce((sum, id) => sum + appDailySavings(id, getEffectiveAppConfig(id, now), usual), 0), [appSettings, now, usual]); // eslint-disable-line react-hooks/exhaustive-deps
  const saved = savedSoFar(potential, today.usedMs, now);
  const freeDaysText = formatInteger(yearlyValue(potential).freeDays, locale);
  const yearText = potential > 0 ? `${freeDaysText} ${unitFor(locale, freeDaysText, t('onboarding.freeDayWords', { returnObjects: true }) as string[])}` : '—';
  return <Screen glow={360} contentStyle={{ gap: 22 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{t('hello')}</Text>
        <Text style={{ color: c.text2, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{t('inControl')}</Text>
      </View>
      {PRO_ENABLED ? <View>
        <CircleButton label={t('wellbeing.notifications')} icon="bell" strokeWidth={1.9} onPress={() => router.push('/permissions')} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, boxShadow: `0px 0px 0px 2px ${c.card}` }} />
      </View> : null}
    </View>

    <HeroCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: c.onHero, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{t('ui.savedPeriod.day')}</Text>
          <View style={{ marginTop: 4 }}><SavedValue minutes={saved} /></View>
          <Text style={{ marginTop: 6, color: c.onHero, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{potential > 0 ? t('savings.possibleToday', { time: formatDuration(Math.round(potential), locale) }) : t('savings.startHint')}</Text>
        </View>
        <SavingsRing progress={potential > 0 ? Math.min(1, saved / potential) : 0} />
      </View>
      {PRO_ENABLED && comparison !== undefined ? <View style={{ marginTop: 12 }}><HeroTrend percent={comparison} label={t('ui.vsLastWeek')} /></View> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <HeroFact icon="calendar" label={t('savings.perYear')} value={yearText} />
        <HeroFact icon="shieldCheck" label={t('savings.blockedToday')} value={formatInteger(today.blocked, locale)} />
      </View>
    </HeroCard>

    <View style={{ gap: 12 }}>
      <SectionTitle title={t('apps')} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {apps.map((appId) => <AppTile key={appId} appId={appId} usedMs={today.perApp[appId]?.usedMs ?? 0} />)}
      </View>
    </View>

    <View style={{ gap: 12 }}>
      <SectionTitle title={t('savings.protection')} />
      <View style={{ paddingHorizontal: 16, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
        {apps.map((appId, index) => <ProtectionRow key={appId} appId={appId} usual={usual} last={index === apps.length - 1} />)}
      </View>
    </View>
  </Screen>;
}
