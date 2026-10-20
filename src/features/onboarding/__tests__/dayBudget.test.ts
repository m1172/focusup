import { MINUTE_ANSWERS, answerFor, formatInteger, reclaimedFreeDays, splitDay, targetMinutes, unitFor, yearCost } from '../dayBudget';

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
