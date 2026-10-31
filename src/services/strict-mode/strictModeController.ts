import type { StrictSession, SocialAppId } from '../../types/app';
import { useAppStore } from '../../store/appStore';
import { track } from '../analytics/localAnalytics';
import { nativeAppBlocker, type NativeAppBlocker } from '../native-blocking';
import { createStrictModeSession, isStrictModeExpired, normalizeStrictSession, snapshotProtectedSettings, type ProtectedPlatform, type StrictModeSession } from './strictModeService';
import { strictModeStorage } from './strictModeStorage';
import { isOpenEndedSession } from './types';
import { cancelStrictModeCompletion, scheduleStrictModeCompletion } from '../notifications/notificationService';
import { canUseFeature } from '../subscription/subscriptionService';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { reconcileProtection } from '../protection/controller';
import { activeRoutines } from '../protection/engine';
import { useWellbeingStore } from '../../store/wellbeingStore';

const asSession = (value: StrictSession | null): StrictModeSession | null => normalizeStrictSession(value);

export async function startStrictMode(input: { durationMinutes: number; protectedPlatforms: ProtectedPlatform[] }, blocker: NativeAppBlocker = nativeAppBlocker): Promise<StrictModeSession> {
  if (!canUseFeature(useSubscriptionStore.getState().isPro, 'strictMode')) throw new Error('FocusUp Pro is required to start Strict Mode.');
  const state = useAppStore.getState();
  const selected = [...new Set(input.protectedPlatforms)];
  if (selected.some((id) => id !== 'instagram' && id !== 'youtube' && id !== 'tiktok' && !useWellbeingStore.getState().nativeApps.includes(id))) throw new Error('This platform needs native protection setup.');
  if (selected.some((id) => id !== 'instagram' && id !== 'youtube' && id !== 'tiktok') && (!(await blocker.isSupported()) || await blocker.getAuthorizationStatus() !== 'authorized')) throw new Error('Native protection authorization is required for this app.');
  const snapshot = snapshotProtectedSettings(state.apps, selected);
  const session = createStrictModeSession(input.durationMinutes, selected, snapshot);
  strictModeStorage.saveSession({ ...session, appIds: selected, filters: Object.fromEntries(selected.map((id) => [id, { ...snapshot[id]!.filters }])) });

  let nativeActive = false;
  try {
    if (await blocker.isSupported()) {
      const authorized = await blocker.requestAuthorization();
      if (authorized) {
        await blocker.configureProtectedApps(selected);
        await blocker.startBlocking(session);
        const status = await blocker.getBlockingStatus();
        nativeActive = status.supported && status.active;
      }
    }
  } catch { nativeActive = false; }
  strictModeStorage.setNativeProtectionActive(nativeActive);
  if (state.completionNotifications && !isOpenEndedSession(session)) void scheduleStrictModeCompletion(session.endsAt);
  void track({ type: 'STRICT_MODE_EVENT', event: 'strict_mode_started', durationMinutes: input.durationMinutes, protectedPlatformCount: selected.length, timestamp: session.startedAt });
  return { ...session, nativeProtectionActive: nativeActive };
}

let reconcileInFlight: Promise<void> | null = null;
export function reconcileStrictModeState(now = Date.now(), blocker: NativeAppBlocker = nativeAppBlocker): Promise<void> {
  if (reconcileInFlight) return reconcileInFlight;
  reconcileInFlight = (async () => {
    if (!canUseFeature(useSubscriptionStore.getState().isPro, 'strictMode')) {
      // Keep the saved session, but never restart hidden protection or its reminders.
      await cancelStrictModeCompletion();
      try { if ((await blocker.isSupported()) && (await blocker.getBlockingStatus()).active) await blocker.stopBlocking(); } catch { /* Whole-plan reconciliation retries native cleanup. */ }
      return;
    }
    const stored = strictModeStorage.getSession();
    const session = asSession(stored);
    if (!session) {
      if (stored) strictModeStorage.clearSession();
      return;
    }
    if (useAppStore.getState().completionNotifications && !isOpenEndedSession(session)) void scheduleStrictModeCompletion(session.endsAt);
    if (isStrictModeExpired(session, now)) {
      try { if ((await blocker.isSupported()) && (await blocker.getBlockingStatus()).active) await blocker.stopBlocking(); } catch { /* Expiry always unlocks in-app settings. */ }
      strictModeStorage.clearSession();
      void reconcileProtection().catch(() => undefined);
      void cancelStrictModeCompletion();
      void track({ type: 'STRICT_MODE_EVENT', event: 'strict_mode_completed', durationMinutes: Math.max(1, Math.round((session.endsAt - session.startedAt) / 60_000)), protectedPlatformCount: session.protectedPlatforms.length, timestamp: now });
      return;
    }
    try {
      if (await blocker.isSupported()) {
        const authorization = await blocker.getAuthorizationStatus();
        if (authorization === 'authorized') {
          const status = await blocker.getBlockingStatus();
          if (!status.active) {
            await blocker.configureProtectedApps(session.protectedPlatforms);
            await blocker.startBlocking(session);
          }
          const current = await blocker.getBlockingStatus();
          const actual = current.supported && current.active;
          if (actual !== Boolean(stored?.nativeProtectionActive)) strictModeStorage.setNativeProtectionActive(actual);
        } else if (stored?.nativeProtectionActive) {
          strictModeStorage.setNativeProtectionActive(false);
        }
      } else if (stored?.nativeProtectionActive) {
        strictModeStorage.setNativeProtectionActive(false);
      }
    } catch {
      if (stored?.nativeProtectionActive) strictModeStorage.setNativeProtectionActive(false);
    }
  })().finally(() => { reconcileInFlight = null; });
  return reconcileInFlight;
}

export async function endStrictModeEarly(blocker: NativeAppBlocker = nativeAppBlocker): Promise<void> {
  const session = asSession(useAppStore.getState().strictSession);
  if (!session) return;
  try { if ((await blocker.isSupported()) && (await blocker.getBlockingStatus()).active) await blocker.stopBlocking(); } catch { /* In-app recovery must remain available. */ }
  strictModeStorage.clearSession(true);
  void reconcileProtection().catch(() => undefined);
  void cancelStrictModeCompletion();
  void track({ type: 'STRICT_MODE_EVENT', event: 'strict_mode_ended_early', durationMinutes: Math.max(1, Math.round((Date.now() - session.startedAt) / 60_000)), protectedPlatformCount: session.protectedPlatforms.length, timestamp: Date.now() });
}

export function isPlatformLocked(appId: SocialAppId, session = useAppStore.getState().strictSession, now = Date.now()): boolean {
  if (!canUseFeature(useSubscriptionStore.getState().isPro, 'strictMode')) return false;
  if (session && session.endsAt > now && (session.protectedPlatforms ?? session.appIds).includes(appId)) return true;
  return canUseFeature(useSubscriptionStore.getState().isPro, 'schedules') && activeRoutines(useAppStore.getState().schedules, new Date(now)).some((routine) => routine.strict && routine.apps.includes(appId) && !routine.allowedApps?.includes(appId));
}
