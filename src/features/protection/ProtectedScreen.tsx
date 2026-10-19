import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, BackButton, Card, Heading, Screen } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { appCatalog, filterLabelKey } from '../apps/catalog';
import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { getEffectiveAppConfig } from '../../services/blockers/effective';
import { isPlatformLocked } from '../../services/strict-mode/strictModeController';
import type { SocialAppId } from '../../types/app';

export function ProtectedScreen({ appId, onReturn }: { appId: SocialAppId; onReturn: () => void }) {
  const c = useAppTheme(); const { t } = useTranslation();
  const strict = useAppStore((s) => s.strictSession);
  const nativeApps = useWellbeingStore((s) => s.nativeApps);
  const filters = getEffectiveAppConfig(appId).filters;
  const activeFilters = appCatalog[appId].filters.filter((key) => filters[key] && !['sponsoredPosts', 'sponsoredContent'].includes(key));
  const locked = isPlatformLocked(appId, strict);
  return <Screen contentStyle={{ gap: 24 }}>
    <BackButton label={t('back')} onPress={onReturn} />
    <View style={{ alignItems: 'center', gap: 12, marginTop: 12 }}>
      <View style={{ marginBottom: 12 }}><AppIcon appId={appId} size={96} /><View style={{ position: 'absolute', right: -4, bottom: -4, width: 38, height: 38, borderRadius: 19, backgroundColor: c.successSoft, borderColor: c.background, borderWidth: 4, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="shield-checkmark" size={23} color={c.success} /></View></View>
      <Heading title={t('design.protectedTitle')} /><Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{t('design.protectedBody')}</Text>
    </View>
    <Card style={{ padding: 18, gap: 8 }}><Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>{t('design.protecting')}</Text>{activeFilters.map((key) => <View key={key} style={{ minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name="checkmark-circle" size={20} color={c.success} /><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{t(filterLabelKey(appId, key))}</Text></View>)}</Card>
    <View style={{ gap: 10 }}><ActionButton title={t('design.returnApp', { app: appCatalog[appId].name })} onPress={onReturn} /><ActionButton secondary title={t('design.temporaryTitle')} disabled={locked} onPress={() => {
      onReturn();
      router.push({ pathname: '/temporary-access', params: { appId } });
    }} /><Text style={{ color: c.faint, fontSize: 11, lineHeight: 17, textAlign: 'center' }}>{t(locked ? 'strictCannotChange' : nativeApps.includes(appId) ? 'wellbeing.accessDescription' : 'wellbeing.nativeHint')}</Text></View>
  </Screen>;
}
