import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ui';
import { FocusLogo } from '../../components/FocusLogo';
import { accountApi, isBackendConfigured } from '../../services/backend/accountSession';
import { signInWithEmail, verifyEmailCode } from '../../services/backend/authentication';
import { EMAIL_PATTERN, useAuthAction, useAuthProviders, useFromOnboarding, useLeaveWhenSignedIn } from './components';
import { AuthBack, AuthFooter, AuthInlineError, AuthInput, AuthLayout, AuthSocialButtons, AuthTextLink, AuthTitle, AuthUnavailable } from './ui';

type Mode = 'signin' | 'forgot' | 'verifyRecovery';

/** "16 · Sign in" from the FocusUp design with Apple / Google / Telegram first and email below,
 * plus the password-recovery steps in the same visual language. */
export function SignInScreen() {
  const { t } = useTranslation();
  const fromOnboarding = useFromOnboarding();
  useLeaveWhenSignedIn(fromOnboarding);
  const { busy, error, setError, run } = useAuthAction();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);
  const social = useAuthProviders();
  const configured = isBackendConfigured();
  const changeMode = (next: Mode) => { setPassword(''); setCode(''); setError(null); setMode(next); };
  const trimmed = email.trim();
  const canSubmit = !busy && (mode === 'verifyRecovery' ? /^\d{6,10}$/.test(code.trim()) : trimmed.length > 0 && (mode !== 'signin' || password.length > 0));

  const submit = () => {
    if (!canSubmit) return;
    if (mode !== 'verifyRecovery' && !EMAIL_PATTERN.test(trimmed)) { setError(t('cloudAuth.emailInvalid')); return; }
    void run(async () => {
      if (mode === 'signin') { await signInWithEmail({ email: trimmed, password }); setPassword(''); }
      if (mode === 'forgot') { await accountApi().forgotPassword(trimmed); changeMode('verifyRecovery'); }
      // A verified recovery code signs in with recoveryRequired; the account screen then asks for a new password.
      if (mode === 'verifyRecovery') { await verifyEmailCode(trimmed, code.trim(), 'recovery'); setCode(''); }
    });
  };

  if (mode !== 'signin') {
    const forgot = mode === 'forgot';
    return <AuthLayout animationKey={mode}>
      <AuthBack onPress={() => changeMode('signin')} />
      <AuthTitle style={{ marginTop: 16 }} title={t(forgot ? 'cloudAuth.forgotPassword' : 'cloudAuth.verifyTitle')} subtitle={forgot ? t('cloudAuth.forgotSubtitle') : t('cloudAuth.verifyBody', { email: trimmed })} />
      <View style={{ marginTop: 24 }}>
        {forgot
          ? <AuthInput kind="email" label={t('cloudAuth.email')} placeholder="email@example.com" value={email} onChange={setEmail} disabled={busy} returnKeyType="go" onSubmitEditing={submit} />
          : <AuthInput kind="code" label={t('cloudAuth.code')} placeholder="123456" value={code} onChange={setCode} disabled={busy} returnKeyType="go" onSubmitEditing={submit} autoFocus />}
      </View>
      <AuthInlineError message={error} />
      <ActionButton style={{ marginTop: 20 }} title={t(busy ? 'cloudAuth.loading' : forgot ? 'cloudAuth.sendReset' : 'cloudAuth.verify')} disabled={!canSubmit} onPress={submit} />
      {!forgot ? <AuthTextLink style={{ marginTop: 8, alignSelf: 'center' }} disabled={busy} title={t('cloudAuth.resend')} onPress={() => { void run(async () => { await accountApi().forgotPassword(trimmed); setError(null); }); }} /> : null}
    </AuthLayout>;
  }

  return <AuthLayout
    animationKey={mode}
    footer={configured ? <AuthFooter disabled={busy} prompt={t('cloudAuth.noAccount')} action={t('cloudAuth.register')} onPress={() => router.replace({ pathname: '/auth/sign-up', params: fromOnboarding ? { from: 'onboarding' } : {} })} /> : null}
  >
    <View style={{ marginTop: 18, alignSelf: 'flex-start' }}><FocusLogo size={56} /></View>
    <AuthTitle style={{ marginTop: 22 }} title={t('cloudAuth.signInTitle')} subtitle={t('cloudAuth.signInSubtitle')} />
    {configured ? <>
      <AuthSocialButtons {...social} busy={busy} run={run} onUnavailable={setError} top={26} spacing={24} />
      <View style={{ marginTop: 24, gap: 12 }}>
        <AuthInput kind="email" label={t('cloudAuth.email')} placeholder="email@example.com" value={email} onChange={setEmail} disabled={busy} returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
        <AuthInput kind="password" inputRef={passwordRef} label={t('cloudAuth.password')} placeholder={t('cloudAuth.password')} value={password} onChange={setPassword} disabled={busy} returnKeyType="go" onSubmitEditing={submit} />
      </View>
      <AuthInlineError message={error} />
      <AuthTextLink style={{ marginTop: 6, alignSelf: 'flex-end' }} disabled={busy} title={t('cloudAuth.forgotPassword')} onPress={() => changeMode('forgot')} />
      <ActionButton style={{ marginTop: 2 }} title={t(busy ? 'cloudAuth.loading' : 'cloudAuth.signIn')} disabled={!canSubmit} onPress={submit} />
    </> : <AuthUnavailable />}
  </AuthLayout>;
}
