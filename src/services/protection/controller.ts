import { Platform } from 'react-native';
import { useAppStore } from '../../store/appStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import type { SocialAppId } from '../../types/app';
import { track } from '../analytics/localAnalytics';
import { activeRoutines, buildNativePlan, createTemporaryAccess } from './engine';
import { protectionBridge } from './nativeBridge';
import { scheduleWellbeingNotifications } from '../notifications/wellbeingNotifications';
import { useProtectionStatusStore } from '../../store/protectionStatusStore';
import { canUseFeature } from '../subscription/subscriptionService';

let lastPlan = '';
let lastNotificationPlan = '';
let lastNotificationDay = '';
let queue: Promise<void> = Promise.resolve();
export function reconcileProtection(requireNative = false): Promise<void> {
  const operation = queue.then(async () => {
    const app = useAppStore.getState(), wellbeing = useWellbeingStore.getState();
    if (wellbeing.temporary && wellbeing.temporary.endsAt <= Date.now()) {
      const ended = wellbeing.temporary;
      wellbeing.setTemporary(null);
      void track({ type: 'PROTECTION_EVENT', event: 'temporary_access_completed', platform: ended.platform, durationMs: ended.endsAt - ended.startedAt, timestamp: ended.endsAt, eventId: ended.id + ':completed' });
    }
    const latest = useWellbeingStore.getState();
    const plan = buildNativePlan({ baseline: latest.nativeApps, routines: app.schedules, sleep: latest.sleep, strict: app.strictSession, temporary: latest.temporary, isPro: useSubscriptionStore.getState().isPro });
    plan.locale = app.selectedLanguage;
    plan.liveActivity = latest.liveActivity;
    plan.utcOffsetMinutes = new Date().getTimezoneOffset();
    const json = JSON.stringify(plan);
    const status = await protectionBridge.getStatus();
    useProtectionStatusStore.getState().setStatus(status);
    if (!status.authorized) lastPlan = '';
    if (requireNative && (!status.supported || !status.authorized)) throw new Error('nativeUnavailable');
    if (json !== lastPlan) {
      if (status.supported && status.authorized) { await protectionBridge.applyPlan(json); lastPlan = json; }
    }
    const today = new Date().toDateString();
    const reminderKey = json + ':' + app.completionNotifications;
    if (lastNotificationPlan !== reminderKey || lastNotificationDay !== today) {
      await scheduleWellbeingNotifications(plan); lastNotificationPlan = reminderKey; lastNotificationDay = today;
    }
  });
  queue = operation.catch(() => undefined);
  return operation;
}
export async function startTemporaryAccess(platform: SocialAppId, minutes: number): Promise<void> {
  const app = useAppStore.getState();
  if (!canUseFeature(useSubscriptionStore.getState().isPro, 'temporaryAccess')) throw new Error('proRequired');
  if (app.strictSession && app.strictSession.endsAt > Date.now() && app.strictSession.appIds.includes(platform)) throw new Error('strictActive');
  if (activeRoutines(app.schedules).some((routine) => routine.strict && routine.apps.includes(platform) && !routine.allowedApps?.includes(platform))) throw new Error('strictActive');
  const status = await protectionBridge.getStatus();
  if (!status.supported || !status.authorized || !status.selectedCount) throw new Error('nativeUnavailable');
  if (!useWellbeingStore.getState().nativeApps.includes(platform)) throw new Error('selectProtectedApp');
  if (status.protectedPlatforms && !status.protectedPlatforms.includes(platform) && useWellbeingStore.getState().temporary?.platform !== platform) throw new Error('selectProtectedApp');
  const access = createTemporaryAccess(platform, minutes, Platform.OS === 'ios' ? 15 : 1);
  const previous = useWellbeingStore.getState().temporary;
  useWellbeingStore.getState().setTemporary(access);
  try { lastPlan = ''; await reconcileProtection(true); }
  catch { useWellbeingStore.getState().setTemporary(previous); throw new Error('nativeUnavailable'); }
  void track({ type: 'PROTECTION_EVENT', event: 'temporary_access_started', platform, durationMs: minutes * 60_000, timestamp: access.startedAt });
  if (previous) recordCompletion(previous);
}
function recordCompletion(access: NonNullable<ReturnType<typeof useWellbeingStore.getState>['temporary']>) {
  const timestamp = Math.min(Date.now(), access.endsAt);
  void track({ type: 'PROTECTION_EVENT', event: 'temporary_access_completed', platform: access.platform, durationMs: Math.max(0, timestamp - access.startedAt), timestamp, eventId: access.id + ':completed' });
}
export async function endTemporaryAccess(): Promise<void> {
  const previous = useWellbeingStore.getState().temporary;
  useWellbeingStore.getState().setTemporary(null);
  lastPlan = '';
  try { await reconcileProtection(true); } catch { useWellbeingStore.getState().setTemporary(previous); throw new Error('nativeUnavailable'); }
  if (previous) recordCompletion(previous);
}
export function resetProtectionController() { lastPlan = ''; lastNotificationPlan = ''; lastNotificationDay = ''; }
