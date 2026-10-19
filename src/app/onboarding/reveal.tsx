import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeInDown, FadeOutUp, ZoomIn, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, Card, IconTile, Screen } from '../../components/ui';
import type { IconName } from '../../components/Icon';
import { CountUp, OnboardingHeader } from '../../features/onboarding/components';
import { ONBOARDING_APPS, HOURS_PER_BOOK, HOURS_PER_LANGUAGE, LIFE_EXPECTANCY, MINUTES_PER_WORKOUT, WAKING_HOURS_PER_DAY, dotSlices, formatInteger, formatYears, projectByApp, projectLifetime, unitFor, type OnboardingAppId } from '../../features/onboarding/lifeProjection';
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

const DOT = 18;

/** One year of life. Its coloured slices (one per app) appear after `delay`. */
function YearDot({ slices, colors, delay, animate }: { slices: [number, number][]; colors: string[]; delay: number; animate: boolean }) {
  const c = useAppTheme();
  const filled = slices.reduce((sum, [, f]) => sum + f, 0);
  const shown = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (filled > 0 && animate) shown.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 180 }));
  }, [animate, delay, filled, shown]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value * 1.4), transform: [{ scale: filled < 0.999 ? 1 : 0.2 + shown.value * 0.8 }] }));
  return <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: c.off, overflow: 'hidden' }}>
    {filled > 0 ? <Animated.View style={[{ flexDirection: 'row', width: DOT, height: DOT, borderRadius: filled < 0.999 ? 0 : DOT / 2, overflow: 'hidden' }, style]}>
      {slices.map(([app, f]) => <View key={app} style={{ width: DOT * f, height: DOT, backgroundColor: colors[app] }} />)}
    </Animated.View> : null}
  </View>;
}

/** Remaining life as a dot grid; the last dots — the social-media years, group by group — fill in one by one. */
type Group = { key: string; label: string; color: string; years: number };

function LifeGrid({ remaining, groups, startDelay, animate }: { remaining: number; groups: Group[]; startDelay: number; animate: boolean }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const years = groups.map((g) => g.years);
  const colors = groups.map((g) => g.color);
  const slices = Array.from({ length: remaining }, (_, i) => dotSlices(i, remaining, years));
  const firstIndex = slices.findIndex((x) => x.length > 0);
  const rows = Array.from({ length: Math.ceil(remaining / 10) }, (_, r) => r);
  return <Card style={{ padding: 18, gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
      <Text style={{ flexShrink: 1, color: c.text, fontSize: 16, fontWeight: '800' }}>{t('onboarding.gridTitle', { age: LIFE_EXPECTANCY })}</Text>
      <Text style={{ color: c.text3, fontSize: 12, fontWeight: '700' }}>{t('onboarding.gridCaption')}</Text>
    </View>
    <View style={{ gap: 10 }}>
      {rows.map((r) => <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {Array.from({ length: 10 }, (_, k) => {
          const i = r * 10 + k;
          return i < remaining ? <YearDot key={k} slices={slices[i]} colors={colors} animate={animate} delay={startDelay + Math.max(0, i - firstIndex) * 85} /> : <View key={k} style={{ width: DOT }} />;
        })}
      </View>)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 }}>
      {[{ color: c.off, label: t('onboarding.legendLife') }, ...groups.map((g) => ({ color: g.color, label: g.label }))].map((item) => <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color }} />
        <Text style={{ color: c.text2, fontSize: 12, fontWeight: '700' }}>{item.label}</Text>
      </View>)}
    </View>
  </Card>;
}

