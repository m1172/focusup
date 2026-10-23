import AsyncStorage from '@react-native-async-storage/async-storage';
import { lastSeenSupportId, markSupportSeen } from '../unread';

jest.mock('expo-notifications', () => ({}));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }));
jest.mock('../../../services/backend/accountSession', () => ({ accountApi: jest.fn() }));
jest.mock('../../../services/notifications/supportPush', () => ({ isSupportReply: jest.fn() }));

beforeEach(() => AsyncStorage.clear());

test('remembers the newest message seen, per account, and never moves backwards', async () => {
  expect(await lastSeenSupportId('user-1')).toBe(0);
  await markSupportSeen('user-1', 12);
  await markSupportSeen('user-1', 9);
  await markSupportSeen('user-1', 0);
  expect(await lastSeenSupportId('user-1')).toBe(12);
  // Another account on this device starts with nothing seen.
  expect(await lastSeenSupportId('user-2')).toBe(0);
  await AsyncStorage.setItem('focusup-support-seen-v1', '{broken');
  expect(await lastSeenSupportId('user-1')).toBe(0);
});
