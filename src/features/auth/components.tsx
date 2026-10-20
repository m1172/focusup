import { leaveAuth } from './navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { useAppTheme } from '../../theme';
import { useAccountStore } from '../../store/accountStore';
import { accountApi, accountSession, isBackendConfigured } from '../../services/backend/accountSession';
import { signInWithApple, signInWithProvider } from '../../services/backend/authentication';
import type { OAuthProvider } from '../../services/backend/types';
import { accountErrorKey } from '../account/errors';
import { BrandLogo } from './BrandLogo';
import { PostHogMaskView } from 'posthog-react-native';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

/** Single-flight async action whose failure is shown inline instead of as an alert. */
export function useAuthAction() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const locked = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (failure) { const key = accountErrorKey(failure); if (key && mounted.current) setError(t(key)); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }, [t]);
  return { busy, error, setError, run };
}

/** Auth pages opened from the last onboarding step carry `?from=onboarding`. */
export function useFromOnboarding() {
  return useLocalSearchParams<{ from?: string }>().from === 'onboarding';
}

export { leaveAuth } from './navigation';
/** Any successful sign-in on an auth page (email, code, Apple, OAuth) leaves the page. */
export function useLeaveWhenSignedIn(fromOnboarding: boolean) {
  const user = useAccountStore((state) => state.user);
  useEffect(() => { void accountSession.initialize().catch(() => undefined); }, []);
  useEffect(() => { if (user) leaveAuth(fromOnboarding); }, [user, fromOnboarding]);
}

type FieldKind = 'text' | 'email' | 'password' | 'code';
export function AuthField({ label, value, onChange, kind = 'text', maxLength = 128, disabled = false, newPassword = false, onSubmit }: { label: string; value: string; onChange: (text: string) => void; kind?: FieldKind; maxLength?: number; disabled?: boolean; newPassword?: boolean; onSubmit?: () => void }) {
  const { t } = useTranslation(); const c = useAppTheme();
  const [hidden, setHidden] = useState(true);
  return <PostHogMaskView style={{ gap: 6 }}><Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card2, borderColor: c.border, borderWidth: 1, borderRadius: 14, minHeight: 52 }}>
      <TextInput
        accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={maxLength} autoCapitalize={kind === 'text' ? 'words' : 'none'} autoCorrect={false} editable={!disabled}
        secureTextEntry={kind === 'password' && hidden} keyboardType={kind === 'email' ? 'email-address' : kind === 'code' ? 'number-pad' : 'default'}
        autoComplete={kind === 'email' ? 'email' : kind === 'code' ? 'one-time-code' : kind === 'password' ? newPassword ? 'new-password' : 'current-password' : 'off'}
        textContentType={kind === 'email' ? 'emailAddress' : kind === 'code' ? 'oneTimeCode' : kind === 'password' ? newPassword ? 'newPassword' : 'password' : 'none'}
        returnKeyType={onSubmit ? 'go' : 'next'} onSubmitEditing={onSubmit}
        style={{ flex: 1, color: c.text, paddingHorizontal: 14, minHeight: 52, fontSize: 16 }}
      />
      {kind === 'password' ? <Pressable accessibilityRole="button" accessibilityLabel={t(hidden ? 'cloudAuth.showPassword' : 'cloudAuth.hidePassword')} hitSlop={8} onPress={() => setHidden((value) => !value)} style={{ paddingHorizontal: 14, minHeight: 52, justifyContent: 'center' }}>
        <Text style={{ color: c.ink, fontWeight: '700', fontSize: 14 }}>{t(hidden ? 'cloudAuth.showPassword' : 'cloudAuth.hidePassword')}</Text>
      </Pressable> : null}
    </View>
  </PostHogMaskView>;
}

export function AuthError({ message }: { message: string | null }) {
  const c = useAppTheme();
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: c.red, lineHeight: 22, fontWeight: '600' }}>{message}</Text> : null;
}

