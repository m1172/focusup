import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export async function markSupportSeen(userId: string, id: number): Promise<void> {
  if (id <= 0 || id <= (await lastSeenSupportId(userId))) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, id } satisfies Seen)).catch(() => undefined);
}

/** Whether the team answered since the user last had the chat open. Checks once each time the screen gains focus. */
export function useSupportUnread(enabled: boolean): boolean {
  const userId = useAccountStore((state) => state.user?.id);
  const [unread, setUnread] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!enabled || !userId) { setUnread(false); return; }
    let active = true;
    void (async () => {
      try {
        const thread = await accountApi().getSupportMessages(await lastSeenSupportId(userId));
        if (active) setUnread(thread.messages.some((message) => message.sender === 'support'));
      } catch { /* Offline: no dot rather than a wrong one. */ }
    })();
    const received = Notifications.addNotificationReceivedListener((notification) => { if (isSupportReply(notification)) setUnread(true); });
    return () => { active = false; received.remove(); };
  }, [enabled, userId]));
  return unread;
}
