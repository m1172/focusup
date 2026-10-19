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
});
