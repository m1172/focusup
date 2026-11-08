import type { SocialAppId } from '../../types/app';
import { ALL_PLATFORMS } from '../protection/engine';

/**
 * Rules a parent set for one child (Vaqtim Family). The server checks the same shape
 * (backend/src/familySchemas.ts); the phone checks it again before using it.
 */
export type FamilyDowntime = { id: string; name: string; start: string; end: string; weekdays: number[]; apps: SocialAppId[] };
export type FamilyBrowsers = {
  instagram?: { enabled: boolean; followingFocus: boolean; hideSponsored: boolean };
  youtube?: { enabled: boolean; subscriptionsFocus: boolean; hideSponsored: boolean; hideComments: boolean };
  tiktok?: { enabled: boolean; followingFocus: boolean };
};
export type FamilyPolicy = { schemaVersion: 1; protectedApps: SocialAppId[]; browsers: FamilyBrowsers; downtime: FamilyDowntime[] };
export type BrowserApp = keyof FamilyBrowsers;
export const BROWSER_APPS: BrowserApp[] = ['instagram', 'youtube', 'tiktok'];

/** What a supervised phone knows: its rules plus the child's age, from the birth date the parent gave. */
export type SupervisionRules = { policy: FamilyPolicy; birthDate: string };
export type AgeBand = 'child' | 'teen' | 'adult';

const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value);
const apps = (value: unknown, max = 8): value is SocialAppId[] => Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every((app) => ALL_PLATFORMS.includes(app as SocialAppId));
const booleans = (value: unknown, keys: string[]) => object(value) && exactKeys(value, keys) && keys.every((key) => typeof value[key] === 'boolean');

export function isFamilyPolicy(value: unknown): value is FamilyPolicy {
  if (!object(value) || !exactKeys(value, ['schemaVersion', 'protectedApps', 'browsers', 'downtime']) || value.schemaVersion !== 1 || !apps(value.protectedApps)) return false;
  const browsers = value.browsers;
  if (!object(browsers) || !Object.keys(browsers).every((key) => (BROWSER_APPS as string[]).includes(key))) return false;
  if (browsers.instagram !== undefined && !booleans(browsers.instagram, ['enabled', 'followingFocus', 'hideSponsored'])) return false;
  if (browsers.youtube !== undefined && !booleans(browsers.youtube, ['enabled', 'subscriptionsFocus', 'hideSponsored', 'hideComments'])) return false;
  if (browsers.tiktok !== undefined && !booleans(browsers.tiktok, ['enabled', 'followingFocus'])) return false;
  if (!Array.isArray(value.downtime) || value.downtime.length > 8) return false;
  const ids = new Set<string>();
  return value.downtime.every((item) => {
    if (!object(item) || !exactKeys(item, ['id', 'name', 'start', 'end', 'weekdays', 'apps'])) return false;
    if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(item.id) || ids.has(item.id)) return false;
    ids.add(item.id);
    return typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 40
      && typeof item.start === 'string' && clock.test(item.start) && typeof item.end === 'string' && clock.test(item.end) && item.start !== item.end
      && Array.isArray(item.weekdays) && item.weekdays.length > 0 && item.weekdays.length <= 7 && new Set(item.weekdays).size === item.weekdays.length
      && item.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) && apps(item.apps) && (item.apps as unknown[]).length > 0;
  });
}

export function isBirthDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Whole years on the phone's local calendar day. */
export function ageOn(birthDate: string, now = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number) as [number, number, number];
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age;
}

/** Under 13: blocking only. 13 to 17: blocking plus parent-enabled clean browsers. 18 and over: may end supervision. */
export function ageBand(birthDate: string, now = new Date()): AgeBand {
  const age = ageOn(birthDate, now);
  return age < 13 ? 'child' : age < 18 ? 'teen' : 'adult';
}

/** Turns the parent's form back into a valid policy; drops browsers for children under 13. */
export function normalizePolicy(policy: FamilyPolicy, birthDate: string, now = new Date()): FamilyPolicy {
  const browsers = ageBand(birthDate, now) === 'child' ? {} : policy.browsers;
  return { schemaVersion: 1, protectedApps: [...new Set(policy.protectedApps)], browsers, downtime: policy.downtime.slice(0, 8) };
}
