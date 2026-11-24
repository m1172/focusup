import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon } from '../../components/Icon';
import { ActionButton } from '../../components/ui';
import { appCatalog } from '../apps/catalog';
import { androidBackground, type BackgroundStatus } from '../../services/device-background/androidBackground';
import { protectionBridge } from '../../services/protection/nativeBridge';
import { useAppStore } from '../../store/appStore';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import type { SocialAppId } from '../../types/app';
import { useAppTheme } from '../../theme';
import { blockingIssue, makerName } from './blockingHealth';

/**
 * Android only. Warns when blocking has stopped (Accessibility switched off by the system) or may stop
 * (battery saving on Xiaomi, Samsung and others), with buttons that open the right Settings screen.
 */
export function BlockingHealthCard() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const apps = useAppStore((state) => state.apps);
  const status = useProtectionStatusStore((state) => state.status);
  const [background, setBackground] = useState<BackgroundStatus | null>(null);
  const refresh = useCallback(() => {
    if (Platform.OS !== 'android') return;
    void protectionBridge.getStatus().then((value) => useProtectionStatusStore.getState().setStatus(value)).catch(() => undefined);
    void androidBackground.status().then(setBackground);
  }, []);
  useFocusEffect(refresh);
  // Coming back from Settings: check again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  // Only apps whose real app Vaqtim really blocked at some point (the switch is set after a successful block).
  const wantedApps = (Object.keys(apps) as SocialAppId[]).filter((id) => apps[id]?.enabled && apps[id]?.blockNativeApp === true);
  const issue = blockingIssue({ android: Platform.OS === 'android', wantedApps, supported: status.supported, authorized: status.authorized, background });
  if (!issue) return null;

  const off = issue.kind === 'accessibilityOff';
  const tone = off ? { bg: c.redSoft, fg: c.red } : { bg: c.amberSoft, fg: c.amber };
  const names = off ? issue.apps.map((id) => appCatalog[id]?.name ?? id).join(', ') : '';
  const maker = issue.kind === 'battery' ? makerName(issue.maker) : '';
  return <View accessibilityRole="alert" style={{ gap: 12, padding: 18, borderRadius: 24, backgroundColor: tone.bg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={off ? 'lockOpen' : 'bell'} size={22} color={tone.fg} strokeWidth={2.2} />
      <Text style={{ flex: 1, color: tone.fg, fontSize: 17, fontWeight: '800' }}>{t(off ? 'androidHealth.offTitle' : 'androidHealth.batteryTitle')}</Text>
    </View>
    <Text style={{ color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '500' }}>
      {off ? t('androidHealth.offBody', { apps: names }) : maker ? t('androidHealth.batteryBody', { maker }) : t('androidHealth.batteryBodyGeneric')}
    </Text>
    {off ? <ActionButton compact title={t('androidHealth.turnOn')} onPress={() => { void protectionBridge.requestAuthorization().finally(refresh); }} />
      : <View style={{ gap: 8 }}>
        <ActionButton compact title={t('androidHealth.battery')} onPress={() => { void androidBackground.openBattery(); }} />
        {issue.kind === 'battery' && issue.hasAutoStart ? <ActionButton compact secondary title={t('androidHealth.autoStart')} onPress={() => { void androidBackground.openAutoStart(); }} /> : null}
      </View>}
  </View>;
}
