import { ANDROID_FEED_SCREENS, feedOnlyApps } from '../androidFeeds';

describe('Android feeds-only blocking', () => {
  it('keeps Instagram and YouTube usable with only Reels and Shorts blocked, and TikTok fully blocked', () => {
    expect(feedOnlyApps(['instagram', 'youtube', 'tiktok'], true)).toEqual(['instagram', 'youtube']);
    expect(ANDROID_FEED_SCREENS.tiktok).toBeUndefined();
  });
  it('does nothing on iPhone, where the whole app is blocked and opens Vaqtim', () => {
    expect(feedOnlyApps(['instagram', 'youtube'], false)).toEqual([]);
  });
  it('only lists IDs that belong to the app they check', () => {
    expect(ANDROID_FEED_SCREENS.instagram!.every((id) => id.startsWith('com.instagram.android:id/'))).toBe(true);
    expect(ANDROID_FEED_SCREENS.youtube!.every((id) => id.startsWith('com.google.android.youtube:id/'))).toBe(true);
  });
});
