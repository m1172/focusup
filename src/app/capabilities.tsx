import { Text } from '../components/Typography';
import { useTranslation } from 'react-i18next';
import { BackButton, Card, Heading, Screen, SettingRow } from '../components/ui';
import { capabilityRegistry } from '../services/capabilities/registry';
import { appCatalog } from '../features/apps/catalog';
import { useAppTheme } from '../theme';

export default function CapabilitiesScreen() {
  const { t } = useTranslation(); const c = useAppTheme();
  return <Screen><BackButton label={t('back')} /><Heading title={t('wellbeing.capabilities')} subtitle={t('wellbeing.deviceRequired')} />{capabilityRegistry.map((entry) => <Card key={entry.platform}><Heading size="card" title={appCatalog[entry.platform].name} subtitle={t(`wellbeing.${entry.optimized}`)} /><SettingRow title={t('ui.iosScreenTime')} subtitle={t(`wellbeing.${entry.nativeIOS}`)} /><SettingRow title={t('ui.androidAccessibility')} subtitle={t(`wellbeing.${entry.nativeAndroid}`)} /><Text style={{ color: c.muted, lineHeight: 20 }}>{t('wellbeing.webHint')}</Text></Card>)}<Card><Heading size="card" title={t('wellbeing.accounts')} /><Text style={{ color: c.muted, lineHeight: 21 }}>{t('wellbeing.accountsHint')}</Text><Text style={{ color: c.muted, lineHeight: 21 }}>{t('wellbeing.mediaHint')}</Text></Card><Card><Heading size="card" title={t('wellbeing.family')} /><Text style={{ color: c.muted, lineHeight: 21 }}>{t('wellbeing.familyHint')}</Text></Card></Screen>;
}
