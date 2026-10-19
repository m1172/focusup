import { AGE_ANSWERS, MINUTE_ANSWERS, answerFor, dotSlices, projectByApp, formatInteger, formatYears, projectLifetime, reclaimedYears, targetMinutes, unitFor } from '../lifeProjection';

describe('projectLifetime', () => {
  it('projects 3 hours a day from age 25 to 6.25 years of the remaining 50', () => {
    const p = projectLifetime(180, 25);
    expect(p.remainingYears).toBe(50);
    expect(p.years).toBeCloseTo(6.25, 5);
    expect(p.daysPerYear).toBeCloseTo(45.66, 1);
    expect(p.wakingShare).toBeCloseTo(0.1875, 5);
    expect(p.totalHours).toBeCloseTo(54_787.5, 1);
    expect(p.books).toBe(7826);
    expect(p.languages).toBe(78);
    expect(p.workouts).toBe(73_050);
  });

  it('clamps ages outside the picker range', () => {
    expect(projectLifetime(60, 5).remainingYears).toBe(62);
    expect(projectLifetime(60, 90).remainingYears).toBe(10);
  });

  it('gives back half the years when use is cut in half', () => {
    expect(reclaimedYears(240, 30, 0.5)).toBeCloseTo(projectLifetime(240, 30).years / 2, 5);
  });

  it('rounds the new daily target to 15 minutes', () => {
    expect(targetMinutes(150, 0.5)).toBe(75);
    expect(targetMinutes(150, 0.25)).toBe(120);
    expect(targetMinutes(30, 0.75)).toBe(15);
  });
});

describe('formatting', () => {
  it('formats years per locale', () => {
    expect(formatYears(6.25, 'en')).toBe('6.3');
    expect(formatYears(6.25, 'ru')).toBe('6,3');
    expect(formatYears(7.02, 'en')).toBe('7');
    expect(formatYears(12.6, 'uz')).toBe('13');
  });

  it('groups thousands', () => {
    expect(formatInteger(54787, 'en')).toBe('54,787');
    expect(formatInteger(54787, 'ru')).toBe('54 787');
    expect(formatInteger(512, 'en')).toBe('512');
  });

  it('picks Russian forms for whole and fractional years', () => {
    const forms = ['год', 'года', 'лет'];
    expect(unitFor('ru', '1', forms)).toBe('год');
    expect(unitFor('ru', '3', forms)).toBe('года');
    expect(unitFor('ru', '11', forms)).toBe('лет');
    expect(unitFor('ru', '6,5', forms)).toBe('года');
    expect(unitFor('en', '1', ['year', 'years', 'years'])).toBe('year');
    expect(unitFor('en', '1,5', ['year', 'years', 'years'])).toBe('years');
  });
});

describe('per-app projection', () => {
  it('splits years by app and skips unused apps', () => {
    const parts = projectByApp({ instagram: 90, youtube: 60, tiktok: 0 }, 25);
    expect(parts.map((p) => p.appId)).toEqual(['instagram', 'youtube']);
    expect(parts[0].years + parts[1].years).toBeCloseTo(projectLifetime(150, 25).years, 5);
  });

  it('fills the last dots app after app', () => {
    // 50 years left, 1.5 + 1 social years -> dots 47 (half), 48 (instagram) and 49 (youtube) are coloured.
    expect(dotSlices(46, 50, [1.5, 1])).toEqual([]);
    expect(dotSlices(47, 50, [1.5, 1])).toEqual([[0, 0.5]]);
    expect(dotSlices(48, 50, [1.5, 1])).toEqual([[0, 1]]);
    expect(dotSlices(49, 50, [1.5, 1])).toEqual([[1, 1]]);
    expect(dotSlices(48, 50, [1.25, 1.25])).toEqual([[0, 0.75], [1, 0.25]]);
  });
});

describe('answer chips', () => {
  it('highlights the range that contains the current value', () => {
    expect(answerFor(15, MINUTE_ANSWERS)).toBe(0);
    expect(answerFor(60, MINUTE_ANSWERS)).toBe(2);
    expect(answerFor(480, MINUTE_ANSWERS)).toBe(5);
    expect(answerFor(25, AGE_ANSWERS)).toBe(2);
    expect(answerFor(65, AGE_ANSWERS)).toBe(5);
  });

  it('picks a value inside its own range', () => {
    for (const set of [MINUTE_ANSWERS, AGE_ANSWERS]) set.forEach((a, i) => expect(answerFor(a.pick, set)).toBe(i));
  });
});
