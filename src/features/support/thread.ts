import type { SupportMessage } from '../../services/backend/types';

/** A message typed on this device that the server has not confirmed yet. */
export type PendingMessage = { localId: string; body: string; state: 'sending' | 'failed' };

export type ThreadRow =
  | { kind: 'day'; key: string; day: Date }
  | { kind: 'message'; key: string; sender: SupportMessage['sender']; body: string; time: string; groupEnd: boolean; pending?: PendingMessage };

/** Adds newly fetched messages, dropping duplicates, ordered by server id. */
export function mergeMessages(current: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function lastMessageId(messages: SupportMessage[]): number {
  return messages.length ? messages[messages.length - 1]!.id : 0;
}

/** "09:05" in the device's time zone. */
export function clockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 'today', 'yesterday' or "20.10.2026", in local days. */
export function dayLabel(day: Date, now: Date): 'today' | 'yesterday' | string {
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const difference = Math.round((start(now) - start(day)) / 86_400_000);
  if (difference === 0) return 'today';
  if (difference === 1) return 'yesterday';
  return `${String(day.getDate()).padStart(2, '0')}.${String(day.getMonth() + 1).padStart(2, '0')}.${day.getFullYear()}`;
}

/**
 * Chat rows oldest first: a day header whenever the local day changes, and
 * `groupEnd` on the last of consecutive messages from one side (it carries the
 * time and the tail of the bubble). Unconfirmed messages come last, as "now".
 */
export function threadRows(messages: SupportMessage[], pending: PendingMessage[], now: Date): ThreadRow[] {
  const items = [
    ...messages.map((message) => ({ key: `m${message.id}`, sender: message.sender, body: message.body, date: new Date(message.createdAt), pending: undefined as PendingMessage | undefined })),
    ...pending.map((message) => ({ key: message.localId, sender: 'user' as const, body: message.body, date: now, pending: message })),
  ];
  const rows: ThreadRow[] = [];
  let previousDay = '';
  items.forEach((item, index) => {
    const date = Number.isNaN(item.date.getTime()) ? now : item.date;
    const day = date.toDateString();
    if (day !== previousDay) { rows.push({ kind: 'day', key: `d${day}`, day: date }); previousDay = day; }
    const next = items[index + 1];
    const groupEnd = !next || next.sender !== item.sender || new Date(next.date).toDateString() !== day || Boolean(item.pending) !== Boolean(next.pending);
    rows.push({ kind: 'message', key: item.key, sender: item.sender, body: item.body, time: clockTime(date), groupEnd, pending: item.pending });
  });
  return rows;
}
