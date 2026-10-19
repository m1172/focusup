import { generateInstagramBlockingScript } from '../instagram/index';
import { defaultInstagramBlockerConfig } from '../instagram/config';
import { generateBlockingScript } from '..';
import { youtubeSelectors } from '../youtube';

const allOff = { reels: false, explore: false, suggestedPosts: false, recommendations: false, sponsoredPosts: false };

describe('generateInstagramBlockingScript', () => {
  it('works when the native engine does not retain function source (Hermes)', () => {
    const toString = jest.spyOn(Function.prototype, 'toString').mockReturnValue('function () { [native code] }');
    try {
      const script = generateInstagramBlockingScript(defaultInstagramBlockerConfig);
      expect(() => new Function(script)).not.toThrow();
      expect(script).not.toContain('[native code]');
      expect(toString).not.toHaveBeenCalled();
    } finally { toString.mockRestore(); }
  });
  it('generates a complete script with all supported filters enabled', () => {
    const script = generateInstagramBlockingScript({ ...defaultInstagramBlockerConfig, sponsoredPosts: true });
    expect(script).toContain('"reels":true');
    expect(script).toContain('"explore":true');
    expect(script).toContain('"suggestedPosts":true');
    expect(script).toContain('"recommendations":true');
    expect(script).toContain('"sponsoredPosts":true');
    expect(script).toContain('MutationObserver');
    expect(script).toContain('focusup-instagram-clean-styles');
    expect(() => new Function(script)).not.toThrow();
  });

  it('keeps every filter disabled when requested', () => {
    const script = generateInstagramBlockingScript(allOff, false);
    expect(script).toContain('"enabled":false');
    expect(script).toContain('"reels":false');
    expect(script).toContain('"explore":false');
    expect(script).toContain('"suggestedPosts":false');
    expect(script).toContain('MutationObserver');
  });

  it('supports a Reels-only configuration', () => {
    const script = generateInstagramBlockingScript({ ...allOff, reels: true });
    expect(script).toContain('"reels":true');
    expect(script).toContain('"explore":false');
    expect(script).toContain('"recommendations":false');
  });

  it('supports an Explore-only configuration', () => {
    const script = generateInstagramBlockingScript({ ...allOff, explore: true });
    expect(script).toContain('"reels":false');
    expect(script).toContain('"explore":true');
  });

  it('does not emit suggested-post filtering when that feature is off', () => {
    const script = generateInstagramBlockingScript({ ...defaultInstagramBlockerConfig, suggestedPosts: false });
    expect(script).toContain('"suggestedPosts":false');
  });

  it('has the observer, marker, and no credential or site-storage access', () => {
    const script = generateInstagramBlockingScript(defaultInstagramBlockerConfig);
    expect(script).toContain('MutationObserver');
    expect(script).toContain('data-focusup-hidden');
    expect(script).toContain('pushState');
    expect(script).toContain('replaceState');
    expect(script).toContain("currentHost !== 'instagram.com'");
    expect(script).toContain('isAuthenticationRoute(location.href)');
    expect(script).not.toMatch(/document\.cookie|localStorage|\[type=['\"]password['\"]\]|name=['\"]password['\"]/i);
    // Cross-document navigation flags may use only these FocusUp-owned keys.
    expect(script).toContain("var SEARCH_REQUEST_KEY = 'focusup-instagram-open-search';");
    expect(script).toContain("var dmReelSwipeStorageKey = 'focusup-instagram-dm-reel-swipe';");
    const storageCalls = Array.from(script.matchAll(/sessionStorage\.(?:getItem|setItem|removeItem)\((SEARCH_REQUEST_KEY|dmReelSwipeStorageKey)(?:\)|, '1'\))/g));
    expect(storageCalls.length).toBeGreaterThan(0);
    expect(script.match(/sessionStorage/g)).toHaveLength(storageCalls.length);
    expect(script.length).toBeGreaterThan(500);
  });
});

it('preserves the existing YouTube blocker and unsupported-platform behavior', () => {
  const script = generateBlockingScript('youtube', true, { shorts: true });
  expect(script).toContain(JSON.stringify(youtubeSelectors.shortsShelves[0]));
  expect(script).toContain('youtube');
  expect(generateBlockingScript('tiktok', true, {})).toBeNull();
});
