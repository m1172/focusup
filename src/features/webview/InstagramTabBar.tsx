import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { isDarkColor } from './BrowserTopStrip';

// Instagram's own tab icons (24×24), copied from instagram.com so the bar looks like theirs.
const HOME = 'm21.762 8.786-7-6.68C13.266.68 10.734.68 9.238 2.106l-7 6.681A4.017 4.017 0 0 0 1 11.68V20c0 1.654 1.346 3 3 3h5.005a1 1 0 0 0 1-1L10 15c0-1.103.897-2 2-2 1.09 0 1.98.877 2 1.962L13.999 22a1 1 0 0 0 1 1H20c1.654 0 3-1.346 3-3v-8.32a4.021 4.021 0 0 0-1.238-2.894ZM21 20a1 1 0 0 1-1 1h-4.001L16 15c0-2.206-1.794-4-4-4s-4 1.794-4 4l.005 6H4a1 1 0 0 1-1-1v-8.32c0-.543.226-1.07.62-1.447l7-6.68c.747-.714 2.013-.714 2.76 0l7 6.68c.394.376.62.904.62 1.448V20Z';
const SEARCH = 'M19 10.5A8.5 8.5 0 1 1 10.5 2a8.5 8.5 0 0 1 8.5 8.5Z';
/** The filled paper plane Instagram shows while Messages is the open tab. */
const MESSAGES = 'M22.513 3.576C21.826 2.552 20.617 2 19.384 2H4.621c-1.474 0-2.878.818-3.46 2.173-.6 1.398-.297 2.935.784 3.997l3.359 3.295a1 1 0 0 0 1.195.156l8.522-4.849a1 1 0 1 1 .988 1.738l-8.526 4.851a1 1 0 0 0-.477 1.104l1.218 5.038c.343 1.418 1.487 2.534 2.927 2.766.208.034.412.051.616.051 1.26 0 2.401-.644 3.066-1.763l7.796-13.118a3.572 3.572 0 0 0-.116-3.863Z';

function TabIcon({ name, color }: { name: 'home' | 'search' | 'messages'; color: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24">
    {name === 'home' ? <Path d={HOME} fill={color} /> : null}
    {name === 'messages' ? <Path d={MESSAGES} fill={color} /> : null}
    {name === 'search' ? <>
      <Path d={SEARCH} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={16.511} y1={16.511} x2={22} y2={22} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </> : null}
  </Svg>;
}

/**
 * Instagram's website hides its bottom tab bar on the Messages list, which leaves no way to the other tabs.
 * This bar takes its place there, in the page's colors, with Messages selected.
 */
export function InstagramTabBar({ background, avatar, onHome, onSearch, onProfile }: {
  background: string; avatar: string; onHome: () => void; onSearch: () => void; onProfile: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dark = isDarkColor(background);
  const color = dark ? '#F5F5F5' : '#0C1014';
  const tabs = [
    { key: 'home' as const, label: t('browser.tabHome'), onPress: onHome },
    { key: 'search' as const, label: t('browser.tabSearch'), onPress: onSearch },
    { key: 'messages' as const, label: t('browser.tabMessages'), onPress: undefined },
  ];
  return <View accessibilityRole="tabbar" style={[styles.bar, { paddingBottom: insets.bottom, backgroundColor: background, borderTopColor: dark ? '#262626' : '#DBDBDB' }]}>
    {tabs.map((tab) => <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: !tab.onPress }}
      onPress={tab.onPress} disabled={!tab.onPress} style={({ pressed }) => [styles.tab, pressed && { opacity: 0.5 }]}>
      <TabIcon name={tab.key} color={color} />
    </Pressable>)}
    <Pressable accessibilityRole="tab" accessibilityLabel={t('browser.tabProfile')} accessibilityState={{ selected: false }} onPress={onProfile}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.5 }]}>
      {avatar
        ? <Image source={{ uri: avatar }} style={[styles.avatar, { borderColor: dark ? '#FFFFFF26' : '#00000017' }]} accessibilityIgnoresInvertColors />
        : <View style={[styles.avatar, { backgroundColor: dark ? '#363636' : '#EFEFEF', borderColor: 'transparent' }]} />}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
});
