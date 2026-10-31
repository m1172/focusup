import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { ActionButton, Screen } from '../../components/ui';
import { OnboardingHeader, StepTitle, WheelPicker } from '../../features/onboarding/components';
import { MAX_AGE, MIN_AGE, unitFor } from '../../features/onboarding/dayBudget';
import { useAppStore } from '../../store/appStore';
import { useOnboardingStore } from '../../store/onboardingStore';

const DEFAULT_AGE = 25;

/** Step 2: age, for the life-in-weeks grid. */
export default function AgeScreen() {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const saved = useOnboardingStore((s) => s.age);
  const [age, setAge] = useState(saved ?? DEFAULT_AGE);
  const words = t('onboarding.ageWords', { returnObjects: true }) as string[];
  const format = (value: number) => `${value} ${unitFor(locale, String(value), words)}`;
  const next = () => { useOnboardingStore.getState().setAge(age); router.push('/onboarding/why'); };
  return <Screen glow={300} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow onPress={next} />}>
    <OnboardingHeader step={2} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.ageTitle')} body={t('onboarding.ageBody')} /></View>
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(550).easing(Easing.out(Easing.cubic))} style={{ marginTop: 28 }}>
      <WheelPicker min={MIN_AGE} max={MAX_AGE} value={age} onChange={setAge} format={format} accessibilityLabel={t('onboarding.ageTitle')} />
    </Animated.View>
  </Screen>;
}
