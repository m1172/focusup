import type { Period, SocialAppId } from '../../types/app';

export type SocialPlatform = SocialAppId;
export type BlockedFeature = 'reels' | 'shorts' | 'explore' | 'recommendations' | 'suggestedPosts';
export type BlockedNavigationDestination = 'reels' | 'shorts';

export type ActiveTimeSegment = { start: number; end: number };

export type PaywallSource = import('../subscription/types').PaywallSource;

export type FocusUpAnalyticsEvent =
  | { type: 'PROTECTION_EVENT'; event: 'temporary_access_started' | 'temporary_access_completed'; platform: SocialPlatform; durationMs: number; timestamp: number; eventId?: string }
  | { type: 'SUBSCRIPTION_EVENT'; event: 'paywall_viewed' | 'plan_selected' | 'purchase_started' | 'purchase_completed' | 'purchase_cancelled' | 'purchase_failed' | 'restore_started' | 'restore_completed'; planId?: 'monthly' | 'annual'; source?: PaywallSource; timestamp: number }
  | { type: 'STRICT_MODE_EVENT'; event: 'strict_mode_started' | 'strict_mode_completed' | 'strict_mode_ended_early'; durationMinutes: number; protectedPlatformCount: number; timestamp: number }
  | { type: 'SESSION_STARTED'; platform: SocialPlatform; timestamp: number; sessionId?: string }
  | { type: 'SESSION_PAUSED'; platform: SocialPlatform; timestamp: number; startedAt: number; durationMs: number; meaningful: boolean; countSession: boolean; segments: ActiveTimeSegment[]; sessionId?: string; eventId?: string }
  | { type: 'SESSION_ENDED'; platform: SocialPlatform; timestamp: number; startedAt: number; durationMs: number; meaningful: boolean; countSession: boolean; segments: ActiveTimeSegment[]; sessionId?: string; eventId?: string }
  | { type: 'DISTRACTION_BLOCKED'; platform: SocialPlatform; feature: BlockedFeature; source: 'navigation' | 'interaction'; timestamp: number }
  | { type: 'BLOCKED_NAVIGATION'; platform: SocialPlatform; destination: BlockedNavigationDestination; timestamp: number };

export type PlatformDailyStatistics = { durationMs: number; sessionCount: number; blockedAttempts: number };
export type DailyStatistics = {
  dateKey: string;
  cleanModeDurationMs: number;
  sessionCount: number;
  blockedAttempts: number;
  platforms: Partial<Record<SocialPlatform, PlatformDailyStatistics>>;
  blockedByFeature: Partial<Record<BlockedFeature, number>>;
  temporaryAccessCount?: number;
  temporaryAccessDurationMs?: number;
};

export type AnalyticsStorage = {
  schemaVersion: number;
  events: FocusUpAnalyticsEvent[];
  daily: Record<string, DailyStatistics>;
};

export type PeriodStatistics = {
  period: Period;
  startDate: Date;
  endDate: Date;
  cleanModeDurationMs: number;
  sessionCount: number;
  blockedAttempts: number;
  platforms: { platform: SocialPlatform; durationMs: number; sessionCount: number; blockedAttempts: number }[];
  blockedByFeature: Partial<Record<BlockedFeature, number>>;
  temporaryAccessCount: number;
  temporaryAccessDurationMs: number;
  timeline: { timestamp: number; durationMs: number }[];
};

export type SavedTimeEstimate = {
  durationMs: number;
  confidence: 'low' | 'medium' | 'high';
  methodologyVersion: string;
} | null;
