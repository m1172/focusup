import type { SocialAppId } from '../../types/app';
import type { FamilyPolicy } from './policy';
import type { ChildDeviceReport } from './resolver';

/** Shapes of the /v1/family API (backend/src/family.ts). */
export type FamilyPolicyRecord = { revision: number; policy: FamilyPolicy; updatedAt: string };
export type FamilyDeviceReport = ChildDeviceReport & { appVersion: string; timezone: string; utcOffsetMinutes: number };
export type FamilyChild = {
  id: string;
  nickname: string;
  birthDate: string;
  removalPending: boolean;
  policy: FamilyPolicyRecord;
  device: { platform: 'ios' | 'android'; enrolledAt: string; lastSeenAt: string | null; appliedRevision: number | null; report: FamilyDeviceReport | null } | null;
  pairing: { expiresAt: string; claimed: boolean; platform: 'ios' | 'android' | null } | null;
  /** Foreground time in the clean browsers for the last 7 days, as last reported by the phone. Missing days were never reported. */
  usage?: FamilyUsageRow[];
};
export type FamilyUsageRow = { day: string; platform: 'instagram' | 'youtube' | 'tiktok'; foregroundMs: number; updatedAt: string };
/** Totals per local day and app; never URLs, searches or accounts. */
export type FamilyUsageReport = { sequence: number; days: { day: string; apps: Partial<Record<'instagram' | 'youtube' | 'tiktok', number>> }[] };
export type FamilyOverview = {
  enrollmentOpen: boolean;
  countries: string[];
  consentVersion: string;
  family: { id: string; country: string; createdAt: string } | null;
  children: FamilyChild[];
};
export type FamilyClaim = { deviceSecret: string; confirmationCode: string; childNickname: string; parentName: string; expiresAt: string };
export type FamilyDeviceSyncRequest = {
  appliedRevision: number | null;
  report: FamilyDeviceReport | null;
  pushToken: string | null;
  usage?: FamilyUsageReport | null;
};
export type FamilyDeviceSync =
  | { state: 'pending'; childNickname: string }
  | { state: 'active'; child: { nickname: string; birthDate: string }; parentName: string; revision: number; policy: unknown }
  | { state: 'released' | 'revoked' | 'unknown' };
export type { SocialAppId };
