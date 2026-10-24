import { Text } from '../components/Typography';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FocusLogo } from '../components/FocusLogo';
import { Icon } from '../components/Icon';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/appStore';
import { useAccountStore } from '../store/accountStore';
import { entryDestination } from '../services/backend/accessPolicy';
import { useWellbeingStore } from '../store/wellbeingStore';
import { useAppTheme } from '../theme';
import { ActionButton, BackgroundGlow } from '../components/ui';
import { ScreenStatusBar } from '../components/ScreenStatusBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

/** Concentric ring that breathes like the design's `fu-pulse` keyframes (7s, opacity .55 → .25, scale 1 → 1.05). */
function PulseRing({ size, delay, restingOpacity }: { size: number; delay: number; restingOpacity: number }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) phase.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }), -1, true));
    return () => cancelAnimation(phase);
  }, [delay, phase, reducedMotion]);
  const style = useAnimatedStyle(() => reducedMotion
    ? { opacity: restingOpacity }
    : { opacity: 0.55 - phase.value * 0.3, transform: [{ scale: 1 + phase.value * 0.05 }] });
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 56 - size / 2, top: 56 - size / 2, width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: c.off }, style]} />;
}

export default function SplashScreen() {
  const { t, i18n } = useTranslation();
  const c = useAppTheme();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.selectedLanguage);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const account = useAccountStore();
  const completed = useAppStore((state) => state.onboardingCompleted);
  const destination = useWellbeingStore((state) => state.launchDestination);
  const [hydrated, setHydrated] = useState(useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated());

  useEffect(() => { void i18n.changeLanguage(language); }, [language, i18n]);
  useEffect(() => {
    const update = () => setHydrated(useAppStore.persist.hasHydrated() && useWellbeingStore.persist.hasHydrated());
    const a = useAppStore.persist.onFinishHydration(update);
    const b = useWellbeingStore.persist.onFinishHydration(update);
    update();
    return () => { a(); b(); };
  }, []);
  useEffect(() => {
    if (!hydrated || !account.ready) return;
    const target = entryDestination(account, completed, destination);
    if (target) router.replace(target);
  }, [account, completed, destination, hydrated]);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.bg }}>
      <ScreenStatusBar />
      <BackgroundGlow height={c.isDark ? 520 : 460} />

      {/* Logo, name and promise sit centred in the space above the buttons on every screen height. */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ width: 112, height: 112 }}>
          {c.logoHalo ? <View pointerEvents="none" style={{ position: 'absolute', left: -104, top: -104, width: 320, height: 320, borderRadius: 160, backgroundImage: c.logoHalo }} /> : null}
          <PulseRing size={168} delay={0} restingOpacity={0.55} />
          <PulseRing size={236} delay={1200} restingOpacity={0.4} />
          <PulseRing size={304} delay={2400} restingOpacity={0.28} />
          <FocusLogo size={112} />
        </View>
        <Text accessibilityRole="header" style={{ marginTop: 28, color: c.text, fontSize: 42, lineHeight: 48, fontWeight: '800', letterSpacing: -1.68, textAlign: 'center' }}>Focus<Text style={{ color: c.accent, fontWeight: '800' }}>Up</Text></Text>
        <Text style={{ marginTop: 12, maxWidth: 320, color: c.text, fontSize: 22, lineHeight: 30, fontWeight: '700', letterSpacing: -0.44, textAlign: 'center' }}>{t('tagline')}</Text>
        <View style={{ marginTop: 24, maxWidth: 320, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="shieldCheck" size={20} color={c.mint} strokeWidth={2} />
          <Text style={{ flexShrink: 1, color: c.text2, fontSize: 15, lineHeight: 22, fontWeight: '500', textAlign: 'center' }}>{t('promise')}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20, gap: 18, alignItems: 'stretch' }}>
        <ActionButton
          title={completed ? t('home') : t('start')}
          arrow
          onPress={() => { const target = entryDestination(account, completed, destination); router.push(target ?? '/onboarding'); }}
        />
        <View accessibilityRole="radiogroup" style={{ alignSelf: 'center', flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: c.seg }}>
          {(['uz', 'ru', 'en'] as const).map((lang) => {
            const selected = language === lang;
            return <Pressable
              key={lang}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => { void Haptics.selectionAsync(); setLanguage(lang); }}
              style={{ width: 54, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.segOn : 'transparent', boxShadow: selected ? c.segSh : undefined }}
            >
              <Text style={{ color: selected ? c.text : c.text2, fontSize: 13, fontWeight: selected ? '800' : '700', letterSpacing: 0.26 }}>{lang.toUpperCase()}</Text>
            </Pressable>;
          })}
        </View>
      </View>
    </View>
  );
}
