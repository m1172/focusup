import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Typography';
import { Icon, type IconName } from '../../components/Icon';
import { AppIcon } from '../../components/AppIcon';
import { ActionButton, ProBadge, Screen, SettingRow, Sheet, tabBarBottom } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { AVAILABLE_APPS, appCatalog } from '../../features/apps/catalog';
import { AppOrbit } from '../../features/protection/AppOrbit';
import { ExtraProtectionSettings } from '../../features/protection/ExtraProtectionSettings';
import { isSavingsApp, useAppConnection } from '../../features/protection/useAppConnection';
import { nativeBlockState } from '../../features/protection/nativeAppSetup';
import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { useStrictMode } from '../../hooks/useStrictMode';
import { useSubscription } from '../../hooks/useSubscription';
import { protectionBridge } from '../../services/protection/nativeBridge';
import { endTemporaryAccess, reconcileProtection } from '../../services/protection/controller';
import { breaksLeft, shortVideoBlockedApps } from '../../services/protection/engine';
import { isOpenEndedSession } from '../../services/strict-mode/types';
import { canUseFeature, isFeatureAvailable, type SubscriptionFeature } from '../../services/subscription/subscriptionService';
import type { PaywallSource } from '../../services/subscription/types';
import type { SocialAppId } from '../../types/app';

type Route = '/strict-mode' | '/sleep' | '/schedule' | '/daily-limits' | '/temporary-access' | '/protection' | '/configure-apps';
type Tile = { key: string; title: string; subtitle?: string; icon: IconName; feature: SubscriptionFeature | null; onPress: () => void };
type Routine = { title: string; icon: IconName; feature: SubscriptionFeature; route: Route };

const clock = (seconds: number) => {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60), rest = seconds % 60;
  return (hours ? `${hours}:${String(minutes).padStart(2, '0')}` : `${minutes}`) + ':' + String(rest).padStart(2, '0');
};

/**
 * Tapping an app on the ring: whether its real app is locked. "Lock it" first explains the system permission here,
 * then the system prompt (and Apple's app list) follows; an app already set up locks straight away.
 */
function LockDialog({ appId, add, lockedApps, onClose, onLock, onAddAnyway }: { appId: SocialAppId | null; add: boolean; lockedApps: readonly SocialAppId[]; onClose: () => void; onLock: () => void; onAddAnyway: () => void }) {
  const { t } = useTranslation();
  const c = useAppTheme();
  const status = useProtectionStatusStore((state) => state.status);
  // Keep showing the last app (and step) while the dialog fades out, so it never flashes another version.
  const [shown, setShown] = useState(appId);
  const [asking, setAsking] = useState(add);
  const [adding, setAdding] = useState(add);
  const [wasOpen, setWasOpen] = useState(false);
  if (Boolean(appId) !== wasOpen) {
    setWasOpen(Boolean(appId));
    if (appId) { setShown(appId); setAsking(add); setAdding(add); }
  }
  const name = shown ? appCatalog[shown].name : '';
  const locked = Boolean(shown && lockedApps.includes(shown));
  const state = shown ? nativeBlockState(status, shown) : 'unsupported';
  const startLock = () => { if (state === 'active') onLock(); else setAsking(true); };

  const title = !asking ? t(locked ? 'ui.appLockedTitle' : 'ui.appUnlockedTitle', { name })
    : state === 'unsupported' ? t('wellbeing.nativeTitle') : t('ui.lockPermissionTitle', { name });
  const body = !asking ? t(locked ? 'ui.appLockedBody' : 'ui.appUnlockedBody', { name })
    : state === 'unsupported' ? t('wellbeing.nativeUnavailable')
    : state === 'needsSelection' ? t('browser.nativeBlockChoose', { name })
    : `${t(Platform.OS === 'ios' ? 'browser.nativeBlockIOSSteps' : 'browser.nativeBlockAndroidSteps', { name })}\n\n${t(Platform.OS === 'ios' ? 'wellbeing.disclosureIOS' : 'wellbeing.disclosureAndroid')}`;
  const primary = asking
    ? state === 'unsupported' ? (adding ? { title: t('ui.addAnyway'), icon: 'plus' as const, onPress: onAddAnyway } : null) : { title: t(state === 'needsSelection' ? 'browser.nativeBlockChooseAction' : 'wellbeing.authorize'), icon: 'shieldCheck' as const, onPress: onLock }
    : locked ? null : { title: t('ui.lockIt'), icon: 'lock' as const, onPress: startLock };

  return <Modal visible={Boolean(appId)} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable accessibilityLabel={t('ui.gotIt')} onPress={onClose} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: c.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(14,16,32,0.4)' }}>
      <Pressable onPress={(event) => event.stopPropagation()} style={{ alignItems: 'center', gap: 12, padding: 22, borderRadius: 32, backgroundColor: c.card, backgroundImage: locked ? undefined : c.lockHalo, boxShadow: c.sheetSh }}>
        {shown ? <View style={{ marginTop: 4 }}>
          <AppIcon appId={shown} size={64} />
          <View style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: c.card, backgroundColor: locked ? c.accent : asking ? c.soft : c.off, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={locked ? 'lock' : asking ? 'shieldCheck' : 'lockOpen'} size={13} color={locked ? '#FFFFFF' : asking ? c.ink : c.text2} strokeWidth={2.6} />
          </View>
        </View> : null}
        <Text accessibilityRole="header" style={{ marginTop: 4, color: c.text, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: c.text2, fontSize: 15, lineHeight: 21, fontWeight: '500', textAlign: 'center' }}>{body}</Text>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 6 }}>
          {primary ? <ActionButton title={primary.title} icon={<Icon name={primary.icon} size={18} color="#FFFFFF" strokeWidth={2.4} />} onPress={primary.onPress} /> : null}
          <ActionButton variant="secondary" title={t(asking && (adding || state !== 'unsupported') ? 'subscription.notNow' : 'ui.gotIt')} onPress={onClose} />
        </View>
      </Pressable>
    </Pressable>
  </Modal>;
}

