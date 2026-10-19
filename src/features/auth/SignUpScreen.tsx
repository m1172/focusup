import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ui';
import { accountApi, isBackendConfigured } from '../../services/backend/accountSession';
import { registerWithEmail, verifyEmailCode } from '../../services/backend/authentication';
import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH, useAuthAction, useAuthProviders, useFromOnboarding, useLeaveWhenSignedIn } from './components';
import { AuthBack, AuthFooter, AuthInlineError, AuthInput, AuthLayout, AuthLegal, AuthSocialButtons, AuthTextLink, AuthTitle, AuthUnavailable, PasswordStrength } from './ui';

/** "17 · Register" from the FocusUp design with Apple / Google / Telegram first and email below,
 * followed by the email-code step when confirmation is required. */
export function SignUpScreen() {
  const { t } = useTranslation();
  const fromOnboarding = useFromOnboarding();
  useLeaveWhenSignedIn(fromOnboarding);
  const { busy, error, setError, run } = useAuthAction();
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);
  const social = useAuthProviders();
  const configured = isBackendConfigured();
  const trimmed = email.trim();
  const canSubmit = !busy && (verifying ? /^\d{6,10}$/.test(code.trim()) : trimmed.length > 0 && password.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    if (!verifying) {
      if (!EMAIL_PATTERN.test(trimmed)) { setError(t('cloudAuth.emailInvalid')); return; }
      if (password.length < MIN_PASSWORD_LENGTH) { setError(t('cloudAuth.passwordHint')); return; }
    }
    void run(async () => {
      if (verifying) { await verifyEmailCode(trimmed, code.trim(), 'signup'); setCode(''); return; }
      // When email confirmation is disabled in Supabase a session comes back immediately.
      const confirmationRequired = await registerWithEmail({ email: trimmed, password });
      setPassword('');
      if (confirmationRequired) setVerifying(true);
    });
  };

  if (verifying) return <AuthLayout animationKey="verify">
    <AuthBack onPress={() => { setCode(''); setError(null); setVerifying(false); }} />
    <AuthTitle style={{ marginTop: 16 }} title={t('cloudAuth.verifyTitle')} subtitle={t('cloudAuth.verifyBody', { email: trimmed })} />
    <View style={{ marginTop: 24 }}>
      <AuthInput kind="code" label={t('cloudAuth.code')} placeholder="123456" value={code} onChange={setCode} disabled={busy} returnKeyType="go" onSubmitEditing={submit} autoFocus />
    </View>
    <AuthInlineError message={error} />
    <ActionButton style={{ marginTop: 20 }} title={t(busy ? 'cloudAuth.loading' : 'cloudAuth.verify')} disabled={!canSubmit} onPress={submit} />
    <AuthTextLink style={{ marginTop: 8, alignSelf: 'center' }} disabled={busy} title={t('cloudAuth.resend')} onPress={() => { void run(async () => { await accountApi().resendConfirmation(trimmed); }); }} />
  </AuthLayout>;

  return <AuthLayout
    animationKey="form"
    footer={configured ? <AuthFooter disabled={busy} prompt={t('cloudAuth.haveAccount')} action={t('cloudAuth.signIn')} onPress={() => router.replace({ pathname: '/auth/sign-in', params: fromOnboarding ? { from: 'onboarding' } : {} })} /> : null}
  >
    <AuthBack />
    <AuthTitle style={{ marginTop: 16 }} title={t('cloudAuth.signUpTitle')} subtitle={t('cloudAuth.signUpSubtitle')} />
    {configured ? <>
      <AuthSocialButtons {...social} busy={busy} run={run} onUnavailable={setError} top={24} spacing={18} />
      <View style={{ marginTop: 18, gap: 12 }}>
        <AuthInput kind="email" label={t('cloudAuth.email')} placeholder="email@example.com" value={email} onChange={setEmail} disabled={busy} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
        <AuthInput kind="newPassword" inputRef={passwordRef} label={t('cloudAuth.password')} placeholder={t('cloudAuth.passwordMin')} value={password} onChange={setPassword} disabled={busy} returnKeyType="go" onSubmitEditing={submit} />
      </View>
      <PasswordStrength password={password} />
      <AuthInlineError message={error} />
      <ActionButton style={{ marginTop: 20 }} title={t(busy ? 'cloudAuth.loading' : 'cloudAuth.register')} disabled={!canSubmit} onPress={submit} />
      <AuthLegal style={{ marginTop: 12 }} />
    </> : <AuthUnavailable />}
  </AuthLayout>;
}
