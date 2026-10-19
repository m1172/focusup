import { BackendError, createBackendClient } from '../client';
import { captureSettingsBackup } from '../settingsBackup';
import { useAppStore } from '../../../store/appStore';

const response = (status: number, data?: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => data }) as Response;

test('does not send protected requests without a session', async () => {
  const fetcher = jest.fn();
  const api = createBackendClient({ baseUrl: 'https://api.example.com', fetch: fetcher });
  await expect(api.getAccount()).rejects.toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
  expect(fetcher).not.toHaveBeenCalled();
});

test('keeps OAuth public and sends session tokens only on authenticated API calls', async () => {
  const fetcher = jest.fn().mockResolvedValue(response(200, { revision: 0, payload: null }));
  const api = createBackendClient({ baseUrl: 'https://api.example.com', getAccessToken: () => 'session-token', fetch: fetcher });
  await api.startOAuth('telegram', 'challenge');
  expect(fetcher.mock.calls[0][0]).toBe('https://api.example.com/v1/auth/oauth/start');
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ provider: 'telegram', codeChallenge: 'challenge' });
  await api.getSettings();
  expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer session-token');
});

test('surfaces revision conflicts without retrying writes', async () => {
  const fetcher = jest.fn().mockResolvedValue(response(409, { error: { code: 'REVISION_CONFLICT', message: 'Read the latest settings.' } }));
  const api = createBackendClient({ baseUrl: 'https://api.example.com', getAccessToken: () => 'token', fetch: fetcher });
  await expect(api.deleteSettings(3)).rejects.toMatchObject({ status: 409, code: 'REVISION_CONFLICT' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ expectedRevision: 3 });
});

test('handles deletion responses, offline failures, and unsafe origins', async () => {
  const fetcher = jest.fn().mockResolvedValue(response(204));
  const api = createBackendClient({ baseUrl: 'https://api.example.com', getAccessToken: () => 'token', fetch: fetcher });
  await expect(api.deleteAccount()).resolves.toBeUndefined();
  fetcher.mockRejectedValue(new Error('network failed'));
  await expect(api.getAccount()).rejects.toBeInstanceOf(BackendError);
  expect(() => createBackendClient({ baseUrl: 'http://api.example.com' })).toThrow('HTTPS');
  expect(() => createBackendClient({ baseUrl: 'https://api.example.com?token=secret' })).toThrow('origin');
});

test('backup capture excludes active enforcement, onboarding answers and analytics', () => {
  const snapshot = captureSettingsBackup();
  expect(Object.keys(snapshot)).toEqual(['schemaVersion', 'preferences', 'wellbeing']);
  expect(snapshot.preferences).not.toHaveProperty('strictSession');
  expect(snapshot.preferences).not.toHaveProperty('webViewDiagnostics');
  expect(snapshot.preferences).not.toHaveProperty('onboardingCompleted');
  expect(snapshot.wellbeing).not.toHaveProperty('temporary');
  expect(snapshot.wellbeing).not.toHaveProperty('nativeApps');
  const original = useAppStore.getState().apps.instagram.filters.reels;
  snapshot.preferences.apps.instagram.filters.reels = !original;
  expect(useAppStore.getState().apps.instagram.filters.reels).toBe(original);
});
