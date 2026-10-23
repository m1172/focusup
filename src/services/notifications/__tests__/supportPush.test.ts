import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { isSupportReply, registerSupportPush, unregisterSupportPush } from '../supportPush';
import { requestNotificationPermission } from '../notificationService';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  IosAuthorizationStatus: { PROVISIONAL: 3 },
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'project-id' } } } } }));
jest.mock('../notificationService', () => ({ ensureNotificationChannel: jest.fn().mockResolvedValue(undefined), requestNotificationPermission: jest.fn() }));

const notifications = Notifications as jest.Mocked<typeof Notifications>;
const askPermission = requestNotificationPermission as jest.MockedFunction<typeof requestNotificationPermission>;
const permission = (granted: boolean, canAskAgain = true) => ({ granted, canAskAgain, status: granted ? 'granted' : 'undetermined', expires: 'never' }) as never;
const api = () => ({ saveSupportPushToken: jest.fn().mockResolvedValue(undefined), removeSupportPushToken: jest.fn().mockResolvedValue(undefined) });

beforeEach(async () => {
  await AsyncStorage.clear();
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[device]' });
});

test('registers silently only when notifications are already allowed, and only once per user and token', async () => {
  const server = api();
  notifications.getPermissionsAsync.mockResolvedValue(permission(false));
  expect(await registerSupportPush(server, 'user-1')).toBe(false);
  expect(askPermission).not.toHaveBeenCalled();
  expect(server.saveSupportPushToken).not.toHaveBeenCalled();

  notifications.getPermissionsAsync.mockResolvedValue(permission(true));
  expect(await registerSupportPush(server, 'user-1')).toBe(true);
  expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-id' });
  expect(server.saveSupportPushToken).toHaveBeenCalledWith('ExponentPushToken[device]', 'ios');
  expect(await registerSupportPush(server, 'user-1')).toBe(true);
  expect(server.saveSupportPushToken).toHaveBeenCalledTimes(1);
  // Another account on the same device, or a rotated token, registers again.
  await registerSupportPush(server, 'user-2');
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[rotated]' });
  await registerSupportPush(server, 'user-2');
  expect(server.saveSupportPushToken).toHaveBeenCalledTimes(3);
});

test('asks for permission once per device, and never when the system will not show the prompt', async () => {
  const server = api();
  notifications.getPermissionsAsync.mockResolvedValue(permission(false, false));
  expect(await registerSupportPush(server, 'user-1', true)).toBe(false);
  expect(askPermission).not.toHaveBeenCalled();

  notifications.getPermissionsAsync.mockResolvedValue(permission(false));
  askPermission.mockResolvedValue(false);
  expect(await registerSupportPush(server, 'user-1', true)).toBe(false);
  expect(await registerSupportPush(server, 'user-1', true)).toBe(false);
  expect(askPermission).toHaveBeenCalledTimes(1);
  expect(server.saveSupportPushToken).not.toHaveBeenCalled();
});

test('registers right after the user allows notifications, and failures never throw', async () => {
  const server = api();
  notifications.getPermissionsAsync.mockResolvedValue(permission(false));
  askPermission.mockResolvedValue(true);
  expect(await registerSupportPush(server, 'user-1', true)).toBe(true);
  expect(server.saveSupportPushToken).toHaveBeenCalledTimes(1);

  await AsyncStorage.clear();
  notifications.getPermissionsAsync.mockResolvedValue(permission(true));
  notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('offline'));
  expect(await registerSupportPush(server, 'user-1')).toBe(false);
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[device]' });
  server.saveSupportPushToken.mockRejectedValue(new Error('server down'));
  expect(await registerSupportPush(server, 'user-1')).toBe(false);
  // Not remembered as registered, so the next sync retries.
  server.saveSupportPushToken.mockResolvedValue(undefined);
  expect(await registerSupportPush(server, 'user-1')).toBe(true);
  expect(server.saveSupportPushToken).toHaveBeenCalledTimes(3);
});

test('sign-out removes the registered token and forgets it locally even when the server cannot be reached', async () => {
  const server = api();
  notifications.getPermissionsAsync.mockResolvedValue(permission(true));
  await registerSupportPush(server, 'user-1');
  server.removeSupportPushToken.mockRejectedValue(new Error('offline'));
  await unregisterSupportPush(server);
  expect(server.removeSupportPushToken).toHaveBeenCalledWith('ExponentPushToken[device]');
  await unregisterSupportPush(server);
  expect(server.removeSupportPushToken).toHaveBeenCalledTimes(1);
  // After sign-out, the same user signing in again registers afresh.
  await registerSupportPush(server, 'user-1');
  expect(server.saveSupportPushToken).toHaveBeenCalledTimes(2);
});

test('recognizes only support-reply notifications', () => {
  const notification = (data: Record<string, unknown>) => ({ request: { content: { data } } }) as never;
  expect(isSupportReply(notification({ kind: 'support-reply', url: '/support' }))).toBe(true);
  expect(isSupportReply(notification({ kind: 'wellbeing' }))).toBe(false);
  expect(isSupportReply(null)).toBe(false);
});
