import { useMemo } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import type { IconName } from '../../components/Icon';
import { ActionButton, Card, HeroCard, IconTile, Screen, type TileTone } from '../../components/ui';
import { CountUp, OnboardingHeader, StepTitle } from '../../features/onboarding/components';
import { formatInteger, insteadOf, unitFor } from '../../features/onboarding/dayBudget';
import { useAppStore } from '../../store/appStore';
import { totalMinutes, useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme';

/** Step 6: what one year of the same hours could be instead. */
export default function InsteadScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const dailyMinutes = useOnboardingStore(totalMinutes);
  const instead = useMemo(() => insteadOf(dailyMinutes, 1), [dailyMinutes]);
  const words = (key: string) => t(`onboarding.${key}`, { returnObjects: true }) as string[];
  const counted = (n: number, key: string) => {
    const text = formatInteger(n, locale);
    return `${text} ${unitFor(locale, text, words(key))}`;
  };
  const hoursText = formatInteger(instead.hours, locale);
  const cards: { icon: IconName; tone: TileTone; text: string }[] = [
    { icon: 'book', tone: 'accent', text: t('onboarding.books', { value: counted(instead.books, 'bookWords') }) },
    { icon: 'run', tone: 'mint', text: t('onboarding.workouts', { value: counted(instead.workouts, 'workoutWords') }) },
    { icon: 'moon', tone: 'blue', text: t('onboarding.evenings', { value: counted(instead.evenings, 'eveningWords') }) },
  ];
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
  return <Screen glow={320} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('onboarding.resultCta')} arrow onPress={() => router.push('/onboarding/how-it-works')} />}>
    <OnboardingHeader step={6} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.insteadTitle')} /></View>
    <Animated.View entering={enter(200)} style={{ marginTop: 22 }}>
      <HeroCard style={{ alignItems: 'center', paddingVertical: 24 }}>
          <CountUp to={instead.hours} delay={300} duration={1200} format={(v) => formatInteger(v, locale)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: '#FFFFFF', fontSize: 60, lineHeight: 68, fontWeight: '800', letterSpacing: -2.5 }} />
        <Text style={{ color: c.onHero, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{unitFor(locale, hoursText, words('hourWords'))} {t('onboarding.insteadOnShort')}</Text>
      </HeroCard>
    </Animated.View>
    <View style={{ marginTop: 14, gap: 10 }}>
      {cards.map((card, i) => <Animated.View key={card.icon} entering={enter(420 + i * 120)}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
          <IconTile name={card.icon} tone={card.tone} size={44} />
          <Text style={{ flex: 1, color: c.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }}>{card.text}</Text>
        </Card>
      </Animated.View>)}
    </View>
  </Screen>;
}
