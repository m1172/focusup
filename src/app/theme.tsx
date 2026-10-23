import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Text } from '../components/Typography';
import { Icon } from '../components/Icon';
import { Screen } from '../components/ui';
import { PageHeader } from '../features/settings/components';
import { useAppStore } from '../store/appStore';
import { palettes, useAppTheme } from '../theme';

type Mode = 'light' | 'system' | 'dark';

/** A tiny phone screen drawn in the theme's own colours; "system" shows both halves. */
function Preview({ mode }: { mode: Mode }) {
  const screen = (p: typeof palettes.light) => <View style={{ flex: 1, padding: 8, gap: 5, backgroundColor: p.bg }}>
    <View style={{ height: 18, borderRadius: 6, backgroundImage: p.hero }} />
    <View style={{ height: 10, borderRadius: 4, backgroundColor: p.card, boxShadow: p.sh }} />
    <View style={{ height: 10, width: '70%', borderRadius: 4, backgroundColor: p.card, boxShadow: p.sh }} />
  </View>;
  return <View style={{ height: 96, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(14,16,32,0.08)' }}>
    {mode === 'dark' ? screen(palettes.dark) : screen(palettes.light)}
    {mode === 'system' ? screen(palettes.dark) : null}
  </View>;
}

export default function ThemeScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const selected = useAppStore((s) => s.themeMode);
  const setTheme = useAppStore((s) => s.setTheme);
  const modes: Mode[] = ['light', 'system', 'dark'];
  return <Screen contentStyle={{ gap: 22 }}>
    <PageHeader icon="contrast" title={t('theme')} subtitle={t('settingsPages.themeSubtitle')} />
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
      {modes.map((mode) => {
        const on = selected === mode;
        return <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t(mode)} onPress={() => { void Haptics.selectionAsync(); setTheme(mode); }} style={({ pressed }) => ({ flex: 1, gap: 10, padding: 8, paddingBottom: 12, borderRadius: 22, borderWidth: 2, borderColor: on ? c.accent : 'transparent', backgroundColor: c.card, boxShadow: on ? undefined : c.sh, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <Preview mode={mode} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 0 : 2, borderColor: c.off, backgroundColor: on ? c.accent : 'transparent' }}>
              {on ? <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3.2} /> : null}
            </View>
            <Text numberOfLines={1} style={{ color: on ? c.ink : c.text, fontSize: 14, fontWeight: '800' }}>{t(mode)}</Text>
          </View>
        </Pressable>;
      })}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: c.soft }}>
      <Icon name="sparkles" size={18} color={c.ink} strokeWidth={2.1} />
      <Text style={{ flex: 1, color: c.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{t('settingsPages.themeHint')}</Text>
    </View>
  </Screen>;
}
