import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeInDown, FadeOutUp, ZoomIn, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, Card, Note, Screen } from '../../components/ui';
import { CountUp, OnboardingHeader } from '../../features/onboarding/components';
import { FREE_HOURS, ONBOARDING_APPS, splitDay, type OnboardingAppId } from '../../features/onboarding/dayBudget';
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


/** Phase 2: the share of free time, and how the free hours split. */
function Result() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const dailyMinutes = useOnboardingStore(totalMinutes);
  const source = useOnboardingStore((s) => s.source);
  const day = useMemo(() => splitDay(dailyMinutes), [dailyMinutes]);
  const measured = source === 'measured';
  const percent = Math.round(day.freeShare * 100);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) glow.value = withDelay(400, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(glow);
  }, [glow, reducedMotion]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.55 + glow.value * 0.45, transform: [{ scale: 0.92 + glow.value * 0.12 }] }));
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
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

    <Animated.View entering={enter(900)} style={{ marginTop: 32 }}>
      <Card style={{ padding: 18, gap: 14 }}>
        <View style={{ height: 18, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', backgroundColor: c.mint }}>
          <View style={{ width: `${Math.min(100, (day.social / Math.max(1, day.social + day.free)) * 100)}%`, backgroundColor: c.red }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.red }} /><Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{t(measured ? 'onboarding.legendSocial' : 'onboarding.legendShort')}</Text></View>
            <Text style={{ color: c.red, fontSize: 18, fontWeight: '800' }}>{formatDuration(Math.round(day.social), locale)}</Text>
          </View>
          <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.mint }} /><Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{t('onboarding.legendFree')}</Text></View>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{formatDuration(Math.round(day.free), locale)}</Text>
          </View>
        </View>
      </Card>
    </Animated.View>
    {day.sleepLost > 0 ? <Animated.View entering={enter(1100)} style={{ marginTop: 14 }}>
      <Note tone="accent" icon="moon">{t('onboarding.sleepLost', { time: formatDuration(day.sleepLost, locale) })}</Note>
    </Animated.View> : null}
  </View>;
}

export default function RevealScreen() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const apps = useOnboardingStore(useShallow((s) => ONBOARDING_APPS.filter((id) => (measuredMinutes(s)[id] ?? 0) > 0)));
  const [phase, setPhase] = useState<'calc' | 'result'>(reducedMotion ? 'result' : 'calc');
  const done = useMemo(() => () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setPhase('result'); }, []);
  const footer = phase === 'result'
    ? <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(1200).duration(500)}><ActionButton title={t('onboarding.resultCta')} arrow onPress={() => router.push('/onboarding/instead')} /></Animated.View>
    : undefined;
  return <Screen glow={420} contentStyle={{ gap: 0 }} footer={footer}>
    <OnboardingHeader step={5} back={phase === 'result'} />
    {phase === 'calc' ? <Calculating apps={apps} onDone={done} /> : <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)}><Result /></Animated.View>}
  </Screen>;
}
