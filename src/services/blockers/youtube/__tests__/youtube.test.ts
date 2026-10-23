import { defaultYouTubeBlockerConfig } from '../config';
import { generateYouTubeBlockingScript } from '../generateScript';
import { isBlockedYouTubeNavigation } from '../navigation';
import { youtubeSelectors } from '../selectors';

const allOff = { shorts: false, homeRecommendations: false, recommendations: false, comments: false, sponsoredContent: false };

describe('YouTube blocker script generation', () => {
  it('generates valid script with the configured blockers and SPA observer', () => {
    const script = generateYouTubeBlockingScript({ ...defaultYouTubeBlockerConfig, comments: true });
    expect(script).toContain('"shorts":true');
    expect(script).toContain('"homeRecommendations":true');
    expect(script).toContain('"recommendations":true');
    expect(script).toContain('"comments":true');
    expect(script).toContain('"sponsoredContent":false');
    expect(script).toContain('MutationObserver');
    expect(script).toContain('focusup-youtube-clean-styles');
    expect(script).toContain('yt-navigate-finish');
    expect(() => new Function(script)).not.toThrow();
  });

  it('leaves every filter inactive when master Clean Mode is off', () => {
    const script = generateYouTubeBlockingScript({ ...defaultYouTubeBlockerConfig }, false);
    expect(script).toContain('"enabled":false');
    expect(script).toContain('"shorts":true');
    expect(script).toContain('"homeRecommendations":true');
  });

  it('supports Shorts-only, Home-only, and recommendations-only configurations', () => {
    const shortsOnly = generateYouTubeBlockingScript({ ...allOff, shorts: true });
    const homeOnly = generateYouTubeBlockingScript({ ...allOff, homeRecommendations: true });
    const recommendationsOnly = generateYouTubeBlockingScript({ ...allOff, recommendations: true });
    expect(shortsOnly).toContain('"shorts":true');
    expect(shortsOnly).toContain('"homeRecommendations":false');
    expect(homeOnly).toContain('"homeRecommendations":true');
    expect(homeOnly).toContain('"recommendations":false');
    expect(recommendationsOnly).toContain('"recommendations":true');
    expect(recommendationsOnly).toContain('"shorts":false');
  });

  it('allows comments to be enabled and keeps sponsored filtering disabled by default', () => {
    const script = generateYouTubeBlockingScript({ ...allOff, comments: true });
    expect(script).toContain('"comments":true');
    expect(defaultYouTubeBlockerConfig.comments).toBe(false);
    expect(defaultYouTubeBlockerConfig.sponsoredContent).toBe(false);
    expect(youtubeSelectors.sponsoredContent).toHaveLength(0);
  });

  it('does not inspect credentials, cookies, or private page data', () => {
    const script = generateYouTubeBlockingScript(defaultYouTubeBlockerConfig);
    expect(script).toContain('data-focusup-youtube-hidden');
    expect(script).not.toMatch(/password|document\.cookie|localStorage|sessionStorage|search_query/i);
  });
});

describe('isBlockedYouTubeNavigation', () => {
  const config = { shorts: true };
  it('blocks relative or absolute Shorts routes while enabled', () => {
    expect(isBlockedYouTubeNavigation('/shorts/abc', config)).toBe(true);
    expect(isBlockedYouTubeNavigation('https://m.youtube.com/shorts/abc', config)).toBe(true);
    expect(isBlockedYouTubeNavigation('https://www.youtube.com/shorts/abc', config)).toBe(true);
  });

  it.each(['/@creator/shorts', 'https://m.youtube.com/@creator/shorts/', '/channel/UC123/shorts', '/c/creator/shorts', '/user/creator/shorts'])('blocks a channel Shorts tab: %s', (url) => {
    expect(isBlockedYouTubeNavigation(url, config)).toBe(true);
  });

  it.each([
    'https://m.youtube.com/watch?v=abc',
    'https://m.youtube.com/results?search_query=react',
    'https://m.youtube.com/feed/subscriptions',
    'https://m.youtube.com/playlist?list=abc',
    'https://www.youtube.com/@creator',
    'https://www.youtube.com/@creator/videos',
    'https://www.youtube.com/@shorts',
    'https://example.com/shorts/abc',
  ])('allows intentional URL %s', (url) => expect(isBlockedYouTubeNavigation(url, config)).toBe(false));

  it('respects the Shorts setting', () => {
    expect(isBlockedYouTubeNavigation('/shorts/abc', { shorts: false })).toBe(false);
  });
});
