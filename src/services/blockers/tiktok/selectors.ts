/** TikTok's mobile site labels its controls with data-e2e attributes; keep every DOM assumption here. */
export const tiktokSelectors = {
  forYouNavigation: ['[data-e2e="home-icon"]', 'a[href="/"]', 'a[href="/foryou"]'],
  followingNavigation: ['a[href="/following"]', 'a[href="/friends"]', '[data-e2e="following-icon"]', '[data-e2e="friends-icon"]'],
  exploreNavigation: ['[data-e2e="discover-icon"]', 'a[href="/discover"]', 'a[href="/explore"]'],
  /** Videos queued after the one that was opened, so a shared link cannot turn into a feed. */
  nextVideos: ['[data-e2e^="video-slide-"]:not([data-e2e="video-slide-active"])'],
  /** "Open TikTok" buttons and prompts that would leave FocusUp. */
  appPromo: ['[data-e2e="open-titok-icon"]', '[data-e2e="open-tiktok-icon"]', '[data-e2e="bottom-cta-container"]'],
  /** "Not now" buttons on full-screen app prompts; pressing them also removes the dimmed backdrop. */
  promoDismiss: ['[data-e2e="alt-middle-cta-cancel-btn"]', '[data-e2e="bottom-cta-cancel-btn"]'],
} as const;

export type TikTokSelectorGroup = keyof typeof tiktokSelectors;
