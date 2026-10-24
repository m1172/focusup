import { PRO_ENABLED } from '../../config/release';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, Card, Screen } from '../../components/ui';
import { useAppTheme } from '../../theme';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { OnboardingHeader } from '../../features/onboarding/components';
import { useAccountStore } from '../../store/accountStore';
import { useAppStore } from '../../store/appStore';

/** Design uses 15px items (14/17 for the two-line one); long single words such as "Рекомендации" step down so they fit the column. */
function itemType(label: string, twoLine: boolean) {
  const longestWord = Math.max(...label.split(/\s+/).map((word) => word.length));
  if (longestWord > 10) return { fontSize: 13, lineHeight: 17 };
  return twoLine ? { fontSize: 14, lineHeight: 17 } : { fontSize: 15, lineHeight: 20 };
}

export default function HowItWorksScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const reducedMotion = useReducedMotion();
  const complete = useAppStore((s) => s.completeOnboarding);
  const signedIn = useAccountStore((s) => Boolean(s.user));
  // Apps start uncleaned; the user sets them up later under Protection. Every new user must sign in.
  const next = () => {
    if (!signedIn) { router.push('/onboarding/account'); return; }
    complete(); router.replace('/');
  };
  const enter = (delay: number) => (reducedMotion ? undefined : FadeInDown.delay(delay).duration(450).easing(Easing.out(Easing.cubic)));
  const columns = [
    { title: 'design.removed', color: c.red, dot: c.red, bg: c.redSoft, kind: 'x' as const, items: PRO_ENABLED ? ['reels', 'shorts', 'explore', 'ui.onboardingRecommendations'] : ['reels', 'shorts'] },
    { title: 'kept', color: c.mintInk, dot: c.mint, bg: c.mintSoft, kind: 'check' as const, items: ['messages', 'friends', 'profiles', 'regularVideos'] },
  ];
  return <Screen glow={380} contentStyle={{ gap: 0 }} footer={<ActionButton title={t('continue')} arrow onPress={next} />}>
    <OnboardingHeader step={4} />
    <Text accessibilityRole="header" style={{ marginTop: 24, color: c.text, fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1.33 }}>{t('design.onboardingTitle')}</Text>
    <Text style={{ marginTop: 12, maxWidth: 320, color: c.text2, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>{t('design.onboardingBody')}</Text>
    <View style={{ marginTop: 32, flexDirection: 'row', gap: 16 }}>
      {columns.map((column) => <Card key={column.title} style={{ flex: 1, minWidth: 0, padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 26 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: column.dot }} /><Text style={{ color: column.color, fontSize: 14, fontWeight: '800' }}>{t(column.title)}</Text></View>
        {column.items.map((key, i) => <Animated.View key={key} entering={enter(200 + i * 120 + (column.kind === 'x' ? 0 : 60))} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: column.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={column.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><Path d={column.kind === 'x' ? 'M6 6l12 12M18 6L6 18' : 'M5 12.5l4.5 4.5L19 7.5'} /></Svg>
          </View>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, color: c.text, fontWeight: '700', ...itemType(t(key), key === 'regularVideos') }}>{t(key)}</Text>
        </Animated.View>)}
      </Card>)}
    </View>
    <View style={{ marginTop: 38, flexDirection: 'row', justifyContent: 'center', gap: 18 }}>{(['instagram', 'youtube', 'tiktok'] as const).map((id, i) => <Animated.View key={id} entering={enter(800 + i * 120)}><AppIcon appId={id} size={52} /></Animated.View>)}</View>
  </Screen>;
}
