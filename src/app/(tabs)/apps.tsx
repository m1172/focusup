import { router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppRow } from '../../components/AppRow';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { Heading, Screen } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { useAppTheme } from '../../theme';
import { getEffectiveAppConfig } from '../../services/blockers/effective';

const apps = ['instagram', 'youtube', 'tiktok', 'x', 'reddit'] as const;
export default function AppsScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  useAppStore((s) => s.apps); useAppStore((s) => s.schedules); useAppStore((s) => s.strictSession);
  useSubscriptionStore((s) => s.isPro); useWellbeingStore((s) => s.sleep);
  const count = (['instagram', 'youtube'] as const).filter((id) => getEffectiveAppConfig(id).enabled).length;
  return <Screen glow={300} glowDarkOnly contentStyle={{ gap: 16 }}>
    <Heading size="large" title={t('apps')} />
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', height: 72, paddingHorizontal: 18, borderRadius: 24, backgroundColor: c.mintSoft, boxShadow: c.ringMint || undefined }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="shieldCheck" size={24} color={c.mintInk} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.mintInk, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.17 }}>{t('design.protectedCount', { count })}</Text>
        <Text style={{ marginTop: 1, color: c.mintInk, opacity: 0.85, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{t('design.totalApps', { count: apps.length })}</Text>
      </View>
    </View>
    <View style={{ gap: 12 }}>{apps.map((appId) => <AppRow key={appId} appId={appId} onPress={() => router.push({ pathname: '/app-settings/[appId]', params: { appId } })} />)}</View>
  </Screen>;
}
