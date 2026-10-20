import { PRO_ENABLED } from '../config/release';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FocusSchedule, Locale, SocialAppId, SocialAppSettings, StrictSession, ThemeMode } from '../types/app';
import type { DiagnosticsByPlatform, WebViewDiagnostics } from '../types/social';

type AppState = {
  onboardingCompleted: boolean;
  selectedLanguage: Locale;
  themeMode: ThemeMode;
  apps: Record<SocialAppId, SocialAppSettings>;
  schedules: FocusSchedule[];
  strictSession: StrictSession | null;
  dailyGoalMinutes: number;
  goalNotifications: boolean;
  completionNotifications: boolean;
  webViewDiagnostics: DiagnosticsByPlatform;
  setLanguage: (language: Locale) => void;
  setTheme: (mode: ThemeMode) => void;
  setAppEnabled: (appId: SocialAppId, enabled: boolean) => void;
  setFilter: (appId: SocialAppId, filter: string, enabled: boolean) => void;
  completeOnboarding: () => void;
  saveSchedule: (schedule: FocusSchedule) => void;
  deleteSchedule: (id: string) => void;
  setScheduleEnabled: (id: string, enabled: boolean) => void;
  startStrict: (minutes: number) => void;
  activateStrict: (session: StrictSession) => void;
  finishStrict: (endedEarly?: boolean) => void;
  setStrictNativeProtection: (active: boolean) => void;
  setDailyGoal: (minutes: number) => void;
  setGoalNotifications: (enabled: boolean) => void;
  setCompletionNotifications: (enabled: boolean) => void;
  setWebViewDiagnostics: (appId: SocialAppId, diagnostics: WebViewDiagnostics | null) => void;
};

export const supportedAppIds: SocialAppId[] = ['instagram', 'youtube'];
const defaults: Record<SocialAppId, SocialAppSettings> = {
  instagram: { enabled: true, filters: { reels: true, explore: true, recommendations: true, suggestedPosts: true, sponsoredPosts: false, homeFeed: false } },
  youtube: { enabled: true, filters: { shorts: true, recommendations: true, homeRecommendations: true, comments: false, sponsoredContent: false } },
  tiktok: { enabled: false, filters: { forYou: true } },
  x: { enabled: false, filters: { recommendations: true } },
  reddit: { enabled: false, filters: { recommendations: true } },
  snapchat: { enabled: false, filters: {} },
  facebook: { enabled: false, filters: {} },
  linkedin: { enabled: false, filters: {} },
};

const starterSchedules: FocusSchedule[] = [
  { id: 'starter-work', name: 'work', start: '09:00', end: '18:00', weekdays: [1, 2, 3, 4, 5], apps: ['instagram', 'youtube'], enabled: false },
  { id: 'starter-sleep', name: 'sleep', start: '22:00', end: '07:00', weekdays: [0, 1, 2, 3, 4, 5, 6], apps: ['instagram', 'youtube'], enabled: false },
  { id: 'starter-study', name: 'study', start: '19:00', end: '21:00', weekdays: [1, 2, 3, 4, 5], apps: ['instagram', 'youtube'], enabled: false },
];

