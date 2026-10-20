import * as Notifications from 'expo-notifications';
import { cancelStrictModeCompletion, requestNotificationPermission, scheduleStrictModeCompletion } from '../notificationService';

jest.mock('../../../config/release', () => ({ PRO_ENABLED: true }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mock = Notifications as jest.Mocked<typeof Notifications>;

describe('local Strict Mode notifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests permission only when explicitly called and schedules a local date trigger', async () => {
    mock.getPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'undetermined', canAskAgain: true, expires: 'never' } as never).mockResolvedValueOnce({ granted: true, status: 'granted', canAskAgain: true, expires: 'never' } as never);
    mock.requestPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true, expires: 'never' } as never);
    mock.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    mock.scheduleNotificationAsync.mockResolvedValue('notification-id');
    expect(await requestNotificationPermission()).toBe(true);
    const endsAt = Date.now() + 60_000;
    await scheduleStrictModeCompletion(endsAt);
    expect(mock.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ trigger: expect.objectContaining({ date: new Date(endsAt) }) }));
    expect(mock.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('cancels only FocusUp Strict Mode completion notifications', async () => {
    mock.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'strict', content: { data: { kind: 'strict-mode-end' } } },
      { identifier: 'other', content: { data: { kind: 'other' } } },
    ] as never);
    await cancelStrictModeCompletion();
    expect(mock.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mock.cancelScheduledNotificationAsync).toHaveBeenCalledWith('strict');
  });
});
