import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, G, LinearGradient, Stop } from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeInDown, FadeOutUp, ZoomIn, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, Card, IconTile, Note, Screen } from '../../components/ui';
import type { IconName } from '../../components/Icon';
import { CountUp, OnboardingHeader } from '../../features/onboarding/components';
import { FREE_HOURS, HOURS_PER_BOOK, HOURS_PER_EVENING, MINUTES_PER_WORKOUT, ONBOARDING_APPS, SLEEP_HOURS, WORK_HOURS, formatInteger, splitDay, unitFor, yearCost, type OnboardingAppId } from '../../features/onboarding/dayBudget';
import { appCatalog } from '../../features/apps/catalog';
import { formatDuration } from '../../utils/formatDuration';
import { useAppStore } from '../../store/appStore';
import { measuredMinutes, totalMinutes, useOnboardingStore } from '../../store/onboardingStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppTheme } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CALC_MS = 2800;
const RING = 200;
const STROKE = 12;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Phase 1: a filling ring with the user's apps orbiting it while status lines cycle. */
function Calculating({ apps, onDone }: { apps: OnboardingAppId[]; onDone: () => void }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const { height } = useWindowDimensions();
  const lines = t('onboarding.calc', { returnObjects: true }) as string[];
  const [line, setLine] = useState(0);
  const progress = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: CALC_MS, easing: Easing.inOut(Easing.cubic) });
    spin.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    const ticker = setInterval(() => setLine((i) => Math.min(i + 1, lines.length - 1)), CALC_MS / lines.length);
    const finish = setTimeout(onDone, CALC_MS + 250);
    return () => { cancelAnimation(progress); cancelAnimation(spin); clearInterval(ticker); clearTimeout(finish); };
  }, [lines.length, onDone, progress, spin]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - progress.value) }));
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 360}deg` }] }));
  const orbitRadius = RING / 2 + 34;
  const shown: OnboardingAppId[] = apps.length ? apps : ['instagram', 'youtube', 'tiktok'];
  return <View style={{ minHeight: Math.max(440, height * 0.66), alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: orbitRadius * 2 + 44, height: orbitRadius * 2 + 44, alignItems: 'center', justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ position: 'absolute', width: RING * 1.6, height: RING * 1.6, borderRadius: RING, backgroundImage: c.lockHalo }} />
      <Svg width={RING} height={RING} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs><LinearGradient id="calcRing" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7A6DFF" /><Stop offset="1" stopColor={c.red} /></LinearGradient></Defs>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={c.off} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle cx={RING / 2} cy={RING / 2} r={R} stroke="url(#calcRing)" strokeWidth={STROKE} strokeLinecap="round" fill="none" strokeDasharray={`${CIRC} ${CIRC}`} animatedProps={ringProps} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <CountUp to={100} duration={CALC_MS} format={(v) => `${Math.round(v)}%`} style={{ color: c.text, fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1.5 }} />
      </View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: orbitRadius * 2, height: orbitRadius * 2 }, orbit]}>
        {shown.map((id, i) => {
          const angle = (2 * Math.PI * i) / shown.length;
          return <Animated.View key={id} entering={ZoomIn.delay(i * 120).springify().damping(12)} style={[{ position: 'absolute', left: orbitRadius + orbitRadius * Math.cos(angle) - 20, top: orbitRadius + orbitRadius * Math.sin(angle) - 20 }, upright]}>
            <AppIcon appId={id} size={40} />
          </Animated.View>;
        })}
      </Animated.View>
    </View>
    <View style={{ marginTop: 18, height: 26, alignSelf: 'stretch', alignItems: 'center' }}>
      <Animated.View key={line} entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(220)} style={{ position: 'absolute' }}>
        <Text style={{ color: c.text2, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{lines[line]}</Text>
      </Animated.View>
    </View>
  </View>;
}


const DAY_MINUTES = 24 * 60;
const FREE_MINUTES = FREE_HOURS * 60;
const DAY_RING = 220;
const DAY_STROKE = 28;
const DAY_R = (DAY_RING - DAY_STROKE) / 2;
const DAY_CIRC = 2 * Math.PI * DAY_R;
/** 2px surface gap between arcs, as a share of the ring. */
const ARC_GAP = 2 / DAY_CIRC;

type Slice = { key: 'sleep' | 'work' | 'social' | 'free'; label: string; color: string; minutes: number };

/** One arc of the day ring; it draws itself once the shared sweep (0–1) passes `start`. */
function DayArc({ start, length, color, sweep }: { start: number; length: number; color: string; sweep: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: DAY_CIRC * (1 - Math.min(length, Math.max(0, sweep.value - start))) }));
  return <G rotation={-90 + start * 360} origin={`${DAY_RING / 2}, ${DAY_RING / 2}`}>
    <AnimatedCircle cx={DAY_RING / 2} cy={DAY_RING / 2} r={DAY_R} stroke={color} strokeWidth={DAY_STROKE} fill="none" strokeDasharray={`${DAY_CIRC} ${DAY_CIRC}`} animatedProps={props} />
  </G>;
}

/** The 24 hours as a ring, drawn clockwise from the top; the centre counts the free hours down to what's left. */
function DayRing({ slices, free, delay }: { slices: Slice[]; free: number; delay: number }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const sweep = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!reducedMotion) sweep.value = withDelay(delay, withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }));
    return () => cancelAnimation(sweep);
  }, [delay, reducedMotion, sweep]);
  const shown = slices.filter((s) => s.minutes > 0);
  const arcs = shown.map((s, i) => ({
    ...s,
    start: shown.slice(0, i).reduce((sum, p) => sum + p.minutes, 0) / DAY_MINUTES,
    length: Math.max(0.002, s.minutes / DAY_MINUTES - ARC_GAP),
  }));
  return <View style={{ width: DAY_RING, height: DAY_RING, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={DAY_RING} height={DAY_RING} style={{ position: 'absolute' }}>
      <Circle cx={DAY_RING / 2} cy={DAY_RING / 2} r={DAY_R} stroke={c.card2} strokeWidth={DAY_STROKE} fill="none" />
      {arcs.map((a) => <DayArc key={a.key} start={a.start} length={a.length} color={a.color} sweep={sweep} />)}
    </Svg>
    <CountUp to={FREE_MINUTES - free} delay={delay + 700} duration={1300} format={(v) => formatDuration(Math.round(FREE_MINUTES - v), locale)} style={{ color: c.text, fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] }} />
    <Text style={{ maxWidth: DAY_RING - DAY_STROKE * 2 - 24, color: c.text2, fontSize: 13, lineHeight: 17, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.freeLeft')}</Text>
  </View>;
}

/** Ring + legend. Social media is one arc; with measured data its legend row splits by app (icons carry the identity). */
function DayCard({ slices, apps, delay }: { slices: Slice[]; apps: { appId: OnboardingAppId; minutes: number }[]; delay: number }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.selectedLanguage);
  const free = slices.find((s) => s.key === 'free')?.minutes ?? 0;
  return <Card style={{ padding: 18, gap: 18 }}>
    <View style={{ gap: 3 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{t('onboarding.dayTitle')}</Text>
      <Text style={{ color: c.text3, fontSize: 12, fontWeight: '700' }}>{t('onboarding.dayCaption', { sleep: SLEEP_HOURS, work: WORK_HOURS, free: FREE_HOURS })}</Text>
    </View>
    <DayRing slices={slices} free={free} delay={delay} />
    <View style={{ gap: 12 }}>
      {slices.map((s) => <View key={s.key} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: s.color }} />
          <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: s.key === 'social' || s.key === 'free' ? '800' : '600' }}>{s.label}</Text>
          <Text style={{ color: s.key === 'social' || s.key === 'free' ? c.text : c.text2, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatDuration(Math.round(s.minutes), locale)}</Text>
        </View>
        {s.key === 'social' && apps.length > 1 ? <View style={{ marginLeft: 22, gap: 8 }}>
          {apps.map((a) => <View key={a.appId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppIcon appId={a.appId} size={22} />
            <Text style={{ flex: 1, color: c.text2, fontSize: 13, fontWeight: '700' }}>{appCatalog[a.appId].name}</Text>
            <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{formatDuration(Math.round(a.minutes), locale)}</Text>
          </View>)}
        </View> : null}
      </View>)}
    </View>
  </Card>;
}

/** Phase 2: the share of free time, the day ring, and what a year of it could be instead. */
function Result() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const dailyMinutes = useOnboardingStore(totalMinutes);
  const byApp = useOnboardingStore(useShallow(measuredMinutes));
  const source = useOnboardingStore((s) => s.source);
  const measuredDays = useOnboardingStore((s) => s.measured?.days ?? 0);
  const day = useMemo(() => splitDay(dailyMinutes), [dailyMinutes]);
  const year = useMemo(() => yearCost(dailyMinutes), [dailyMinutes]);
  const measured = source === 'measured';
  // The ring caps social media at sleep + free time; scale the per-app rows to match.
  const scale = dailyMinutes > 0 ? day.social / dailyMinutes : 0;
  const apps = measured ? ONBOARDING_APPS.filter((id) => (byApp[id] ?? 0) > 0).map((id) => ({ appId: id, minutes: (byApp[id] ?? 0) * scale })) : [];
  const slices: Slice[] = [
    { key: 'sleep', label: t('onboarding.legendSleep'), color: c.blue, minutes: day.sleep },
    { key: 'work', label: t('onboarding.legendWork'), color: c.text3, minutes: day.work },
    { key: 'social', label: t(measured ? 'onboarding.legendSocial' : 'onboarding.legendShort'), color: c.red, minutes: day.social },
    { key: 'free', label: t('onboarding.legendFree'), color: c.mint, minutes: day.free },
  ];
  const words = (key: string) => t(`onboarding.${key}`, { returnObjects: true }) as string[];
  const counted = (n: number, key: string) => {
    const text = formatInteger(n, locale);
    return `${text} ${unitFor(locale, text, words(key))}`;
  };
  const percent = Math.round(day.freeShare * 100);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) glow.value = withDelay(400, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(glow);
  }, [glow, reducedMotion]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.55 + glow.value * 0.45, transform: [{ scale: 0.92 + glow.value * 0.12 }] }));
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
  const stats = [
    { value: formatDuration(Math.round(year.weekHours * 60), locale), label: t('onboarding.statWeek') },
    { value: formatInteger(year.yearHours, locale), label: t('onboarding.statYear') },
    { value: formatInteger(year.freeDays, locale), label: t('onboarding.statFreeDays', { hours: FREE_HOURS }) },
  ];
  const instead: { icon: IconName; tone: 'accent' | 'blue' | 'mint'; text: string }[] = [
    { icon: 'book', tone: 'accent', text: t('onboarding.books', { value: counted(year.books, 'bookWords') }) },
    { icon: 'run', tone: 'mint', text: t('onboarding.workouts', { value: counted(year.workouts, 'workoutWords') }) },
    { icon: 'moon', tone: 'blue', text: t('onboarding.evenings', { value: counted(year.evenings, 'eveningWords') }) },
  ];
  return <View>
    <Animated.View entering={enter(0)} style={{ marginTop: 22, alignSelf: 'center', height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center', backgroundColor: c.redSoft }}>
      <Text style={{ color: c.red, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 }}>{t('onboarding.everyDay')}</Text>
    </Animated.View>
    <Animated.View entering={enter(120)}><Text style={{ marginTop: 14, color: c.text2, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{t(measured ? 'onboarding.socialTakesApps' : 'onboarding.socialTakesShort')}</Text></Animated.View>
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 300, height: 220, borderRadius: 150, backgroundImage: c.isDark ? 'radial-gradient(closest-side, rgba(255,107,117,0.28), rgba(255,107,117,0))' : 'radial-gradient(closest-side, rgba(201,42,53,0.14), rgba(201,42,53,0))' }, glowStyle]} />
      <Animated.View entering={reducedMotion ? undefined : ZoomIn.delay(200).duration(500).easing(Easing.out(Easing.back(1.6)))}>
        <CountUp to={percent} delay={300} duration={1700} format={(v) => `${Math.round(v)}%`} onDone={() => { if (!reducedMotion) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }} style={{ color: c.red, fontSize: 104, lineHeight: 116, fontWeight: '800', letterSpacing: -5, fontVariant: ['tabular-nums'] }} />
      </Animated.View>
    </View>
    <Animated.View entering={enter(420)}><Text style={{ marginHorizontal: 12, color: c.text, fontSize: 19, lineHeight: 26, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.ofFreeTime', { hours: FREE_HOURS })}</Text></Animated.View>

    <Animated.View entering={enter(1700)} style={{ marginTop: 28 }}>
      <DayCard slices={slices} apps={apps} delay={2100} />
    </Animated.View>
    {day.sleepLost > 0 ? <Animated.View entering={enter(2600)} style={{ marginTop: 14 }}>
      <Note tone="accent" icon="moon">{t('onboarding.sleepLost', { time: formatDuration(day.sleepLost, locale) })}</Note>
    </Animated.View> : null}

    <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
      {stats.map((s, i) => <Animated.View key={s.label} entering={enter(2800 + i * 110)} style={{ flex: 1 }}>
        <Card style={{ flex: 1, padding: 14, gap: 4 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: c.text, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.6 }}>{s.value}</Text>
          <Text numberOfLines={3} style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{s.label}</Text>
        </Card>
      </Animated.View>)}
    </View>

    <Animated.View entering={enter(3200)}><Text style={{ marginTop: 28, color: c.text, fontSize: 20, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 }}>{t('onboarding.couldInstead')}</Text></Animated.View>
    <View style={{ marginTop: 12, gap: 10 }}>
      {instead.map((row, i) => <Animated.View key={row.icon} entering={enter(3350 + i * 140)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
          <IconTile name={row.icon} tone={row.tone} size={44} />
          <Text style={{ flex: 1, color: c.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }}>{row.text}</Text>
        </Card>
      </Animated.View>)}
    </View>
    <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(3800).duration(500)}>
      <Text style={{ marginTop: 16, color: c.text3, fontSize: 12, lineHeight: 17, fontWeight: '500' }}>{measured ? t('onboarding.basisMeasured', { days: counted(measuredDays, 'dayWords') }) : t('onboarding.basisEstimate')} {t('onboarding.footnote', { sleep: SLEEP_HOURS, work: WORK_HOURS, book: HOURS_PER_BOOK, workout: MINUTES_PER_WORKOUT, evening: HOURS_PER_EVENING })}</Text>
    </Animated.View>
  </View>;
}

export default function RevealScreen() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const apps = useOnboardingStore(useShallow((s) => ONBOARDING_APPS.filter((id) => (measuredMinutes(s)[id] ?? 0) > 0)));
  const [phase, setPhase] = useState<'calc' | 'result'>(reducedMotion ? 'result' : 'calc');
  const done = useMemo(() => () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setPhase('result'); }, []);
  const footer = phase === 'result'
    ? <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(2600).duration(500)}><ActionButton title={t('onboarding.resultCta')} arrow onPress={() => router.push('/onboarding/reclaim')} /></Animated.View>
    : undefined;
  return <Screen glow={420} contentStyle={{ gap: 0 }} footer={footer}>
    <OnboardingHeader step={2} back={phase === 'result'} />
    {phase === 'calc' ? <Calculating apps={apps} onDone={done} /> : <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)}><Result /></Animated.View>}
  </Screen>;
}
