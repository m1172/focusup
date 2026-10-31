import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { FocusLogo } from '../../components/FocusLogo';
import { Screen } from '../../components/ui';
import { OnboardingHeader, StepTitle } from '../../features/onboarding/components';
import { AuthError, OrDivider, ProviderButton, ProviderButtons, SwitchAuthLink, useAuthAction, useAuthProviders, useLeaveWhenSignedIn } from '../../features/auth/components';
import { AuthUnavailable } from '../../features/auth/ui';
import { isBackendConfigured } from '../../services/backend/accountSession';
import { useAppTheme } from '../../theme';

/** Last onboarding step: offer every sign-up method the backend enables, require an account. */
export default function OnboardingAccountScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  useLeaveWhenSignedIn(true);
  const available = useAuthProviders();
  const { busy, error, run } = useAuthAction();
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(450).easing(Easing.out(Easing.cubic)));
  const openAuth = (pathname: '/auth/sign-up' | '/auth/sign-in') => router.push({ pathname, params: { from: 'onboarding' } });

  return <Screen glow={420} contentStyle={{ gap: 0, flexGrow: 1 }}>
    <OnboardingHeader step={10} />
    <Animated.View entering={enter(0)} style={{ marginTop: 28, alignItems: 'center' }}>
      <View style={{ width: 76, height: 76 }}>
        {c.logoHalo ? <View pointerEvents="none" style={{ position: 'absolute', left: -62, top: -62, width: 200, height: 200, borderRadius: 100, backgroundImage: c.logoHalo }} /> : null}
        <FocusLogo size={76} />
      </View>
    </Animated.View>
    <View style={{ marginTop: 24 }}><StepTitle title={t('cloudAuth.onboardingTitle')} body={t('cloudAuth.onboardingBody')} delay={80} /></View>

    <View style={{ flex: 1, minHeight: 28 }} />

    <Animated.View entering={enter(380)} style={{ gap: 12 }}>
      {!isBackendConfigured() ? <AuthUnavailable /> : null}
      <ProviderButtons {...available} busy={busy} run={run} />
      {available.providers.length ? <OrDivider label={t('cloudAuth.or')} /> : null}
      <ProviderButton provider="email" disabled={busy} title={t('cloudAuth.continueEmail')} onPress={() => openAuth('/auth/sign-up')} />
      <AuthError message={error} />
      <SwitchAuthLink disabled={busy} prompt={t('cloudAuth.haveAccount')} action={t('cloudAuth.signIn')} onPress={() => openAuth('/auth/sign-in')} />

    </Animated.View>
  </Screen>;
}
