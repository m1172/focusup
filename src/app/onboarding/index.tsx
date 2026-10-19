import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeInDown, ZoomIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, Screen } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useAppTheme } from '../../theme';
import { formatDuration } from '../../utils/formatDuration';
import type { SocialAppId } from '../../types/app';

const feed: SocialAppId[] = ['instagram', 'tiktok', 'youtube', 'instagram', 'tiktok', 'youtube'];
const POST = 116;
const GAP = 10;

/** One fake post in the endless feed. */
function Post({ appId }: { appId: SocialAppId }) {
  const c = useAppTheme();
  const tint = c.apps[appId];
  return <View style={{ height: POST, borderRadius: 18, padding: 10, gap: 8, backgroundColor: c.card2 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <AppIcon appId={appId} size={22} />
      <View style={{ gap: 4 }}>
        <View style={{ width: 64, height: 6, borderRadius: 3, backgroundColor: c.off }} />
        <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.off, opacity: 0.6 }} />
      </View>
    </View>
    <View style={{ flex: 1, borderRadius: 12, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 0, height: 0, marginLeft: 4, borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 14, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: tint.ink, opacity: 0.7 }} />
    </View>
  </View>;
}

/** "Scrolling · 2h 47m" pill whose minutes keep running; isolated so ticks don't re-render the feed. */
function ScrollTimer() {
  const c = useAppTheme();
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.selectedLanguage);
  const reducedMotion = useReducedMotion();
  const blink = useSharedValue(1);
  const [minutes, setMinutes] = useState(reducedMotion ? 167 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    blink.value = withRepeat(withSequence(withTiming(0.25, { duration: 600 }), withTiming(1, { duration: 600 })), -1, false);
    const timer = setInterval(() => setMinutes((m) => (m >= 9 * 60 + 59 ? 0 : m + 1)), 70);
    return () => { cancelAnimation(blink); clearInterval(timer); };
  }, [blink, reducedMotion]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  return <View style={{ position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: c.redSoft, boxShadow: c.isDark ? '0px 0px 0px 1px rgba(255,107,117,0.25)' : undefined }}>
    <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.red }, dotStyle]} />
    <Text numberOfLines={1} style={{ color: c.red, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{t('onboarding.scrolling')} · {formatDuration(minutes, locale)}</Text>
  </View>;
}

/** Phone mockup with a feed that never ends, and a timer that keeps eating minutes. */
function EndlessPhone({ height }: { height: number }) {
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const loop = feed.length * (POST + GAP);
  const y = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) y.value = withRepeat(withTiming(-loop, { duration: 14000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(y);
  }, [loop, reducedMotion, y]);
  const feedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const width = Math.round(height * 0.62);
  return <View style={{ width, height, borderRadius: 38, padding: 8, backgroundColor: c.card, boxShadow: c.isDark ? c.heroSh : c.navSh }}>
    <View style={{ flex: 1, borderRadius: 30, overflow: 'hidden', backgroundColor: c.bg }}>
      <Animated.View style={[{ padding: 10, gap: GAP }, feedStyle]}>
        {[...feed, ...feed, ...feed].map((id, i) => <Post key={i} appId={id} />)}
      </Animated.View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 46, backgroundImage: `linear-gradient(180deg, ${c.bg}, ${c.bg}00)` }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, backgroundImage: `linear-gradient(0deg, ${c.bg}, ${c.bg}00)` }} />
      <View style={{ position: 'absolute', top: 10, alignSelf: 'center', width: 64, height: 18, borderRadius: 9, backgroundColor: c.island }} />
      <ScrollTimer />
    </View>
  </View>;
}

/** App icon that pops in, then bobs gently forever. */
function FloatingIcon({ appId, delay, style }: { appId: SocialAppId; delay: number; style: object }) {
  const reducedMotion = useReducedMotion();
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!reducedMotion) bob.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(bob);
  }, [bob, delay, reducedMotion]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * bob.value }, { rotate: `${(bob.value - 0.5) * 8}deg` }] }));
  return <Animated.View entering={reducedMotion ? undefined : ZoomIn.delay(400 + delay).springify().damping(12)} style={[{ position: 'absolute' }, style]}>
    <Animated.View style={anim}><AppIcon appId={appId} size={50} /></Animated.View>
  </Animated.View>;
}

export default function OnboardingHookScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const phoneHeight = Math.round(Math.min(330, Math.max(230, height * 0.36)));
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(550).easing(Easing.out(Easing.cubic)));
  return <Screen glow={460} contentStyle={{ gap: 0 }} footer={<Animated.View entering={enter(700)}><ActionButton title={t('onboarding.hookCta')} arrow onPress={() => router.push('/onboarding/your-time')} /></Animated.View>}>
    <View style={{ marginTop: 18, height: phoneHeight + 20, alignItems: 'center', justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ position: 'absolute', width: phoneHeight * 1.3, height: phoneHeight * 1.3, borderRadius: phoneHeight, backgroundImage: c.lockHalo }} />
      <Animated.View entering={reducedMotion ? undefined : ZoomIn.duration(600).easing(Easing.out(Easing.back(1.4)))}><EndlessPhone height={phoneHeight} /></Animated.View>
      <FloatingIcon appId="instagram" delay={0} style={{ left: 6, top: phoneHeight * 0.14 }} />
      <FloatingIcon appId="tiktok" delay={400} style={{ right: 4, top: phoneHeight * 0.06 }} />
      <FloatingIcon appId="youtube" delay={800} style={{ right: 10, top: phoneHeight * 0.64 }} />
    </View>
    <Animated.View entering={enter(250)} style={{ marginTop: 28, alignSelf: 'flex-start', height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center', backgroundColor: c.soft }}>
      <Text style={{ color: c.ink, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 }}>{t('onboarding.hookEyebrow')}</Text>
    </Animated.View>
    <Animated.View entering={enter(350)}><Text accessibilityRole="header" style={{ marginTop: 14, color: c.text, fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1.2 }}>{t('onboarding.hookTitle')}</Text></Animated.View>
    <Animated.View entering={enter(480)}><Text style={{ marginTop: 12, color: c.text2, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>{t('onboarding.hookBody')}</Text></Animated.View>
  </Screen>;
}
