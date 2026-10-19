import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { ActionButton, Screen } from '../../components/ui';
import { AnswerChips, OnboardingHeader, PoppingValue, RulerPicker, StepTitle } from '../../features/onboarding/components';
import { AGE_ANSWERS, LIFE_EXPECTANCY, MAX_AGE, MIN_AGE, answerFor, projectLifetime, unitFor } from '../../features/onboarding/lifeProjection';
import { useAppStore } from '../../store/appStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme';

export default function AgeScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const age = useOnboardingStore((s) => s.age);
  const setAge = useOnboardingStore((s) => s.setAge);
  const remaining = projectLifetime(60, age).remainingYears;
  const current = answerFor(age, AGE_ANSWERS);
  const options = AGE_ANSWERS.map((a, k) => ({ key: String(k), value: a.pick, selected: k === current, label: a.to === Infinity ? t('onboarding.rangeOver', { time: a.from }) : `${a.from}–${a.to - 1}` }));
  const yearsText = `${remaining} ${unitFor(locale, String(remaining), t('onboarding.yearWords', { returnObjects: true }) as string[])}`;
  return <Screen glow={300} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow onPress={() => router.push('/onboarding/reveal')} />}>
    <OnboardingHeader step={2} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.ageTitle')} body={t('onboarding.ageBody')} /></View>
    <View style={{ marginTop: 22 }}><AnswerChips options={options} onSelect={setAge} delay={180} /></View>
    <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(450).duration(600).easing(Easing.out(Easing.cubic))} style={{ marginTop: 26, alignItems: 'center' }}>
      <PoppingValue value={age}>
        <Text style={{ color: c.text, fontSize: 72, lineHeight: 80, fontWeight: '800', letterSpacing: -3.5, fontVariant: ['tabular-nums'] }}>{age}</Text>
      </PoppingValue>
      <View style={{ marginTop: 6, minHeight: 34, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 17, backgroundColor: c.soft }}>
        <Text style={{ color: c.ink, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center' }}>{t('onboarding.ageLive', { years: yearsText, age: LIFE_EXPECTANCY })}</Text>
      </View>
      <View style={{ marginTop: 18, alignSelf: 'stretch' }}>
        <RulerPicker
          min={MIN_AGE}
          max={MAX_AGE}
          step={1}
          value={age}
          onChange={setAge}
          isMajor={(v) => v % 5 === 0}
          majorLabel={String}
          accessibilityLabel={t('onboarding.ageTitle')}
          accessibilityValue={String(age)}
        />
      </View>
      <Text style={{ marginTop: 2, color: c.text3, fontSize: 12, fontWeight: '700' }}>{t('onboarding.fineTune')}</Text>
    </Animated.View>
  </Screen>;
}
