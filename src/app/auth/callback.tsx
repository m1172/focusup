import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActionButton, Heading, Screen } from '../../components/ui';
import { authRedirectUrl, oauthFlow } from '../../services/backend/authentication';
import { accountSession } from '../../services/backend/accountSession';
import { leaveAuth } from '../../features/auth/components';
import { useAppStore } from '../../store/appStore';

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string | string[]; error?: string | string[] }>();
  const code = typeof params.code === 'string' ? params.code : undefined;
  const error = typeof params.error === 'string' ? params.error : undefined;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    const url = new URL(authRedirectUrl());
    if (code) url.searchParams.set('code', code);
    if (error) url.searchParams.set('error', error);
    void accountSession.initialize().then(() => oauthFlow().complete(url.toString())).then(() => {
      if (!mounted) return;
      // Web OAuth reloads the app, so the onboarding step that started it is gone.
      if (useAppStore.getState().onboardingCompleted) router.replace('/account'); else leaveAuth(true);
    }).catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, [code, error]);
  return <Screen><Heading title={t('cloudAuth.title')} subtitle={t(failed ? 'cloudAuth.callbackFailed' : 'cloudAuth.loading')} />
    {failed ? <ActionButton title={t('cloudAuth.backToSignIn')} onPress={() => router.replace('/account')} /> : <ActivityIndicator accessibilityLabel={t('cloudAuth.loading')} />}
  </Screen>;
}
