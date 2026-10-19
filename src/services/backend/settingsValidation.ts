import type { CloudBackup, CloudSettings } from './types';
import { validateSleepPlan } from '../protection/engine';

const platforms = ['instagram', 'youtube', 'tiktok', 'x', 'reddit', 'snapchat', 'facebook', 'linkedin'];
const filterNames = ['reels', 'explore', 'recommendations', 'suggestedPosts', 'sponsoredPosts', 'homeFeed', 'shorts', 'homeRecommendations', 'comments', 'sponsoredContent', 'forYou'];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const integer = (value: unknown, min: number, max: number) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const time = (value: unknown) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const list = (value: unknown, allowed: readonly unknown[], min = 0) => Array.isArray(value) && value.length >= min && value.length <= allowed.length && new Set(value).size === value.length && value.every((item) => allowed.includes(item));
const filters = (value: unknown) => object(value) && keys(value, filterNames) && Object.values(value).every((item) => typeof item === 'boolean');
const platformFilters = (value: unknown) => object(value) && keys(value, platforms) && Object.values(value).every(filters);
function schedule(value: unknown): boolean {
  if (!object(value) || !keys(value, ['id', 'name', 'start', 'end', 'weekdays', 'apps', 'enabled', 'allowedApps', 'filters', 'strict', 'notify'])) return false;
  return typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100 && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 80 && time(value.start) && time(value.end) && value.start !== value.end && list(value.weekdays, [0, 1, 2, 3, 4, 5, 6], 1) && list(value.apps, platforms, 1) && typeof value.enabled === 'boolean' && (value.allowedApps === undefined || list(value.allowedApps, platforms)) && (value.filters === undefined || platformFilters(value.filters)) && (value.strict === undefined || typeof value.strict === 'boolean') && (value.notify === undefined || typeof value.notify === 'boolean');
}
export function isCloudSettings(value: unknown): value is CloudSettings {
  if (!object(value) || !keys(value, ['schemaVersion', 'preferences', 'wellbeing']) || value.schemaVersion !== 1 || !object(value.preferences) || !object(value.wellbeing)) return false;
  const p = value.preferences, w = value.wellbeing;
  if (!keys(p, ['selectedLanguage', 'themeMode', 'apps', 'schedules', 'dailyGoalMinutes', 'goalNotifications', 'completionNotifications']) || !keys(w, ['launchDestination', 'sleep'])) return false;
  if (!['uz', 'ru', 'en'].includes(p.selectedLanguage as string) || !['system', 'light', 'dark'].includes(p.themeMode as string) || !integer(p.dailyGoalMinutes, 1, 1440) || typeof p.goalNotifications !== 'boolean' || typeof p.completionNotifications !== 'boolean') return false;
  if (!object(p.apps) || !keys(p.apps, platforms) || Object.keys(p.apps).length !== platforms.length || !Object.values(p.apps).every((app) => object(app) && keys(app, ['enabled', 'filters']) && typeof app.enabled === 'boolean' && filters(app.filters))) return false;
  if (!Array.isArray(p.schedules) || p.schedules.length > 50 || !p.schedules.every(schedule) || new Set(p.schedules.map((item) => item.id)).size !== p.schedules.length) return false;
  if (!['home', 'instagram', 'youtube'].includes(w.launchDestination as string) || !object(w.sleep) || !keys(w.sleep, ['enabled', 'bedtime', 'wakeTime', 'windDownMinutes', 'morningMinutes', 'weekdays', 'apps', 'allowedApps', 'notify']) || !validateSleepPlan(w.sleep)) return false;
  return list(w.sleep.weekdays, [0, 1, 2, 3, 4, 5, 6], 1) && list(w.sleep.apps, platforms, 1) && list(w.sleep.allowedApps, platforms);
}
export function isCloudBackup(value: unknown): value is CloudBackup {
  return object(value) && keys(value, ['revision', 'payload', 'updatedAt']) && integer(value.revision, 0, Number.MAX_SAFE_INTEGER - 1) && (value.updatedAt === null || typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))) && (value.payload === null || isCloudSettings(value.payload));
}
