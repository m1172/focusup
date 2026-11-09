import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { AppIcon } from '../components/AppIcon';
import { BackButton, Card, GroupLabel, Heading, Screen } from '../components/ui';
import { WIDGETS_ENABLED } from '../config/release';
import { vaqtimFeatures, type FeatureStatus } from '../services/capabilities/features';
import { useAppTheme } from '../theme';

/** "Vaqtim features": what works now, what is experimental and what isn't available yet. */
export default function CapabilitiesScreen() {
  const { t } = useTranslation(); const c = useAppTheme();
  const tone: Record<FeatureStatus, { fg: string; bg: string }> = {
    available: { fg: c.success, bg: c.primarySoft },
    experimental: { fg: c.text2, bg: c.card2 },
    notAvailable: { fg: c.text3, bg: c.card2 },
  };
  return <Screen contentStyle={{ gap: 14 }}>
    <BackButton label={t('back')} />
    <Heading title={t('features.title')} subtitle={t('features.subtitle')} />
    {vaqtimFeatures({ widget: WIDGETS_ENABLED }).map(({ group, items }) => <View key={group} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {group === 'general' ? null : <AppIcon appId={group} size={22} />}
        <GroupLabel title={group === 'general' ? t('features.general') : group === 'instagram' ? 'Instagram' : group === 'youtube' ? 'YouTube' : 'TikTok'} />
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {items.map((item, index) => {
          const label = item.alwaysOn ? t('features.alwaysOn') : t(`features.${item.status}`);
          return <View key={item.key} accessible accessibilityLabel={`${t(`features.item.${item.key}`)}: ${label}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: c.line }}>
            <Text style={{ flex: 1, color: item.status === 'notAvailable' ? c.text3 : c.text, fontSize: 15, lineHeight: 20, fontWeight: '600' }}>{t(`features.item.${item.key}`)}</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: tone[item.status].bg }}>
              <Text style={{ color: tone[item.status].fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
            </View>
          </View>;
        })}
      </Card>
    </View>)}
  </Screen>;
}
