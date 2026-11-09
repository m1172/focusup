/**
 * What the "Vaqtim features" page lists. Statuses describe the code as it is: 'experimental' means a website
 * filter that can miss things when the site changes; 'notAvailable' is never shown as working.
 * Update this list whenever a feature ships or is switched off.
 */
export type FeatureStatus = 'available' | 'experimental' | 'notAvailable';
export type FeatureGroup = 'instagram' | 'youtube' | 'tiktok' | 'general';
export type FeatureItem = { key: string; status: FeatureStatus; alwaysOn?: boolean };

export function vaqtimFeatures(options: { widget: boolean }): { group: FeatureGroup; items: FeatureItem[] }[] {
  return [
    { group: 'instagram', items: [
      { key: 'reels', status: 'available', alwaysOn: true },
      { key: 'explore', status: 'available' },
      { key: 'suggested', status: 'available' },
      { key: 'homeFeed', status: 'experimental' },
      { key: 'stories', status: 'experimental' },
      { key: 'messagesOnly', status: 'experimental' },
      { key: 'ads', status: 'experimental' },
      { key: 'accounts', status: 'available' },
    ] },
    { group: 'youtube', items: [
      { key: 'shorts', status: 'available', alwaysOn: true },
      { key: 'homeRecommendations', status: 'available' },
      { key: 'related', status: 'available' },
      { key: 'youtubeExplore', status: 'experimental' },
      { key: 'youtubeAds', status: 'notAvailable' },
    ] },
    { group: 'tiktok', items: [
      { key: 'forYou', status: 'available', alwaysOn: true },
      { key: 'following', status: 'available' },
      { key: 'tiktokExplore', status: 'available' },
    ] },
    { group: 'general', items: [
      { key: 'blockApps', status: 'available' },
      { key: 'schedules', status: 'available' },
      { key: 'sleep', status: 'available' },
      { key: 'dailyLimits', status: 'available' },
      { key: 'grayscale', status: 'available' },
      { key: 'layout', status: 'available' },
      { key: 'darkMode', status: 'available' },
      { key: 'darkSites', status: 'experimental' },
      { key: 'widget', status: options.widget ? 'available' : 'notAvailable' },
      { key: 'snapchat', status: 'notAvailable' },
      { key: 'systemGrayscale', status: 'notAvailable' },
    ] },
  ];
}
