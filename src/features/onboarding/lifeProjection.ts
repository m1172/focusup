import type { Locale } from '../../types/app';

/** Onboarding is focused on the three apps FocusUp targets first. */
export const ONBOARDING_APPS = ['instagram', 'youtube', 'tiktok'] as const;
export type OnboardingAppId = (typeof ONBOARDING_APPS)[number];

/**
 * Lifetime social-media projection shown during onboarding.
 * Every assumption lives here so the footnote on the reveal screen can state them plainly.
 */
export const LIFE_EXPECTANCY = 75;
export const WAKING_HOURS_PER_DAY = 16;
export const MIN_AGE = 13;
export const MAX_AGE = 65;
export const MIN_APP_MINUTES = 15;
export const MAX_APP_MINUTES = 480;
export const HOURS_PER_BOOK = 7;
export const HOURS_PER_LANGUAGE = 700;
export const MINUTES_PER_WORKOUT = 45;
const DAYS_PER_YEAR = 365.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type LifeProjection = {
  /** Years from today until LIFE_EXPECTANCY. */
  remainingYears: number;
  /** Whole years of the remaining life spent on social media (24h days). */
  years: number;
  totalHours: number;
  /** Full days per year spent on social media. */
  daysPerYear: number;
  /** Share of waking hours, 0–1. */
  wakingShare: number;
  books: number;
  languages: number;
  workouts: number;
};

export function projectLifetime(dailyMinutes: number, age: number): LifeProjection {
  const minutes = clamp(dailyMinutes, 0, 24 * 60);
  const remainingYears = LIFE_EXPECTANCY - clamp(Math.round(age), MIN_AGE, MAX_AGE);
  const totalHours = (minutes / 60) * DAYS_PER_YEAR * remainingYears;
  return {
    remainingYears,
    years: totalHours / (24 * DAYS_PER_YEAR),
    totalHours,
    daysPerYear: (minutes * DAYS_PER_YEAR) / (24 * 60),
    wakingShare: minutes / (WAKING_HOURS_PER_DAY * 60),
    books: Math.floor(totalHours / HOURS_PER_BOOK),
    languages: Math.floor(totalHours / HOURS_PER_LANGUAGE),
    workouts: Math.floor((totalHours * 60) / MINUTES_PER_WORKOUT),
  };
}

/** Each app's share of the projected years, in ONBOARDING_APPS order. */
export function projectByApp(minutesByApp: Partial<Record<OnboardingAppId, number>>, age: number) {
  return ONBOARDING_APPS.filter((id) => (minutesByApp[id] ?? 0) > 0).map((id) => ({ appId: id, minutes: minutesByApp[id] ?? 0, years: projectLifetime(minutesByApp[id] ?? 0, age).years }));
}

/**
 * Splits one year-dot of the life grid into coloured slices. The social-media years sit at the end
 * of the remaining life, app after app; `index` is the dot's year. Returns [appIndex, fraction] pairs.
 */
export function dotSlices(index: number, remaining: number, yearsPerApp: number[]): [number, number][] {
  const total = yearsPerApp.reduce((a, b) => a + b, 0);
  let cursor = remaining - total;
  const slices: [number, number][] = [];
  yearsPerApp.forEach((years, app) => {
    const from = Math.max(cursor, index), to = Math.min(cursor + years, index + 1);
    if (to > from) slices.push([app, to - from]);
    cursor += years;
  });
  return slices;
}

/** Daily minutes after cutting by `cut` (0–1), rounded to 15 minutes; never below 15. */
export function targetMinutes(dailyMinutes: number, cut: number) {
  return Math.max(15, Math.round((dailyMinutes * (1 - clamp(cut, 0, 1))) / 15) * 15);
}

/** Years given back by dropping from `dailyMinutes` to the rounded target. */
export function reclaimedYears(dailyMinutes: number, age: number, cut: number) {
  return projectLifetime(dailyMinutes, age).years - projectLifetime(targetMinutes(dailyMinutes, cut), age).years;
}

/** One decimal under 10 ("6.5", "6,5" in ru/uz), whole numbers above; a trailing ".0" is dropped. */
export function formatYears(value: number, locale: Locale | string) {
  const text = value >= 10 ? String(Math.round(value)) : (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return locale === 'en' ? text : text.replace('.', ',');
}

/** "22,812" in English, "22 812" in Russian and Uzbek. Avoids Intl, which Hermes may not ship. */
export function formatInteger(value: number, locale: Locale | string) {
  const separator = locale === 'en' ? ',' : ' ';
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Word form for a possibly fractional count. Russian uses the genitive singular for fractions
 * ("6,5 года"); otherwise it follows the [one, few, many] forms used across the app.
 */
export function unitFor(locale: Locale | string, display: string, forms: readonly string[]) {
  const n = Number(display.replace(',', '.'));
  if (!Number.isInteger(n)) return locale === 'ru' ? forms[1] : forms[2];
  if (locale === 'ru') {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
    return forms[2];
  }
  return n === 1 ? forms[0] : forms[2];
}

/** Tap-to-pick answer ranges: [from, to) with the value a tap selects. `to` of the last one is open. */
export type AnswerRange = { from: number; to: number; pick: number };

export const MINUTE_ANSWERS: AnswerRange[] = [
  { from: 0, to: 30, pick: 15 },
  { from: 30, to: 60, pick: 45 },
  { from: 60, to: 120, pick: 90 },
  { from: 120, to: 180, pick: 150 },
  { from: 180, to: 240, pick: 210 },
  { from: 240, to: Infinity, pick: 300 },
];

export const AGE_ANSWERS: AnswerRange[] = [
  { from: 13, to: 18, pick: 16 },
  { from: 18, to: 25, pick: 21 },
  { from: 25, to: 35, pick: 29 },
  { from: 35, to: 45, pick: 39 },
  { from: 45, to: 55, pick: 49 },
  { from: 55, to: Infinity, pick: 58 },
];

export function answerFor(value: number, answers: AnswerRange[]) {
  return answers.findIndex((a) => value >= a.from && value < a.to);
}
