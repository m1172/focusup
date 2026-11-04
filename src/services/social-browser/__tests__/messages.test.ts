import { parseSocialWebViewEvent } from '../messages';

describe('parseSocialWebViewEvent', () => {
  it('accepts known, correctly typed events for the expected platform', () => {
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'READY', platform: 'instagram', observerActive: true }), 'instagram'))
      .toEqual({ type: 'READY', platform: 'instagram', observerActive: true });
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'FILTER_APPLIED', platform: 'youtube', feature: 'shorts', count: 2 }), 'youtube'))
      .toEqual({ type: 'FILTER_APPLIED', platform: 'youtube', feature: 'shorts', count: 2 });
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'URL_CHANGED', platform: 'youtube', route: 'watch' }), 'youtube'))
      .toEqual({ type: 'URL_CHANGED', platform: 'youtube', route: 'watch' });
  });

  it.each([
    ['malformed JSON', '{'],
    ['wrong platform', JSON.stringify({ type: 'READY', platform: 'youtube', observerActive: true })],
    ['unknown event', JSON.stringify({ type: 'PAGE_CONTENT', platform: 'instagram', content: 'private' })],
    ['extra fields', JSON.stringify({ type: 'READY', platform: 'instagram', observerActive: true, username: 'private' })],
    ['unknown filter', JSON.stringify({ type: 'FILTER_APPLIED', platform: 'instagram', feature: 'messages', count: 1 })],
    ['invalid count', JSON.stringify({ type: 'FILTER_APPLIED', platform: 'youtube', feature: 'shorts', count: -1 })],
    ['unclassified route', JSON.stringify({ type: 'URL_CHANGED', platform: 'instagram', route: '/private.username/' })],
    ['URL data', JSON.stringify({ type: 'URL_CHANGED', platform: 'youtube', route: 'search', url: 'https://youtube.com/results?search_query=private' })],
  ])('rejects %s', (_label, raw) => {
    expect(parseSocialWebViewEvent(raw, 'instagram')).toBeNull();
  });

  it('rejects features and destinations belonging to another platform', () => {
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'shorts' }), 'instagram')).toBeNull();
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'FILTER_APPLIED', platform: 'youtube', feature: 'reels', count: 1 }), 'youtube')).toBeNull();
  });

  it('accepts numeric detection counts without page content or account data', () => {
    const event = { type: 'CONTENT_DETECTED', platform: 'instagram', feature: 'sponsoredPosts', count: 2 };
    expect(parseSocialWebViewEvent(JSON.stringify(event), 'instagram')).toEqual(event);
    for (const invalid of [{ ...event, count: -1 }, { ...event, count: 0 }, { ...event, count: 1.5 }, { ...event, count: 1001 }, { ...event, feature: 'messages' }, { ...event, username: 'private' }]) {
      expect(parseSocialWebViewEvent(JSON.stringify(invalid), 'instagram')).toBeNull();
    }
    expect(parseSocialWebViewEvent(JSON.stringify({ ...event, platform: 'youtube' }), 'youtube')).toBeNull();
  });

  it('accepts only an opaque hex edge color without additional page data', () => {
    const event = { type: 'PAGE_APPEARANCE', platform: 'instagram', backgroundColor: '#0c1014', isStory: false };
    expect(parseSocialWebViewEvent(JSON.stringify(event), 'instagram')).toEqual(event);
    for (const invalid of [{ ...event, backgroundColor: 'url(https://example.com)' }, { ...event, backgroundColor: '#ffffff00' }, { ...event, content: 'private' }]) {
      expect(parseSocialWebViewEvent(JSON.stringify(invalid), 'instagram')).toBeNull();
    }
  });

  it('accepts TikTok feed events and rejects other platforms\' features', () => {
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'tiktok', feature: 'forYou' }), 'tiktok'))
      .toEqual({ type: 'BLOCKED_NAVIGATION', platform: 'tiktok', feature: 'forYou' });
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'FILTER_APPLIED', platform: 'tiktok', feature: 'following', count: 1 }), 'tiktok'))
      .toEqual({ type: 'FILTER_APPLIED', platform: 'tiktok', feature: 'following', count: 1 });
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'tiktok', feature: 'shorts' }), 'tiktok')).toBeNull();
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'READY', platform: 'tiktok', observerActive: true }), 'youtube')).toBeNull();
  });
});

describe('Instagram account and session events', () => {
  const parse = (value: object, platform: 'instagram' | 'youtube' = 'instagram') => parseSocialWebViewEvent(JSON.stringify({ platform, ...value }), platform);
  it('accepts a username and an Instagram-hosted profile picture', () => {
    expect(parse({ type: 'ACCOUNT', username: 'me.person_1', avatar: 'https://scontent.cdninstagram.com/a.jpg' })).toEqual({ type: 'ACCOUNT', platform: 'instagram', username: 'me.person_1', avatar: 'https://scontent.cdninstagram.com/a.jpg' });
    expect(parse({ type: 'ACCOUNT', username: 'me', avatar: '' })).toEqual({ type: 'ACCOUNT', platform: 'instagram', username: 'me', avatar: '' });
  });
  it('rejects odd usernames, other image hosts and extra fields', () => {
    expect(parse({ type: 'ACCOUNT', username: '../me', avatar: '' })).toBeNull();
    expect(parse({ type: 'ACCOUNT', username: 'me', avatar: 'https://evil.example/cdninstagram.com.jpg' })).toBeNull();
    expect(parse({ type: 'ACCOUNT', username: 'me', avatar: 'http://scontent.cdninstagram.com/a.jpg' })).toBeNull();
    expect(parse({ type: 'ACCOUNT', username: 'me', avatar: '', password: 'x' })).toBeNull();
  });
  it('accepts posts seen, the bottom bar state and the switcher request from Instagram only', () => {
    expect(parse({ type: 'POSTS_SEEN', count: 3 })).toEqual({ type: 'POSTS_SEEN', platform: 'instagram', count: 3 });
    expect(parse({ type: 'POSTS_SEEN', count: 0 })).toBeNull();
    expect(parse({ type: 'POSTS_SEEN', count: 1000 })).toBeNull();
    expect(parse({ type: 'NAV_BAR', visible: false })).toEqual({ type: 'NAV_BAR', platform: 'instagram', visible: false });
    expect(parse({ type: 'OPEN_ACCOUNTS' })).toEqual({ type: 'OPEN_ACCOUNTS', platform: 'instagram' });
    expect(parse({ type: 'OPEN_ACCOUNTS' }, 'youtube')).toBeNull();
    expect(parse({ type: 'URL_CHANGED', route: 'inbox' })).toEqual({ type: 'URL_CHANGED', platform: 'instagram', route: 'inbox' });
  });
});
