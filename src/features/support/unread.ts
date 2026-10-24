import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { accountApi } from '../../services/backend/accountSession';
import { isSupportReply } from '../../services/notifications/supportPush';
import { useAccountStore } from '../../store/accountStore';

const STORAGE_KEY = 'focusup-support-seen-v1';
type Seen = { userId: string; id: number };

/** The newest message id this user has had on screen in the chat on this device. */
export async function lastSeenSupportId(userId: string): Promise<number> {
  try {
    const value = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? 'null') as Seen | null;
    return value?.userId === userId && Number.isSafeInteger(value.id) ? value.id : 0;
  } catch { return 0; }
}

/** Settings checks the server at most this often; a reply notification marks the dot at once in between. */
const CHECK_EVERY_MS = 5 * 60_000;
type UnreadState = { userId: string | null; unread: boolean; checkedAt: number };
const useUnreadStore = create<UnreadState>(() => ({ userId: null, unread: false, checkedAt: 0 }));

export async function markSupportSeen(userId: string, id: number): Promise<void> {
  // The chat is on screen, so nothing in it is unread any more.
  useUnreadStore.setState({ userId, unread: false, checkedAt: Date.now() });
  if (id <= 0 || id <= (await lastSeenSupportId(userId))) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, id } satisfies Seen)).catch(() => undefined);
}

/** Whether the team answered since the user last had the chat open. Asks the server at most every few minutes. */
export function useSupportUnread(enabled: boolean): boolean {
  const userId = useAccountStore((state) => state.user?.id);
  const unread = useUnreadStore((state) => enabled && Boolean(userId) && state.userId === userId && state.unread);
  useFocusEffect(useCallback(() => {
    if (!enabled || !userId) return undefined;
    const cached = useUnreadStore.getState();
    if (cached.userId !== userId || Date.now() - cached.checkedAt >= CHECK_EVERY_MS) {
      useUnreadStore.setState({ userId, unread: cached.userId === userId && cached.unread, checkedAt: Date.now() });
      void (async () => {
        try {
          const thread = await accountApi().getSupportMessages(await lastSeenSupportId(userId));
          if (useUnreadStore.getState().userId === userId) useUnreadStore.setState({ unread: thread.messages.some((message) => message.sender === 'support') });
        } catch { useUnreadStore.setState({ checkedAt: 0 }); /* Offline: try again on the next visit. */ }
      })();
    }
    const received = Notifications.addNotificationReceivedListener((notification) => { if (isSupportReply(notification)) useUnreadStore.setState({ userId, unread: true }); });
    return () => { received.remove(); };
  }, [enabled, userId]));
  return unread;
}
