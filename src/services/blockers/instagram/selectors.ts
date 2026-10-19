/** Keep Instagram-specific DOM assumptions in this registry. Prefer destinations and semantics over generated classes. */
export const instagramSelectors = {
  reels: ['a[href*="/reels"]', 'nav [aria-label*="Reel" i]', '[role="navigation"] [aria-label*="Reel" i]', 'footer [aria-label*="Reel" i]'],
  explore: ['a[href^="/explore/"]', 'a[href*="/explore/"]', 'a[aria-label*="Explore" i]'],
  suggestedPosts: ['article', '[role="article"]'],
  recommendations: ['section', '[role="region"]', '[role="group"]'],
  sponsoredPosts: ['article', '[role="article"]'],
  homeFeed: ['article', '[role="article"]'],
} as const;

export type InstagramSelectorFeature = keyof typeof instagramSelectors;
