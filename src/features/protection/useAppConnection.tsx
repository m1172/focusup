import { useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { appCatalog } from '../apps/catalog';
import { TurnOffSheet } from './FrictionControls';
import { enableAfterNativeBlock } from './nativeAppSetup';
import { appDailySavings, SHORT_VIDEO_FILTER, usualMinutes, type SavingsAppId } from '../savings/savings';
import { useAppStore } from '../../store/appStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { isPlatformLocked } from '../../services/strict-mode/strictModeController';
import type { SocialAppId } from '../../types/app';

export const FEED_NAME: Record<SavingsAppId, string> = { instagram: 'Reels', youtube: 'Shorts', tiktok: 'For You' };
export const isSavingsApp = (appId: SocialAppId): appId is SavingsAppId => appId in SHORT_VIDEO_FILTER;

/**
 * Connecting an app to Vaqtim (clean mode with its short-video feed hidden, after asking to block the real app)
 * and disconnecting it behind the typing step. Shared by the Protect tab and the Configure apps page.
 * Render `sheet` once on the screen that uses it.
 */
export function useAppConnection() {
  const { t } = useTranslation();
  const apps = useAppStore((state) => state.apps);
  const strict = useAppStore((state) => state.strictSession);
  const setAppEnabled = useAppStore((state) => state.setAppEnabled);
  const setFilter = useAppStore((state) => state.setFilter);
  const setBlocking = useAppStore((state) => state.setBlocking);
  const usualSource = useOnboardingStore((state) => state.source);
  const shortFormMinutes = useOnboardingStore((state) => state.shortFormMinutes);
  const measured = useOnboardingStore((state) => state.measured);
  const [turnOff, setTurnOff] = useState<SocialAppId | null>(null);

  const locked = (appId: SocialAppId) => isPlatformLocked(appId, strict);
  const isConnected = (appId: SocialAppId) => Boolean(apps[appId]?.enabled) || locked(appId);

  // `confirmed`: the caller already explained the permission. `plain`: add it without blocking the real app.
  const connect = (appId: SocialAppId, confirmed = false, plain = false) => {
    const feed = isSavingsApp(appId) ? SHORT_VIDEO_FILTER[appId] : null;
    const turnOn = () => {
      if (!useAppStore.getState().apps[appId]?.enabled) setAppEnabled(appId, true);
      if (feed && !useAppStore.getState().apps[appId]?.filters[feed]) setFilter(appId, feed, true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    if (plain || !feed || !isSavingsApp(appId)) { turnOn(); return; }
    void enableAfterNativeBlock(appId, appCatalog[appId].name, FEED_NAME[appId], (blocked) => { turnOn(); setBlocking(appId, 'blockNativeApp', blocked); }, { confirmed })
      .catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed')));
  };
  // Locking = blocking the real app, which needs the Screen Time / Accessibility permission first.
  // `confirmed`: the caller already explained the permission, so go straight to the system prompt.
  const lock = (appId: SocialAppId, confirmed = false) => {
    if (!isSavingsApp(appId)) return;
    void enableAfterNativeBlock(appId, appCatalog[appId].name, FEED_NAME[appId], (blocked) => {
      if (!blocked) { Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.nativeUnavailable')); return; }
      setBlocking(appId, 'blockNativeApp', true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, { confirmed }).catch(() => Alert.alert(t('wellbeing.nativeTitle'), t('wellbeing.failed')));
  };
  const disconnect = (appId: SocialAppId) => {
    if (locked(appId)) { Alert.alert(t('ui.hardMode'), t('strictCannotChange')); return; }
    setTurnOff(appId);
  };

  const usual = usualMinutes(usualSource, shortFormMinutes, measured?.minutes ?? null);
  const minutes = turnOff && isSavingsApp(turnOff) ? appDailySavings(turnOff, apps[turnOff], usual) : 0;
  const sheet = <TurnOffSheet visible={Boolean(turnOff)} name={turnOff ? appCatalog[turnOff].name : ''} minutesPerDay={minutes}
    onKeep={() => setTurnOff(null)}
    // Disconnecting unlocks the real app too, so nothing stays blocked for an app Vaqtim no longer shows.
    onTurnOff={() => { if (turnOff) { setAppEnabled(turnOff, false); setBlocking(turnOff, 'blockNativeApp', false); } setTurnOff(null); }} />;

  return { connect, disconnect, lock, isConnected, locked, sheet };
}
