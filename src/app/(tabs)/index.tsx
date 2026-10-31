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
import { appDailySavings, savedSoFar, usualMinutes, yearlyValue, type SavingsAppId } from '../../features/savings/savings';
import { formatInteger, unitFor } from '../../features/onboarding/dayBudget';
import { formatDuration } from '../../utils/formatDuration';
import { BrowserLinkSheet } from '../../features/webview/BrowserLinkSheet';

const apps = AVAILABLE_APPS;
const featureName: Record<SavingsAppId, string> = { instagram: 'Reels', youtube: 'Shorts', tiktok: 'For You' };
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

/** One wide card per app: opens the clean app, shows whether Vaqtim protects it and today's time in it. */
function AppCard({ appId, usedMs }: { appId: SavingsAppId; usedMs: number }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const active = appCatalog[appId].supported && getEffectiveAppConfig(appId).enabled;
  const name = appCatalog[appId].name;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${t('savings.open')} ${name}`} onPress={() => router.push({ pathname: '/browser/[appId]', params: { appId } })}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
    <AppIcon appId={appId} size={50} />
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text numberOfLines={1} style={{ color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.3 }}>{name}</Text>
      <StatusDot on={active} label={active ? t('ui.homeHidden', { feature: featureName[appId] }) : t('ui.homeNotConnected')} />
    </View>
    <View style={{ alignItems: 'flex-end', gap: 2 }}>
      <Text numberOfLines={1} style={{ color: c.text3, fontSize: 11, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('savings.todayLabel')}</Text>
      <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, lineHeight: 21, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatDuration(Math.round(usedMs / 60_000), locale)}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('ui.appSettings', { name })} hitSlop={6}
      onPress={() => router.push({ pathname: '/app-settings/[appId]', params: { appId } })}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card2, opacity: pressed ? 0.7 : 1 })}>
      <Icon name="sliders" size={18} color={c.text2} />
    </Pressable>
  </Pressable>;
}

/** Shown only while some apps are not connected: a nudge to the Protect tab, where connecting happens. */
function ConnectHint({ missing }: { missing: SavingsAppId[] }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  return <Pressable accessibilityRole="button" onPress={() => router.navigate('/focus')}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: c.soft, opacity: pressed ? 0.8 : 1 })}>
    <View style={{ flexDirection: 'row' }}>{missing.map((id, index) => <View key={id} style={{ marginLeft: index ? -10 : 0, borderRadius: 12, borderWidth: 2, borderColor: c.soft }}><AppIcon appId={id} size={30} /></View>)}</View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ color: c.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' }}>{t('ui.homeConnectTitle', { count: missing.length })}</Text>
      <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{t('ui.homeConnectBody')}</Text>
    </View>
    <Icon name="chevron" size={18} color={c.ink} strokeWidth={2.2} />
  </Pressable>;
}

const greetingKey = (hour: number) => hour < 5 ? 'ui.greetEvening' : hour < 12 ? 'ui.greetMorning' : hour < 18 ? 'ui.greetAfternoon' : 'ui.greetEvening';

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
  const [linkOpen, setLinkOpen] = useState(false);
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
      for (const entry of day.platforms) if (entry.platform === 'instagram' || entry.platform === 'youtube' || entry.platform === 'tiktok') perApp[entry.platform] = { usedMs: entry.durationMs, blocked: entry.blockedAttempts };
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
  const missing = apps.filter((id) => !getEffectiveAppConfig(id, now).enabled);
  const freeDaysText = formatInteger(yearlyValue(potential).freeDays, locale);
  const yearText = potential > 0 ? `${freeDaysText} ${unitFor(locale, freeDaysText, t('onboarding.freeDayWords', { returnObjects: true }) as string[])}` : '—';
  return <Screen glow={360} contentStyle={{ gap: 22 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{t(greetingKey(now.getHours()))}</Text>
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
      <View style={{ gap: 10 }}>
        {apps.map((appId) => <AppCard key={appId} appId={appId} usedMs={today.perApp[appId]?.usedMs ?? 0} />)}
      </View>
    </View>

    {missing.length ? <ConnectHint missing={missing} /> : null}

    {/* A shared Instagram, YouTube or TikTok link opens in the clean browser, not the real app. */}
    <Pressable accessibilityRole="button" accessibilityLabel={t('ui.openLinkBar')} onPress={() => setLinkOpen(true)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 18, borderRadius: 30, backgroundColor: c.card, boxShadow: c.sh, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="link" size={18} color={c.ink} /></View>
      <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '700' }}>{t('ui.openLinkBar')}</Text>
      <Icon name="chevron" size={18} color={c.text3} strokeWidth={2.2} />
    </Pressable>
    <BrowserLinkSheet name={apps.map((id) => appCatalog[id].name).join(', ')} visible={linkOpen} onClose={() => setLinkOpen(false)}
      onOpen={(url, appId) => router.push({ pathname: '/browser/[appId]', params: { appId, url } })} />
  </Screen>;
}
