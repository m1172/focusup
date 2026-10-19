import { timeEquivalents } from '../timeEquivalents';

describe('timeEquivalents', () => {
  it('matches the design example: 5h 17m → 3 h reading, 2 workouts', () => {
    expect(timeEquivalents(317)).toEqual({ readingHours: 3, readingMinutes: 190, workouts: 2 });
  });
  it('is zero when nothing was saved', () => {
    expect(timeEquivalents(0)).toEqual({ readingHours: 0, readingMinutes: 0, workouts: 0 });
  });
});
