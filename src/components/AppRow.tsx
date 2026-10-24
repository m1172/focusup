import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Typography';
import { Icon } from './Icon';
import { useAppTheme } from '../theme';
import { appCatalog } from '../features/apps/catalog';
import { useAppStore } from '../store/appStore';
import type { SocialAppId } from '../types/app';
import { AppIcon } from './AppIcon';
import { Pill } from './ui';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useWellbeingStore } from '../store/wellbeingStore';
import { getEffectiveAppConfig } from '../services/blockers/effective';

/** App card (Apps tab): 84px row, 52px tile with a check badge when cleaned, status pill and chevron. */
export function AppRow({ appId, onPress }: { appId: SocialAppId; onPress?: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const app = appCatalog[appId];
  useAppStore((s) => s.apps[appId]);
  useAppStore((s) => s.schedules);
  useSubscriptionStore((s) => s.isPro);
  useWellbeingStore((s) => s.sleep);
  const cleaned = app.supported && getEffectiveAppConfig(appId).enabled;

  return <Pressable
    disabled={!onPress}
    onPress={onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${app.name}, ${cleaned ? t('cleaned') : t('off')}`}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, height: 84, paddingHorizontal: 16, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, opacity: pressed ? 0.8 : 1 })}
  >
    <View>
      <AppIcon appId={appId} size={52} dimmed={!cleaned} />
      {cleaned ? <View style={{ position: 'absolute', right: -5, bottom: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: c.mint, boxShadow: `0px 0px 0px 3px ${c.card}`, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={11} color="#FFFFFF" strokeWidth={3.5} /></View> : null}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.17 }}>{app.name}</Text>
      <View style={{ marginTop: 4 }}><Pill label={cleaned ? t('cleaned') : t('off')} variant={cleaned ? 'success' : 'muted'} /></View>
    </View>
    {onPress ? <Icon name="chevron" size={20} color={c.text3} strokeWidth={2.2} /> : null}
  </Pressable>;
}
