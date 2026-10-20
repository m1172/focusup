import { z } from 'zod';

export const appId = z.enum(['instagram', 'youtube', 'tiktok', 'x', 'reddit', 'snapchat', 'facebook', 'linkedin']);
const apps = z.array(appId).max(8).refine((values) => new Set(values).size === values.length, 'Duplicate apps');
const weekdays = z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((values) => new Set(values).size === values.length, 'Duplicate weekdays');
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const filterNames = ['reels', 'explore', 'recommendations', 'suggestedPosts', 'sponsoredPosts', 'homeFeed', 'shorts', 'homeRecommendations', 'comments', 'sponsoredContent', 'forYou'] as const;
const filters = z.partialRecord(z.enum(filterNames), z.boolean());
const platformFilters = z.partialRecord(appId, filters);
const schedule = z.strictObject({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(80),
  start: clock, end: clock, weekdays, apps, enabled: z.boolean(), allowedApps: apps.optional(),
  filters: platformFilters.optional(), strict: z.boolean().optional(), notify: z.boolean().optional(),
});
export const settingsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  preferences: z.strictObject({
    selectedLanguage: z.enum(['uz', 'ru', 'en']), themeMode: z.enum(['system', 'light', 'dark']),
    apps: z.record(appId, z.strictObject({ enabled: z.boolean(), filters })),
    schedules: z.array(schedule).max(50).refine((values) => new Set(values.map((value) => value.id)).size === values.length, 'Duplicate schedule IDs'),
    dailyGoalMinutes: z.number().int().min(1).max(1440),
    goalNotifications: z.boolean(), completionNotifications: z.boolean(),
  }),
  wellbeing: z.strictObject({
    launchDestination: z.enum(['home', 'instagram', 'youtube']),
    sleep: z.strictObject({
      enabled: z.boolean(), bedtime: clock, wakeTime: clock,
      windDownMinutes: z.number().int().min(0).max(180), morningMinutes: z.number().int().min(0).max(180),
      weekdays, apps, allowedApps: apps, notify: z.boolean(),
    }),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;
export const revisionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
export const saveSettingsSchema = z.strictObject({ expectedRevision: revisionSchema, payload: settingsSchema });
export const deleteSettingsSchema = z.strictObject({ expectedRevision: revisionSchema });
export const profileSchema = z.strictObject({ displayName: z.string().trim().max(80) });
export const credentialsSchema = z.strictObject({ email: z.email().max(254), password: z.string().min(1).max(128), captchaToken: z.string().min(1).max(4096).optional() });
export const signupSchema = credentialsSchema.extend({ password: z.string().min(8).max(128) });
export const refreshSchema = z.strictObject({ refreshToken: z.string().min(1).max(4096) });
export const recoverySchema = z.strictObject({ email: z.email().max(254), captchaToken: z.string().min(1).max(4096).optional() });
export const passwordSchema = z.strictObject({ password: z.string().min(8).max(128) });
export const verifySchema = z.strictObject({ tokenHash: z.string().min(1).max(4096), type: z.enum(['email', 'recovery']) });
export const verifyCodeSchema = z.strictObject({ email: z.email().max(254), token: z.string().regex(/^\d{6,10}$/), type: z.enum(['signup', 'recovery']) });
export const resendSchema = z.strictObject({ email: z.email().max(254), captchaToken: z.string().min(1).max(4096).optional() });
export const oauthStartSchema = z.strictObject({ provider: z.enum(['google', 'apple', 'telegram']), codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const oauthExchangeSchema = z.strictObject({ code: z.string().min(1).max(4096), codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) });
export const idTokenSchema = z.strictObject({ provider: z.enum(['apple', 'google']), idToken: z.string().min(1).max(16384), nonce: z.string().min(16).max(256) });
