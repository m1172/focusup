import type { FocusSchedule } from '../../types/app';

export function parseClock(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return Number.NaN;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isScheduleActive(schedule: FocusSchedule, day: number, minuteOfDay: number): boolean {
  if (!schedule.enabled || schedule.start === schedule.end) return false;
  const start = parseClock(schedule.start);
  const end = parseClock(schedule.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (start < end) return schedule.weekdays.includes(day) && minuteOfDay >= start && minuteOfDay < end;
  if (minuteOfDay >= start) return schedule.weekdays.includes(day);
  if (minuteOfDay < end) return schedule.weekdays.includes((day + 6) % 7);
  return false;
}
