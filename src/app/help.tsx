import { Text } from '../components/Typography';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton, ActionButton, Card, Heading, Screen } from '../components/ui';
import { useAppTheme } from '../theme';
import { useRemoteBlockerConfigStore } from '../store/remoteBlockerConfigStore';

export default function HelpScreen() {
  const { t } = useTranslation(); const c = useAppTheme();
  const rules = useRemoteBlockerConfigStore((state) => state.config);
  const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';
  const contact = (report: boolean) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { Alert.alert(t('wellbeing.contact'), t('wellbeing.noContact')); return; }
    const body = report ? t('wellbeing.reportBody') : '';
    void Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(report ? 'FocusUp blocker issue' : 'FocusUp support')}&body=${encodeURIComponent(body)}`).catch(() => Alert.alert(t('wellbeing.contact'), t('wellbeing.failed')));
  };
  return <Screen><BackButton label={t('back')} /><Heading title={t('wellbeing.faq')} />{['Login', 'Native', 'Purchase', 'Privacy'].map((topic) => <Card key={topic}><Heading size="card" title={t(`wellbeing.faq${topic}`)} /><Text style={{ color: c.text, lineHeight: 23 }}>{t(`wellbeing.faq${topic}Answer`)}</Text></Card>)}<ActionButton secondary title={t('wellbeing.capabilities')} onPress={() => router.push('/capabilities')} /><ActionButton title={t('wellbeing.report')} onPress={() => contact(true)} /><ActionButton secondary title={t('wellbeing.contact')} onPress={() => contact(false)} /><Card><Text selectable style={{ color: c.muted, fontSize: 12 }}>FocusUp 1.0 · Instagram rules: {rules.platforms.instagram?.version ?? 'bundled'} · YouTube rules: {rules.platforms.youtube?.version ?? 'bundled'}</Text><Text style={{ color: c.muted, lineHeight: 20 }}>{t('wellbeing.reportBody')}</Text></Card></Screen>;
}
