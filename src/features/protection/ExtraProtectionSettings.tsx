import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GroupLabel, IconTile, ProBadge, SettingRow, Toggle } from '../../components/ui';
import type { IconName } from '../../components/Icon';
import { useAppTheme } from '../../theme';
import { useShallow } from 'zustand/react/shallow';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { useSubscription } from '../../hooks/useSubscription';
import { canUseFeature, isFeatureAvailable, type SubscriptionFeature } from '../../services/subscription/subscriptionService';
import { ensureNativeAuthorization } from './nativeAppSetup';
import { TurnOffSheet } from './FrictionControls';

type Key = 'adultFilter' | 'uninstallProtection' | 'grayscale';
const rows: { key: Key; feature: SubscriptionFeature; icon: IconName; iosOnly: boolean; native: boolean }[] = [
  { key: 'adultFilter', feature: 'adultContentFilter', icon: 'eyeOff', iosOnly: true, native: true },
  { key: 'uninstallProtection', feature: 'uninstallProtection', icon: 'lock', iosOnly: true, native: true },
  { key: 'grayscale', feature: 'grayscale', icon: 'contrast', iosOnly: false, native: false },
];

/** Device-wide extras (Pro): Apple's adult-website filter, uninstall protection and grayscale in the clean browser. */
/** `only` picks some of the rows, `title` replaces the group label. */
export function ExtraProtectionSettings({ only, title }: { only?: Key[]; title?: string } = {}) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const isPro = useSubscription().isPro;
  const values = useWellbeingStore(useShallow((state) => ({ adultFilter: state.adultFilter, uninstallProtection: state.uninstallProtection, grayscale: state.grayscale })));
  const [turnOff, setTurnOff] = useState<Key | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = rows.filter((row) => isFeatureAvailable(row.feature) && (!only || only.includes(row.key)));
  if (!visible.length) return null;

  const set = (key: Key, value: boolean) => {
    const store = useWellbeingStore.getState();
    if (key === 'adultFilter') store.setAdultFilter(value);
    else if (key === 'uninstallProtection') store.setUninstallProtection(value);
    else store.setGrayscale(value);
  };
  const turnOn = (row: (typeof rows)[number]) => {
    if (!canUseFeature(isPro, row.feature)) { router.push({ pathname: '/pro', params: { source: 'settings' } }); return; }
    if (!row.native) { set(row.key, true); return; }
    setBusy(true);
    void ensureNativeAuthorization().then((state) => {
      if (state === 'authorized') set(row.key, true);
      else if (state === 'unsupported') Alert.alert(t(`ui.${row.key}`), t('browser.websiteUnavailable'));
    }).catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed'))).finally(() => setBusy(false));
  };

  return <View style={{ gap: 6 }}>
    <GroupLabel title={title ?? t('ui.groupExtraProtection')} />
    <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>
      {visible.map((row, index) => {
        const unsupported = row.iosOnly && Platform.OS !== 'ios';
        const locked = !canUseFeature(isPro, row.feature);
        const value = values[row.key] && !locked;
        return <SettingRow key={row.key} last={index === visible.length - 1}
          icon={<IconTile name={row.icon} tone={row.key === 'grayscale' ? 'blue' : 'accent'} />}
          title={t(`ui.${row.key}`)}
          subtitle={unsupported ? t('ui.iosOnly') : t(`ui.${row.key}Hint`)}
          badge={locked ? <ProBadge /> : undefined}
          right={<Toggle label={t(`ui.${row.key}`)} value={value} disabled={unsupported || busy}
            onChange={(next) => { if (next) turnOn(row); else if (row.native) setTurnOff(row.key); else set(row.key, false); }} />} />;
      })}
    </View>
    <TurnOffSheet visible={turnOff !== null} name={turnOff ? t(`ui.${turnOff}`) : ''} minutesPerDay={0}
      onKeep={() => setTurnOff(null)} onTurnOff={() => { if (turnOff) set(turnOff, false); setTurnOff(null); }} />
  </View>;
}
