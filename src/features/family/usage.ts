import { BROWSER_APPS, type BrowserApp, type FamilyPolicy } from '../../services/family/policy';
import type { FamilyUsageRow } from '../../services/family/types';

export type UsageDay = { day: string; minutes: Partial<Record<BrowserApp, number>>; reported: boolean };
export type UsageSummary = {
  /** The child's today, then the 6 days before, oldest last. */
  days: UsageDay[];
  today: Record<BrowserApp, { minutes: number | null; limit: number | null; overLimit: boolean }>;
  /** True when the newest report is old, so today's numbers may be behind. */
  stale: boolean;
  lastReportAt: number | null;
};

/** A report older than this is shown as possibly out of date. */
export const USAGE_STALE_MS = 10 * 60_000;

/** The child's local date, from the timezone offset the phone reported (minutes behind UTC, as getTimezoneOffset). */
export function childDay(now: number, utcOffsetMinutes: number | null, daysBack = 0): string {
  return new Date(now - (utcOffsetMinutes ?? 0) * 60_000 - daysBack * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Turns the reported rows into what the parent sees. A day with no report stays "not reported";
 * it is never shown as zero, and nothing claims protection from usage numbers.
 */
export function summarizeUsage(rows: FamilyUsageRow[], policy: FamilyPolicy, utcOffsetMinutes: number | null, now = Date.now()): UsageSummary {
  const byDay = new Map<string, FamilyUsageRow[]>();
  for (const row of rows) byDay.set(row.day, [...(byDay.get(row.day) ?? []), row]);
  const days: UsageDay[] = Array.from({ length: 7 }, (_, back) => {
    const day = childDay(now, utcOffsetMinutes, back);
    const reported = byDay.get(day) ?? [];
    return { day, reported: reported.length > 0, minutes: Object.fromEntries(reported.map((row) => [row.platform, Math.round(row.foregroundMs / 60_000)])) };
  });
  const lastReportAt = rows.reduce<number | null>((latest, row) => { const at = Date.parse(row.updatedAt); return Number.isFinite(at) && (latest === null || at > latest) ? at : latest; }, null);
  const today = Object.fromEntries(BROWSER_APPS.map((app) => {
    const minutes = days[0]!.reported ? days[0]!.minutes[app] ?? 0 : null;
    const limit = policy.limits?.[app] ?? null;
    return [app, { minutes, limit, overLimit: minutes !== null && limit !== null && minutes >= limit }];
  })) as UsageSummary['today'];
  return { days, today, stale: lastReportAt === null || now - lastReportAt > USAGE_STALE_MS, lastReportAt };
}
