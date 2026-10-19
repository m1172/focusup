import type { SocialAppId } from '../../types/app';
import { ALL_PLATFORMS } from '../protection/engine';

/** A future authenticated parent/child backend must verify and authorize policy
 * revisions. A local pairing code alone must never grant remote control. */
export type FamilyPolicy = {
  version: 1;
  revision: number;
  profileId: string;
  apps: Partial<Record<SocialAppId, { available: boolean; dailyLimitMinutes: number | null; filters: Record<string, boolean>; allowMultipleAccounts: boolean }>>;
  downtime: { start: string; end: string; weekdays: number[] }[];
};
export type FamilyPolicyProvider = { getPolicy(): Promise<FamilyPolicy | null>; verifyAndAcceptPolicy(signedPayload: string): Promise<FamilyPolicy> };
export const familyCapabilities = { linking: false, managedChildAuthorization: false, remoteEnforcement: false, nativeSectionAllowances: false, preventMultipleWebsiteAccounts: false } as const;
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
export function isValidFamilyPolicy(value: unknown): value is FamilyPolicy {
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || typeof value.profileId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value.profileId) || !object(value.apps) || !Array.isArray(value.downtime) || value.downtime.length > 16) return false;
  const filters = ['reels', 'shorts', 'explore', 'recommendations', 'homeRecommendations', 'suggestedPosts', 'homeFeed', 'comments', 'savedPosts'];
  if (!Object.entries(value.apps).every(([platform, rule]) => ALL_PLATFORMS.includes(platform as SocialAppId) && object(rule) && typeof rule.available === 'boolean' && (rule.dailyLimitMinutes === null || (Number.isInteger(rule.dailyLimitMinutes) && Number(rule.dailyLimitMinutes) > 0 && Number(rule.dailyLimitMinutes) <= 1440)) && typeof rule.allowMultipleAccounts === 'boolean' && object(rule.filters) && Object.entries(rule.filters).every(([key, enabled]) => filters.includes(key) && typeof enabled === 'boolean'))) return false;
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return value.downtime.every((item) => object(item) && typeof item.start === 'string' && clock.test(item.start) && typeof item.end === 'string' && clock.test(item.end) && item.start !== item.end && Array.isArray(item.weekdays) && item.weekdays.length > 0 && item.weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6));
}
