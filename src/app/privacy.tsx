import { Text } from '../components/Typography';
import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton, ActionButton, Card, Heading, Screen } from '../components/ui';
import { useAppTheme } from '../theme';
import { clearFocusUpData } from '../services/privacy/clearFocusUpData';

export default function PrivacyScreen() {
  const { t } = useTranslation(); const c = useAppTheme(); const [busy, setBusy] = useState(false);
  const confirm = () => Alert.alert(t('wellbeing.clearConfirm'), t('wellbeing.clearDescription'), [{ text: t('cancel'), style: 'cancel' }, { text: t('wellbeing.clearAction'), style: 'destructive', onPress: () => { setBusy(true); void clearFocusUpData().then(({ browserDataCleared }) => { if (!browserDataCleared) Alert.alert(t('wellbeing.clearData'), t('wellbeing.clearPartial')); router.dismissAll(); router.replace('/'); }).catch(() => Alert.alert(t('wellbeing.clearData'), t('wellbeing.clearFailed'))).finally(() => setBusy(false)); } }]);
  return <Screen><BackButton label={t('back')} /><Heading title={t('privacy')} /><Card><Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }}>{t('wellbeing.faqPrivacyAnswer')}</Text></Card><Card><Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }}>{t('wellbeing.faqNativeAnswer')}</Text></Card><Card><Heading size="card" title={t('wellbeing.clearData')} /><Text style={{ color: c.muted, lineHeight: 21 }}>{t('wellbeing.clearDescription')}</Text><ActionButton secondary disabled={busy} title={t('wellbeing.clearData')} onPress={confirm} /></Card></Screen>;
}
