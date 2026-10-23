import { useRef, useState, type PropsWithChildren, type ReactNode, type RefObject } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View, type ReturnKeyTypeOptions, type StyleProp, type TextInputInstance, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Trans, useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { BackButton, BackgroundGlow } from '../../components/ui';
import { ScreenStatusBar } from '../../components/ScreenStatusBar';
import { useAppTheme } from '../../theme';
import { signInWithApple, signInWithProvider } from '../../services/backend/authentication';
import type { OAuthProvider } from '../../services/backend/types';
import { getConfiguredLegalUrl, SUBSCRIPTION_PRIVACY_URL, SUBSCRIPTION_TERMS_URL } from '../../services/subscription/subscriptionConfig';
import { BrandLogo } from './BrandLogo';
import { AuthError, MIN_PASSWORD_LENGTH, useAuthProviders } from './components';
import { PostHogMaskView } from 'posthog-react-native';

/*
 * Building blocks for the "16 · Sign in" and "17 · Register" designs.
 * Measurements are taken 1:1 from the light/dark canvases (390×844 frame, 54px status bar,
 * 34px home indicator), so offsets below are expressed relative to the safe area.
 */

/** Page shell: 380px radial glow, 24px gutters, footer 8px above the home indicator. */
export function AuthLayout({ children, footer, animationKey }: PropsWithChildren<{ footer?: ReactNode; animationKey?: string }>) {
  const c = useAppTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const entering = reducedMotion ? undefined : FadeInDown.duration(280).easing(Easing.out(Easing.cubic));
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
    <ScreenStatusBar />
    <BackgroundGlow height={380} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      >
        <Animated.View key={animationKey} entering={entering}>{children}</Animated.View>
        {footer ? <View style={{ marginTop: 'auto', paddingTop: 24 }}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** 44pt circular back button, 10px below the status bar. */
export function AuthBack({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  return <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><BackButton label={t('back')} onPress={onPress} /></View>;
}

/** 32/38 extra-bold title with a 16/24 secondary line. */
export function AuthTitle({ title, subtitle, style }: { title: string; subtitle?: string; style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme();
  return <View style={style}>
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.12 }}>{title}</Text>
    {subtitle ? <Text style={{ marginTop: 6, color: c.text2, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>{subtitle}</Text> : null}
  </View>;
}

type InputKind = 'email' | 'password' | 'newPassword' | 'code';

/** 60pt card field with the label inside it; focused fields get a 2px accent ring. */
export function AuthInput({ label, value, onChange, kind, placeholder, disabled = false, returnKeyType, onSubmitEditing, inputRef, autoFocus }: {
  label: string; value: string; onChange: (text: string) => void; kind: InputKind; placeholder?: string; disabled?: boolean;
  returnKeyType?: ReturnKeyTypeOptions; onSubmitEditing?: () => void; inputRef?: RefObject<TextInputInstance | null>; autoFocus?: boolean;
}) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const ownRef = useRef<TextInputInstance>(null);
  const ref = inputRef ?? ownRef;
  const [focused, setFocused] = useState(false), [visible, setVisible] = useState(false);
  const secret = kind === 'password' || kind === 'newPassword';
  const keepKeyboard = returnKeyType === 'next';
  return <Pressable
    accessible={false} onPress={() => ref.current?.focus()}
    style={{ height: 60, paddingTop: 9, paddingLeft: 16, paddingRight: secret ? 56 : 16, borderRadius: 18, backgroundColor: c.card, boxShadow: focused ? `0px 0px 0px 2px ${c.accent}` : c.sh, opacity: disabled ? 0.6 : 1 }}
  >
    <Text style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '700' }}>{label}</Text>
    <PostHogMaskView><TextInput
      ref={ref} accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} autoFocus={autoFocus}
      placeholder={placeholder} placeholderTextColor={c.text3} selectionColor={c.accent}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      secureTextEntry={secret && !visible} autoCapitalize="none" autoCorrect={false} spellCheck={false}
      keyboardType={kind === 'email' ? 'email-address' : kind === 'code' ? 'number-pad' : 'default'}
      autoComplete={kind === 'email' ? 'email' : kind === 'code' ? 'one-time-code' : kind === 'newPassword' ? 'new-password' : 'current-password'}
      textContentType={kind === 'email' ? 'emailAddress' : kind === 'code' ? 'oneTimeCode' : kind === 'newPassword' ? 'newPassword' : 'password'}
      maxLength={kind === 'email' ? 254 : kind === 'code' ? 10 : 128}
      returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} submitBehavior={keepKeyboard ? 'submit' : 'blurAndSubmit'}
      style={{ height: 28, padding: 0, margin: 0, color: c.text, fontSize: 16, fontFamily: 'Manrope-600', includeFontPadding: false }}
    /></PostHogMaskView>
    {secret ? <Pressable
      accessibilityRole="button" accessibilityLabel={t(visible ? 'cloudAuth.hidePasswordLabel' : 'cloudAuth.showPasswordLabel')} accessibilityState={{ selected: visible }}
      onPress={() => setVisible((shown) => !shown)}
      style={({ pressed }) => ({ position: 'absolute', right: 6, top: 8, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={visible ? 'eyeOff' : 'eye'} size={22} color={c.text2} />
    </Pressable> : null}
  </Pressable>;
}

/** 0 = empty, 1 = shorter than the minimum, 2–4 = fair / good / strong. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  if (password.length < MIN_PASSWORD_LENGTH) return 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  return Math.min(4, 2 + (classes >= 3 ? 1 : 0) + (classes === 4 || password.length >= 16 ? 1 : 0)) as 2 | 3 | 4;
}

const strengthLabel = ['', 'cloudAuth.strengthWeak', 'cloudAuth.strengthFair', 'cloudAuth.strengthGood', 'cloudAuth.strengthStrong'] as const;

/** Four-segment meter plus the "At least 12 characters" requirement row. */
export function PasswordStrength({ password }: { password: string }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const score = passwordStrength(password);
  const met = password.length >= MIN_PASSWORD_LENGTH;
  const bar = [c.off, c.red, c.amber, c.blue, c.mint][score];
  const label = [c.text2, c.red, c.amber, c.blue, c.mintInk][score];
  return <View style={{ marginTop: 14 }} accessible accessibilityLabel={`${t('cloudAuth.passwordMin')}${score ? `, ${t(strengthLabel[score])}` : ''}`}>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4].map((segment) => <View key={segment} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: segment <= score ? bar : c.off }} />)}
    </View>
    <View style={{ marginTop: 10, minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: met ? c.mintSoft : 'transparent', borderWidth: met ? 0 : 1.5, borderColor: c.off }}>
        {met ? <Icon name="check" size={11} color={c.mintInk} strokeWidth={3.4} /> : null}
      </View>
      <Text style={{ flex: 1, color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{t('cloudAuth.passwordMin')}</Text>
      {score ? <Text style={{ color: label, fontSize: 13, lineHeight: 18, fontWeight: '800' }}>{t(strengthLabel[score])}</Text> : null}
    </View>
  </View>;
}

/** Inline ink-coloured text button with a 44pt touch target ("Forgot password?"). */
export function AuthTextLink({ title, onPress, disabled, style }: { title: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [{ height: 44, paddingHorizontal: 2, justifyContent: 'center', opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }, style]}>
    <Text style={{ color: c.ink, fontSize: 14, fontWeight: '700' }}>{title}</Text>
  </Pressable>;
}

/** "Don't have an account? Sign up" footer. */
export function AuthFooter({ prompt, action, onPress, disabled }: { prompt: string; action: string; onPress: () => void; disabled?: boolean }) {
  const c = useAppTheme();
  return <View style={{ minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <Text style={{ color: c.text2, fontSize: 15, fontWeight: '600' }}>{prompt}</Text>
    <Pressable accessibilityRole="link" disabled={disabled} onPress={onPress} style={({ pressed }) => ({ height: 44, paddingHorizontal: 2, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c.ink, fontSize: 15, fontWeight: '800' }}>{action}</Text>
    </Pressable>
  </View>;
}

export function AuthInlineError({ message }: { message: string | null }) {
  return message ? <View style={{ marginTop: 12 }}><AuthError message={message} /></View> : null;
}

/** Shown in place of the form when the build has no backend configured. */
export function AuthUnavailable() {
  const c = useAppTheme();
  const { t } = useTranslation();
  return <View style={{ marginTop: 26, padding: 18, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
    <Text style={{ color: c.text2, fontSize: 15, lineHeight: 22 }}>{t('cloudAuth.unavailable')}</Text>
  </View>;
}

/** "By continuing, you agree to the Terms of Use and Privacy Policy." */
export function AuthLegal({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme();
  const termsUrl = getConfiguredLegalUrl(SUBSCRIPTION_TERMS_URL), privacyUrl = getConfiguredLegalUrl(SUBSCRIPTION_PRIVACY_URL);
  const link = (url: string | null, fallback?: () => void) => {
    const onPress = url ? () => { void Linking.openURL(url); } : fallback;
    return <Text accessibilityRole={onPress ? 'link' : undefined} onPress={onPress} style={{ color: c.ink, fontWeight: '800' }} />;
  };
  return <View style={style}>
    <Text style={{ textAlign: 'center', color: c.text2, fontSize: 12, lineHeight: 17, fontWeight: '600' }}>
      <Trans i18nKey="cloudAuth.agreeTerms" components={{ terms: link(termsUrl), privacy: link(privacyUrl, () => router.push('/privacy')) }} />
    </Text>
  </View>;
}

/** Hairline divider with a centred "or". */
function AuthDivider({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  return <View style={[{ height: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
    <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
    <Text style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{t('cloudAuth.or')}</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
  </View>;
}

function TelegramMark({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="4.35 5.95 14 14" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Path fill={color} d="M5.43 11.87l11.57-4.46c.54-.2 1.01.13.83.94l-1.97 9.28c-.15.66-.54.82-1.09.51l-3-2.21-1.45 1.39c-.16.16-.3.3-.6.3l.21-3.05 5.56-5.02c.24-.21-.05-.33-.38-.12l-6.87 4.33-2.96-.92c-.64-.2-.66-.64.14-.96z" />
  </Svg>;
}

const providerA11y = { apple: 'cloudAuth.continueApple', google: 'cloudAuth.continueGoogle', telegram: 'cloudAuth.continueTelegram' } as const;

function SocialButton({ provider, onPress, disabled, style }: { provider: OAuthProvider; onPress: () => void; disabled: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const apple = provider === 'apple';
  const tile = apple ? 'rgba(127,127,140,0.28)' : provider === 'google' ? c.blueSoft : c.apps.tiktok.bg;
  const mark = apple ? <BrandLogo provider="apple" size={15} color={c.appleFg} />
    : provider === 'google' ? <BrandLogo provider="google" size={15} color={c.blue} />
      : <TelegramMark size={15} color={c.apps.tiktok.ink} />;
  return <Pressable
    accessibilityRole="button" accessibilityLabel={t(providerA11y[provider])} accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => { void Haptics.selectionAsync(); onPress(); }}
    style={({ pressed }) => [{ height: 56, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: apple ? c.appleBg : c.card, boxShadow: apple ? undefined : c.sh, opacity: disabled ? 0.5 : pressed ? 0.86 : 1 }, style]}
  >
    <View style={{ width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: tile }}>{mark}</View>
    <Text numberOfLines={1} style={{ flexShrink: 1, color: apple ? c.appleFg : c.text, fontSize: 16, fontWeight: '700' }}>
      {apple ? t('cloudAuth.continueApple') : provider === 'google' ? 'Google' : 'Telegram'}
    </Text>
  </Pressable>;
}

const providerName = { apple: 'Apple', google: 'Google', telegram: 'Telegram' } as const;

/** Show only providers enabled by the backend. Email remains available when none are enabled. */
export function AuthSocialButtons({ providers, nativeApple, busy, run, onUnavailable, top, spacing }: ReturnType<typeof useAuthProviders> & {
  busy: boolean; run: (action: () => Promise<void>) => Promise<void>; onUnavailable: (message: string) => void; top: number; spacing: number;
}) {
  const { t } = useTranslation();
  const signIn = (provider: OAuthProvider) => {
    if (!providers.includes(provider)) { onUnavailable(t('cloudAuth.providerUnavailable', { provider: providerName[provider] })); return; }
    void run(() => provider === 'apple' && nativeApple ? signInWithApple() : signInWithProvider(provider));
  };
  if (!providers.length) return null;
  const secondary = (['google', 'telegram'] as const).filter((provider) => providers.includes(provider));
  return <>
    {providers.includes('apple') ? <SocialButton provider="apple" disabled={busy} onPress={() => signIn('apple')} style={{ marginTop: top }} /> : null}
    {secondary.length ? <View style={{ marginTop: providers.includes('apple') ? 12 : top, flexDirection: 'row', gap: 12 }}>
      {secondary.map((provider) => <SocialButton key={provider} provider={provider} disabled={busy} onPress={() => signIn(provider)} style={{ flex: 1 }} />)}
    </View> : null}
    <AuthDivider style={{ marginTop: spacing }} />
  </>;
}
