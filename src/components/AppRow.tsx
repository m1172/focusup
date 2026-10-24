import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Typography';
import { Icon } from './Icon';
import { useAppTheme } from '../theme';
import { appCatalog } from '../features/apps/catalog';
import { useAppStore } from '../store/appStore';
import type { SocialAppId } from '../types/app';
import { AppIcon } from './AppIcon';
import { Pill, Toggle } from './ui';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useWellbeingStore } from '../store/wellbeingStore';
import { getEffectiveAppConfig } from '../services/blockers/effective';
import { isPlatformLocked } from '../services/strict-mode/strictModeController';
import { SHORT_VIDEO_FILTERS } from '../services/protection/engine';
import { enableAfterNativeBlock } from '../features/protection/nativeAppSetup';

/**
 * App card.
 * - `selectable` (onboarding): 80px row, 48px tile, description and an on/off switch.
 * - default (Apps tab): 84px row, 52px tile with a check badge when cleaned, status pill and chevron.
 */
export function AppRow({ appId, onPress, selectable = false }: { appId: SocialAppId; onPress?: () => void; compact?: boolean; selectable?: boolean }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const app = appCatalog[appId];
  const config = useAppStore((s) => s.apps[appId]);
  const strict = useAppStore((s) => s.strictSession);
  useAppStore((s) => s.schedules);
  useSubscriptionStore((s) => s.isPro);
  useWellbeingStore((s) => s.sleep);
  const setEnabled = useAppStore((s) => s.setAppEnabled);
  const locked = isPlatformLocked(appId, strict);
  const cleaned = app.supported && getEffectiveAppConfig(appId).enabled;

  // Turning on an app whose Reels/Shorts filter is on blocks the original app first, as in its settings.
  const toggle = (value: boolean) => {
    const filter = SHORT_VIDEO_FILTERS[appId];
    if (!value || !filter || !config.filters[filter]) { setEnabled(appId, value); return; }
    void enableAfterNativeBlock(appId, app.name, appId === 'instagram' ? 'Reels' : 'Shorts', () => setEnabled(appId, true))
      .catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed')));
  };

  if (selectable) {
    return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 80, paddingHorizontal: 16, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
      <AppIcon appId={appId} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.text, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.17 }}>{app.name}</Text>
        <Text style={{ marginTop: 2, color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '500' }}>{t(`design.${app.descriptionKey}`)}</Text>
      </View>
      <Toggle label={app.name} value={app.supported && config.enabled} disabled={!app.supported || locked} onDisabledPress={locked ? () => Alert.alert(t('strictActive'), t('strictCannotChange')) : undefined} onChange={toggle} />
    </View>;
  }

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
