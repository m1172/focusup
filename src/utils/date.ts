import type { Period } from '../types/app';

export function getLocalDateKey(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

export function startOfPeriod(period: Period, date: Date): Date {
  if (period === 'day') return startOfLocalDay(date);
  if (period === 'week') {
    const mondayOffset = (date.getDay() + 6) % 7;
    return addLocalDays(startOfLocalDay(date), -mondayOffset);
  }
  if (period === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
  return new Date(date.getFullYear(), 0, 1);
}

export function endOfPeriod(period: Period, date: Date): Date {
  const start = startOfPeriod(period, date);
  if (period === 'day') return addLocalDays(start, 1);
  if (period === 'week') return addLocalDays(start, 7);
  if (period === 'month') return new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return new Date(start.getFullYear() + 1, 0, 1);
}

export function previousPeriod(period: Period, date: Date): { start: Date; end: Date } {
  const currentStart = startOfPeriod(period, date);
  const previousDate = period === 'day' || period === 'week'
    ? addLocalDays(currentStart, period === 'day' ? -1 : -7)
    : period === 'month'
      ? new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1)
      : new Date(currentStart.getFullYear() - 1, 0, 1);
  return { start: startOfPeriod(period, previousDate), end: currentStart };
}

export function splitIntervalByLocalDay(start: number, end: number): Record<string, number> {
  const result: Record<string, number> = {};
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return result;
  let cursor = start;
  while (cursor < end) {
    const dayStart = startOfLocalDay(new Date(cursor));
    const nextDay = addLocalDays(dayStart, 1);
    const segmentEnd = Math.min(end, nextDay.getTime());
    const key = getLocalDateKey(cursor);
    result[key] = (result[key] ?? 0) + segmentEnd - cursor;
    cursor = segmentEnd;
  }
  return result;
}

export function enumerateLocalDays(start: Date, endExclusive: Date): Date[] {
  const result: Date[] = [];
  for (let cursor = startOfLocalDay(start); cursor < endExclusive; cursor = addLocalDays(cursor, 1)) result.push(cursor);
  return result;
}
