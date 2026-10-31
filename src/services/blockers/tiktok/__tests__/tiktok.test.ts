import { JSDOM } from 'jsdom';
import { generateTikTokBlockingScript } from '../generateScript';
import { isBlockedTikTokNavigation } from '../navigation';
import { isTikTokVideoUrl, tiktokFeedFeature } from '../detectors';
import { classifySocialBrowserNavigation, getSocialBrowserRoute, normalizeSocialBrowserLink } from '../../../social-browser/navigation';

type BrowserWindow = Window & typeof globalThis & { __focusUpTikTok?: { observer: MutationObserver }; ReactNativeWebView?: { postMessage: (value: string) => void } };
const hidden = 'data-focusup-tiktok-hidden';

describe('TikTok feed detection', () => {
  it.each([
    ['https://www.tiktok.com/', 'forYou'],
    ['https://www.tiktok.com/foryou', 'forYou'],
    ['https://www.tiktok.com/foryou?lang=en', 'forYou'],
    ['https://www.tiktok.com/en/', 'forYou'],
    ['https://www.tiktok.com/live', 'forYou'],
    ['https://www.tiktok.com/following', 'following'],
    ['https://www.tiktok.com/friends', 'following'],
    ['https://www.tiktok.com/explore', 'explore'],
    ['https://m.tiktok.com/discover', 'explore'],
  ])('classifies %s as %s', (url, feature) => {
    expect(tiktokFeedFeature(url)).toBe(feature);
  });

  it.each([
    'https://www.tiktok.com/inbox',
    'https://www.tiktok.com/messages',
    'https://www.tiktok.com/@creator',
    'https://www.tiktok.com/@creator/video/7300000000000000000',
    'https://www.tiktok.com/search?q=cooking',
    'https://www.tiktok.com/profile',
    'https://example.com/',
  ])('keeps %s open', (url) => {
    expect(tiktokFeedFeature(url)).toBeNull();
  });

  it('blocks only the feeds whose filter is on', () => {
    expect(isBlockedTikTokNavigation('https://www.tiktok.com/', { forYou: true })).toBe(true);
    expect(isBlockedTikTokNavigation('https://www.tiktok.com/', { forYou: false })).toBe(false);
    expect(isBlockedTikTokNavigation('https://www.tiktok.com/following', { forYou: true, following: false })).toBe(false);
    expect(isBlockedTikTokNavigation('https://www.tiktok.com/following', { following: true })).toBe(true);
  });

  it('recognises a single shared video', () => {
    expect(isTikTokVideoUrl('https://www.tiktok.com/@creator/video/7300000000000000000')).toBe(true);
    expect(isTikTokVideoUrl('https://www.tiktok.com/@creator')).toBe(false);
  });
});

describe('TikTok browser navigation', () => {
  it('accepts TikTok links, including short links', () => {
    expect(normalizeSocialBrowserLink('tiktok', 'vm.tiktok.com/ZMabc/')).toBe('https://vm.tiktok.com/ZMabc/');
    expect(normalizeSocialBrowserLink('tiktok', 'https://www.tiktok.com/@creator/video/1')).toBe('https://www.tiktok.com/@creator/video/1');
    expect(normalizeSocialBrowserLink('tiktok', 'https://youtube.com/watch?v=1')).toBeNull();
    expect(normalizeSocialBrowserLink('tiktok', 'http://www.tiktok.com:8080/')).toBeNull();
  });

  it('keeps TikTok and its sign-in providers in the app and sends other sites out', () => {
    expect(classifySocialBrowserNavigation('tiktok', 'https://www.tiktok.com/login')).toBe('internal');
    expect(classifySocialBrowserNavigation('tiktok', 'https://accounts.google.com/o/oauth2/auth')).toBe('internal');
    expect(classifySocialBrowserNavigation('tiktok', 'https://appleid.apple.com/auth/authorize')).toBe('internal');
    expect(classifySocialBrowserNavigation('tiktok', 'https://example.com/')).toBe('external');
    expect(classifySocialBrowserNavigation('tiktok', 'https://apps.apple.com/app/tiktok/id835599320')).toBe('reject');
  });

  it('reports coarse routes only', () => {
    expect(getSocialBrowserRoute('tiktok', 'https://www.tiktok.com/')).toBe('feed');
    expect(getSocialBrowserRoute('tiktok', 'https://www.tiktok.com/@creator/video/1')).toBe('watch');
    expect(getSocialBrowserRoute('tiktok', 'https://www.tiktok.com/@creator')).toBe('profile');
    expect(getSocialBrowserRoute('tiktok', 'https://www.tiktok.com/search?q=private')).toBe('search');
    expect(getSocialBrowserRoute('tiktok', 'https://www.tiktok.com/inbox')).toBe('other');
  });
});

