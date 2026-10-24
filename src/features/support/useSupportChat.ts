import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { BackendError } from '../../services/backend/client';
import { accountApi } from '../../services/backend/accountSession';
import type { SupportMessage } from '../../services/backend/types';
import { setForegroundNotificationFilter } from '../../services/notifications/notificationService';
import { isSupportReply } from '../../services/notifications/supportPush';
import { useAccountStore } from '../../store/accountStore';
import { lastMessageId, mergeMessages, type PendingMessage } from './thread';
import { syncSupportPush } from './push';
import { markSupportSeen } from './unread';

/** New replies are fetched this often while the chat is open and the app is in front. A reply notification
 * fetches at once, so this is only the fallback for devices without notifications. */
const POLL_MS = 15_000;

/** The thread survives leaving the chat (in memory only), so reopening it asks only for newer messages. */
let savedThread: { userId: string; messages: SupportMessage[] } | null = null;

export type SupportChatProblem = 'unavailable' | 'loadFailed' | 'tooFast' | null;

/** Removes reply notifications from the tray once the chat that shows them is open. */
async function dismissReplyNotifications() {
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(presented.filter(isSupportReply).map((notification) => Notifications.dismissNotificationAsync(notification.request.identifier)));
}

/**
 * The user's support thread. Loads on focus, then polls for team replies only
 * while the screen is focused and the app is active, so a closed chat costs nothing.
 * Replies that arrive while it is closed come as push notifications instead.
 */
export function useSupportChat(context: string) {
  const userId = useAccountStore((state) => state.user?.id);
  const saved = savedThread && savedThread.userId === userId ? savedThread.messages : null;
  const [messages, setMessages] = useState<SupportMessage[]>(() => saved ?? []);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState(() => !saved);
  const [problem, setProblem] = useState<SupportChatProblem>(null);
  const latest = useRef(saved ? lastMessageId(saved) : 0);
  const focused = useRef(false);
  useEffect(() => {
    if (userId) savedThread = { userId, messages };
    latest.current = lastMessageId(messages);
    if (focused.current && userId) void markSupportSeen(userId, latest.current);
  }, [messages, userId]);

  const refresh = useCallback(async () => {
    try {
      const thread = await accountApi().getSupportMessages(latest.current);
      setMessages((current) => mergeMessages(current, thread.messages));
      setProblem((current) => thread.available ? (current === 'unavailable' || current === 'loadFailed' ? null : current) : 'unavailable');
    } catch {
      setProblem((current) => current ?? 'loadFailed');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) { void refresh(); timer = setInterval(() => void refresh(), POLL_MS); } };
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    focused.current = true;
    start();
    if (userId) void markSupportSeen(userId, latest.current);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') { start(); void dismissReplyNotifications().catch(() => undefined); } else stop(); });
    // The open chat shows a reply itself, so it fetches at once instead of showing a banner.
    setForegroundNotificationFilter(isSupportReply);
    const received = Notifications.addNotificationReceivedListener((notification) => { if (isSupportReply(notification)) void refresh(); });
    void dismissReplyNotifications().catch(() => undefined);
    void syncSupportPush();
    return () => { focused.current = false; stop(); subscription.remove(); received.remove(); setForegroundNotificationFilter(null); };
  }, [refresh, userId]));

  const deliver = useCallback(async (localId: string, body: string) => {
    setPending((current) => current.map((message) => message.localId === localId ? { ...message, state: 'sending' } : message));
    try {
      const saved = await accountApi().sendSupportMessage(body, context);
      setMessages((current) => mergeMessages(current, [saved]));
      setPending((current) => current.filter((message) => message.localId !== localId));
      setProblem(null);
    } catch (error) {
      setPending((current) => current.map((message) => message.localId === localId ? { ...message, state: 'failed' } : message));
      if (error instanceof BackendError && error.status === 429) setProblem('tooFast');
      else if (error instanceof BackendError && error.code === 'SUPPORT_UNAVAILABLE') setProblem('unavailable');
    }
  }, [context]);

  const send = useCallback((text: string) => {
    const body = text.trim().slice(0, 2000);
    if (!body) return;
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPending((current) => [...current, { localId, body, state: 'sending' }]);
    void deliver(localId, body);
    // Writing is when a reply notification is worth asking for; the prompt appears once per device.
    void syncSupportPush(true);
  }, [deliver]);

  const retry = useCallback((localId: string) => {
    const message = pending.find((item) => item.localId === localId);
    if (message) void deliver(localId, message.body);
  }, [deliver, pending]);

  return { messages, pending, loading, problem, send, retry };
}