/** "Don't have an account? Create one" style footer link. */
export function SwitchAuthLink({ prompt, action, onPress, disabled }: { prompt: string; action: string; onPress: () => void; disabled?: boolean }) {
  const c = useAppTheme();
  return <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 6, minHeight: 44 }}>
    <Text style={{ color: c.text2, fontSize: 15, fontWeight: '500' }}>{prompt}</Text>
    <Pressable accessibilityRole="link" disabled={disabled} hitSlop={10} onPress={onPress}><Text style={{ color: c.ink, fontSize: 15, fontWeight: '800' }}>{action}</Text></Pressable>
  </View>;
}

/** Thin rule with a centred label: "──── or continue with ────". */
export function OrDivider({ label }: { label: string }) {
  const c = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: c.off }} />
    <Text style={{ color: c.text3, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: c.off }} />
  </View>;
}

/** OAuth providers enabled on the backend (AUTH_OAUTH_PROVIDERS), plus native Apple availability. */
export function useAuthProviders() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]), [nativeApple, setNativeApple] = useState(false);
  useEffect(() => {
    let mounted = true;
    if (isBackendConfigured()) void accountApi().getProviders().then((result) => { if (mounted) setProviders(result.oauth.filter((provider) => ['apple', 'google', 'telegram'].includes(provider))); }).catch(() => undefined);
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then((available) => { if (mounted) setNativeApple(available); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  // Apple only where the native sheet works: browser OAuth needs an Apple secret key the project doesn't configure.
  // Apple first, as on the platform sign-in sheets.
  return { providers: providers.filter((provider) => provider !== 'apple' || nativeApple).sort((a, b) => Number(b === 'apple') - Number(a === 'apple')), nativeApple };
}

const providerLabel = { apple: 'cloudAuth.continueApple', google: 'cloudAuth.continueGoogle', telegram: 'cloudAuth.continueTelegram' } as const;

/** Full-width 56pt button matching ActionButton's shape, with a brand mark on the left. */
export function ProviderButton({ provider, title, onPress, disabled }: { provider: OAuthProvider | 'email'; title: string; onPress: () => void; disabled?: boolean }) {
  const c = useAppTheme();
  // Apple's guidelines ask for a black (light UI) or white (dark UI) button.
  const apple = provider === 'apple';
  const background = apple ? c.isDark ? '#FFFFFF' : '#000000' : c.card;
  const color = apple ? c.isDark ? '#000000' : '#FFFFFF' : c.text;
  return <Pressable
    accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => { void Haptics.selectionAsync(); onPress(); }}
    style={({ pressed }) => ({ minHeight: 56, borderRadius: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: background, boxShadow: apple ? undefined : c.sh, borderWidth: !apple && c.isDark ? 1 : 0, borderColor: c.line, opacity: disabled ? 0.5 : pressed ? 0.86 : 1 })}
  >
    <View style={{ position: 'absolute', left: 20 }}>{provider === 'email' ? <Icon name="mail" size={22} color={c.ink} strokeWidth={2} /> : <BrandLogo provider={provider} size={provider === 'apple' ? 21 : 22} color={color} />}</View>
    <Text style={{ color, fontSize: 16, fontWeight: '700', letterSpacing: -0.16, paddingHorizontal: 28, textAlign: 'center' }}>{title}</Text>
  </Pressable>;
}

/** Social sign-in buttons. `after` runs once a provider signs in successfully (native flows only;
 * web OAuth redirects and finishes on /auth/callback). */
export function ProviderButtons({ providers, nativeApple, busy, run, after }: ReturnType<typeof useAuthProviders> & { busy: boolean; run: (action: () => Promise<void>) => Promise<void>; after?: () => void }) {
  const { t } = useTranslation(); const c = useAppTheme();
  const signIn = (action: () => Promise<void>) => { void run(async () => { await action(); if (accountSession.getState().user) after?.(); }); };
  return <>{providers.map((provider) => provider === 'apple' && nativeApple
    ? <View key="apple" pointerEvents={busy ? 'none' : 'auto'} accessibilityState={{ disabled: busy }} style={{ opacity: busy ? 0.5 : 1 }}><AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={c.isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={20} style={{ width: '100%', height: 56 }} onPress={() => signIn(signInWithApple)}
    /></View>
    : <ProviderButton key={provider} provider={provider} disabled={busy} title={t(providerLabel[provider])} onPress={() => signIn(() => signInWithProvider(provider))} />)}</>;
}

