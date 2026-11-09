import type { FocusSchedule, SocialAppId, SocialAppSettings } from '../../types/app';
import type { NativeProtectionPlan } from '../protection/types';
import { isScheduleActive, parseClock } from '../schedules/time';
import { ageBand, BROWSER_APPS, type BrowserApp, type FamilyDowntime, type SupervisionRules } from './policy';

/**
 * One place that turns a parent's rules into what the phone enforces: native blocking,
 * the clean browsers, and the locks shown in settings. Parent rules only ever add
 * restrictions; a stronger personal setting stays as it is.
 */

/** Feeds that stay blocked for every supervised child, whatever the parent or child chose. */
export const MANDATORY_FILTERS: Record<BrowserApp, string> = { instagram: 'reels', youtube: 'shorts', tiktok: 'forYou' };

export const isBrowserApp = (appId: SocialAppId): appId is BrowserApp => (BROWSER_APPS as SocialAppId[]).includes(appId);

/** In-browser filters the parent's rules turn on. Free for families: no Pro check applies to these. */
export function familyForcedFilters(appId: SocialAppId, rules: SupervisionRules | null): Record<string, boolean> {
  if (!rules || !isBrowserApp(appId)) return {};
  const forced: Record<string, boolean> = { [MANDATORY_FILTERS[appId]]: true };
  const { browsers } = rules.policy;
  if (appId === 'instagram' && browsers.instagram) {
    if (browsers.instagram.followingFocus) Object.assign(forced, { explore: true, recommendations: true, suggestedPosts: true });
    if (browsers.instagram.hideSponsored) forced.sponsoredPosts = true;
    if (browsers.instagram.hideStories) forced.stories = true;
    if (browsers.instagram.messagesOnly) forced.messagesOnly = true;
  }
  if (appId === 'youtube' && browsers.youtube) {
    if (browsers.youtube.subscriptionsFocus) Object.assign(forced, { homeRecommendations: true, recommendations: true });
    if (browsers.youtube.hideSponsored) forced.sponsoredContent = true;
    if (browsers.youtube.hideComments) forced.comments = true;
    if (browsers.youtube.hideExplore) forced.explore = true;
  }
  // TikTok's Following tab stays; the parent can hide Explore as well.
  if (appId === 'tiktok' && browsers.tiktok?.followingFocus) forced.explore = true;
  return forced;
}

/** The parent's daily limit for this clean browser in minutes, or null. Breaks never lift it. */
export function familyDailyLimit(appId: SocialAppId, rules: SupervisionRules | null): number | null {
  if (!rules || !isBrowserApp(appId)) return null;
  const minutes = rules.policy.limits?.[appId];
  return typeof minutes === 'number' && minutes > 0 ? minutes : null;
}

/** Original apps the family blocks all day: the listed ones, plus every app whose clean browser is on. */
export function familyBlockedApps(rules: SupervisionRules | null): SocialAppId[] {
  if (!rules) return [];
  const browsers = BROWSER_APPS.filter((app) => rules.policy.browsers[app]?.enabled);
  return [...new Set([...rules.policy.protectedApps, ...browsers])];
}

/** Every app the phone must be able to block: all-day apps and downtime apps. */
export function familyRequiredApps(rules: SupervisionRules | null): SocialAppId[] {
  if (!rules) return [];
  return [...new Set([...familyBlockedApps(rules), ...rules.policy.downtime.flatMap((item) => item.apps)])];
}

const asSchedule = (item: FamilyDowntime): FocusSchedule => ({ id: `family-${item.id}`, name: item.name, start: item.start, end: item.end, weekdays: item.weekdays, apps: item.apps, enabled: true, strict: true, notify: false });

/** Downtime as native routines. Strict, so no break can lift them. */
export function familyRoutines(rules: SupervisionRules | null): FocusSchedule[] {
  return rules ? rules.policy.downtime.map(asSchedule) : [];
}

/** The downtime blocking this app right now, on the phone's local clock. */
export function activeDowntime(rules: SupervisionRules | null, appId: SocialAppId, now = new Date()): FamilyDowntime | null {
  if (!rules) return null;
  const minute = now.getHours() * 60 + now.getMinutes();
  return rules.policy.downtime.find((item) => item.apps.includes(appId) && isScheduleActive(asSchedule(item), now.getDay(), minute)) ?? null;
}

export type DowntimeBoundary = { at: Date; kind: 'start' | 'end'; downtime: FamilyDowntime };

