import { INSTAGRAM_INBOX_URL, instagramBlockedPage, instagramStartUrl } from '../url';
import { normalizeInstagramBlockerConfig } from '../config';
import { generateInstagramBlockingScript } from '../generateScript';
import { isYouTubeExploreUrl } from '../../youtube/detectors';
import { youtubeBlockedPage } from '../../youtube/navigation';
import { parseSocialWebViewEvent } from '../../../social-browser/messages';

describe('Instagram Stories filter', () => {
  it('blocks Story pages only while the filter is on', () => {
    expect(instagramBlockedPage('/stories/someone/123/', { stories: true })).toBe('stories');
    expect(instagramBlockedPage('/stories/highlights/1/', { stories: true })).toBe('stories');
    expect(instagramBlockedPage('/stories/someone/123/', { stories: false })).toBeNull();
    expect(instagramBlockedPage('/someone/', { stories: true })).toBeNull();
    expect(instagramBlockedPage('https://example.com/stories/x/', { stories: true })).toBeNull();
  });

  it('is off by default so existing users see no change', () => {
    expect(normalizeInstagramBlockerConfig({}).stories).toBe(false);
    expect(normalizeInstagramBlockerConfig({}).messagesOnly).toBe(false);
  });
});

describe('Instagram messages-only mode', () => {
  const config = { messagesOnly: true };

  it.each([['/', 'homeFeed'], ['/explore/', 'explore'], ['/explore/tags/cats/', 'explore'], ['/reels/', 'reels'], ['/stories/a/1/', 'stories']])('closes feeds: %s', (url, page) => {
    expect(instagramBlockedPage(url, config)).toBe(page);
  });

  it.each(['/direct/inbox/', '/direct/t/123/', '/p/abc/', '/reel/abc/', '/someone/', '/explore/search/', '/accounts/edit/'])('keeps messages, shared posts and profiles: %s', (url) => {
    expect(instagramBlockedPage(url, config)).toBeNull();
  });

  it('opens on the inbox and turns every feed filter on', () => {
    expect(instagramStartUrl(config)).toBe(INSTAGRAM_INBOX_URL);
    expect(instagramStartUrl({})).toBe('https://www.instagram.com/');
    expect(normalizeInstagramBlockerConfig({ messagesOnly: true, explore: false, suggestedPosts: false })).toMatchObject({ reels: true, explore: true, suggestedPosts: true, recommendations: true, homeFeed: true, stories: true });
  });

  it('puts the same page rules into the page script', () => {
    const script = generateInstagramBlockingScript({ messagesOnly: true });
    expect(script).toContain('"messagesOnly":true');
    expect(script).toContain("'/direct/inbox/'");
    expect(script).toContain("applyFeature('stories'");
  });
});

describe('YouTube Explore and Trending', () => {
  it.each(['https://m.youtube.com/feed/explore', 'https://m.youtube.com/feed/trending?bp=1', 'https://www.youtube.com/gaming', 'https://m.youtube.com/feed/news_destination'])('recognises discovery pages: %s', (url) => {
    expect(isYouTubeExploreUrl(url)).toBe(true);
    expect(youtubeBlockedPage(url, { explore: true })).toBe('explore');
    expect(youtubeBlockedPage(url, { explore: false })).toBeNull();
  });

  it.each(['https://m.youtube.com/results?search_query=x', 'https://m.youtube.com/feed/subscriptions', 'https://m.youtube.com/watch?v=1', 'https://m.youtube.com/@channel', 'https://m.youtube.com/feed/library'])('keeps search, subscriptions and videos: %s', (url) => {
    expect(youtubeBlockedPage(url, { explore: true, shorts: true })).toBeNull();
  });
});

describe('page messages for the new pages', () => {
  it('accepts only known blocked pages', () => {
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'stories' }), 'instagram')).toEqual({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'stories' });
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'homeFeed' }), 'instagram')).not.toBeNull();
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'instagram', feature: 'direct' }), 'instagram')).toBeNull();
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'youtube', feature: 'explore' }), 'youtube')).toEqual({ type: 'BLOCKED_NAVIGATION', platform: 'youtube', feature: 'explore' });
    expect(parseSocialWebViewEvent(JSON.stringify({ type: 'BLOCKED_NAVIGATION', platform: 'youtube', feature: 'stories' }), 'youtube')).toBeNull();
  });
});
