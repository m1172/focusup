import type { InstagramBlockerConfig } from '../../../types/social';

export const defaultInstagramBlockerConfig: InstagramBlockerConfig = {
  reels: true,
  explore: true,
  suggestedPosts: true,
  recommendations: true,
  sponsoredPosts: false,
  homeFeed: false,
  stories: false,
  messagesOnly: false,
};

/** Exact semantic labels only; Instagram layouts without these labels remain unfiltered. */
export const sponsoredPostsBlockerStatus = 'experimental' as const;

export function normalizeInstagramBlockerConfig(input: Partial<Record<string, boolean>>): InstagramBlockerConfig {
  const messagesOnly = input.messagesOnly === true;
  const config: InstagramBlockerConfig = {
    reels: input.reels ?? defaultInstagramBlockerConfig.reels,
    explore: input.explore ?? defaultInstagramBlockerConfig.explore,
    suggestedPosts: input.suggestedPosts ?? defaultInstagramBlockerConfig.suggestedPosts,
    recommendations: input.recommendations ?? defaultInstagramBlockerConfig.recommendations,
    sponsoredPosts: input.sponsoredPosts ?? defaultInstagramBlockerConfig.sponsoredPosts,
    homeFeed: input.homeFeed ?? false,
    stories: input.stories ?? false,
    messagesOnly,
  };
  // Messages-only mode hides every feed, so a shared post can't lead into endless recommendations.
  if (messagesOnly) Object.assign(config, { reels: true, explore: true, suggestedPosts: true, recommendations: true, homeFeed: true, stories: true });
  return config;
}
