/** A notification for every given Expo push token. */
export type PushMessage = { title: string; body: string; data: Record<string, unknown> };
/** Sends through the Expo push service; resolves to the tokens Expo reports as no longer registered. */
export type PushSender = (tokens: string[], message: PushMessage) => Promise<string[]>;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo's free push service: no account key is needed unless enhanced push security is turned on. */
export function createExpoPush(fetcher: typeof fetch = fetch): PushSender {
  return async (tokens, message) => {
    if (!tokens.length) return [];
    // One request takes up to 100 messages; a user has at most five devices.
    const messages = tokens.slice(0, 100).map((to) => ({ to, ...message, channelId: 'default', priority: 'high' }));
    const response = await fetcher(EXPO_PUSH_URL, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(messages), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Expo push request failed');
    const decoded = await response.json().catch(() => null) as { data?: { status?: string; details?: { error?: string } }[] } | null;
    const tickets = Array.isArray(decoded?.data) ? decoded.data : [];
    return messages.filter((_, index) => tickets[index]?.status === 'error' && tickets[index]?.details?.error === 'DeviceNotRegistered').map((item) => item.to);
  };
}

/** What a reply notification shows: the start of the answer on one line. */
export function supportReplyPreview(text: string, limit = 100): string {
  const line = text.replace(/\s+/g, ' ').trim();
  const characters = Array.from(line);
  return characters.length <= limit ? line : characters.slice(0, limit - 1).join('').trimEnd() + '…';
}
