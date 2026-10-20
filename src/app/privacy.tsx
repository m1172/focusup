import { PRO_ENABLED } from '../config/release';
import { Text } from '../components/Typography';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BackButton, ActionButton, Card, Heading, Screen } from '../components/ui';
import { useAppTheme } from '../theme';
import { clearFocusUpData } from '../services/privacy/clearFocusUpData';
import { getAnalyticsConsent, initializeProductAnalytics, isProductAnalyticsConfigured, setAnalyticsConsent, subscribeAnalyticsConsent } from '../services/analytics/productAnalytics';

function TrackingPreference() {
  const { t } = useTranslation(); const c = useAppTheme();
  const enabled = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, () => false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { void initializeProductAnalytics(); }, []);
  return <Card><Heading size="card" title={t('observability.title')} />
    <Text style={{ color: c.text2, lineHeight: 22 }}>{t('observability.description')}</Text>
    {!isProductAnalyticsConfigured ? <Text style={{ color: c.text2, lineHeight: 22 }}>{t('observability.unavailable')}</Text> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 }}>
      <Text style={{ flex: 1, color: c.text, fontWeight: '600' }}>{t('observability.enabled')}</Text>
      <Switch accessibilityLabel={t('observability.enabled')} disabled={saving} value={enabled} onValueChange={(value) => {
        setSaving(true);
        void setAnalyticsConsent(value).catch(() => Alert.alert(t('privacy'), t('observability.saveFailed'))).finally(() => setSaving(false));
      }} />
    </View>
  </Card>;
}

export default function PrivacyScreen() {
  const { t } = useTranslation(); const c = useAppTheme(); const [busy, setBusy] = useState(false);
  const confirm = () => Alert.alert(t('wellbeing.clearConfirm'), t('wellbeing.clearDescription'), [{ text: t('cancel'), style: 'cancel' }, { text: t('wellbeing.clearAction'), style: 'destructive', onPress: () => { setBusy(true); void clearFocusUpData().then(({ browserDataCleared }) => { if (!browserDataCleared) Alert.alert(t('wellbeing.clearData'), t('wellbeing.clearPartial')); router.dismissAll(); router.replace('/'); }).catch(() => Alert.alert(t('wellbeing.clearData'), t('wellbeing.clearFailed'))).finally(() => setBusy(false)); } }]);
  return <Screen><BackButton label={t('back')} /><Heading title={t('privacy')} /><Card><Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }}>{t('wellbeing.faqPrivacyAnswer')}</Text></Card><TrackingPreference />{PRO_ENABLED ? <Card><Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }}>{t('wellbeing.faqNativeAnswer')}</Text></Card> : null}<Card><Heading size="card" title={t('wellbeing.clearData')} /><Text style={{ color: c.muted, lineHeight: 21 }}>{t('wellbeing.clearDescription')}</Text><ActionButton secondary disabled={busy} title={t('wellbeing.clearData')} onPress={confirm} /></Card></Screen>;
}
