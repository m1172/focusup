import type { SupportMessage } from '../../../services/backend/types';
import { dayLabel, lastMessageId, mergeMessages, threadRows } from '../thread';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
const message = (id: number, sender: SupportMessage['sender'], createdAt: string): SupportMessage => ({ id, sender, body: `m${id}`, createdAt });

test('merges polled messages without duplicates, in server order', () => {
  const current = [message(1, 'user', at(20, 9)), message(3, 'support', at(20, 10))];
  const merged = mergeMessages(current, [message(3, 'support', at(20, 10)), message(2, 'user', at(20, 9, 30)), message(4, 'user', at(20, 11))]);
  expect(merged.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  expect(mergeMessages(current, [])).toBe(current);
  expect(lastMessageId(merged)).toBe(4);
  expect(lastMessageId([])).toBe(0);
});

test('labels local days', () => {
  const now = new Date(2026, 9, 20, 0, 30);
  expect(dayLabel(new Date(2026, 9, 20, 0, 5), now)).toBe('today');
  expect(dayLabel(new Date(2026, 9, 19, 23, 59), now)).toBe('yesterday');
  expect(dayLabel(new Date(2026, 8, 3, 12), now)).toBe('03.09.2026');
});

test('groups consecutive messages per side and day, with unsent messages last', () => {
  const now = new Date(2026, 9, 20, 12);
  const rows = threadRows([
    message(1, 'user', at(19, 22, 5)),
    message(2, 'user', at(20, 9)),
    message(3, 'user', at(20, 9, 1)),
    message(4, 'support', at(20, 10, 30)),
  ], [{ localId: 'local-1', body: 'Thanks', state: 'sending' }], now);
  expect(rows.map((row) => row.kind === 'day' ? 'day' : `${row.key}:${row.groupEnd ? 'end' : 'mid'}`)).toEqual([
    'day', 'm1:end', 'day', 'm2:mid', 'm3:end', 'm4:end', 'local-1:end',
  ]);
  const support = rows.find((row) => row.kind === 'message' && row.key === 'm4');
  expect(support).toMatchObject({ sender: 'support', time: '10:30' });
  expect(rows.at(-1)).toMatchObject({ sender: 'user', body: 'Thanks', pending: { state: 'sending' } });
});
