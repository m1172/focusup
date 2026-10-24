import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { Icon, type IconName } from '../components/Icon';
import { Screen } from '../components/ui';
import { PageHeader, Panel } from '../features/settings/components';
import { useAppTheme } from '../theme';
import { clearFocusUpData } from '../services/privacy/clearFocusUpData';

function Fact({ icon, text }: { icon: IconName; text: string }) {
  const c = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.mintSoft }}><Icon name={icon} size={17} color={c.mintInk} strokeWidth={2.2} /></View>
    <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '600' }}>{text}</Text>
  </View>;
}

export default function PrivacyScreen() {
  const { t } = useTranslation(); const c = useAppTheme(); const [busy, setBusy] = useState(false);
  const confirm = () => Alert.alert(t('wellbeing.clearConfirm'), t('wellbeing.clearDescription'), [{ text: t('cancel'), style: 'cancel' }, { text: t('wellbeing.clearAction'), style: 'destructive', onPress: () => { setBusy(true); void clearFocusUpData().then(({ browserDataCleared }) => { if (!browserDataCleared) Alert.alert(t('wellbeing.clearData'), t('wellbeing.clearPartial')); if (router.canDismiss()) router.dismissAll(); router.replace('/'); }).catch(() => Alert.alert(t('wellbeing.clearData'), t('wellbeing.clearFailed'))).finally(() => setBusy(false)); } }]);
  return <Screen contentStyle={{ gap: 18 }}>
    <PageHeader icon="shield" tone="mint" title={t('privacy')} subtitle={t('settingsPages.privacySubtitle')} />
    <Panel label={t('settingsPages.storedTitle')}>
      <Fact icon="lock" text={t('settingsPages.storedLocal')} />
      <Fact icon="cloud" text={t('settingsPages.storedBackup')} />
      <Fact icon="eyeOff" text={t('settingsPages.storedSocial')} />
      <Fact icon="stats" text={t('settingsPages.analyticsFact')} />
    </Panel>
    <Panel><Text style={{ color: c.text, fontSize: 15, lineHeight: 23 }}>{t('wellbeing.faqNativeAnswer')}</Text></Panel>
    <View style={{ gap: 14, padding: 18, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, borderWidth: 1, borderColor: c.redSoft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.redSoft }}><Icon name="close" size={20} color={c.red} strokeWidth={2.4} /></View>
        <Text style={{ flex: 1, color: c.text, fontSize: 16, lineHeight: 21, fontWeight: '800' }}>{t('settingsPages.clearTitle')}</Text>
      </View>
      <Text style={{ color: c.text2, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{t('settingsPages.clearShort')}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={confirm} style={({ pressed }) => ({ height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.red, opacity: busy ? 0.5 : pressed ? 0.7 : 1 })}>
        <Text style={{ color: c.red, fontSize: 15, fontWeight: '800' }}>{t('wellbeing.clearData')}</Text>
      </Pressable>
    </View>
  </Screen>;
}
