import type { TikTokBlockerConfig } from '../../../types/social';

/** TikTok's mobile site; its home page is the endless For You feed, which Clean Mode replaces with the inbox. */
export const TIKTOK_BASE_URL = 'https://www.tiktok.com/inbox';

export const defaultTikTokBlockerConfig: TikTokBlockerConfig = {
  forYou: true,
  following: true,
  explore: false,
};

export function normalizeTikTokBlockerConfig(input: Partial<Record<string, boolean>>): TikTokBlockerConfig {
  return {
    forYou: input.forYou ?? defaultTikTokBlockerConfig.forYou,
    following: input.following ?? defaultTikTokBlockerConfig.following,
    explore: input.explore ?? defaultTikTokBlockerConfig.explore,
  };
}
