import type { SocialAppId } from './app';

export type InstagramBlockerConfig = {
  reels: boolean;
  explore: boolean;
  suggestedPosts: boolean;
  recommendations: boolean;
  sponsoredPosts: boolean;
  homeFeed: boolean;
};

export type InstagramFilterFeature = keyof InstagramBlockerConfig;
export type SocialBrowserRoute = 'feed' | 'search' | 'watch' | 'subscriptions' | 'channel' | 'playlist' | 'reels' | 'shorts' | 'profile' | 'inbox' | 'other';

export type YouTubeBlockerConfig = {
  shorts: boolean;
  homeRecommendations: boolean;
  recommendations: boolean;
  comments: boolean;
  sponsoredContent: boolean;
};

export type YouTubeFilterFeature = keyof YouTubeBlockerConfig;

export type TikTokBlockerConfig = {
  forYou: boolean;
  following: boolean;
  explore: boolean;
};

export type TikTokFilterFeature = keyof TikTokBlockerConfig;

/** Websites FocusUp opens in its clean in-app browser. */
export type CleanPlatform = 'instagram' | 'youtube' | 'tiktok';
export const CLEAN_PLATFORMS: readonly CleanPlatform[] = ['instagram', 'youtube', 'tiktok'];
export function isCleanPlatform(value: unknown): value is CleanPlatform {
  return value === 'instagram' || value === 'youtube' || value === 'tiktok';
}

export type InstagramWebViewEvent =
  | { type: 'READY'; platform: 'instagram'; observerActive: boolean }
  | { type: 'CONTENT_DETECTED'; platform: 'instagram'; feature: 'sponsoredPosts' | 'suggestedPosts'; count: number }
  | { type: 'FILTER_APPLIED'; platform: 'instagram'; feature: InstagramFilterFeature; count: number }
  | { type: 'URL_CHANGED'; platform: 'instagram'; route: SocialBrowserRoute }
  | { type: 'BLOCKED_NAVIGATION'; platform: 'instagram'; feature: 'reels' }
  /** Feed posts that were at least half on screen, counted once each, for the session strip. */
  | { type: 'POSTS_SEEN'; platform: 'instagram'; count: number }
  /** The signed-in account, read from the profile tab. Kept on the phone for the account switcher only. */
  | { type: 'ACCOUNT'; platform: 'instagram'; username: string; avatar: string }
  /** Whether Instagram shows its own bottom tab bar on this page. */
  | { type: 'NAV_BAR'; platform: 'instagram'; visible: boolean }
  /** The username menu was tapped: Vaqtim shows its own account switcher instead of Instagram's. */
  | { type: 'OPEN_ACCOUNTS'; platform: 'instagram' }
  | { type: 'ERROR'; platform: 'instagram'; scope: string };

export type YouTubeWebViewEvent =
  | { type: 'READY'; platform: 'youtube'; observerActive: boolean }
  | { type: 'FILTER_APPLIED'; platform: 'youtube'; feature: YouTubeFilterFeature; count: number }
  | { type: 'URL_CHANGED'; platform: 'youtube'; route: SocialBrowserRoute }
  | { type: 'BLOCKED_NAVIGATION'; platform: 'youtube'; feature: 'shorts' }
  | { type: 'ERROR'; platform: 'youtube'; scope: string };

export type TikTokWebViewEvent =
  | { type: 'READY'; platform: 'tiktok'; observerActive: boolean }
  | { type: 'FILTER_APPLIED'; platform: 'tiktok'; feature: TikTokFilterFeature; count: number }
  | { type: 'URL_CHANGED'; platform: 'tiktok'; route: SocialBrowserRoute }
  | { type: 'BLOCKED_NAVIGATION'; platform: 'tiktok'; feature: TikTokFilterFeature }
  | { type: 'ERROR'; platform: 'tiktok'; scope: string };

export type SocialWebViewEvent = InstagramWebViewEvent | YouTubeWebViewEvent | TikTokWebViewEvent
  | { type: 'PAGE_APPEARANCE'; platform: CleanPlatform; backgroundColor: string; isStory: boolean };

export type WebViewDiagnostics = {
  currentUrl: string;
  cleanMode: boolean;
  injectedScriptActive: boolean;
  observerActive: boolean;
  lastInjectionAt: string;
  lastFilterPassAt?: string;
  blockerConfig: SocialWebViewConfig;
  filterCounts?: Partial<Record<InstagramFilterFeature | YouTubeFilterFeature | TikTokFilterFeature, number>>;
};

export type SocialWebViewConfig = Record<string, boolean>;
export type DiagnosticsByPlatform = Partial<Record<SocialAppId, WebViewDiagnostics>>;
