import * as Notifications from 'expo-notifications';
import { useAppStore } from '../../store/appStore';
import { useWellbeingStore } from '../../store/wellbeingStore';
import { activeRoutines } from '../protection/engine';
import { reconcileProtection } from '../protection/controller';
import { BackendError } from './client';
import { captureSettingsBackup } from './settingsBackup';
import { isCloudSettings } from './settingsValidation';

export function assertRestoreAllowed() {
  const app = useAppStore.getState();
  if (!useAppStore.persist.hasHydrated() || !useWellbeingStore.persist.hasHydrated()) throw new BackendError(0, 'LOCAL_NOT_READY', 'Local settings are still loading.');
  if (app.strictSession && app.strictSession.endsAt > Date.now() || activeRoutines(app.schedules).some((item) => item.strict)) throw new BackendError(409, 'STRICT_ACTIVE', 'Wait until Strict Mode or your strict routine ends before restoring.');
}
/** Explicit restore only. Device permissions, active sessions, native selections
 * and purchase entitlements are preserved. Native-application failure rolls back. */
export async function restoreCloudSettings(value: unknown): Promise<void> {
  if (!isCloudSettings(value)) throw new BackendError(400, 'INVALID_BACKUP', 'This backup cannot be restored.');
  assertRestoreAllowed();
  let remindersAllowed = false;
  try { remindersAllowed = (await Notifications.getPermissionsAsync()).granted; } catch { /* Do not request permission during restore. */ }
  assertRestoreAllowed();
  const previous = captureSettingsBackup();
  const next = JSON.parse(JSON.stringify(value)) as typeof value;
  if (!remindersAllowed) {
    next.preferences.completionNotifications = false;
    next.preferences.schedules = next.preferences.schedules.map((item) => ({ ...item, notify: false }));
    next.wellbeing.sleep.notify = false;
  }
  const apply = (snapshot: typeof value) => {
    useAppStore.setState(snapshot.preferences);
    useWellbeingStore.setState(snapshot.wellbeing);
  };
  apply(next);
  try { await reconcileProtection(); }
  catch {
    apply(previous);
    try { await reconcileProtection(); } catch { /* Keep the original local settings; report native failure. */ }
    throw new BackendError(0, 'RESTORE_FAILED', 'Restoring protection failed; your previous settings were kept.');
  }
}
