import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton, Screen } from '../../components/ui';
import { AnswerChips, OnboardingHeader, StepTitle } from '../../features/onboarding/components';
import { toggleAnswer, useOnboardingStore } from '../../store/onboardingStore';

const GOALS = ['family', 'sleep', 'reading', 'sport', 'learning', 'calm'] as const;

/** Step 8: what the freed-up time is for. Multiple choice; shown back on the commit step. */
export default function GoalsScreen() {
  const { t } = useTranslation();
  const goals = useOnboardingStore((s) => s.goals);
  const options = GOALS.map((key, i) => ({ key, value: i, label: t(`onboarding.goals.${key}`), selected: goals.includes(key) }));
  return <Screen glow={300} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow disabled={!goals.length} onPress={() => router.push('/onboarding/commit')} />}>
    <OnboardingHeader step={8} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.goalsTitle')} body={t('onboarding.goalsBody')} /></View>
    <View style={{ marginTop: 22 }}>
      <AnswerChips columns={2} multiple delay={180} options={options} onSelect={(i) => useOnboardingStore.getState().setGoals(toggleAnswer(goals, GOALS[i]))} />
    </View>
  </Screen>;
}