export const useAppStore = create<AppState>()(persist((set, get) => ({
  onboardingCompleted: false,
  selectedLanguage: 'uz',
  themeMode: 'system',
  apps: defaults,
  schedules: starterSchedules,
  strictSession: null,
  dailyGoalMinutes: 120,
  goalNotifications: true,
  completionNotifications: false,
  webViewDiagnostics: {},
  setLanguage: (selectedLanguage) => set({ selectedLanguage }),
  setTheme: (themeMode) => set({ themeMode }),
  setAppEnabled: (appId, enabled) => set((state) => {
    if (PRO_ENABLED && state.strictSession && state.strictSession.endsAt > Date.now() && state.strictSession.appIds.includes(appId)) return state;
    return { apps: { ...state.apps, [appId]: { ...state.apps[appId], enabled } } };
  }),
  setFilter: (appId, filter, enabled) => set((state) => {
    if (PRO_ENABLED && state.strictSession && state.strictSession.endsAt > Date.now() && state.strictSession.appIds.includes(appId)) return state;
    return { apps: { ...state.apps, [appId]: { ...state.apps[appId], filters: { ...state.apps[appId].filters, [filter]: enabled } } } };
  }),
  completeOnboarding: () => set({ onboardingCompleted: true }),
  saveSchedule: (schedule) => set((state) => ({ schedules: [...state.schedules.filter((item) => item.id !== schedule.id), schedule] })),
  deleteSchedule: (id) => set((state) => ({ schedules: state.schedules.filter((item) => item.id !== id) })),
  setScheduleEnabled: (id, enabled) => set((state) => ({ schedules: state.schedules.map((item) => item.id === id ? { ...item, enabled } : item) })),
  startStrict: (minutes) => {
    if (!PRO_ENABLED) return;
    const appIds = supportedAppIds.filter((id) => get().apps[id].enabled);
    if (appIds.length === 0) return;
    const apps = get().apps;
    const now = Date.now();
    set({ strictSession: { id: `strict-${now}`, startedAt: now, endsAt: now + minutes * 60_000, appIds, protectedPlatforms: appIds, active: true, nativeProtectionActive: false, protectionSnapshot: Object.fromEntries(appIds.map((id) => [id, { ...apps[id], filters: { ...apps[id].filters } }])), filters: Object.fromEntries(appIds.map((id) => [id, { ...apps[id].filters }])) } });
  },
  activateStrict: (strictSession) => set({ strictSession }),
  finishStrict: (_endedEarly) => set({ strictSession: null }),
  setStrictNativeProtection: (active) => set((state) => state.strictSession ? { strictSession: { ...state.strictSession, nativeProtectionActive: active } } : state),
  setDailyGoal: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
  setGoalNotifications: (goalNotifications) => set({ goalNotifications }),
  setCompletionNotifications: (completionNotifications) => set({ completionNotifications }),
  setWebViewDiagnostics: (appId, diagnostics) => set((state) => ({ webViewDiagnostics: { ...state.webViewDiagnostics, [appId]: diagnostics ?? undefined } })),
}), {
  name: 'focusup-preferences-v1',
  storage: createJSONStorage(() => AsyncStorage),
  version: 4,
  partialize: (state) => ({
    onboardingCompleted: state.onboardingCompleted,
    selectedLanguage: state.selectedLanguage,
    themeMode: state.themeMode,
    apps: state.apps,
    schedules: state.schedules,
    strictSession: state.strictSession,
    dailyGoalMinutes: state.dailyGoalMinutes,
    goalNotifications: state.goalNotifications,
    completionNotifications: state.completionNotifications,
  }),
  migrate: (persisted, version) => {
    const state = (persisted ?? {}) as Partial<AppState>;
    delete (state as Partial<AppState> & { demoPro?: boolean }).demoPro;
    const storedApps = state.apps ?? defaults;
    const storedInstagram = storedApps.instagram ?? defaults.instagram;
    const legacyFilters = storedInstagram.filters ?? {};
    const instagramFilters = {
      ...defaults.instagram.filters,
      ...legacyFilters,
      sponsoredPosts: legacyFilters.sponsoredPosts ?? false,
    };
    delete (instagramFilters as Record<string, unknown>).ads;
    const storedYouTube = storedApps.youtube ?? defaults.youtube;
    const youtubeFilters = {
      ...defaults.youtube.filters,
      ...storedYouTube.filters,
      sponsoredContent: storedYouTube.filters.sponsoredContent ?? false,
    };
    delete (youtubeFilters as Record<string, unknown>).ads;
    return {
      ...state,
      apps: {
        ...defaults,
        ...storedApps,
        instagram: { ...defaults.instagram, ...storedInstagram, filters: instagramFilters },
        youtube: { ...defaults.youtube, ...storedYouTube, filters: youtubeFilters },
      },
      webViewDiagnostics: {},
    } as AppState;
  },
}));
