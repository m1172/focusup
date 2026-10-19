import { JSDOM } from 'jsdom';
import { generateInstagramBlockingScript } from '../generateScript';

type BrowserWindow = Window & typeof globalThis & {
  ReactNativeWebView?: { postMessage: jest.Mock };
  __focusUpInstagram?: { apply: (node: Element | Document) => void; observer: MutationObserver };
};
let dom: JSDOM;
let browser: BrowserWindow;
let document: Document;
const allOff = { reels: false, explore: false, recommendations: false, suggestedPosts: false, sponsoredPosts: false, homeFeed: false };
const inject = (config = allOff, enabled = true) => browser.eval(generateInstagramBlockingScript(config, enabled));
const messages = () => browser.ReactNativeWebView!.postMessage.mock.calls.map(([value]) => JSON.parse(value as string));

describe('Instagram semantic content detection', () => {
  beforeEach(() => {
    dom = new JSDOM('', { url: 'https://www.instagram.com/', runScripts: 'outside-only', pretendToBeVisual: true });
    browser = dom.window as unknown as BrowserWindow;
    document = browser.document;
    browser.console.debug = jest.fn();
    browser.ReactNativeWebView = { postMessage: jest.fn() };
  });
  afterEach(() => {
    browser.__focusUpInstagram?.observer.disconnect();
    dom.window.close();
  });

  it('requires a recognized ad label and ignores ordinary captions', () => {
    document.body.innerHTML = '<article><header><span>Sponsored</span></header></article><article><header>Friend</header><p>Sponsored</p><div role="comment">Реклама</div></article><article><header><span>Реклама</span></header></article>';
    inject({ ...allOff, sponsoredPosts: true });
    const posts = document.querySelectorAll('article');
    expect(posts[0].getAttribute('data-focusup-hidden')).toBe('sponsoredPosts');
    expect(posts[1].hasAttribute('data-focusup-hidden')).toBe(false);
    expect(posts[2].getAttribute('data-focusup-hidden')).toBe('sponsoredPosts');
  });

  it('counts detected content with filters off and does not recount it on reinjection', () => {
    document.body.innerHTML = '<article><header><span>Sponsored</span></header><a href="/p/ad-1/">Post</a></article><article><h2>Suggested for you</h2><a href="/p/suggested-1/">Post</a></article>';
    inject(allOff, false);
    expect(document.querySelectorAll('[data-focusup-hidden]')).toHaveLength(0);
    expect(messages().filter((event) => event.type === 'CONTENT_DETECTED')).toEqual([
      { type: 'CONTENT_DETECTED', platform: 'instagram', feature: 'sponsoredPosts', count: 1 },
      { type: 'CONTENT_DETECTED', platform: 'instagram', feature: 'suggestedPosts', count: 1 },
    ]);
    inject(allOff, false);
    browser.__focusUpInstagram!.apply(document);
    expect(messages().filter((event) => event.type === 'CONTENT_DETECTED')).toHaveLength(2);
  });

  it('hides labeled ads and suggested posts, then restores them when filters are disabled', () => {
    document.body.innerHTML = '<article id="ad"><header><span>Sponsored</span></header></article><article id="suggested"><h2>Suggested for you</h2></article><article id="friend"><header>A friend</header><p>Sponsored</p></article>';
    inject({ ...allOff, sponsoredPosts: true, suggestedPosts: true });
    expect(document.querySelector('#ad')?.getAttribute('data-focusup-hidden')).toBe('sponsoredPosts');
    expect(document.querySelector('#suggested')?.getAttribute('data-focusup-hidden')).toBe('suggestedPosts');
    expect(document.querySelector('#friend')?.hasAttribute('data-focusup-hidden')).toBe(false);
    inject(allOff, false);
    expect(document.querySelectorAll('[data-focusup-hidden]')).toHaveLength(0);
  });

  it('detects late labels and recycled articles without counting the same post twice', () => {
    document.body.innerHTML = '<article><header><span></span></header><a href="/p/first/">Post</a></article>';
    inject({ ...allOff, sponsoredPosts: true });
    document.querySelector('span')!.textContent = 'Sponsored';
    browser.__focusUpInstagram!.apply(document);
    expect(document.querySelector('article')!.getAttribute('data-focusup-hidden')).toBe('sponsoredPosts');
    browser.__focusUpInstagram!.apply(document);
    expect(messages().filter((event) => event.type === 'CONTENT_DETECTED')).toHaveLength(1);
    document.querySelector('a')!.setAttribute('href', '/p/second/');
    browser.__focusUpInstagram!.apply(document);
    expect(messages().filter((event) => event.type === 'CONTENT_DETECTED')).toHaveLength(2);
  });

  it('preserves Search, messages and profiles when Explore and Reels are hidden', () => {
    document.body.innerHTML = '<nav><a id="search" href="/explore/"><svg aria-label="Search"></svg></a><a id="explore" href="/explore/">Explore</a><a id="reels" href="/reels/">Reels</a><a id="messages" href="/direct/inbox/">Messages</a><a id="profile" href="/my-account/">Profile</a></nav>';
    inject({ ...allOff, explore: true, reels: true });
    for (const id of ['search', 'messages', 'profile']) expect(document.getElementById(id)?.hasAttribute('data-focusup-hidden')).toBe(false);
    expect(document.getElementById('explore')?.getAttribute('data-focusup-hidden')).toBe('explore');
    expect(document.getElementById('reels')?.getAttribute('data-focusup-hidden')).toBe('reels');
  });

  it('hides only the dedicated Reels entry and preserves Home videos, photos and profile grids', () => {
    document.body.innerHTML = '<nav><a id="reels" href="/reels"><svg aria-label="Reels"></svg></a><a id="inbox" href="/direct/inbox/">Inbox</a></nav><div role="tablist"><a id="tab" href="/person/reels/">Reels</a></div><article id="reel"><video controls></video><a id="home-video-link" href="/person/reel/video-id/"><svg aria-label="Reels"></svg>Video</a><a id="more-reels" href="/reels/">More reels</a></article><article id="photo"><a href="/p/photo-id/">Photo</a></article><a id="profile-tile" href="/reel/video-id/"><svg aria-label="Reels"></svg></a>';
    const pause = jest.spyOn(document.querySelector('video')!, 'pause');
    inject({ ...allOff, reels: true });
    expect(document.getElementById('reels')?.getAttribute('data-focusup-hidden')).toBe('reels');
    for (const id of ['tab', 'reel', 'photo', 'inbox', 'home-video-link', 'more-reels', 'profile-tile']) expect(document.getElementById(id)?.hasAttribute('data-focusup-hidden')).toBe(false);
    expect(document.querySelector('video')?.controls).toBe(true);
    expect(pause).not.toHaveBeenCalled();
    pause.mockRestore();
  });

  it('blocks the Reels feed entry while allowing individual account videos to open', () => {
    document.body.innerHTML = '<nav><a id="reels" href="/reels/">Reels</a></nav><a id="video" href="/person/reel/video-id/">Account video</a>';
    inject({ ...allOff, reels: true });
    const click = new browser.MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('reels')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    browser.history.pushState({}, '', '/reels/');
    expect(browser.location.pathname).toBe('/');
    browser.history.replaceState({}, '', '/explore/reels/');
    expect(browser.location.pathname).toBe('/');
    expect(messages().filter((event) => event.type === 'BLOCKED_NAVIGATION')).toHaveLength(3);
    browser.history.pushState({}, '', '/direct/inbox/');
    expect(browser.location.pathname).toBe('/direct/inbox/');
    browser.history.pushState({}, '', '/person/reels/');
    expect(browser.location.pathname).toBe('/person/reels/');
    for (const path of ['/reel/video-id/', '/person/reel/video-id/', '/reels/video-id/']) {
      browser.history.pushState({}, '', path);
      expect(browser.location.pathname).toBe(path);
    }
    const videoClick = new browser.MouseEvent('click', { bubbles: true, cancelable: true });
    // Prevent JSDOM's default page load after checking that our capture handler allows the video.
    let preventedBeforeWebsiteHandler = false;
    document.getElementById('video')!.addEventListener('click', (event) => { preventedBeforeWebsiteHandler = event.defaultPrevented; event.preventDefault(); });
    document.getElementById('video')!.dispatchEvent(videoClick);
    expect(preventedBeforeWebsiteHandler).toBe(false);
    expect(messages().filter((event) => event.type === 'BLOCKED_NAVIGATION')).toHaveLength(3);
  });

  it('removes a nested Reels slot and shares the bottom bar across the four remaining icons', () => {
    document.body.innerHTML = '<nav id="bottom"><div id="home"><a href="/">Home</a></div><div id="search"><a href="/explore/search/">Search</a></div><div id="reels-slot"><span><a href="/reels/">Reels</a></span></div><div id="messages"><a href="/direct/inbox/">Messages</a></div><div id="profile"><a href="/person/">Profile</a></div></nav>';
    inject({ ...allOff, reels: true });
    const row = document.getElementById('bottom')!;
    expect(row.hasAttribute('data-focusup-nav-row')).toBe(true);
    expect(document.getElementById('reels-slot')!.getAttribute('data-focusup-hidden')).toBe('reels');
    expect(Array.from(row.querySelectorAll(':scope > [data-focusup-nav-item]:not([data-focusup-hidden])')).map((item) => item.id)).toEqual(['home', 'search', 'messages', 'profile']);
    expect(browser.getComputedStyle(row).display).toBe('flex');
    for (const id of ['home', 'search', 'messages', 'profile']) {
      expect(browser.getComputedStyle(document.getElementById(id)!).flexGrow).toBe('1');
    }
    inject(allOff);
    expect(document.getElementById('reels-slot')!.hasAttribute('data-focusup-hidden')).toBe(false);
    expect(row.hasAttribute('data-focusup-nav-row')).toBe(false);
    expect(document.querySelectorAll('[data-focusup-nav-item]')).toHaveLength(0);
  });

  it('recognizes a bottom bar made of divs without changing the desktop sidebar', () => {
    document.body.innerHTML = '<div id="bottom"><div><a href="/">Home</a></div><div><a href="/explore/">Search</a></div><div id="reels-slot"><a href="/reels/">Reels</a></div><div><a href="/direct/inbox/">Messages</a></div><div><a href="/person/">Profile</a></div></div><nav id="sidebar"><a href="/">Home</a><a href="/reels/">Reels</a><a href="/person/">Profile</a></nav>';
    document.getElementById('bottom')!.getBoundingClientRect = () => ({ width: 390, height: 50, top: 718, bottom: 768, left: 0, right: 390, x: 0, y: 718, toJSON: () => ({}) });
    document.getElementById('sidebar')!.getBoundingClientRect = () => ({ width: 80, height: 768, top: 0, bottom: 768, left: 0, right: 80, x: 0, y: 0, toJSON: () => ({}) });
    inject({ ...allOff, reels: true });
    expect(document.getElementById('bottom')!.hasAttribute('data-focusup-nav-row')).toBe(true);
    expect(document.getElementById('reels-slot')!.getAttribute('data-focusup-hidden')).toBe('reels');
    expect(document.getElementById('sidebar')!.hasAttribute('data-focusup-nav-row')).toBe(false);
  });

  it('keeps dynamically loaded Home videos while filtering the Reels navigation icon', async () => {
    inject({ ...allOff, reels: true });
    document.body.innerHTML = '<nav><a id="late-navigation" href="/reels/">Reels</a></nav><article id="late-video"><video controls></video><a href="/reel/late-id/">Video</a></article>';
    const pause = jest.spyOn(document.querySelector('video')!, 'pause');
    await new Promise<void>((resolve) => browser.requestAnimationFrame(() => browser.requestAnimationFrame(() => resolve())));
    expect(document.getElementById('late-navigation')?.getAttribute('data-focusup-hidden')).toBe('reels');
    expect(document.getElementById('late-video')?.hasAttribute('data-focusup-hidden')).toBe(false);
    expect(pause).not.toHaveBeenCalled();
    pause.mockRestore();
  });

  it('restores Home videos hidden by the previous broad Reels rule during an update', () => {
    document.body.innerHTML = '<article id="home-video" data-focusup-hidden="reels"><video controls></video><a href="/reel/video-id/">Video</a></article><nav><a id="reels" href="/reels/">Reels</a></nav>';
    inject({ ...allOff, reels: true });
    expect(document.getElementById('home-video')?.hasAttribute('data-focusup-hidden')).toBe(false);
    expect(document.getElementById('reels')?.getAttribute('data-focusup-hidden')).toBe('reels');
  });
});
