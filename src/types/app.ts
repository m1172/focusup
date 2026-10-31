export type Locale = 'uz' | 'ru' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';
export type SocialAppId = 'instagram' | 'youtube' | 'tiktok' | 'x' | 'reddit' | 'snapchat' | 'facebook' | 'linkedin';

export type SocialAppSettings = {
  /** "Show in Vaqtim": the clean in-app browser applies this app's filters. */
  enabled: boolean;
  filters: Record<string, boolean>;
  /** Block the original app; opening it leads to Vaqtim instead. Missing in settings saved before this switch existed. */
  blockNativeApp?: boolean;
  /** Block the app's website in Safari and other browsers (iOS). */
  blockWebsite?: boolean;
};

export type BlockingSwitch = 'blockNativeApp' | 'blockWebsite';

export type FocusSchedule = {
  id: string;
  name: string;
  start: string;
  end: string;
  weekdays: number[];
  apps: SocialAppId[];
  enabled: boolean;
  allowedApps?: SocialAppId[];
  filters?: Partial<Record<SocialAppId, Record<string, boolean>>>;
  strict?: boolean;
  notify?: boolean;
};

export type StrictSession = {
  id?: string;
  startedAt?: number;
  endsAt: number;
  appIds: SocialAppId[];
  filters: Partial<Record<SocialAppId, Record<string, boolean>>>;
  protectedPlatforms?: SocialAppId[];
  active?: boolean;
  nativeProtectionActive?: boolean;
  protectionSnapshot?: Partial<Record<SocialAppId, SocialAppSettings>>;
  endedEarly?: boolean;
};

export type Period = 'day' | 'week' | 'month' | 'year';
