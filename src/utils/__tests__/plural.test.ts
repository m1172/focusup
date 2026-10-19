import { pluralForm, withCount } from '../plural';

const ru = ['тренировка', 'тренировки', 'тренировок'];
const en = ['workout', 'workouts', 'workouts'];

describe('pluralForm', () => {
  it('follows Russian plural rules', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map((n) => pluralForm('ru', n, ru))).toEqual([
      'тренировка', 'тренировки', 'тренировки', 'тренировок', 'тренировок', 'тренировок', 'тренировок', 'тренировка', 'тренировки', 'тренировок', 'тренировка', 'тренировок',
    ]);
  });
  it('uses singular only for one in English and Uzbek', () => {
    expect(withCount('en', 1, en)).toBe('1 workout');
    expect(withCount('en', 0, en)).toBe('0 workouts');
    expect(withCount('uz', 2, ['ta mashg‘ulot', 'ta mashg‘ulot', 'ta mashg‘ulot'])).toBe('2 ta mashg‘ulot');
  });
});
