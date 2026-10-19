export type Locale = 'uz' | 'ru' | 'en';
export type ThemeMode = 'system' | 'light' | 'dark';
export type SocialAppId = 'instagram' | 'youtube' | 'tiktok' | 'x' | 'reddit' | 'snapchat' | 'facebook' | 'linkedin';

export type SocialAppSettings = {
  enabled: boolean;
  filters: Record<string, boolean>;
};

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