describe('TikTok page script', () => {
  let dom: JSDOM;
  let browser: BrowserWindow;
  let messages: Record<string, unknown>[];
  const load = (url: string, html: string, config = { forYou: true, following: false, explore: false }, enabled = true) => {
    dom = new JSDOM(`<body>${html}</body>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
    browser = dom.window as unknown as BrowserWindow;
    messages = [];
    browser.ReactNativeWebView = { postMessage: (value) => messages.push(JSON.parse(value)) };
    browser.eval(generateTikTokBlockingScript(config, enabled));
    return browser.document;
  };
  afterEach(() => { browser.__focusUpTikTok?.observer.disconnect(); dom.window.close(); });

  const nav = '<nav><a href="/" id="home"><span data-e2e="home-icon"></span></a><a href="/discover" id="discover"><span data-e2e="discover-icon"></span></a><a href="/inbox" id="inbox"><span data-e2e="dm-icon"></span></a><a href="/profile" id="profile"><span data-e2e="profile-icon"></span></a><a href="snssdk1233://" id="open"><span data-e2e="open-titok-icon"></span></a></nav>';

  it('hides the For You tab and app prompts, keeping messages and profile', () => {
    const document = load('https://www.tiktok.com/inbox', nav);
    expect(document.getElementById('home')?.getAttribute(hidden)).toBe('forYou');
    expect(document.getElementById('open')?.getAttribute(hidden)).toBe('appPromo');
    for (const id of ['discover', 'inbox', 'profile']) expect(document.getElementById(id)?.hasAttribute(hidden)).toBe(false);
    expect(messages).toContainEqual({ platform: 'tiktok', type: 'FILTER_APPLIED', feature: 'forYou', count: 1 });
  });

  it('hides Discover only when its filter is on', () => {
    const document = load('https://www.tiktok.com/inbox', nav, { forYou: true, following: false, explore: true });
    expect(document.getElementById('discover')?.getAttribute(hidden)).toBe('explore');
  });

  it('leaves the feed tab alone when Clean Mode is off but still removes app prompts', () => {
    const document = load('https://www.tiktok.com/inbox', nav, { forYou: true, following: false, explore: false }, false);
    expect(document.getElementById('home')?.hasAttribute(hidden)).toBe(false);
    expect(document.getElementById('open')?.getAttribute(hidden)).toBe('appPromo');
  });

  it('keeps an opened video and hides the ones queued after it', () => {
    const document = load('https://www.tiktok.com/@creator/video/7300000000000000000', '<div data-e2e="video-slide-0" id="first"><div data-e2e="video-slide-active"></div></div><div data-e2e="video-slide-1" id="next"></div>');
    expect(document.getElementById('first')?.hasAttribute(hidden)).toBe(false);
    expect(document.getElementById('next')?.getAttribute(hidden)).toBe('forYou');
  });

  it('presses "Not now" on full-screen app prompts', () => {
    const document = load('https://www.tiktok.com/inbox', '<button data-e2e="alt-middle-cta-cancel-btn" id="later">Not now</button>');
    const later = document.getElementById('later')!;
    const click = jest.fn();
    later.addEventListener('click', click);
    // The first pass ran during load; a re-inserted prompt is pressed on the next pass.
    const again = later.cloneNode(true) as HTMLElement; again.id = 'again'; again.addEventListener('click', click);
    document.body.appendChild(again);
    return new Promise<void>((resolve) => { setTimeout(() => { expect(click).toHaveBeenCalledTimes(1); resolve(); }, 100); });
  });
});
