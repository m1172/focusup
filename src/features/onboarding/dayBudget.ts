import type { Locale } from '../../types/app';

/** Onboarding is focused on the three apps FocusUp targets first. */
export const ONBOARDING_APPS = ['instagram', 'youtube', 'tiktok'] as const;
export type OnboardingAppId = (typeof ONBOARDING_APPS)[number];

/**
 * The 24-hour day shown during onboarding: 8 hours of sleep, 8 of work or study, and the
 * 8 that are actually yours. Every assumption lives here so the reveal footnote can state them plainly.
 */
export const SLEEP_HOURS = 8;
export const WORK_HOURS = 8;
export const FREE_HOURS = 24 - SLEEP_HOURS - WORK_HOURS;
export const MIN_APP_MINUTES = 15;
export const MAX_APP_MINUTES = 480;
export const HOURS_PER_BOOK = 7;
export const MINUTES_PER_WORKOUT = 45;
export const HOURS_PER_EVENING = 3;
const DAY_MINUTES = 24 * 60;
const FREE_MINUTES = FREE_HOURS * 60;
const SLEEP_MINUTES = SLEEP_HOURS * 60;
const DAYS_PER_YEAR = 365.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** How one day splits, in minutes. Social media comes out of free time first, then out of sleep. */
export type DayBudget = {
  sleep: number;
  work: number;
  social: number;
  free: number;
  /** Sleep minutes social media eats once free time runs out. */
  sleepLost: number;
  /** Share of the free hours spent on social media, 0–1. */
  freeShare: number;
};

export function splitDay(dailyMinutes: number): DayBudget {
  const social = clamp(Math.round(dailyMinutes), 0, FREE_MINUTES + SLEEP_MINUTES);
  const sleepLost = Math.max(0, social - FREE_MINUTES);
  return {
    sleep: SLEEP_MINUTES - sleepLost,
    work: WORK_HOURS * 60,
    social,
    free: Math.max(0, FREE_MINUTES - social),
    sleepLost,
    freeShare: Math.min(1, social / FREE_MINUTES),
  };
}

/** What a year of that habit adds up to. */
export type YearCost = {
  weekHours: number;
  yearHours: number;
  /** Whole free days (FREE_HOURS each) a year spent on social media. */
  freeDays: number;
  books: number;
  workouts: number;
  evenings: number;
};

export function yearCost(dailyMinutes: number): YearCost {
  const yearHours = (clamp(dailyMinutes, 0, DAY_MINUTES) / 60) * DAYS_PER_YEAR;
  return {
    weekHours: (yearHours / DAYS_PER_YEAR) * 7,
    yearHours,
    freeDays: yearHours / FREE_HOURS,
    books: Math.floor(yearHours / HOURS_PER_BOOK),
    workouts: Math.floor((yearHours * 60) / MINUTES_PER_WORKOUT),
    evenings: Math.floor(yearHours / HOURS_PER_EVENING),
  };
}

/** Daily minutes after cutting by `cut` (0–1), rounded to 15 minutes; never below 15. */
export function targetMinutes(dailyMinutes: number, cut: number) {
  return Math.max(15, Math.round((dailyMinutes * (1 - clamp(cut, 0, 1))) / 15) * 15);
}

/** Free days a year given back by dropping from `dailyMinutes` to the rounded target. */
export function reclaimedFreeDays(dailyMinutes: number, cut: number) {
  return Math.max(0, yearCost(dailyMinutes).freeDays - yearCost(targetMinutes(dailyMinutes, cut)).freeDays);
}

/** "22,812" in English, "22 812" in Russian and Uzbek. Avoids Intl, which Hermes may not ship. */
export function formatInteger(value: number, locale: Locale | string) {
  const separator = locale === 'en' ? ',' : ' ';
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Word form for a possibly fractional count. Russian uses the genitive singular for fractions
 * ("6,5 года"); otherwise it follows the [one, few, many] forms used across the app.
 */
export function unitFor(locale: Locale | string, display: string, forms: readonly string[]) {
  const n = Number(locale === 'en' ? display.replace(/,/g, '') : display.replace(/\s/g, '').replace(',', '.'));
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

export function answerFor(value: number, answers: AnswerRange[]) {
  return answers.findIndex((a) => value >= a.from && value < a.to);
}
