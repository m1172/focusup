import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { ActionButton, Card, HeroCard, Note, Screen, Segmented } from '../../components/ui';
import { CountUp, OnboardingHeader, PoppingValue, StepTitle } from '../../features/onboarding/components';
import { FREE_HOURS, formatInteger, reclaimedFreeDays, splitDay, targetMinutes, unitFor } from '../../features/onboarding/dayBudget';
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
  const cut = useOnboardingStore((s) => s.cut);
  const setCut = useOnboardingStore((s) => s.setCut);
  const target = targetMinutes(dailyMinutes, cut);
  const freeNow = splitDay(dailyMinutes).free;
  const freeLater = splitDay(target).free;
  const back = Math.max(0, dailyMinutes - target);
  const daysText = formatInteger(reclaimedFreeDays(dailyMinutes, cut), locale);
  const days = `${daysText} ${unitFor(locale, daysText, t('onboarding.freeDayWords', { returnObjects: true }) as string[])}`;
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
  return <Screen glow={320} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('onboarding.reclaimCta')} arrow onPress={() => { setDailyGoal(target); router.push('/onboarding/how-it-works'); }} />}>
    <OnboardingHeader step={3} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.reclaimTitle')} body={t('onboarding.reclaimBody')} /></View>
    <Animated.View entering={enter(200)} style={{ marginTop: 20 }}>
      <Segmented height={40} value={String(cut) as (typeof cuts)[number]} onChange={(v) => setCut(Number(v))} options={cuts.map((v) => ({ value: v, label: t('onboarding.cutLabel', { percent: Number(v) * 100 }) }))} />
    </Animated.View>
    <Animated.View entering={enter(320)} style={{ marginTop: 18 }}>
      <HeroCard style={{ alignItems: 'center', paddingVertical: 26 }}>
        <PoppingValue value={cut}>
          <CountUp to={back} delay={350} duration={1300} format={(v) => `+${formatDuration(Math.round(v), locale)}`} style={{ color: '#FFFFFF', fontSize: 64, lineHeight: 72, fontWeight: '800', letterSpacing: -2.5 }} />
        </PoppingValue>
        <Text style={{ marginTop: 2, color: c.onHero, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.freeBack')}</Text>
        <Text style={{ marginTop: 10, color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.freeDaysBack', { days })}</Text>
      </HeroCard>
    </Animated.View>
    <Animated.View entering={enter(440)} style={{ marginTop: 14 }}>
      <Card style={{ gap: 18 }}>
        <Bar label={t('onboarding.now')} detail={t('onboarding.freeOf', { time: formatDuration(freeNow, locale), hours: FREE_HOURS })} share={freeNow / (FREE_HOURS * 60)} color={`linear-gradient(90deg, ${c.text3}, ${c.text3})`} delay={500} />
        <Bar label={t('onboarding.withFocusUp')} detail={t('onboarding.freeOf', { time: formatDuration(freeLater, locale), hours: FREE_HOURS })} share={freeLater / (FREE_HOURS * 60)} color={c.grad} delay={800} />
      </Card>
    </Animated.View>
    <Animated.View entering={enter(560)} style={{ marginTop: 14, gap: 10 }}>
      <Note tone="mint" icon="shieldCheck">{t('onboarding.reclaimNote')}</Note>
      <Text style={{ paddingHorizontal: 6, color: c.text3, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{t('onboarding.goalSet', { time: formatDuration(target, locale) })}</Text>
    </Animated.View>
  </Screen>;
}
