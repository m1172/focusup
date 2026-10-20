import { router } from 'expo-router';
import { AVAILABLE_APPS } from '../../features/apps/catalog';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { AppRow } from '../../components/AppRow';
import { ActionButton, Screen } from '../../components/ui';
import { OnboardingHeader } from '../../features/onboarding/components';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';

const apps = AVAILABLE_APPS;
export default function ChooseAppsScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const complete = useAppStore((s) => s.completeOnboarding);
  const signedIn = useAccountStore((s) => Boolean(s.user));
  // Every new user must authenticate, including builds without cloud configuration.
  const next = () => {
    if (!signedIn) { router.push('/onboarding/account'); return; }
    complete(); router.replace('/');
  };
  return <Screen glow={300} glowDarkOnly contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow onPress={next} />}>
    <OnboardingHeader step={5} />
    <Text accessibilityRole="header" style={{ marginTop: 24, color: c.text, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.9 }}>{t('chooseApps')}</Text>
    <View style={{ marginTop: 32, gap: 10 }}>{apps.map((appId) => <AppRow key={appId} appId={appId} selectable />)}</View>
  </Screen>;
}
