import { useState } from 'react';
import { router } from 'expo-router';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { ActionButton, Screen } from '../../components/ui';
import { OnboardingHeader, StepTitle } from '../../features/onboarding/components';
import { cleanReferralCode } from '../../features/onboarding/referral';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAppTheme } from '../../theme';

/**
 * Step 10: an optional invite code. It stays on this device and goes out only as the `referral_code`
 * property of the `onboarding_completed` analytics event; there is no backend reward yet.
 */
export default function ReferralScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [code, setCode] = useState(useOnboardingStore.getState().referralCode);
  const [focused, setFocused] = useState(false);
  const next = (value: string) => {
    useOnboardingStore.getState().setReferralCode(value);
    // A returning user who is already signed in skips the account step.
    if (!useAccountStore.getState().user) { router.push('/onboarding/account'); return; }
    useAppStore.getState().completeOnboarding();
    router.replace('/');
  };
  const footer = <View style={{ gap: 6 }}>
    <ActionButton title={t('continue')} arrow disabled={!code} onPress={() => next(code)} />
    <ActionButton ghost title={t('onboarding.referralSkip')} onPress={() => next('')} />
  </View>;
  return <Screen glow={320} contentStyle={{ gap: 0 }} footer={footer}>
    <OnboardingHeader step={10} />
    <View style={{ marginTop: 24 }}><StepTitle title={t('onboarding.referralTitle')} body={t('onboarding.referralBody')} /></View>
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(500).easing(Easing.out(Easing.cubic))} style={{ marginTop: 26, gap: 8 }}>
      <Text style={{ color: c.text2, fontSize: 13, fontWeight: '700' }}>{t('onboarding.referralLabel')}</Text>
      <TextInput
        accessibilityLabel={t('onboarding.referralLabel')}
        value={code}
        onChangeText={(text) => setCode(cleanReferralCode(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t('onboarding.referralPlaceholder')}
        placeholderTextColor={c.text3}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={24}
        returnKeyType="done"
        onSubmitEditing={() => { if (code) next(code); }}
        style={{ height: 58, paddingHorizontal: 18, borderRadius: 18, backgroundColor: c.card, borderWidth: 1.5, borderColor: focused ? c.accent : c.line, boxShadow: c.sh, color: c.text, fontSize: code ? 20 : 17, fontWeight: '800', letterSpacing: code ? 2 : 0, fontFamily: 'Manrope-800' }}
      />
    </Animated.View>
  </Screen>;
}
