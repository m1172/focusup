import { isScheduleActive, parseClock } from '../time';
import type { FocusSchedule } from '../../../types/app';

const base: FocusSchedule = { id: 'test', name: 'sleep', start: '22:00', end: '07:00', weekdays: [1], apps: ['instagram'], enabled: true };

describe('schedule time evaluation', () => {
  it('parses valid 24-hour clock values and rejects invalid ones', () => {
    expect(parseClock('22:30')).toBe(1350);
    expect(parseClock('24:00')).toBeNaN();
  });

  it('treats the selected weekday as the start day for an overnight schedule', () => {
    expect(isScheduleActive(base, 1, 23 * 60)).toBe(true);
    expect(isScheduleActive(base, 2, 6 * 60)).toBe(true);
    expect(isScheduleActive(base, 2, 8 * 60)).toBe(false);
  });

  it('includes the start and excludes the end of a daytime schedule', () => {
    const work = { ...base, start: '09:00', end: '18:00' };
    expect(isScheduleActive(work, 1, 540)).toBe(true);
    expect(isScheduleActive(work, 1, 1080)).toBe(false);
    expect(isScheduleActive({ ...work, enabled: false }, 1, 600)).toBe(false);
  });
});
