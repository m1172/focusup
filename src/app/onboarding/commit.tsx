import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import type { IconName } from '../../components/Icon';
import { ActionButton, Card, IconTile, Screen, type TileTone } from '../../components/ui';
import { OnboardingHeader, StepTitle } from '../../features/onboarding/components';
import { targetMinutes } from '../../features/onboarding/dayBudget';
import { CelebrationBurst, HoldCircle } from '../../features/protection/FrictionControls';
import { PRO_ENABLED } from '../../config/release';
import { useAppStore } from '../../store/appStore';
import { useAccountStore } from '../../store/accountStore';
import { totalMinutes, useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme';
import { formatDuration } from '../../utils/formatDuration';

/** Step 9: the plan in three lines, made official by holding the button. Sets the daily goal. */
export default function CommitScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const dailyMinutes = useOnboardingStore(totalMinutes);
  const cut = useOnboardingStore((s) => s.cut);
  const goals = useOnboardingStore((s) => s.goals);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const target = targetMinutes(dailyMinutes, cut);
  const goalText = goals.map((key) => t(`onboarding.goals.${key}`)).join(', ');
  const rows: { icon: IconName; tone: TileTone; text: string }[] = [
    { icon: 'clock', tone: 'accent', text: t('onboarding.commitLimit', { time: formatDuration(target, locale) }) },
    { icon: 'shieldCheck', tone: 'mint', text: t('onboarding.commitScroll') },
    { icon: 'target', tone: 'blue', text: goalText ? t('onboarding.commitGoals', { goals: goalText }) : t('onboarding.commitNoGoals') },
  ];
  const commit = () => {
    if (done) return;
    useAppStore.getState().setDailyGoal(target);
    useOnboardingStore.getState().commit(PRO_ENABLED);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBurst((n) => n + 1);
    setDone(true);
  };
  // The invite-code step is hidden for now; a signed-in user skips the account step too.
  const next = () => {
    if (!useAccountStore.getState().user) { router.push('/onboarding/account'); return; }
    useAppStore.getState().completeOnboarding();
    router.replace('/');
  };
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(500).easing(Easing.out(Easing.cubic)));
  return <Screen glow={360} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow disabled={!done} onPress={next} />}>
    <OnboardingHeader step={9} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.commitTitle')} body={t('onboarding.commitBody')} /></View>
    <Animated.View entering={enter(200)} style={{ marginTop: 22 }}>
      <Card style={{ paddingVertical: 8, gap: 0 }}>
        {rows.map((row, i) => <View key={row.icon} style={{ minHeight: 60, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
          <IconTile name={row.icon} tone={row.tone} size={36} />
          <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '700' }}>{row.text}</Text>
        </View>)}
      </Card>
    </Animated.View>
    <Animated.View entering={enter(420)} style={{ marginTop: 36, alignItems: 'center' }}>
      <HoldCircle label={t('onboarding.commitLabel')} holdingLabel={t('friction.holding')} doneLabel={t('onboarding.commitDone')} done={done} onDone={commit} />
      <CelebrationBurst trigger={burst} />
    </Animated.View>
  </Screen>;
}
