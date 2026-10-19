import type { Locale } from '../types/app';

/**
 * Picks a word form for a count without relying on Intl.PluralRules (not guaranteed on Hermes).
 * `forms` is [one, few, many]: Russian uses all three; English uses one/many; Uzbek has a single form.
 */
export function pluralForm(locale: Locale | string, count: number, forms: readonly string[]): string {
  const n = Math.abs(Math.floor(count));
  if (locale === 'ru') {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }
  return n === 1 ? forms[0] : forms[2];
}

/** "2 тренировки", "1 workout", "2 ta mashg‘ulot". */
export function withCount(locale: Locale | string, count: number, forms: readonly string[]): string {
  return `${count} ${pluralForm(locale, count, forms)}`;
}
