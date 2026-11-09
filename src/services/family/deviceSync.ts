import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { BackendError, createBackendClient } from '../backend/client';
import { secretStorage } from '../backend/secretStorage';
import { isBackendConfigured } from '../backend/accountSession';
import { reconcileProtection } from '../protection/controller';
import { protectionBridge } from '../protection/nativeBridge';
import { nativeBlockState } from '../../features/protection/nativeAppSetup';
import { isRemoteFeatureEnabled } from '../../store/remoteBlockerConfigStore';
import { currentSupervisionRules, useFamilyStore, type FamilyNotice } from '../../store/familyStore';
import { BROWSER_APPS, isBirthDate, isFamilyPolicy } from './policy';
import { familyRequiredApps, MANDATORY_FILTERS } from './resolver';
import type { FamilyDeviceReport, FamilyDeviceSync, FamilyUsageReport } from './types';
import { getLocalAnalytics } from '../analytics/localAnalytics';
import { getUnsavedActiveMs } from '../analytics/sessionTracker';
import { addLocalDays, getLocalDateKey } from '../../utils/date';

/**
 * The supervised phone's side of Vaqtim Family. It checks in on launch, on returning to the
 * foreground, every 30 seconds while open, and when a "family-refresh" push arrives. The OS does
 * not guarantee background delivery, so saved rules keep working offline and changes wait until
 * the next check-in. It reports permission and blocking state, and daily minutes in Vaqtim's clean
 * browsers (at most once a minute). Never URLs, searches, accounts, messages or other apps.
 */

const secret = secretStorage('focusup.family.device.v1');
const endpoint = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
export const FAMILY_REFRESH_KIND = 'family-refresh';
const SYNC_INTERVAL_MS = 30_000;
/** Usage goes up at most once a minute while the app is open, and when it goes to the background. */
export const USAGE_REPORT_MS = 60_000;
const DAY_MS = 86_400_000;

function deviceApi(deviceSecret: string | null) {
  return createBackendClient({ baseUrl: endpoint, allowInsecureHttp: __DEV__, getAuthorization: () => deviceSecret ? `Device ${deviceSecret}` : null });
}

/** Step 1 on the child's phone: redeem the parent's code. Returns the confirmation code the parent must type. */
export async function claimFamilyCode(code: string): Promise<string> {
  if (!isBackendConfigured()) throw new BackendError(503, 'NOT_CONFIGURED', 'Vaqtim is not connected.');
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new BackendError(400, 'UNSUPPORTED_PLATFORM', 'Use an iPhone or Android phone.');
  const claimed = await deviceApi(null).claimFamilyPairing(code, Platform.OS);
  await secret.write(claimed.deviceSecret);
  useFamilyStore.getState().setPending({ childNickname: claimed.childNickname.slice(0, 40), parentName: claimed.parentName.slice(0, 80), confirmationCode: claimed.confirmationCode, expiresAt: Date.parse(claimed.expiresAt) || Date.now() + 600_000 });
  return claimed.confirmationCode;
}

/** Leaves the "waiting for the parent" step on this phone. The unused claim expires on the server. */
export async function cancelPendingPairing() {
  if (useFamilyStore.getState().role !== 'pending') return;
  await secret.remove().catch(() => undefined);
  useFamilyStore.getState().release(null);
}

async function pushToken(): Promise<string | null> {
  try {
    // Never prompts: a token is sent only when notifications are already allowed.
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== IosAuthorizationStatus.PROVISIONAL) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return /^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]{1,200}\]$/.test(data) ? data : null;
  } catch { return null; }
}

function timezone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return /^[A-Za-z0-9_+\-/]{1,64}$/.test(zone) ? zone : 'UTC';
  } catch { return 'UTC'; }
}

let lastApplyFailed = false;

