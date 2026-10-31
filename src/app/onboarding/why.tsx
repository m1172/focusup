import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton, Screen } from '../../components/ui';
import { AnswerChips, OnboardingHeader, StepTitle } from '../../features/onboarding/components';
import { toggleAnswer, useOnboardingStore } from '../../store/onboardingStore';

const REASONS = ['messages', 'work', 'useful', 'news'] as const;

/** Step 3: one question, "why not just delete it?". Several answers allowed. */
export default function WhyScreen() {
  const { t } = useTranslation();
  const picked = useOnboardingStore((s) => s.reasons);
  const options = REASONS.map((key, i) => ({ key, value: i, label: t(`onboarding.reasons.${key}`), selected: picked.includes(key) }));
  return <Screen glow={300} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow disabled={!picked.length} onPress={() => router.push('/onboarding/life-weeks')} />}>
    <OnboardingHeader step={3} from={2} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.whyTitle')} body={t('onboarding.pickAll')} /></View>
    <View style={{ marginTop: 24 }}>
      <AnswerChips columns={1} multiple delay={180} options={options} onSelect={(i) => useOnboardingStore.getState().setReasons(toggleAnswer(picked, REASONS[i]))} />
    </View>
  </Screen>;
}