/** The Protect tab: Vaqtim with the apps it protects around it, quick actions and Hard Mode. */
export default function ProtectScreen() {
  const { t } = useTranslation();
  const c = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isPro = useSubscription().isPro;
  const apps = useAppStore((state) => state.apps);
  const temporary = useWellbeingStore((state) => state.temporary);
  const breaks = useWellbeingStore((state) => state.breaks);
  const { session, now, remainingMs, active: hardModeOn } = useStrictMode();
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [scrollable, setScrollable] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const { connect, disconnect, lock, isConnected, sheet } = useAppConnection();
  const [lockInfo, setLockInfo] = useState<{ appId: SocialAppId; add: boolean } | null>(null);
  const protection = useProtectionStatusStore((state) => state.status);
  // Adding an app asks for access to the real app first; it joins already locked once access is given.
  const requestConnect = (appId: SocialAppId) => {
    if (isSavingsApp(appId) && nativeBlockState(protection, appId) !== 'active') setLockInfo({ appId, add: true });
    else connect(appId);
  };

  useFocusEffect(useCallback(() => {
    void protectionBridge.getStatus().then(useProtectionStatusStore.getState().setStatus);
    void reconcileProtection().catch(() => undefined);
  }, []));
  useEffect(() => {
    if (!temporary) return undefined;
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [temporary]);

  const nativeBlocked = shortVideoBlockedApps(apps);
  const connected = AVAILABLE_APPS.filter(isConnected);
  const breakSeconds = temporary ? Math.max(0, Math.ceil((temporary.endsAt - clockNow) / 1000)) : 0;
  const onBreak = Boolean(temporary && breakSeconds > 0);
  const left = breaksLeft(breaks, new Date(now));
  const hardModeAvailable = isFeatureAvailable('strictMode');

  const open = (feature: SubscriptionFeature | null, source: PaywallSource, route: Route, params?: Record<string, string>) => {
    setManageOpen(false);
    if (feature && !canUseFeature(isPro, feature)) { router.push({ pathname: '/pro', params: { source } }); return; }
    router.push(params ? { pathname: route, params } : route);
  };

  const takeBreak = () => {
    if (hardModeOn && left === 0) { Alert.alert(t('ui.takeBreak'), t('ui.noBreaksLeft')); return; }
    const appId = (session ? (session.protectedPlatforms ?? session.appIds)[0] : nativeBlocked[0]) ?? AVAILABLE_APPS[0];
    open('temporaryAccess', 'strict_mode', '/temporary-access', { appId });
  };
  // The tiles are quick actions only; settings live behind the button at the top, so nothing is offered twice.
  const tiles: Tile[] = [];
  if (isFeatureAvailable('temporaryAccess')) tiles.push({ key: 'break', title: t('ui.breakTile'), icon: 'clock', feature: 'temporaryAccess', onPress: takeBreak });
  if (isFeatureAvailable('dailyLimits')) tiles.push({ key: 'limits', title: t('ui.limitsTile'), icon: 'target', feature: 'dailyLimits', onPress: () => open('dailyLimits', 'schedules', '/daily-limits') });
  // The status page is the extra-apps native protection screen, which is Pro; in the free version it would only show a paywall.
  if (isFeatureAvailable('nativeProtection')) tiles.push({ key: 'status', title: t('ui.statusTile'), subtitle: t('ui.statusTileHint'), icon: 'shieldCheck', feature: 'nativeProtection', onPress: () => open('nativeProtection', 'schedules', '/protection') });

  const routines = ([
    { title: t('wellbeing.sleep'), icon: 'moon', feature: 'sleepMode', route: '/sleep' },
    { title: t('schedules'), icon: 'calendar', feature: 'schedules', route: '/schedule' },
    { title: t('ui.dailyLimits'), icon: 'target', feature: 'dailyLimits', route: '/daily-limits' },
  ] satisfies Routine[]).filter((item) => isFeatureAvailable(item.feature));

  // Free version: the only setting is per-app blocking, so the top button opens it directly instead of a one-row menu.
  const openSettings = () => { if (routines.length) setManageOpen(true); else open(null, 'schedules', '/configure-apps'); };

  // The ring takes the height that is left, so the whole tab fits on one screen on most phones.
  const reserved = 64 + 14 + 96 + (tiles.length ? 14 + 84 : 0) + (hardModeAvailable ? 14 + 64 : 0) + (onBreak ? 14 + 64 : 0) + tabBarBottom(insets.bottom) + 68 + 32;
  const orbitHeight = Math.max(230, Math.min(380, windowHeight - insets.top - reserved));
  const sectionLabel = { color: c.text3, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' } as const;

  return <Screen navigation scroll={false}>
    <ScrollView scrollEnabled={scrollable} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: tabBarBottom(insets.bottom) + 68 + 24, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50 }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.1 }}>{t('ui.protectTitle')}</Text>
          <Text style={{ color: c.text2, fontSize: 14, lineHeight: 19, fontWeight: '500' }}>{t('ui.protectedCount', { count: connected.length, total: AVAILABLE_APPS.length })}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('ui.manageTitle')} onPress={openSettings}
          style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: c.card, boxShadow: c.sh, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Icon name="sliders" size={22} color={c.ink} />
        </Pressable>
      </View>

      <AppOrbit apps={AVAILABLE_APPS} connected={connected} nativeBlocked={nativeBlocked} height={orbitHeight}
        onOpen={(appId) => setLockInfo({ appId, add: false })} onConnect={requestConnect} onDisconnect={disconnect} onDragChange={(dragging) => setScrollable(!dragging)} />

      {onBreak && temporary ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.amberSoft }}>
        <AppIcon appId={temporary.platform} size={36} />
        <Text accessibilityRole="timer" style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: '800' }}>{t('ui.breakActive', { time: clock(breakSeconds) })}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void endTemporaryAccess().catch(() => Alert.alert(t('ui.endBreak'), t('wellbeing.failed'))); }}
          style={({ pressed }) => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.card, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>{t('ui.endBreak')}</Text>
        </Pressable>
      </View> : null}

      {tiles.length === 0 ? null : tiles.length === 1 ? <Pressable accessibilityRole="button" accessibilityLabel={tiles[0]!.title} onPress={tiles[0]!.onPress}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 16, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={tiles[0]!.icon} size={21} color={c.ink} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>{tiles[0]!.title}</Text>
          {tiles[0]!.subtitle ? <Text numberOfLines={1} style={{ color: c.text2, fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{tiles[0]!.subtitle}</Text> : null}
        </View>
        <Icon name="chevron" size={18} color={c.text3} strokeWidth={2.2} />
      </Pressable> : <View style={{ flexDirection: 'row', gap: 10 }}>
        {tiles.map((tile) => <Pressable key={tile.key} accessibilityRole="button" accessibilityLabel={tile.title} onPress={tile.onPress}
          style={({ pressed }) => ({ flex: 1, height: 84, borderRadius: 24, backgroundColor: c.card, boxShadow: c.sh, alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={tile.icon} size={20} color={c.ink} /></View>
          <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>{tile.title}</Text>
          {tile.feature && !canUseFeature(isPro, tile.feature) ? <View style={{ position: 'absolute', top: 8, right: 8 }}><ProBadge /></View> : null}
        </Pressable>)}
      </View>}

      {hardModeAvailable ? <Pressable accessibilityRole="button" accessibilityLabel={t('ui.hardMode')} onPress={() => open('strictMode', 'strict_mode', '/strict-mode')}
        style={({ pressed }) => ({ minHeight: 64, borderRadius: 32, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: hardModeOn ? undefined : c.card, backgroundImage: hardModeOn ? c.grad : undefined, boxShadow: hardModeOn ? c.glow : c.sh, opacity: pressed ? 0.85 : 1 })}>
        <Icon name="lockDot" size={22} color={hardModeOn ? '#FFFFFF' : c.ink} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: hardModeOn ? '#FFFFFF' : c.text, fontSize: 16, fontWeight: '800' }}>{hardModeOn ? t('ui.hardMode') : t('ui.hardModeTurnOn')}</Text>
          {hardModeOn ? <Text style={{ color: c.onHero, fontSize: 12, fontWeight: '600' }}>
            {(isOpenEndedSession(session) ? t('ui.hardModeOpen') : clock(Math.floor(remainingMs / 1000))) + ' · ' + (left > 0 ? t('ui.breaksLeft', { count: left }) : t('ui.noBreaksLeft'))}
          </Text> : null}
        </View>
        {!hardModeOn && !canUseFeature(isPro, 'strictMode') ? <ProBadge /> : <Icon name="chevron" size={18} color={hardModeOn ? '#FFFFFF' : c.text3} strokeWidth={2.2} />}
      </Pressable> : null}
    </ScrollView>

    <Sheet visible={manageOpen} onClose={() => setManageOpen(false)} title={t('ui.manageTitle')}>
      <Text style={sectionLabel}>{t('ui.yourApps')}</Text>
      <View style={{ borderRadius: 20, backgroundColor: c.card2, paddingHorizontal: 14 }}>
        <SettingRow last icon={<Icon name="apps" size={22} color={c.ink} />} title={t('ui.configureApps')} subtitle={t('ui.configureAppsHint')} onPress={() => open(null, 'schedules', '/configure-apps')} />
      </View>
      {routines.length ? <>
        <Text style={[sectionLabel, { marginTop: 6 }]}>{t('ui.timeManagement')}</Text>
        <View style={{ borderRadius: 20, backgroundColor: c.card2, paddingHorizontal: 14 }}>
          {routines.map((item, index) => <SettingRow key={item.route} last={index === routines.length - 1}
            icon={<Icon name={item.icon} size={22} color={c.ink} />} title={item.title}
            badge={canUseFeature(isPro, item.feature) ? undefined : <ProBadge />}
            onPress={() => open(item.feature, 'schedules', item.route)} />)}
        </View>
      </> : null}
      <ExtraProtectionSettings only={['adultFilter']} title={t('browser.blockingTitle')} />
    </Sheet>

    {sheet}
    <LockDialog appId={lockInfo?.appId ?? null} add={Boolean(lockInfo?.add)} lockedApps={nativeBlocked} onClose={() => setLockInfo(null)}
      // The system permission prompt does not show while the dialog is still closing.
      onLock={() => { const info = lockInfo; setLockInfo(null); if (info) setTimeout(() => info.add ? connect(info.appId, true) : lock(info.appId, true), 350); }}
      onAddAnyway={() => { const info = lockInfo; setLockInfo(null); if (info) connect(info.appId, true, true); }} />
  </Screen>;
}