/** Today and the 6 days before it: foreground time per clean browser, including the session that is still open. */
export async function buildFamilyUsage(now = new Date()): Promise<FamilyUsageReport['days']> {
  const storage = await getLocalAnalytics();
  const days: FamilyUsageReport['days'] = [];
  for (let offset = 0; offset < 7; offset++) {
    const start = addLocalDays(now, -offset);
    const end = offset === 0 ? now : addLocalDays(now, -offset + 1);
    const key = getLocalDateKey(start);
    const apps: FamilyUsageReport['days'][number]['apps'] = {};
    for (const app of BROWSER_APPS) {
      const saved = storage.daily[key]?.platforms[app]?.durationMs ?? 0;
      apps[app] = Math.min(DAY_MS, Math.max(0, Math.round(saved + getUnsavedActiveMs(app, start.getTime(), end.getTime()))));
    }
    days.push({ day: key, apps });
  }
  return days;
}

let lastUsageAt = 0;
let usageDue = false;
/** Send usage with the next check-in even if a minute hasn't passed (the app is going to the background). */
export function reportUsageSoon() { usageDue = true; }

async function usageForSync(): Promise<FamilyUsageReport | null> {
  if (useFamilyStore.getState().role !== 'child') return null;
  if (!usageDue && Date.now() - lastUsageAt < USAGE_REPORT_MS) return null;
  try {
    const days = await buildFamilyUsage();
    lastUsageAt = Date.now(); usageDue = false;
    return { sequence: useFamilyStore.getState().nextUsageSequence(), days };
  } catch { return null; }
}

/** What the parent sees about this phone: permission, which required apps are really blocked, and the timezone. */
export async function buildFamilyReport(): Promise<FamilyDeviceReport | null> {
  const rules = currentSupervisionRules();
  if (!rules || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return null;
  const status = await protectionBridge.getStatus();
  const required = familyRequiredApps(rules);
  const blocked = required.filter((app) => nativeBlockState(status, app, true) === 'active');
  const blockerMissing = BROWSER_APPS.some((app) => rules.policy.browsers[app]?.enabled && !isRemoteFeatureEnabled(app, MANDATORY_FILTERS[app]));
  return {
    platform: Platform.OS,
    appVersion: (Constants.expoConfig?.version ?? '0').replace(/[^0-9A-Za-z.+-]/g, '').slice(0, 32) || '0',
    authorized: status.supported && status.authorized && (Platform.OS !== 'ios' || status.member === 'child'),
    member: Platform.OS === 'ios' ? status.member ?? null : null,
    blockedApps: blocked,
    missingApps: required.filter((app) => !blocked.includes(app)),
    error: !status.supported ? 'NATIVE_UNAVAILABLE' : lastApplyFailed ? 'APPLY_FAILED' : blockerMissing ? 'BLOCKER_UNAVAILABLE' : null,
    timezone: timezone(),
    utcOffsetMinutes: new Date().getTimezoneOffset(),
  };
}

/**
 * Lifts the family rules from this phone after the server said so. The server is told first: a phone that
 * cleared itself without telling the server would leave the parent waiting for a removal that already happened.
 */
async function releaseHere(deviceSecret: string, notice: FamilyNotice, acknowledge: boolean) {
  if (acknowledge) await deviceApi(deviceSecret).releaseFamilyDevice();
  await secret.remove();
  useFamilyStore.getState().release(notice);
  lastApplyFailed = false;
  await reconcileProtection().catch(() => undefined);
}

/** Applies new rules and reports "applied" only when the phone's native blocking accepted them. */
async function applyRules(revision: number): Promise<boolean> {
  try {
    const applied = await reconcileProtection();
    lastApplyFailed = !applied;
    if (applied) useFamilyStore.getState().setApplied(revision);
    return applied;
  } catch {
    lastApplyFailed = true;
    return false;
  }
}

let running: Promise<void> | null = null;
let again = false;

/** One check-in. Single-flight: a call during a running check-in runs once more after it. */
export function syncFamilyDevice(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally { running = null; }
  })();
  return running;
}

