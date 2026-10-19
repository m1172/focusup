export const instagramAuthenticationRoutePattern = String.raw`^/(?:accounts/(?:login|signup|password/reset|onetap|one_tap|two_factor_authentication|confirm_email)|challenge|checkpoint)(?:/|$)`;
/** Restrict the Reels feed landing page. Individual video links and account grids stay accessible. */
export const instagramReelsFeedRoutePattern = String.raw`^/(?:reels|explore/reels)/?$`;

export function isBlockedInstagramNavigation(url: string, config: { reels?: boolean }): boolean {
  if (!config.reels) return false;
  try {
    const parsed = new URL(url, 'https://www.instagram.com');
    if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname)) return false;
    return new RegExp(instagramReelsFeedRoutePattern, 'i').test(parsed.pathname);
  } catch { return false; }
}

export function isInstagramAuthenticationUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://www.instagram.com');
    if (!['instagram.com', 'www.instagram.com'].includes(parsed.hostname)) return false;
    return new RegExp(instagramAuthenticationRoutePattern, 'i').test(parsed.pathname);
  } catch {
    return false;
  }
}
