import { Text } from '../components/Typography';
import { Icon } from '../components/Icon';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton, Card, Heading, Screen, SettingRow } from '../components/ui';
import { useAppStore } from '../store/appStore';
import { useAppTheme } from '../theme';
import type { Locale } from '../types/app';

const options: { id: Locale; label: string; native: string }[] = [{ id:'uz', label:'O‘zbekcha', native:'UZ' }, { id:'ru', label:'Русский', native:'RU' }, { id:'en', label:'English', native:'EN' }];
export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const c = useAppTheme();
  const selected = useAppStore((state) => state.selectedLanguage);
  const setLanguage = useAppStore((state) => state.setLanguage);
  useEffect(() => { void i18n.changeLanguage(selected); }, [i18n, selected]);
  return <Screen><BackButton label={t('back')} /><Heading title={t('language')} /><Card style={{ paddingHorizontal: 12, paddingVertical: 4 }}>{options.map((option, index) => <SettingRow key={option.id} title={option.label} right={selected === option.id ? <Icon name="check" size={20} color={c.ink} strokeWidth={2.6} /> : <Text style={{ color: c.text3, fontSize: 13, fontWeight: '700' }}>{option.native}</Text>} onPress={() => { setLanguage(option.id); void i18n.changeLanguage(option.id); router.back(); }} last={index === options.length - 1} />)}</Card></Screen>;
}