async function syncOnce() {
  const store = useFamilyStore.getState();
  if (store.role === 'none' || !isBackendConfigured()) return;
  const deviceSecret = await secret.read().catch(() => null);
  if (!deviceSecret) {
    // A pending claim without its secret cannot finish; a supervised phone without one keeps its saved rules.
    if (store.role === 'pending') useFamilyStore.getState().release(null);
    return;
  }
  let response: FamilyDeviceSync;
  try {
    const usage = await usageForSync();
    try {
      response = await deviceApi(deviceSecret).syncFamilyDevice({ appliedRevision: store.appliedRevision, report: await buildFamilyReport(), pushToken: store.role === 'child' ? await pushToken() : null, ...(usage ? { usage } : {}) });
    } catch (error) {
      // Send the usage again next time; totals with a new sequence number can't count twice.
      if (usage) usageDue = true;
      throw error;
    }
  } catch {
    // Offline or a server problem: keep enforcing the saved rules and try again on the next check-in.
    return;
  }
  useFamilyStore.getState().setSynced(Date.now());
  if (response.state === 'pending') return;
  if (response.state === 'released') { await releaseHere(deviceSecret, 'released', true); return; }
  if (response.state === 'revoked') { await releaseHere(deviceSecret, 'revoked', true); return; }
  if (response.state === 'unknown') {
    // The family was deleted, or the parent never confirmed this phone in time.
    if (store.role === 'pending') { await secret.remove().catch(() => undefined); useFamilyStore.getState().release(null); return; }
    await releaseHere(deviceSecret, 'released', false);
    return;
  }
  if (response.state !== 'active' || !isFamilyPolicy(response.policy) || !isBirthDate(response.child?.birthDate) || !Number.isSafeInteger(response.revision)) return;
  const previous = useFamilyStore.getState();
  useFamilyStore.getState().setSupervision({ childNickname: String(response.child.nickname).slice(0, 40), parentName: String(response.parentName ?? '').slice(0, 80), birthDate: response.child.birthDate, policy: response.policy, revision: response.revision });
  const needsReport = previous.appliedRevision !== response.revision || previous.role !== 'child';
  const applied = await applyRules(response.revision);
  // Tell the parent right away that the new rules are in place.
  if (applied && needsReport) again = true;
}

/** End supervision as an adult (18 or over). The server checks the age. */
export async function endSupervisionAsAdult(): Promise<void> {
  const deviceSecret = await secret.read();
  if (!deviceSecret) throw new BackendError(401, 'DEVICE_AUTH_REQUIRED', 'This phone is not connected to a family.');
  await deviceApi(deviceSecret).endFamilySupervision();
  await releaseHere(deviceSecret, 'ended', false);
}

/** Starts check-ins for a supervised or pending phone. Returns a cleanup function. */
export function startFamilySync(): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;
  const tick = () => { if (useFamilyStore.getState().role !== 'none') void syncFamilyDevice(); };
  const startTimer = () => { if (!timer) timer = setInterval(tick, SYNC_INTERVAL_MS); };
  const stopTimer = () => { if (timer) clearInterval(timer); timer = undefined; };
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') { tick(); startTimer(); return; }
    stopTimer();
    // The session just paused: send its final minutes now rather than on the next open.
    if (useFamilyStore.getState().role === 'child') { reportUsageSoon(); tick(); }
  });
  const notification = Notifications.addNotificationReceivedListener((event) => { if (event.request.content.data?.kind === FAMILY_REFRESH_KIND) tick(); });
  const hydration = useFamilyStore.persist.onFinishHydration(tick);
  const roleChanges = useFamilyStore.subscribe((state, previous) => { if (state.role !== previous.role && state.role !== 'none') tick(); });
  if (useFamilyStore.persist.hasHydrated()) tick();
  if (AppState.currentState === 'active') startTimer();
  return () => { stopTimer(); appState.remove(); notification.remove(); hydration(); roleChanges(); };
}
