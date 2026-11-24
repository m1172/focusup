import type { SocialAppId } from '../../types/app';

/**
 * Android: instead of blocking the whole real app, Vaqtim can leave only its short-video screen
 * (Instagram Reels, YouTube Shorts) and keep the rest of the app working, like posting and messages.
 * The Accessibility service looks for these view IDs on screen; when one is visible it goes back.
 * The IDs live here, not in Kotlin, so a fix after an app update ships as an over-the-air update.
 * TikTok's main screen is its For You feed, so TikTok stays fully blocked.
 */
export const ANDROID_FEED_SCREENS: Partial<Record<SocialAppId, string[]>> = {
  instagram: ['com.instagram.android:id/clips_viewer_view_pager', 'com.instagram.android:id/clips_viewer_container', 'com.instagram.android:id/clips_video_container'],
  youtube: ['com.google.android.youtube:id/reel_recycler', 'com.google.android.youtube:id/reel_player_page_container', 'com.google.android.youtube:id/reel_watch_player'],
};

/** Apps whose real app keeps working on Android, with only the short-video screen blocked. */
export function feedOnlyApps(baseline: SocialAppId[], android: boolean): SocialAppId[] {
  return android ? baseline.filter((app) => Boolean(ANDROID_FEED_SCREENS[app]?.length)) : [];
}
