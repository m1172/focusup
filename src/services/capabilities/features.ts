/**
 * What the "Vaqtim features" page lists. Statuses describe the code as it is: 'experimental' means a website
 * filter that can miss things when the site changes; 'notAvailable' is never shown as working.
 * Update this list whenever a feature ships or is switched off.
 */
export type FeatureStatus = 'available' | 'experimental' | 'notAvailable';
export type FeatureGroup = 'instagram' | 'youtube' | 'tiktok' | 'general' | 'pro' | 'family';
export type FeatureItem = { key: string; status: FeatureStatus; alwaysOn?: boolean };

/** Paid plans appear only once they can be bought (PRO_ENABLED and FAMILY_ENABLED), under their own headings. */
export function vaqtimFeatures(options: { widget: boolean; pro?: boolean; family?: boolean }): { group: FeatureGroup; items: FeatureItem[] }[] {
  const paid: { group: FeatureGroup; items: FeatureItem[] }[] = [];
  if (options.pro) paid.push({ group: 'pro', items: [
    { key: 'hardMode', status: 'available' },
    { key: 'breaks', status: 'available' },
    // A website filter like the others: it can miss comments when YouTube changes its page.
    { key: 'youtubeComments', status: 'experimental' },
    { key: 'advancedStats', status: 'available' },
  ] });
  if (options.family) paid.push({ group: 'family', items: [
    { key: 'familyRules', status: 'available' },
    { key: 'familyUsage', status: 'available' },
  ] });
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
      { key: 'postMode', status: 'available' },
      { key: 'grayscale', status: 'available' },
      { key: 'layout', status: 'available' },
      { key: 'darkMode', status: 'available' },
      { key: 'darkSites', status: 'experimental' },
      { key: 'widget', status: options.widget ? 'available' : 'notAvailable' },
      { key: 'snapchat', status: 'notAvailable' },
      { key: 'systemGrayscale', status: 'notAvailable' },
    ] },
    ...paid,
  ];
}
