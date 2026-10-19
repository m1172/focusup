import type { InstagramBlockerConfig } from '../../../types/social';

export const defaultInstagramBlockerConfig: InstagramBlockerConfig = {
  reels: true,
  explore: true,
  suggestedPosts: true,
  recommendations: true,
  sponsoredPosts: false,
  homeFeed: false,
};

/** Exact semantic labels only; Instagram layouts without these labels remain unfiltered. */
export const sponsoredPostsBlockerStatus = 'experimental' as const;

export function normalizeInstagramBlockerConfig(input: Partial<Record<string, boolean>>): InstagramBlockerConfig {
  return {
    reels: input.reels ?? defaultInstagramBlockerConfig.reels,
    explore: input.explore ?? defaultInstagramBlockerConfig.explore,
    suggestedPosts: input.suggestedPosts ?? defaultInstagramBlockerConfig.suggestedPosts,
    recommendations: input.recommendations ?? defaultInstagramBlockerConfig.recommendations,
    sponsoredPosts: input.sponsoredPosts ?? defaultInstagramBlockerConfig.sponsoredPosts,
    homeFeed: input.homeFeed ?? false,
  };
}
