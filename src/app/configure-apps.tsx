import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from '../components/Typography';
import { Icon } from '../components/Icon';
import { AppIcon } from '../components/AppIcon';
import { BackButton, Screen, Toggle } from '../components/ui';
import { useAppTheme } from '../theme';
import { AVAILABLE_APPS, appCatalog } from '../features/apps/catalog';
import { BlockingSwitches } from '../features/protection/BlockingSwitches';
import { TurnOffSheet } from '../features/protection/FrictionControls';
import { FEED_NAME, isSavingsApp, useAppConnection } from '../features/protection/useAppConnection';
import { useAppStore } from '../store/appStore';
import { shortVideoBlockedApps } from '../services/protection/engine';
import { canUseFeature } from '../services/subscription/subscriptionService';
import { useSubscription } from '../hooks/useSubscription';
import type { BlockingSwitch, SocialAppId } from '../types/app';

type Filter = 'added' | 'notAdded' | 'blocked' | 'unblocked';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'added', label: 'ui.filterAdded' },
  { key: 'notAdded', label: 'ui.filterNotAdded' },
  { key: 'blocked', label: 'ui.filterBlocked' },
  { key: 'unblocked', label: 'ui.filterUnblocked' },
];

/** Every app on one page: show it in Vaqtim, block the real app, block the website. */
export default function ConfigureAppsScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const apps = useAppStore((state) => state.apps);
  const setBlocking = useAppStore((state) => state.setBlocking);
  const { connect, disconnect, isConnected, locked, sheet } = useAppConnection();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [blockingOff, setBlockingOff] = useState<{ appId: SocialAppId; key: BlockingSwitch } | null>(null);

  const isPro = useSubscription().isPro;
  const nativeBlocked = shortVideoBlockedApps(apps);
  const websiteActive = canUseFeature(isPro, 'blockWebsiteVersion');
  const blocked = (appId: SocialAppId) => nativeBlocked.includes(appId) || (websiteActive && Boolean(apps[appId]?.blockWebsite));
  const matches = (appId: SocialAppId) => filter === 'added' ? isConnected(appId) : filter === 'notAdded' ? !isConnected(appId)
    : filter === 'blocked' ? blocked(appId) : filter === 'unblocked' ? !blocked(appId) : true;
  const visible = AVAILABLE_APPS.filter(matches);
  const explainLock = () => Alert.alert(t('ui.hardMode'), t('strictCannotChange'));

  return <Screen contentStyle={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
      <BackButton label={t('back')} />
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.7 }}>{t('ui.configureApps')}</Text>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 6 }}>
      {FILTERS.map((item) => {
        const on = filter === item.key;
        return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(on ? null : item.key)}
          style={({ pressed }) => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: on ? undefined : c.card, backgroundImage: on ? c.grad : undefined, boxShadow: on ? c.sw : c.sh, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ color: on ? '#FFFFFF' : c.text, fontSize: 14, fontWeight: '700' }}>{t(item.label)}</Text>
        </Pressable>;
      })}
    </ScrollView>

    {visible.length === 0 ? <Text style={{ color: c.text3, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: 32 }}>{t('ui.configureEmpty')}</Text> : null}

    {visible.map((appId) => {
      const name = appCatalog[appId].name;
      const on = isConnected(appId);
      const isLocked = locked(appId);
      return <View key={appId} style={{ padding: 8, borderRadius: 26, backgroundColor: c.card, boxShadow: c.sh, borderWidth: 1.5, borderColor: on ? c.soft : 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 8 }}>
          <AppIcon appId={appId} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.3 }}>{name}</Text>
            <Text numberOfLines={1} style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{t('ui.showInVaqtim')}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('ui.appSettings', { name })} hitSlop={6}
            onPress={() => router.push({ pathname: '/app-settings/[appId]', params: { appId } })}
            style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Icon name="sliders" size={18} color={c.text2} />
          </Pressable>
          <Toggle label={`${name}. ${t('ui.showInVaqtim')}`} value={on} disabled={isLocked && on} onDisabledPress={explainLock}
            onChange={(next) => { if (next) connect(appId); else disconnect(appId); }} />
        </View>
        {on && isSavingsApp(appId) ? <BlockingSwitches bare appId={appId} name={name} feature={FEED_NAME[appId]} locked={isLocked} onLockedPress={explainLock}
          onRequestTurnOff={(key) => setBlockingOff({ appId, key })} /> : null}
      </View>;
    })}

    {sheet}
    <TurnOffSheet visible={Boolean(blockingOff)} minutesPerDay={0}
      name={blockingOff?.key === 'blockNativeApp' ? t('browser.blockRealApp', { name: appCatalog[blockingOff.appId].name }) : t('browser.blockWebsite')}
      onKeep={() => setBlockingOff(null)}
      onTurnOff={() => { if (blockingOff) setBlocking(blockingOff.appId, blockingOff.key, false); setBlockingOff(null); }} />
  </Screen>;
}
