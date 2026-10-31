import { HORIZON_YEARS, MINUTE_ANSWERS, answerFor, formatInteger, insteadOf, reclaimedFreeDays, splitDay, targetMinutes, unitFor, wakingShare, weekGridRuns, weeksAhead, yearCost } from '../dayBudget';

describe('splitDay', () => {
  it('takes 3 hours a day out of the 8 free hours', () => {
    expect(splitDay(180)).toEqual({ sleep: 480, work: 480, social: 180, free: 300, sleepLost: 0, freeShare: 0.375 });
  });

  it('eats into sleep once free time runs out', () => {
    const day = splitDay(600);
    expect(day.free).toBe(0);
    expect(day.sleepLost).toBe(120);
    expect(day.sleep).toBe(360);
    expect(day.freeShare).toBe(1);
    expect(day.sleep + day.work + day.social + day.free).toBe(24 * 60);
  });

  it('never takes more than sleep and free time together', () => {
    const day = splitDay(24 * 60);
    expect(day.social).toBe(16 * 60);
    expect(day.sleep).toBe(0);
    expect(splitDay(-30).social).toBe(0);
  });
});

describe('yearCost', () => {
  it('adds up 3 hours a day over a year', () => {
    const year = yearCost(180);
    expect(year.weekHours).toBeCloseTo(21, 5);
    expect(year.yearHours).toBeCloseTo(1095.75, 2);
    expect(year.freeDays).toBeCloseTo(136.97, 1);
    expect(year.books).toBe(156);
    expect(year.workouts).toBe(1461);
    expect(year.evenings).toBe(365);
  });

  it('gives back half the free days when use is cut in half', () => {
    expect(reclaimedFreeDays(240, 0.5)).toBeCloseTo(yearCost(240).freeDays / 2, 5);
  });

  it('rounds the new daily target to 15 minutes', () => {
    expect(targetMinutes(150, 0.5)).toBe(75);
    expect(targetMinutes(150, 0.25)).toBe(120);
    expect(targetMinutes(30, 0.75)).toBe(15);
  });
});

describe('formatting', () => {
  it('groups thousands', () => {
    expect(formatInteger(54787, 'en')).toBe('54,787');
    expect(formatInteger(54787, 'ru')).toBe('54 787');
    expect(formatInteger(512, 'en')).toBe('512');
  });

  it('picks Russian forms for whole, grouped and fractional numbers', () => {
    const forms = ['день', 'дня', 'дней'];
    expect(unitFor('ru', '1', forms)).toBe('день');
    expect(unitFor('ru', '3', forms)).toBe('дня');
    expect(unitFor('ru', '11', forms)).toBe('дней');
    expect(unitFor('ru', '1 091', forms)).toBe('день');
    expect(unitFor('ru', '6,5', forms)).toBe('дня');
    expect(unitFor('en', '1', ['day', 'days', 'days'])).toBe('day');
    expect(unitFor('en', '1,096', ['day', 'days', 'days'])).toBe('days');
  });
});

describe('answer chips', () => {
  it('highlights the range that contains the current value', () => {
    expect(answerFor(15, MINUTE_ANSWERS)).toBe(0);
    expect(answerFor(60, MINUTE_ANSWERS)).toBe(2);
    expect(answerFor(480, MINUTE_ANSWERS)).toBe(5);
  });

  it('picks a value inside its own range', () => {
    MINUTE_ANSWERS.forEach((a, i) => expect(answerFor(a.pick, MINUTE_ANSWERS)).toBe(i));
  });
});

describe('wakingShare', () => {
  it('measures against the 16 waking hours', () => {
    expect(wakingShare(240)).toBe(0.25);
    expect(wakingShare(2000)).toBe(1);
    expect(wakingShare(-5)).toBe(0);
  });
});

describe('weeksAhead', () => {
  it('splits the next 10 years for someone scrolling 3 hours a day', () => {
    const weeks = weeksAhead(10, 180);
    expect(weeks.total).toBe(520);
    expect(weeks.scrolling).toBe(65); // 520 × 3/24
    expect(weeks.sleep).toBe(173); // 520 × 8/24 (173.3 rounded)
    expect(weeks.remaining).toBe(520 - 65 - 173);
    expect(weeks.scrollingYears).toBeCloseTo(1.25, 2);
  });

  it('always adds up to the whole horizon', () => {
    for (const [years, minutes] of [[1, 15], [5, 600], [10, 1440], [1, 0]]) {
      const w = weeksAhead(years, minutes);
      expect(w.scrolling + w.sleep + w.remaining).toBe(w.total);
      expect(Math.min(w.sleep, w.scrolling, w.remaining)).toBeGreaterThanOrEqual(0);
    }
  });

  it('takes scrolling out of sleep once free time is gone', () => {
    const heavy = weeksAhead(10, 16 * 60);
    expect(heavy.sleep).toBe(0);
    expect(heavy.remaining).toBe(Math.round(520 * 8 / 24));
  });
});

describe('weekGridRuns', () => {
  it('fills rows in order and wraps runs across rows', () => {
    const runs = weekGridRuns({ total: 9, scrolling: 3, sleep: 5, remaining: 1, scrollingYears: 0 }, 4);
    expect(runs).toEqual([
      { row: 0, start: 0, length: 3, kind: 'scrolling' },
      { row: 0, start: 3, length: 1, kind: 'sleep' },
      { row: 1, start: 0, length: 4, kind: 'sleep' },
      { row: 2, start: 0, length: 1, kind: 'remaining' },
    ]);
  });

  it('covers every week of each horizon exactly once', () => {
    for (const years of HORIZON_YEARS) {
      const runs = weekGridRuns(weeksAhead(years, 180), 26);
      expect(runs.reduce((sum, r) => sum + r.length, 0)).toBe(years * 52);
    }
  });
});

describe('insteadOf', () => {
  it('splits a year of 2 hours a day into reading, workouts and evenings', () => {
    const year = insteadOf(120, 1); // 43,830 minutes
    expect(year.hours).toBe(730);
    expect(year.books).toBe(62); // 438 reading hours / 7
    expect(year.workouts).toBe(292); // 30% / 45 min
    expect(year.evenings).toBe(24); // 4,383 minutes left / 180
  });

  it('scales with the period and never goes negative', () => {
    expect(insteadOf(120, 5).hours).toBe(3652);
    expect(insteadOf(0, 1)).toEqual({ hours: 0, books: 0, workouts: 0, evenings: 0 });
    expect(insteadOf(60, -1).hours).toBe(0);
  });
});
