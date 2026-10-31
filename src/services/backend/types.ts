import type { FocusSchedule, Locale, SocialAppId, SocialAppSettings, ThemeMode } from '../../types/app';
import type { SleepPlan } from '../protection/types';

/** Only explicit user preferences enter cloud backups. Device permissions,
 * strict sessions, browsing data, analytics and purchases remain device-owned. */
export type CloudSettings = {
  schemaVersion: 1;
  preferences: {
    selectedLanguage: Locale;
    themeMode: ThemeMode;
    apps: Record<SocialAppId, SocialAppSettings>;
    schedules: FocusSchedule[];
    dailyGoalMinutes: number;
    goalNotifications: boolean;
    completionNotifications: boolean;
  };
  wellbeing: { launchDestination: 'home' | 'instagram' | 'youtube' | 'tiktok'; sleep: SleepPlan };
};
export type CloudBackup = { revision: number; payload: CloudSettings | null; updatedAt: string | null };
export type AccountProfile = { displayName: string; updatedAt: string | null };
export type Account = { id: string; email: string | null; profile: AccountProfile };
export type AuthSession = { accessToken: string; refreshToken: string; expiresAt: number | null; user: { id: string; email: string | null } };
export type OAuthProvider = 'apple' | 'google' | 'telegram';
export type Credentials = { email: string; password: string; captchaToken?: string };
export type AccountExport = { exportedAt: string; account: Pick<Account, 'id' | 'email'>; profile: AccountProfile; settings: CloudBackup };
/** One message of the user's support thread; `support` messages are the team's Telegram replies. */
export type SupportMessage = { id: number; sender: 'user' | 'support'; body: string; createdAt: string };
export type SupportThread = { available: boolean; messages: SupportMessage[] };
