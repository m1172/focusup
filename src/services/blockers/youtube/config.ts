import type { YouTubeBlockerConfig } from '../../../types/social';

export const YOUTUBE_BASE_URL = 'https://m.youtube.com/';

export const defaultYouTubeBlockerConfig: YouTubeBlockerConfig = {
  shorts: true,
  homeRecommendations: true,
  recommendations: true,
  comments: false,
  sponsoredContent: false,
};

/** Sponsored modules have no sufficiently reliable semantic signal yet. */
export const sponsoredContentBlockerStatus = 'unavailable' as const;

export function normalizeYouTubeBlockerConfig(input: Partial<Record<string, boolean>>): YouTubeBlockerConfig {
  return {
    shorts: input.shorts ?? defaultYouTubeBlockerConfig.shorts,
    homeRecommendations: input.homeRecommendations ?? defaultYouTubeBlockerConfig.homeRecommendations,
    recommendations: input.recommendations ?? defaultYouTubeBlockerConfig.recommendations,
    comments: input.comments ?? defaultYouTubeBlockerConfig.comments,
    sponsoredContent: input.sponsoredContent ?? defaultYouTubeBlockerConfig.sponsoredContent,
  };
}
