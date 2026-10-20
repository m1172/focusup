import { SettingsSync, type SettingsSyncDeps } from '../settingsSync';
import type { CloudBackup, CloudSettings } from '../types';

const settings = (language: string) => ({ schemaVersion: 1, preferences: { selectedLanguage: language }, wellbeing: {} }) as unknown as CloudSettings;

function setup(cloud: CloudBackup, saved: Record<string, { revision: number; snapshot: string }> = {}) {
  let local = settings('uz');
  const records = { ...saved };
  const deps = {
    getSettings: jest.fn(async () => cloud),
    saveSettings: jest.fn(async (revision: number, payload: CloudSettings) => { cloud = { revision: revision + 1, payload, updatedAt: 'now' }; return cloud; }),
    capture: () => JSON.parse(JSON.stringify(local)) as CloudSettings,
    restore: jest.fn(async (payload: CloudSettings) => { local = payload; }),
    load: async (userId: string) => records[userId] ?? null,
    save: jest.fn(async (userId: string, record: { revision: number; snapshot: string }) => { records[userId] = record; }),
    debounceMs: 1000,
  } satisfies SettingsSyncDeps;
  const sync = new SettingsSync(deps);
  return { sync, deps, records, setLocal: (value: CloudSettings) => { local = value; }, getLocal: () => local };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('SettingsSync', () => {
  it('restores an existing cloud copy on the first sign-in and does not upload over it', async () => {
    const { sync, deps, getLocal } = setup({ revision: 4, payload: settings('ru'), updatedAt: 'then' });
    sync.setUser('user-1');
    await sync.idle();
    expect(deps.restore).toHaveBeenCalledTimes(1);
    expect(getLocal().preferences.selectedLanguage).toBe('ru');
    expect(deps.saveSettings).not.toHaveBeenCalled();
  });

  it('uploads this device when the account has no cloud copy yet', async () => {
    const { sync, deps } = setup({ revision: 0, payload: null, updatedAt: null });
    sync.setUser('user-1');
    await sync.idle();
    expect(deps.restore).not.toHaveBeenCalled();
    expect(deps.saveSettings).toHaveBeenCalledWith(0, settings('uz'));
  });

  it('uploads a change after the pause, and skips settings that did not change', async () => {
    const { sync, deps, setLocal } = setup({ revision: 0, payload: null, updatedAt: null });
    sync.setUser('user-1');
    await sync.idle();
    deps.saveSettings.mockClear();

    sync.notifyChanged();
    jest.advanceTimersByTime(1000);
    await sync.idle();
    expect(deps.saveSettings).not.toHaveBeenCalled();

    setLocal(settings('en'));
    sync.notifyChanged();
    jest.advanceTimersByTime(999);
    await sync.idle();
    expect(deps.saveSettings).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await sync.idle();
    expect(deps.saveSettings).toHaveBeenCalledWith(1, settings('en'));
  });

  it('keeps syncing a device it already knows without restoring again', async () => {
    const { sync, deps, setLocal } = setup({ revision: 7, payload: settings('ru'), updatedAt: 'then' }, { 'user-1': { revision: 7, snapshot: JSON.stringify(settings('uz')) } });
    setLocal(settings('en'));
    sync.setUser('user-1');
    await sync.idle();
    expect(deps.restore).not.toHaveBeenCalled();
    expect(deps.saveSettings).toHaveBeenCalledWith(7, settings('en'));
  });

  it('wins a revision conflict with the latest cloud revision', async () => {
    const { sync, deps, setLocal } = setup({ revision: 9, payload: settings('ru'), updatedAt: 'then' }, { 'user-1': { revision: 3, snapshot: '' } });
    deps.saveSettings.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 'REVISION_CONFLICT' }));
    setLocal(settings('en'));
    sync.setUser('user-1');
    await sync.idle();
    expect(deps.saveSettings).toHaveBeenNthCalledWith(1, 3, settings('en'));
    expect(deps.saveSettings).toHaveBeenNthCalledWith(2, 9, settings('en'));
  });

  it('never uploads while a blocked first restore is pending, and retries it on flush', async () => {
    const { sync, deps } = setup({ revision: 2, payload: settings('ru'), updatedAt: 'then' });
    deps.restore.mockRejectedValueOnce(Object.assign(new Error('strict'), { code: 'STRICT_ACTIVE' }));
    sync.setUser('user-1');
    await sync.idle();
    sync.notifyChanged();
    jest.advanceTimersByTime(1000);
    await sync.idle();
    expect(deps.saveSettings).not.toHaveBeenCalled();

    await sync.flush();
    expect(deps.restore).toHaveBeenCalledTimes(2);
    expect(deps.saveSettings).not.toHaveBeenCalled();
  });

  it('drops a pending upload when the user signs out', async () => {
    const { sync, deps, setLocal } = setup({ revision: 0, payload: null, updatedAt: null });
    sync.setUser('user-1');
    await sync.idle();
    deps.saveSettings.mockClear();
    setLocal(settings('en'));
    sync.notifyChanged();
    sync.setUser(null);
    jest.advanceTimersByTime(1000);
    await sync.idle();
    expect(deps.saveSettings).not.toHaveBeenCalled();
  });
});
