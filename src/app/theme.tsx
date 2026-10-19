import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { BackButton, Heading, Screen } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { useAppTheme } from '../theme';

export default function ThemeScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const selected = useAppStore((s) => s.themeMode);
  const setTheme = useAppStore((s) => s.setTheme);
  return <Screen contentStyle={{ gap: 18 }}><BackButton label={t('back')} /><Heading title={t('theme')} subtitle={t('design.themeBody')} />
    <View accessibilityRole="radiogroup" style={{ gap: 12, marginTop: 4 }}>{([
      ['light', 'sunny-outline', t('ui.themeLightHint')], ['system', 'phone-portrait-outline', t('design.systemTheme')], ['dark', 'moon-outline', t('ui.themeDarkHint')],
    ] as const).map(([mode, icon, subtitle]) => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: selected === mode }} onPress={() => setTheme(mode)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 84, gap: 14, paddingHorizontal: 16, borderRadius: 24, backgroundColor: selected === mode ? c.primarySoft : c.surface, borderWidth: 1, borderColor: selected === mode ? c.primary + '66' : c.border }}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: mode === 'dark' ? '#242438' : mode === 'light' ? '#FFF7DE' : c.surfaceSecondary, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={26} color={mode === 'light' ? '#C79B15' : mode === 'dark' ? '#B6AFFE' : c.primary} /></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{t(mode)}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{subtitle}</Text></View><Ionicons name={selected === mode ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected === mode ? c.primary : c.faint} />
    </Pressable>)}</View>
    <View style={{ borderRadius: 22, padding: 16, flexDirection: 'row', gap: 12, backgroundColor: c.primarySoft, marginTop: 2 }}><Ionicons name="sparkles-outline" size={24} color={c.primary} /><View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>{t('design.systemRecommended')}</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{t('design.systemDetail')}</Text></View></View>
  </Screen>;
}
