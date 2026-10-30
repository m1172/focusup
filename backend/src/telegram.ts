import type { Config } from './config.ts';
import { ApiError } from './errors.ts';

/** The pieces of a Telegram update the support relay reads. */
export type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    reply_to_message?: { message_id: number };
  };
};

export interface SupportRelay {
  /** Whether the bot token, team chat and webhook secret are all set. */
  configured: boolean;
  /** Posts plain text (no markup) to the team chat; returns the Telegram message id. */
  post(text: string): Promise<number>;
  /** Plain-text reply in any chat; failures are ignored. */
  reply(chatId: number, messageId: number, text: string): Promise<void>;
  /** Marks a team message as delivered; failures are ignored. */
  acknowledge(messageId: number): Promise<void>;
  isTeamChat(chatId: number): boolean;
  /** Constant-time check of the X-Telegram-Bot-Api-Secret-Token header. */
  verifyWebhook(secret: string | null): boolean;
}

export function createSupportRelay(config: Config, fetcher: typeof fetch = fetch): SupportRelay {
  const token = config.TELEGRAM_BOT_TOKEN;
  const chatId = config.TELEGRAM_SUPPORT_CHAT_ID;
  const webhookSecret = config.TELEGRAM_WEBHOOK_SECRET;
  const configured = Boolean(token && chatId && webhookSecret);
  const call = async (method: string, body: unknown): Promise<unknown> => {
    if (!configured) throw new ApiError(503, 'SUPPORT_UNAVAILABLE', 'Support chat is not available right now.');
    let response: Response;
    try {
      response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ApiError(503, 'SUPPORT_UNAVAILABLE', 'Support chat is not available right now.');
    }
    const decoded = await response.json().catch(() => null) as { ok?: boolean; result?: unknown } | null;
    // Never echo Telegram's error text: it can include the request URL, which holds the token.
    if (!response.ok || !decoded?.ok) throw new ApiError(503, 'SUPPORT_UNAVAILABLE', 'Support chat is not available right now.');
    return decoded.result;
  };
  return {
    configured,
    async post(text) {
      const result = await call('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } }) as { message_id?: unknown } | null;
      if (typeof result?.message_id !== 'number') throw new ApiError(503, 'SUPPORT_UNAVAILABLE', 'Support chat is not available right now.');
      return result.message_id;
    },
    async reply(target, messageId, text) {
      await call('sendMessage', { chat_id: target, text, reply_parameters: { message_id: messageId, allow_sending_without_reply: true } }).catch(() => undefined);
    },
    async acknowledge(messageId) {
      await call('setMessageReaction', { chat_id: chatId, message_id: messageId, reaction: [{ type: 'emoji', emoji: '👍' }] }).catch(() => undefined);
    },
    isTeamChat: (id) => configured && String(id) === chatId,
    verifyWebhook(secret) {
      if (!configured || !secret) return false;
      const expected = new TextEncoder().encode(webhookSecret);
      const actual = new TextEncoder().encode(secret);
      let difference = expected.length ^ actual.length;
      for (let index = 0; index < expected.length; index++) difference |= expected[index]! ^ (actual[index] ?? 0);
      return difference === 0;
    },
  };
}

/** What the team sees for each user message. The short tag lets them tell threads apart at a glance. */
export function supportPostText(message: { userId: string; email: string | null; displayName: string; body: string; context?: string }): string {
  const who = [message.displayName.trim(), message.email].filter(Boolean).join(' · ') || 'Vaqtim user';
  const lines = [`💬 ${who}`, `#u${message.userId.replace(/-/g, '').slice(0, 8)}`, '', message.body];
  if (message.context) lines.push('', `— ${message.context}`);
  lines.push('', '↩️ Reply to this message to answer in the app.');
  return lines.join('\n');
}
