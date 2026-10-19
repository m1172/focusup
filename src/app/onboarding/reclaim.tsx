import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { ActionButton, Card, HeroCard, Note, Screen, Segmented } from '../../components/ui';
import { CountUp, OnboardingHeader, PoppingValue, StepTitle } from '../../features/onboarding/components';
import { formatYears, projectLifetime, reclaimedYears, targetMinutes, unitFor } from '../../features/onboarding/lifeProjection';
import { useAppStore } from '../../store/appStore';
import { totalMinutes, useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme';
import { formatDuration } from '../../utils/formatDuration';

const cuts = ['0.25', '0.5', '0.75'] as const;

/** Labelled bar that grows to `share` (0–1) of the track. */
function Bar({ label, detail, share, color, delay }: { label: string; detail: string; share: number; color: string; delay: number }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const width = useSharedValue(reducedMotion ? share : 0);
  useEffect(() => {
    width.value = reducedMotion ? share : withDelay(delay, withTiming(share, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [delay, reducedMotion, share, width]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0.04, width.value) * 100}%` }));
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, color: c.text2, fontSize: 13, fontWeight: '700' }}>{detail}</Text>
    </View>
    <View style={{ height: 14, borderRadius: 7, backgroundColor: c.card2, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 14, borderRadius: 7, backgroundImage: color }, fill]} />
    </View>
  </View>;
}

export default function ReclaimScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const setDailyGoal = useAppStore((s) => s.setDailyGoal);
  const reducedMotion = useReducedMotion();
  const dailyMinutes = useOnboardingStore(totalMinutes);
  const age = useOnboardingStore((s) => s.age);
  const cut = useOnboardingStore((s) => s.cut);
  const setCut = useOnboardingStore((s) => s.setCut);
  const target = targetMinutes(dailyMinutes, cut);
  const nowYears = projectLifetime(dailyMinutes, age).years;
  const laterYears = projectLifetime(target, age).years;
  const back = reclaimedYears(dailyMinutes, age, cut);
  const years = (value: number) => {
    const text = formatYears(value, locale);
    return `${text} ${unitFor(locale, text, t('onboarding.yearWords', { returnObjects: true }) as string[])}`;
  };
  const backText = formatYears(back, locale);
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
  return <Screen glow={320} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('onboarding.reclaimCta')} arrow onPress={() => { setDailyGoal(target); router.push('/onboarding/how-it-works'); }} />}>
    <OnboardingHeader step={4} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.reclaimTitle')} body={t('onboarding.reclaimBody')} /></View>
    <Animated.View entering={enter(200)} style={{ marginTop: 20 }}>
      <Segmented height={40} value={String(cut) as (typeof cuts)[number]} onChange={(v) => setCut(Number(v))} options={cuts.map((v) => ({ value: v, label: t('onboarding.cutLabel', { percent: Number(v) * 100 }) }))} />
    </Animated.View>
    <Animated.View entering={enter(320)} style={{ marginTop: 18 }}>
      <HeroCard style={{ alignItems: 'center', paddingVertical: 26 }}>
        <PoppingValue value={cut}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <CountUp to={back} delay={350} duration={1300} format={(v) => `+${formatYears(v, locale)}`} style={{ color: '#FFFFFF', fontSize: 72, lineHeight: 80, fontWeight: '800', letterSpacing: -3 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800' }}>{unitFor(locale, backText, t('onboarding.yearWords', { returnObjects: true }) as string[])}</Text>
          </View>
        </PoppingValue>
        <Text style={{ marginTop: 2, color: c.onHero, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.yearsBack')}</Text>
      </HeroCard>
    </Animated.View>
    <Animated.View entering={enter(440)} style={{ marginTop: 14 }}>
      <Card style={{ gap: 18 }}>
        <Bar label={t('onboarding.now')} detail={`${years(nowYears)} · ${t('onboarding.perDay', { time: formatDuration(dailyMinutes, locale) })}`} share={1} color={`linear-gradient(90deg, ${c.red}, ${c.red})`} delay={500} />
        <Bar label={t('onboarding.withFocusUp')} detail={`${years(laterYears)} · ${t('onboarding.perDay', { time: formatDuration(target, locale) })}`} share={dailyMinutes ? target / dailyMinutes : 0} color={c.grad} delay={800} />
      </Card>
    </Animated.View>
    <Animated.View entering={enter(560)} style={{ marginTop: 14, gap: 10 }}>
      <Note tone="mint" icon="shieldCheck">{t('onboarding.reclaimNote')}</Note>
      <Text style={{ paddingHorizontal: 6, color: c.text3, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{t('onboarding.goalSet', { time: formatDuration(target, locale) })}</Text>
    </Animated.View>
  </Screen>;
}
