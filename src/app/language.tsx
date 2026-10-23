import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Text } from '../components/Typography';
import { Icon } from '../components/Icon';
import { Screen } from '../components/ui';
import { PageHeader } from '../features/settings/components';
import { useAppStore } from '../store/appStore';
import { useAppTheme } from '../theme';
import type { Locale } from '../types/app';

/** Each language in its own name, with the English name underneath for people who can't read the current one. */
const options: { id: Locale; label: string; english: string; code: string }[] = [
  { id: 'uz', label: 'O‘zbekcha', english: 'Uzbek', code: 'UZ' },
  { id: 'ru', label: 'Русский', english: 'Russian', code: 'RU' },
  { id: 'en', label: 'English', english: 'English', code: 'EN' },
];

export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const c = useAppTheme();
  const selected = useAppStore((state) => state.selectedLanguage);
  const setLanguage = useAppStore((state) => state.setLanguage);
  useEffect(() => { void i18n.changeLanguage(selected); }, [i18n, selected]);
  const choose = (id: Locale) => {
    void Haptics.selectionAsync();
    setLanguage(id);
    void i18n.changeLanguage(id);
    // A short pause so the new check mark is seen before going back.
    setTimeout(() => { if (router.canGoBack()) router.back(); }, 250);
  };
  return <Screen contentStyle={{ gap: 22 }}>
    <PageHeader icon="globe" tone="blue" title={t('language')} subtitle={t('settingsPages.languageSubtitle')} />
    <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
      {options.map((option) => {
        const on = selected === option.id;
        return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={option.label} onPress={() => choose(option.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingHorizontal: 16, borderRadius: 24, borderWidth: 2, borderColor: on ? c.accent : 'transparent', backgroundColor: on ? c.soft : c.card, boxShadow: on ? undefined : c.sh, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
          <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent : c.card2 }}>
            <Text style={{ color: on ? '#FFFFFF' : c.text2, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>{option.code}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800' }}>{option.label}</Text>
            <Text style={{ color: c.text3, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{option.english}</Text>
          </View>
          <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 0 : 2, borderColor: c.off, backgroundColor: on ? c.accent : 'transparent' }}>
            {on ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
        </Pressable>;
      })}
    </View>
  </Screen>;
}
