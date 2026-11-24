import type { SocialAppId } from '../../types/app';
import type { BackgroundStatus } from '../../services/device-background/androidBackground';

export type BlockingIssue =
  /** Android switched Vaqtim's Accessibility service off (it does after some updates and restarts). */
  | { kind: 'accessibilityOff'; apps: SocialAppId[] }
  /** Battery saving can stop Vaqtim in the background, and blocking with it. */
  | { kind: 'battery'; maker: string; hasAutoStart: boolean };

/** What stops the real apps from being blocked on this Android phone, most urgent first. Nothing to report: null. */
export function blockingIssue(input: { android: boolean; wantedApps: SocialAppId[]; supported: boolean; authorized: boolean; background: BackgroundStatus | null }): BlockingIssue | null {
  if (!input.android || !input.supported || input.wantedApps.length === 0) return null;
  if (!input.authorized) return { kind: 'accessibilityOff', apps: input.wantedApps };
  if (input.background?.batteryRestricted) return { kind: 'battery', maker: input.background.maker, hasAutoStart: input.background.hasAutoStart };
  return null;
}

/** "xiaomi" → "Xiaomi"; unknown makers get no name. */
export function makerName(maker: string): string {
  const clean = maker.trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
}
