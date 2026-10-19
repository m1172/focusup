/** Keep page-world code as source text. Hermes does not retain function source for Function.toString(). */
export const socialBrowserRouteScript = String.raw`function(platform, url) {
  try {
    var parsed = new URL(url, platform === 'youtube' ? 'https://m.youtube.com' : 'https://www.instagram.com');
    var path = parsed.pathname.toLowerCase();
    if (platform === 'youtube') {
      if (path === '/' || path === '/home') return 'feed';
      if (path === '/results') return 'search';
      if (path === '/watch') return 'watch';
      if (path === '/feed/subscriptions') return 'subscriptions';
      if (path === '/playlist') return 'playlist';
      if (/^\/shorts(?:\/|$)/.test(path)) return 'shorts';
      if (/^\/(?:channel|c|user)\//.test(path) || path.startsWith('/@')) return 'channel';
      return 'other';
    }
    if (path === '/' || path === '/accounts/onetap') return 'feed';
    if (path === '/search' || path.startsWith('/explore/search/')) return 'search';
    if (/^\/(?:reels?)(?:\/|$)/.test(path)) return 'reels';
    if (/^\/(?:p|tv)\//.test(path)) return 'watch';
    if (/^\/(?:direct|accounts|about|legal)(?:\/|$)/.test(path)) return 'other';
    return path.split('/').filter(Boolean).length === 1 ? 'profile' : 'other';
  } catch (_) { return 'other'; }
}`;