/** Per-app years with bars that grow to each app's share. */
function Breakdown({ parts, delay }: { parts: { appId: OnboardingAppId; minutes: number; years: number }[]; delay: number }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const max = Math.max(...parts.map((p) => p.years));
  const yearWords = t('onboarding.yearWords', { returnObjects: true }) as string[];
  return <Card style={{ padding: 18, gap: 16 }}>
    <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{t('onboarding.breakdownTitle')}</Text>
    {parts.map((p, i) => {
      const years = formatYears(p.years, locale);
      return <View key={p.appId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AppIcon appId={p.appId} size={40} />
        <View style={{ flex: 1, gap: 7 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{appCatalog[p.appId].name}</Text>
            <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}><Text style={{ color: c.apps[p.appId].ink, fontSize: 15, fontWeight: '800' }}>{years} {unitFor(locale, years, yearWords)}</Text> · {formatDuration(p.minutes, locale)}</Text>
          </View>
          <GrowBar share={p.years / max} color={c.apps[p.appId].ink} delay={delay + 200 + i * 150} />
        </View>
      </View>;
    })}
  </Card>;
}

function GrowBar({ share, color, delay }: { share: number; color: string; delay: number }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const width = useSharedValue(reducedMotion ? share : 0);
  useEffect(() => {
    if (!reducedMotion) width.value = withDelay(delay, withTiming(share, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, reducedMotion, share, width]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0.03, width.value) * 100}%` }));
  return <View style={{ height: 8, borderRadius: 4, backgroundColor: c.card2, overflow: 'hidden' }}>
    <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: color }, fill]} />
  </View>;
}

/** Phase 2: the number, the grid, and what that time could be instead. */
function Result() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const dailyMinutes = useOnboardingStore(totalMinutes);
  const byApp = useOnboardingStore(useShallow(measuredMinutes));
  const source = useOnboardingStore((s) => s.source);
  const measuredDays = useOnboardingStore((s) => s.measured?.days ?? 0);
  const age = useOnboardingStore((s) => s.age);
  const p = useMemo(() => projectLifetime(dailyMinutes, age), [age, dailyMinutes]);
  const parts = useMemo(() => projectByApp(byApp, age), [age, byApp]);
  const measured = source === 'measured';
  const groups: Group[] = measured
    ? parts.map((x) => ({ key: x.appId, label: appCatalog[x.appId].name, color: c.apps[x.appId].ink, years: x.years }))
    : [{ key: 'short', label: t('onboarding.legendShort'), color: c.red, years: p.years }];
  const words = (key: string) => t(`onboarding.${key}`, { returnObjects: true }) as string[];
  const counted = (n: number, key: string) => `${formatInteger(n, locale)} ${unitFor(locale, String(n), words(key))}`;
  const yearsText = formatYears(p.years, locale);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) glow.value = withDelay(400, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(glow);
  }, [glow, reducedMotion]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.55 + glow.value * 0.45, transform: [{ scale: 0.92 + glow.value * 0.12 }] }));
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
  const stats = [
    { value: formatInteger(p.daysPerYear, locale), label: t('onboarding.statDays') },
    { value: `${Math.round(p.wakingShare * 100)}%`, label: t('onboarding.statWaking') },
    { value: formatInteger(p.totalHours, locale), label: t('onboarding.statHours') },
  ];
  const instead: { icon: IconName; tone: 'accent' | 'blue' | 'mint'; text: string }[] = [
    { icon: 'book', tone: 'accent', text: t('onboarding.books', { value: counted(p.books, 'bookWords') }) },
    { icon: 'globe', tone: 'blue', text: t('onboarding.languages', { value: counted(p.languages, 'languageWords') }) },
    { icon: 'run', tone: 'mint', text: t('onboarding.workouts', { value: counted(p.workouts, 'workoutWords') }) },
  ];
  return <View>
    <Animated.View entering={enter(0)} style={{ marginTop: 22, alignSelf: 'center', height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center', backgroundColor: c.redSoft }}>
      <Text style={{ color: c.red, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 }}>{t('onboarding.ifNothingChanges')}</Text>
    </Animated.View>
    <Animated.View entering={enter(120)}><Text style={{ marginTop: 14, color: c.text2, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.youWillSpend')}</Text></Animated.View>
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 300, height: 220, borderRadius: 150, backgroundImage: c.isDark ? 'radial-gradient(closest-side, rgba(255,107,117,0.28), rgba(255,107,117,0))' : 'radial-gradient(closest-side, rgba(201,42,53,0.14), rgba(201,42,53,0))' }, glowStyle]} />
      <Animated.View entering={reducedMotion ? undefined : ZoomIn.delay(200).duration(500).easing(Easing.out(Easing.back(1.6)))} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <CountUp to={p.years} delay={300} duration={1900} format={(v) => formatYears(v, locale)} onDone={() => { if (!reducedMotion) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }} style={{ color: c.red, fontSize: 104, lineHeight: 116, fontWeight: '800', letterSpacing: -5 }} />
        <Text style={{ color: c.red, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 }}>{unitFor(locale, yearsText, words('yearWords'))}</Text>
      </Animated.View>
    </View>
    <Animated.View entering={enter(420)}><Text style={{ marginHorizontal: 12, color: c.text, fontSize: 19, lineHeight: 26, fontWeight: '700', textAlign: 'center' }}>{t(measured ? 'onboarding.ofYourLifeApps' : 'onboarding.ofYourLifeShort')}</Text></Animated.View>

    <Animated.View entering={enter(2000)} style={{ marginTop: 28 }}>
      <LifeGrid remaining={p.remainingYears} groups={groups} startDelay={2500} animate={!reducedMotion} />
    </Animated.View>
    {measured && parts.length > 1 ? <Animated.View entering={enter(2700)} style={{ marginTop: 14 }}><Breakdown parts={parts} delay={2700} /></Animated.View> : null}

    <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
      {stats.map((s, i) => <Animated.View key={s.label} entering={enter(2900 + i * 110)} style={{ flex: 1 }}>
        <Card style={{ flex: 1, padding: 14, gap: 4 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: c.text, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.6 }}>{s.value}</Text>
          <Text numberOfLines={3} style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{s.label}</Text>
        </Card>
      </Animated.View>)}
    </View>

    <Animated.View entering={enter(3300)}><Text style={{ marginTop: 28, color: c.text, fontSize: 20, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 }}>{t('onboarding.couldInstead')}</Text></Animated.View>
    <View style={{ marginTop: 12, gap: 10 }}>
      {instead.map((row, i) => <Animated.View key={row.icon} entering={enter(3450 + i * 140)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
          <IconTile name={row.icon} tone={row.tone} size={44} />
          <Text style={{ flex: 1, color: c.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }}>{row.text}</Text>
        </Card>
      </Animated.View>)}
    </View>
    <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(3900).duration(500)}>
      <Text style={{ marginTop: 16, color: c.text3, fontSize: 12, lineHeight: 17, fontWeight: '500' }}>{measured ? t('onboarding.basisMeasured', { days: counted(measuredDays, 'dayWords') }) : t('onboarding.basisEstimate')} {t('onboarding.footnote', { age: LIFE_EXPECTANCY, waking: WAKING_HOURS_PER_DAY, book: HOURS_PER_BOOK, language: HOURS_PER_LANGUAGE, workout: MINUTES_PER_WORKOUT })}</Text>
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
    <OnboardingHeader step={4} back={phase === 'result'} />
    {phase === 'calc' ? <Calculating apps={apps} onDone={done} /> : <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)}><Result /></Animated.View>}
  </Screen>;
}
