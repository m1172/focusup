import { Pressable, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from './Typography';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../theme';

export type TabKey = 'home' | 'stats' | 'settings';
const tabs: { key: TabKey; href: '/(tabs)' | '/(tabs)/statistics' | '/(tabs)/settings'; icon: IconName }[] = [
  { key: 'home', href: '/(tabs)', icon: 'home' },
  { key: 'stats', href: '/(tabs)/statistics', icon: 'stats' },
  { key: 'settings', href: '/(tabs)/settings', icon: 'sliders' },
];

function activeFromPath(path: string): TabKey {
  if (path.startsWith('/statistics')) return 'stats';
  if (path.startsWith('/settings') || path.startsWith('/schedule')) return 'settings';
  return 'home';
}

/** Floating 68px tab bar from the design (each tab fills a full third of the bar, so a tap anywhere near an icon counts): 30px radius, 16px side inset, blurred surface. */
export function BottomNavigation({ active, onSelect }: { active?: TabKey; onSelect?: (key: TabKey) => void }) {
  const c = useAppTheme(); const insets = useSafeAreaInsets(); const { t } = useTranslation();
  const pathname = usePathname();
  const current = active ?? activeFromPath(pathname);
  return <View accessibilityRole="tablist" style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom - 8, 12), height: 68, borderRadius: 30, backgroundColor: c.nav, boxShadow: c.navSh, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 6, zIndex: 15 }}>
    {tabs.map((tab) => {
      const selected = tab.key === current;
      const color = selected ? c.ink : c.text2;
      return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={t(tab.key)} onPress={() => { void Haptics.selectionAsync(); if (onSelect) onSelect(tab.key); else router.navigate(tab.href); }} style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.soft : 'transparent' }}><Icon name={tab.icon} size={24} color={color} /></View>
        <Text style={{ color, fontSize: 11, fontWeight: selected ? '800' : '600' }}>{t(tab.key)}</Text>
      </Pressable>;
    })}
  </View>;
}
