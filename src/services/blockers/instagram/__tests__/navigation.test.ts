import { isBlockedInstagramNavigation, isInstagramAuthenticationUrl } from '../url';

describe('isBlockedInstagramNavigation', () => {
  it('blocks the Reels feed button destination only when the Reels filter is enabled', () => {
    expect(isBlockedInstagramNavigation('/reels/', { reels: true })).toBe(true);
    expect(isBlockedInstagramNavigation('https://www.instagram.com/reel/abc123/', { reels: true })).toBe(false);
    expect(isBlockedInstagramNavigation('/reels/', { reels: false })).toBe(false);
  });

  it.each(['/reels', '/reels/', '/reels/?next=1', '/explore/reels/'])('blocks the Reels feed landing page: %s', (url) => {
    expect(isBlockedInstagramNavigation(url, { reels: true })).toBe(true);
    expect(isBlockedInstagramNavigation(url, { reels: false })).toBe(false);
  });

  it.each(['/', '/explore/', '/direct/inbox/', '/p/post-id/', '/person/reels/', '/reel/video-id/', '/person/reel/video-id/', '/reels/video-id/', 'https://example.com/reels/'])('keeps individual videos and account content available: %s', (url) => {
    expect(isBlockedInstagramNavigation(url, { reels: true })).toBe(false);
  });
});

describe('isInstagramAuthenticationUrl', () => {
  it.each([
    'https://www.instagram.com/accounts/login/',
    'https://www.instagram.com/accounts/password/reset/',
    'https://www.instagram.com/challenge/123456/',
    'https://www.instagram.com/accounts/onetap/',
  ])('recognizes Instagram authentication routes: %s', (url) => {
    expect(isInstagramAuthenticationUrl(url)).toBe(true);
  });

  it.each([
    'https://www.instagram.com/',
    'https://www.instagram.com/reels/',
    'https://example.com/accounts/login/',
  ])('does not classify normal browsing as authentication: %s', (url) => {
    expect(isInstagramAuthenticationUrl(url)).toBe(false);
  });
});
