import { z } from 'zod';
import { appId } from './schemas.ts';

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const uniqueApps = (max: number) => z.array(appId).max(max).refine((values) => new Set(values).size === values.length, 'Duplicate apps');
const weekdays = z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((values) => new Set(values).size === values.length, 'Duplicate weekdays');

/** Bedtime or other downtime: the listed original apps and their Vaqtim browsers are blocked. */
const downtime = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  name: z.string().trim().min(1).max(40),
  start: clock, end: clock, weekdays,
  apps: uniqueApps(8).min(1),
}).refine((value) => value.start !== value.end, 'Downtime needs a start and an end');

/** Clean browsers a teen may use. Reels, Shorts and For You stay blocked whatever these say. */
const browsers = z.strictObject({
  // hideStories, messagesOnly and hideExplore were added later; older phones never receive them unset.
  instagram: z.strictObject({ enabled: z.boolean(), followingFocus: z.boolean(), hideSponsored: z.boolean(), hideStories: z.boolean().optional(), messagesOnly: z.boolean().optional() }).optional(),
  youtube: z.strictObject({ enabled: z.boolean(), subscriptionsFocus: z.boolean(), hideSponsored: z.boolean(), hideComments: z.boolean(), hideExplore: z.boolean().optional() }).optional(),
  tiktok: z.strictObject({ enabled: z.boolean(), followingFocus: z.boolean() }).optional(),
});
const browserApp = z.enum(['instagram', 'youtube', 'tiktok']);
/** Minutes a day in each clean browser, across all its accounts. */
export const FAMILY_LIMIT_MINUTES = { min: 5, max: 720 } as const;
const limits = z.partialRecord(browserApp, z.number().int().min(FAMILY_LIMIT_MINUTES.min).max(FAMILY_LIMIT_MINUTES.max));

export const familyPolicySchema = z.strictObject({
  schemaVersion: z.literal(1),
  /** Original apps blocked on the child's phone. */
  protectedApps: uniqueApps(8),
  browsers,
  downtime: z.array(downtime).max(8).refine((values) => new Set(values.map((value) => value.id)).size === values.length, 'Duplicate downtime IDs'),
  limits: limits.optional(),
});
export type FamilyPolicy = z.infer<typeof familyPolicySchema>;

/** What a new child profile starts with: the three short-video apps blocked, no browsers, no downtime. */
export const starterFamilyPolicy: FamilyPolicy = { schemaVersion: 1, protectedApps: ['instagram', 'youtube', 'tiktok'], browsers: {}, downtime: [] };

const consentVersion = z.string().regex(/^[a-z0-9.-]{1,32}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid date');

export const familySetupSchema = z.strictObject({ country: z.string().regex(/^[A-Z]{2}$/), consentVersion });
export const addChildSchema = z.strictObject({ nickname: z.string().trim().min(1).max(40), birthDate: isoDate, consentVersion });
export const savePolicySchema = z.strictObject({ expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER - 1), policy: familyPolicySchema });
export const approvePairingSchema = z.strictObject({ confirmationCode: z.string().regex(/^\d{6}$/) });
export const childParamsSchema = z.strictObject({ childId: z.uuid() });
/** Codes are shown as ABCD-EFGH; spaces, dashes and lower case are accepted. */
export const claimSchema = z.strictObject({ code: z.string().max(20).transform((value) => value.toUpperCase().replace(/[\s-]/g, '')).pipe(z.string().regex(/^[A-HJKMNP-Z2-9]{8}$/)), platform: z.enum(['ios', 'android']) });

/** The phone's own report. Only permission and blocking state; never browsing data. */
const report = z.strictObject({
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().regex(/^[0-9A-Za-z.+-]{1,32}$/),
  authorized: z.boolean(),
  /** iOS: which Screen Time authorization this phone has. */
  member: z.enum(['child', 'individual']).nullable(),
  blockedApps: uniqueApps(8),
  missingApps: uniqueApps(8),
  error: z.enum(['NATIVE_UNAVAILABLE', 'APPLY_FAILED', 'BLOCKER_UNAVAILABLE']).nullable(),
  timezone: z.string().regex(/^[A-Za-z0-9_+\-/]{1,64}$/),
  utcOffsetMinutes: z.number().int().min(-900).max(900),
});
/**
 * Foreground time in Vaqtim's clean browsers, per local day and app, for at most the last 8 days.
 * Totals, not additions: sending the same report twice changes nothing, and the sequence number
 * lets the server ignore an older report that arrives late. Never URLs, searches or accounts.
 */
const DAY_MS = 86_400_000;
const usage = z.strictObject({
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  days: z.array(z.strictObject({ day: isoDate, apps: z.partialRecord(browserApp, z.number().int().min(0).max(DAY_MS)) })).max(8)
    .refine((values) => new Set(values.map((value) => value.day)).size === values.length, 'Duplicate days'),
});
export const deviceSyncSchema = z.strictObject({
  appliedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  report: report.nullable(),
  pushToken: z.string().regex(/^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]{1,200}\]$/).nullable(),
  // Optional so phones from before usage reporting keep syncing.
  usage: usage.nullable().optional(),
});
