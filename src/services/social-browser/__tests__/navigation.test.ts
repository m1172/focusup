import { classifySocialBrowserNavigation, getSocialBrowserRoute, isInstagramMetaAuthRedirect, isSameDocumentLocation, isYouTubeGoogleAuthUrl, normalizeSocialBrowserLink } from '../navigation';

describe('classifySocialBrowserNavigation', () => {
  it('keeps secure embedded pages inside the WebView without opening Safari', () => {
    expect(classifySocialBrowserNavigation('instagram', 'https://www.facebook.com/privacy/consent/', false)).toBe('internal');
    expect(classifySocialBrowserNavigation('youtube', 'https://accounts.google.com/embedded/setup', false)).toBe('internal');
    expect(classifySocialBrowserNavigation('instagram', 'https://example.com/', true)).toBe('external');
    expect(classifySocialBrowserNavigation('instagram', 'https://www.instagram.com/', true)).toBe('internal');
    expect(classifySocialBrowserNavigation('instagram', 'https://www.facebook.com/login/', true)).toBe('internal');
  });
  it.each([
    'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin',
    'https://accounts.google.com/lifecycle/steps/signup/name?continue=https%3A%2F%2Fwww.youtube.com%2F',
    'https://accounts.youtube.com/accounts/SetSID',
    'https://accounts.google.co.uk/accounts/SetSID',
  ])('keeps YouTube sign-in and sign-up inside the WebView: %s', (url) => {
    expect(classifySocialBrowserNavigation('youtube', url, true)).toBe('internal');
  });
  it('does not treat Google sign-in as part of Instagram or lookalike hosts', () => {
    expect(classifySocialBrowserNavigation('instagram', 'https://accounts.google.com/ServiceLogin', true)).toBe('external');
    expect(isYouTubeGoogleAuthUrl('https://accounts.google.com.evil.test/')).toBe(false);
    expect(isYouTubeGoogleAuthUrl('http://accounts.google.com/')).toBe(false);
  });
  it.each([
    'https://apps.apple.com/app/instagram/id389801252',
    'https://play.google.com/store/apps/details?id=com.google.android.youtube',
    'https://instagram.app.link/open',
    'instagram://user?username=focusup',
    'intent://instagram.com/#Intent;scheme=https;package=com.instagram.android;end',
    'vnd.youtube://watch?v=abc',
  ])('never hands off to the native app or its store page: %s', (url) => {
    expect(classifySocialBrowserNavigation('instagram', url, true)).toBe('reject');
    expect(classifySocialBrowserNavigation('youtube', url, true)).toBe('reject');
  });
  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'https://user:secret@instagram.com/', 'invalid'])('rejects unsafe navigation for any frame: %s', (url) => {
    expect(classifySocialBrowserNavigation('instagram', url, false)).toBe('reject');
    expect(classifySocialBrowserNavigation('instagram', url, true)).toBe('reject');
  });
});

describe('normalizeSocialBrowserLink', () => {
  it('accepts secure links only for the selected platform', () => {
    expect(normalizeSocialBrowserLink('instagram', ' instagram.com/p/post-id/?igsh=123 ')).toBe('https://instagram.com/p/post-id/?igsh=123');
    expect(normalizeSocialBrowserLink('instagram', 'https://www.instagram.com/direct/inbox/')).toBe('https://www.instagram.com/direct/inbox/');
    expect(normalizeSocialBrowserLink('youtube', 'https://youtu.be/video')).toBe('https://youtu.be/video');
  });
  it.each(['', 'javascript:alert(1)', 'file:///etc/passwd', 'http://instagram.com/', 'https://instagram.com.evil.test/', 'https://instagram.com@evil.test/', 'https://user:secret@instagram.com/', 'https://instagram.com:8080/', 'https://instagram.com\\@evil.test/', 'https://youtube.com/', 'instagram.com/a b'])('rejects unsafe or unrelated links: %s', (url) => {
    expect(normalizeSocialBrowserLink('instagram', url)).toBeNull();
  });
  it('does not enable unsupported platforms', () => {
    expect(normalizeSocialBrowserLink('x', 'https://x.com/')).toBeNull();
    expect(normalizeSocialBrowserLink('tiktok', 'https://tiktok.com/')).toBe('https://tiktok.com/');
  });
});

describe('getSocialBrowserRoute', () => {
  it.each([
    ['instagram', 'https://www.instagram.com/', 'feed'],
    ['instagram', 'https://www.instagram.com/explore/search/?q=private-term', 'search'],
    ['instagram', 'https://www.instagram.com/private.username/', 'profile'],
    ['instagram', 'https://www.instagram.com/reels/123456/?utm_source=private', 'reels'],
    ['youtube', 'https://m.youtube.com/results?search_query=private-term', 'search'],
    ['youtube', 'https://m.youtube.com/watch?v=private-video-id', 'watch'],
    ['youtube', 'https://m.youtube.com/feed/subscriptions', 'subscriptions'],
    ['youtube', 'https://m.youtube.com/@private-channel', 'channel'],
    ['youtube', 'https://m.youtube.com/shorts/private-video-id', 'shorts'],
  ] as const)('classifies %s routes without returning identifiers or query data', (platform, url, expected) => {
    const route = getSocialBrowserRoute(platform, url);
    expect(route).toBe(expected);
    expect(route).not.toMatch(/private|video-id|search_query|utm_source/i);
  });

  it('fails safely for malformed routes', () => {
    expect(getSocialBrowserRoute('youtube', 'not a url')).toBe('other');
  });

  it('distinguishes main-document HTTP failures from failed subresources without exposing query data', () => {
    expect(isSameDocumentLocation('https://m.youtube.com/watch?v=private-id', 'https://m.youtube.com/watch?v=private-id')).toBe(true);
    expect(isSameDocumentLocation('https://m.youtube.com/youtubei/v1/player?key=private', 'https://m.youtube.com/watch?v=private-id')).toBe(false);
    expect(isSameDocumentLocation('not a url', 'https://m.youtube.com/')).toBe(false);
  });

  it.each([
    'https://www.facebook.com/login/?next=https%3A%2F%2Fwww.instagram.com%2F',
    'https://m.facebook.com/checkpoint/?next=https%3A%2F%2Fwww.instagram.com%2F',
    'https://www.facebook.com/dialog/oauth?client_id=123',
    'https://www.facebook.com/',
    'https://facebook.com/?next=https%3A%2F%2Fwww.instagram.com%2F',
  ])('keeps the Instagram sign-in handoff in the WebView: %s', (url) => {
    expect(isInstagramMetaAuthRedirect(url)).toBe(true);
  });

  it.each([
    'https://www.facebook.com/another-page/',
    'https://example.com/login/',
    'http://www.facebook.com/login/',
  ])('does not keep unrelated navigation inside the WebView: %s', (url) => {
    expect(isInstagramMetaAuthRedirect(url)).toBe(false);
  });
});
