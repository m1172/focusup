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
};
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
};
export type FamilyDeviceSync =
  | { state: 'pending'; childNickname: string }
  | { state: 'active'; child: { nickname: string; birthDate: string }; parentName: string; revision: number; policy: unknown }
  | { state: 'released' | 'revoked' | 'unknown' };
export type { SocialAppId };
