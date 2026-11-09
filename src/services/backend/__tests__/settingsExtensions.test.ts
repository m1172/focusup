import { addExtensions, readExtensions, saveCompatible, withoutExtensions } from '../settingsExtensions';
import { isCloudSettings } from '../settingsValidation';
import { captureSettingsBackup } from '../settingsBackup';
import { useAppStore } from '../../../store/appStore';
import { useWellbeingStore } from '../../../store/wellbeingStore';
import { BackendError } from '../client';

describe('backup extensions', () => {
  beforeEach(() => {
    const apps = useAppStore.getState().apps;
    useAppStore.setState({ apps: { ...apps, instagram: { enabled: true, filters: { reels: true, stories: true, messagesOnly: false } } }, schedules: [{ id: 'evening', name: 'Evening', start: '20:00', end: '22:00', weekdays: [1], apps: ['instagram'], enabled: true, filters: { instagram: { reels: true, stories: true } } }] });
    useWellbeingStore.setState({ grayscale: true, dailyLimits: { instagram: 30 } });
  });

  it('keeps the old fields in the old format and moves newer settings into extensions', () => {
    const backup = captureSettingsBackup();
    expect(backup.preferences.apps.instagram.filters).toEqual({ reels: true });
    expect(backup.preferences.schedules[0].filters).toEqual({ instagram: { reels: true } });
    expect(backup.extensions).toEqual({ version: 1, grayscale: true, dailyLimits: { instagram: 30 }, filters: { instagram: { stories: true, messagesOnly: false } } });
    expect(isCloudSettings(backup)).toBe(true);
    // What an un-updated server receives after the fallback is the original format.
    expect(isCloudSettings(withoutExtensions(backup))).toBe(true);
    expect(withoutExtensions(backup)).not.toHaveProperty('extensions');
  });

  it('puts extensions back on restore, and leaves phone values alone for old backups', () => {
    const backup = captureSettingsBackup();
    expect(readExtensions(backup).apps.instagram.filters).toEqual({ reels: true, stories: true, messagesOnly: false });
    expect(readExtensions(backup).grayscale).toBe(true);
    const old = withoutExtensions(backup);
    expect(readExtensions(old)).toMatchObject({ grayscale: null, dailyLimits: null });
  });

  it('rejects malformed extensions', () => {
    const backup = captureSettingsBackup();
    expect(isCloudSettings({ ...backup, extensions: { version: 2 } })).toBe(false);
    expect(isCloudSettings({ ...backup, extensions: { version: 1, dailyLimits: { instagram: 0 } } })).toBe(false);
    expect(isCloudSettings({ ...backup, extensions: { version: 1, filters: { instagram: { reels: true } } } })).toBe(false);
    expect(addExtensions({ ...backup, preferences: { ...backup.preferences, apps: readExtensions(backup).apps } }, { grayscale: false, dailyLimits: {} }).extensions).toEqual({ version: 1, grayscale: false, dailyLimits: {}, filters: { instagram: { stories: true, messagesOnly: false } } });
  });

  it('saves without extensions when the server is older, and only then', async () => {
    const backup = captureSettingsBackup();
    const saved = { revision: 2, payload: null, updatedAt: null };
    const save = jest.fn().mockRejectedValueOnce(new BackendError(400, 'VALIDATION_ERROR', 'bad')).mockResolvedValueOnce(saved);
    await expect(saveCompatible(save, 1, backup)).resolves.toBe(saved);
    expect(save).toHaveBeenNthCalledWith(1, 1, backup);
    expect(save.mock.calls[1][1]).not.toHaveProperty('extensions');
    const conflict = jest.fn().mockRejectedValue(new BackendError(409, 'REVISION_CONFLICT', 'conflict'));
    await expect(saveCompatible(conflict, 1, backup)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    expect(conflict).toHaveBeenCalledTimes(1);
  });
});
