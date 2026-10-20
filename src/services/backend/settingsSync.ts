import type { CloudBackup, CloudSettings } from './types';

/** What the sync remembers per account on this device: the cloud revision and the settings it last matched. */
type SyncRecord = { revision: number; snapshot: string };

export type SettingsSyncDeps = {
  getSettings: () => Promise<CloudBackup>;
  saveSettings: (revision: number, payload: CloudSettings) => Promise<CloudBackup>;
  capture: () => CloudSettings;
  /** Applies a cloud backup locally; throws when that is not allowed right now (e.g. Strict Mode). */
  restore: (payload: CloudSettings) => Promise<void>;
  load: (userId: string) => Promise<SyncRecord | null>;
  save: (userId: string, record: SyncRecord) => Promise<void>;
  debounceMs?: number;
  log?: (step: string, details?: Record<string, string | number | boolean>) => void;
};

const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';

/**
 * Keeps the signed-in account's cloud copy of settings current without any UI.
 * - First sign-in on a device: an existing cloud copy is restored (a new phone gets its settings);
 *   with no cloud copy yet, this device's settings are uploaded.
 * - Afterwards every local change is uploaded after a short pause; this device wins revision conflicts,
 *   because the change being saved is the one the user just made here.
 * Failures stay silent and are retried on the next change, sign-in or app foreground.
 */
export class SettingsSync {
  private userId: string | null = null;
  private record: SyncRecord | null = null;
  /** True until the first-sign-in decision (restore or upload) has succeeded for the current user. */
  private pendingFirstSync = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private applyingRestore = false;

  constructor(private deps: SettingsSyncDeps) {}

  /** Call whenever the signed-in user changes (null when signed out). */
  setUser(userId: string | null) {
    if (userId === this.userId) return;
    this.cancelTimer();
    this.userId = userId; this.record = null; this.pendingFirstSync = Boolean(userId);
    if (userId) this.enqueue(() => this.start(userId));
  }

  /** Call when local settings change. Uploads after the debounce unless the change came from a restore. */
  notifyChanged() {
    if (!this.userId || this.applyingRestore) return;
    this.cancelTimer();
    this.timer = setTimeout(() => { this.timer = null; this.enqueue(() => this.upload()); }, this.deps.debounceMs ?? 4000);
  }

  /** Upload now (app going to the background) or retry an unfinished first sync (app returning). */
  flush(): Promise<void> {
    if (!this.userId) return this.queue;
    const userId = this.userId;
    this.cancelTimer();
    return this.enqueue(() => this.pendingFirstSync ? this.start(userId) : this.upload());
  }

  /** Resolves once queued work has finished; for tests. */
  idle() { return this.queue; }

  private cancelTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch((error: unknown) => { this.deps.log?.('failed', { code: errorCode(error) }); });
    return this.queue;
  }

  private async start(userId: string) {
    if (this.userId !== userId) return;
    this.record = await this.deps.load(userId);
    if (this.record) { this.pendingFirstSync = false; await this.upload(); return; }
    const cloud = await this.deps.getSettings();
    if (this.userId !== userId) return;
    if (cloud.payload) {
      this.applyingRestore = true;
      try { await this.deps.restore(cloud.payload); } finally { this.applyingRestore = false; }
      await this.remember(userId, { revision: cloud.revision, snapshot: JSON.stringify(this.deps.capture()) });
      this.deps.log?.('restored cloud settings', { revision: cloud.revision });
      this.pendingFirstSync = false;
    } else {
      await this.remember(userId, { revision: cloud.revision, snapshot: '' });
      this.pendingFirstSync = false;
      await this.upload();
    }
  }

  private async upload() {
    const userId = this.userId;
    if (!userId || this.pendingFirstSync || !this.record) return;
    const payload = this.deps.capture();
    const snapshot = JSON.stringify(payload);
    if (snapshot === this.record.snapshot) return;
    let saved: CloudBackup;
    try { saved = await this.deps.saveSettings(this.record.revision, payload); }
    catch (error) {
      if (errorCode(error) !== 'REVISION_CONFLICT') throw error;
      const latest = await this.deps.getSettings();
      saved = await this.deps.saveSettings(latest.revision, payload);
    }
    if (this.userId !== userId) return;
    await this.remember(userId, { revision: saved.revision, snapshot });
    this.deps.log?.('uploaded settings', { revision: saved.revision });
  }

  private async remember(userId: string, record: SyncRecord) {
    this.record = record;
    await this.deps.save(userId, record);
  }
}
