import type { SocialAppId } from '../../types/app';

export const appCatalog: Record<SocialAppId, { name: string; descriptionKey: string; color: string; glyph: string; filters: string[]; supported: boolean }> = {
  instagram: { name: 'Instagram', descriptionKey: 'instagramDesc', color: '#D94E94', glyph: '◎', filters: ['reels', 'explore', 'recommendations', 'suggestedPosts', 'homeFeed', 'sponsoredPosts'], supported: true },
  youtube: { name: 'YouTube', descriptionKey: 'youtubeDesc', color: '#F04444', glyph: '▶', filters: ['shorts', 'homeRecommendations', 'recommendations', 'comments', 'sponsoredContent'], supported: true },
  tiktok: { name: 'TikTok', descriptionKey: 'tiktokDesc', color: '#111827', glyph: '♪', filters: ['forYou', 'following', 'explore'], supported: true },
  x: { name: 'X', descriptionKey: 'xDesc', color: '#4D5665', glyph: '𝕏', filters: ['recommendations'], supported: false },
  reddit: { name: 'Reddit', descriptionKey: 'redditDesc', color: '#F26735', glyph: '●', filters: ['recommendations'], supported: false },
  snapchat: { name: 'Snapchat', descriptionKey: 'wellbeing.nativeOnly', color: '#B19B0C', glyph: 'S', filters: [], supported: false },
  facebook: { name: 'Facebook', descriptionKey: 'wellbeing.nativeOnly', color: '#356ED8', glyph: 'f', filters: [], supported: false },
  linkedin: { name: 'LinkedIn', descriptionKey: 'wellbeing.nativeOnly', color: '#3479A3', glyph: 'in', filters: [], supported: false },
};

/** The apps FocusUp offers right now, in display order. The rest of the catalog stays for saved settings. */
export const AVAILABLE_APPS = ['instagram', 'youtube', 'tiktok'] as const satisfies readonly SocialAppId[];

export function filterLabelKey(appId: SocialAppId, filter: string): string {
  const labels: Record<string, string> = { homeFeed: 'wellbeing.feed', reels: 'reels', explore: 'explore', recommendations: 'recommendations', suggestedPosts: 'suggestedPosts', ads: 'ads', sponsoredPosts: 'ads', sponsoredContent: 'ads', shorts: 'shorts', homeRecommendations: 'homeRecommendations', comments: 'comments', forYou: 'ui.forYou', following: 'ui.following' };
  return labels[filter] ?? filter;
}