/** The next time any downtime starts or ends, within the coming week. */
export function nextDowntimeBoundary(rules: SupervisionRules | null, now = new Date()): DowntimeBoundary | null {
  if (!rules) return null;
  let next: DowntimeBoundary | null = null;
  for (const downtime of rules.policy.downtime) {
    const start = parseClock(downtime.start), end = parseClock(downtime.end);
    const length = ((end - start + 1440) % 1440) || 1440;
    for (let offset = -1; offset <= 7; offset++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (!downtime.weekdays.includes(day.getDay())) continue;
      const starts = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(start / 60), start % 60);
      const ends = new Date(starts.getTime() + length * 60_000);
      for (const [at, kind] of [[starts, 'start'], [ends, 'end']] as const) {
        if (at.getTime() > now.getTime() && (!next || at.getTime() < next.at.getTime())) next = { at, kind, downtime };
      }
    }
  }
  return next;
}

export type BrowserAccess = 'allowed' | 'under13' | 'notEnabled' | 'downtime' | 'blockerUnavailable';

/**
 * Whether a supervised child may open this clean browser now. `mandatoryAvailable` says whether the
 * short-video blocker can run; if it cannot, the browser stays closed rather than showing an unfiltered feed.
 */
export function familyBrowserAccess(appId: SocialAppId, rules: SupervisionRules | null, now = new Date(), mandatoryAvailable: (app: BrowserApp, feature: string) => boolean = () => true): BrowserAccess {
  if (!rules) return 'allowed';
  if (ageBand(rules.birthDate, now) === 'child') return 'under13';
  if (!isBrowserApp(appId) || !rules.policy.browsers[appId]?.enabled) return 'notEnabled';
  if (activeDowntime(rules, appId, now)) return 'downtime';
  if (!mandatoryAvailable(appId, MANDATORY_FILTERS[appId])) return 'blockerUnavailable';
  return 'allowed';
}

/** A personal app setting with the family's rules on top. Nothing the child set can weaken them. */
export function familyAppSettings(appId: SocialAppId, personal: SocialAppSettings, rules: SupervisionRules | null): SocialAppSettings {
  if (!rules) return personal;
  const forced = familyForcedFilters(appId, rules);
  const cleanOn = isBrowserApp(appId) && Boolean(rules.policy.browsers[appId]?.enabled);
  return {
    ...personal,
    enabled: personal.enabled || cleanOn,
    filters: { ...personal.filters, ...forced },
    blockNativeApp: Boolean(personal.blockNativeApp) || familyBlockedApps(rules).includes(appId),
  };
}

/** Native routines on Android are capped at 16; family downtime goes first so it is never dropped. */
const MAX_ROUTINES = 16;

/** The personal native plan with the family's rules added. No breaks while supervised. */
export function applyFamilyToPlan(plan: NativeProtectionPlan, rules: SupervisionRules | null): NativeProtectionPlan {
  if (!rules) return plan;
  const baseline = [...new Set([...plan.baseline, ...familyBlockedApps(rules)])];
  return {
    ...plan,
    baseline,
    routines: [...familyRoutines(rules), ...plan.routines.filter((routine) => !routine.id.startsWith('family-'))].slice(0, MAX_ROUTINES),
    temporary: null,
    strict: plan.strict ? { ...plan.strict, platforms: plan.strict.platforms.filter((platform) => baseline.includes(platform)) } : null,
  };
}

/** The parent-facing state of a child's protection, from what the phone last reported. */
export type ChildProtectionState = 'setupNeeded' | 'waiting' | 'applied' | 'unavailable' | 'removing';
export type ChildDeviceReport = { authorized: boolean; member: 'child' | 'individual' | null; platform: 'ios' | 'android'; blockedApps: SocialAppId[]; missingApps: SocialAppId[]; error: string | null };
export function childProtectionState(child: { removalPending: boolean; policyRevision: number; device: { appliedRevision: number | null; report: ChildDeviceReport | null } | null }): ChildProtectionState {
  if (child.removalPending) return 'removing';
  if (!child.device) return 'setupNeeded';
  const report = child.device.report;
  if (report && (!report.authorized || report.error === 'NATIVE_UNAVAILABLE' || (report.platform === 'ios' && report.member !== 'child'))) return 'unavailable';
  if (report?.missingApps.length) return 'setupNeeded';
  if (!report || (child.device.appliedRevision ?? 0) < child.policyRevision || report.error) return 'waiting';
  return 'applied';
}
