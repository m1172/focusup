import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../../components/Icon';
import { Text } from '../../components/Typography';
import { ProBadge, Toggle } from '../../components/ui';
import { useSubscription } from '../../hooks/useSubscription';
import { canUseFeature, isFeatureAvailable } from '../../services/subscription/subscriptionService';
import { useAppTheme } from '../../theme';
import { useAppStore } from '../../store/appStore';
import { shortVideoBlockedApps, WEBSITE_DOMAINS } from '../../services/protection/engine';
import type { BlockingSwitch, SocialAppId } from '../../types/app';
import { enableAfterNativeBlock, ensureNativeAuthorization } from './nativeAppSetup';

type Props = {
  appId: SocialAppId;
  name: string;
  /** The feed this app's blocking is about, e.g. "Reels". */
  feature: string;
  locked: boolean;
  onLockedPress: () => void;
  /** Turning a switch off goes through the parent's confirmation sheet. */
  onRequestTurnOff: (key: BlockingSwitch) => void;
  /** Rows only, without the section title and card, to sit inside another card. */
  bare?: boolean;
};

/** "Block the real app" and "Block the website": each works on its own, apart from what the in-app browser hides. */
export function BlockingSwitches({ appId, name, feature, locked, onLockedPress, onRequestTurnOff, bare = false }: Props) {
  const c = useAppTheme();
  const { t } = useTranslation();
  const setBlocking = useAppStore((state) => state.setBlocking);
  const nativeOn = useAppStore((state) => shortVideoBlockedApps({ [appId]: state.apps[appId] }).includes(appId));
  const websiteOn = useAppStore((state) => Boolean(state.apps[appId]?.blockWebsite));
  const [busy, setBusy] = useState<BlockingSwitch | null>(null);
  const domain = WEBSITE_DOMAINS[appId]?.[0] ?? '';
  const websiteSupported = Platform.OS === 'ios';
  const isPro = useSubscription().isPro;
  const websiteLocked = !canUseFeature(isPro, 'blockWebsiteVersion');

  const turnOnNative = () => {
    setBusy('blockNativeApp');
    void enableAfterNativeBlock(appId, name, feature, (blocked) => {
      if (blocked) setBlocking(appId, 'blockNativeApp', true);
      else Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.nativeUnavailable'));
    })
      .catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed')))
      .finally(() => setBusy(null));
  };
  const turnOnWebsite = () => {
    if (websiteLocked) { router.push({ pathname: '/pro', params: { source: 'settings' } }); return; }
    setBusy('blockWebsite');
    void ensureNativeAuthorization().then((state) => {
      if (state === 'authorized') setBlocking(appId, 'blockWebsite', true);
      else if (state === 'unsupported') Alert.alert(t('browser.blockWebsite'), t('browser.websiteUnavailable'));
    }).catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed'))).finally(() => setBusy(null));
  };

  const allRows: { key: BlockingSwitch; icon: IconName; title: string; hint: string; value: boolean; disabled: boolean; onEnable: () => void }[] = [
    { key: 'blockNativeApp', icon: 'shieldCheck', title: t('browser.blockRealApp', { name }), hint: t('browser.blockRealAppHint'), value: nativeOn, disabled: false, onEnable: turnOnNative },
    { key: 'blockWebsite', icon: 'globe', title: t('browser.blockWebsite'), hint: websiteSupported ? t('browser.blockWebsiteHint', { domain }) : t('browser.websiteIosOnly'), value: websiteOn && !websiteLocked, disabled: !websiteSupported, onEnable: turnOnWebsite },
  ];
  // Website blocking is Pro: hidden in the free release, shown with a Pro badge once Pro exists.
  const rows = allRows.filter((row) => row.key !== 'blockWebsite' || isFeatureAvailable('blockWebsiteVersion'));

  const list = rows.map((row, index) => <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: index === 0 && !bare ? 0 : 1, borderTopColor: c.line, opacity: row.disabled ? 0.55 : 1 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={row.icon} size={20} color={c.ink} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flexShrink: 1, color: c.text, fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{row.title}</Text>
            {row.key === 'blockWebsite' && websiteLocked ? <ProBadge /> : null}
          </View>
          <Text style={{ color: c.text2, fontSize: 12, lineHeight: 16, fontWeight: '600' }}>{row.hint}</Text>
        </View>
        <Toggle label={row.title} value={row.value} disabled={row.disabled || busy !== null || (locked && row.value)}
          onDisabledPress={locked && row.value ? onLockedPress : undefined}
          onChange={(next) => { if (next) row.onEnable(); else onRequestTurnOff(row.key); }} />
      </View>);
  if (bare) return <>{list}</>;
  return <View style={{ gap: 8 }}>
    <Text accessibilityRole="header" style={{ color: c.text3, fontSize: 13, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 6 }}>{t('browser.blockingTitle')}</Text>
    <View style={{ padding: 8, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh }}>{list}</View>
  </View>;
}
