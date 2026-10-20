/** Stable-ish YouTube custom elements and destinations; keep DOM assumptions centralized here. */
export const youtubeSelectors = {
  shortsNavigation: [
    'a[href^="/shorts"]',
    'a[href*="/shorts/"]',
    'ytd-guide-entry-renderer a[title="Shorts"]',
    'ytm-pivot-bar-item-renderer',
    'yt-pivot-bar-item-view-model',
    'ytm-pivot-bar-renderer a',
    'ytm-pivot-bar-renderer button',
    'ytm-pivot-bar-renderer [role="tab"]',
  ],
  shortsShelves: [
    'ytd-reel-shelf-renderer',
    'ytm-reel-shelf-renderer',
    'ytd-shorts',
    'ytm-shorts-lockup-view-model',
    'a[href*="/shorts/"]',
  ],
  homeRecommendations: ['ytd-rich-grid-renderer', 'ytm-rich-grid-renderer'],
  recommendations: [
    'ytd-watch-next-secondary-results-renderer',
    'ytm-watch-next-secondary-results-renderer',
    'ytd-compact-video-renderer',
  ],
  comments: ['ytd-comments', 'ytm-comments-entry-point-header-renderer'],
  sponsoredContent: [], // TODO: Enable after a stable, locale-safe semantic marker is verified.
} as const;

export type YouTubeSelectorGroup = keyof typeof youtubeSelectors;
