import { JSDOM } from 'jsdom';
import { generateInstagramBlockingScript } from '../generateScript';

type Browser = Window & typeof globalThis & {
  ReactNativeWebView: { postMessage: jest.Mock };
  __focusUpInstagram: {
    observer: MutationObserver;
    apply: (node: Document) => void;
    update: (config: { enabled: boolean; reels: boolean }) => void;
  };
};

describe('Reel swipe lock', () => {
  let dom: JSDOM;
  let browser: Browser;
  const locked = 'data-focusup-dm-reel-lock';
  const inject = () => browser.eval(generateInstagramBlockingScript({ reels: true }, true, undefined, false));
  const settle = () => new Promise<void>((resolve) => browser.requestAnimationFrame(() => browser.requestAnimationFrame(() => resolve())));
  const touch = (node: Element, type: string, x: number, y: number) => {
    const event = new browser.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
    node.dispatchEvent(event);
    return event;
  };
  const addViewer = () => {
    const viewer = browser.document.createElement('div');
    viewer.style.cssText = 'overflow-y:scroll;scroll-snap-type:y mandatory';
    viewer.innerHTML = '<div><video></video></div><div><video></video></div>';
    viewer.getBoundingClientRect = () => new browser.DOMRect(0, 0, 402, 742);
    viewer.querySelectorAll('video').forEach((video, index) => { video.getBoundingClientRect = () => new browser.DOMRect(0, index * 742, 402, 742); });
    browser.document.body.appendChild(viewer);
    return viewer;
  };

  beforeEach(() => {
    dom = new JSDOM('<div id="thread" style="overflow-y:auto"><video></video></div>', {
      url: 'https://www.instagram.com/direct/t/thread-id/', runScripts: 'outside-only', pretendToBeVisual: true,
    });
    browser = dom.window as unknown as Browser;
    browser.ReactNativeWebView = { postMessage: jest.fn() };
    browser.console.debug = jest.fn();
    Object.defineProperties(browser, { innerWidth: { value: 402 }, innerHeight: { value: 812 } });
  });
  afterEach(() => { browser.__focusUpInstagram?.observer.disconnect(); dom.window.close(); });

  it('locks the late-rendered DM overlay even when no Reel link or URL change occurs', async () => {
    inject();
    const viewer = addViewer();
    await settle();
    expect(browser.location.pathname).toBe('/direct/t/thread-id/');
    expect(viewer.hasAttribute(locked)).toBe(true);
    expect(browser.document.getElementById('thread')!.hasAttribute(locked)).toBe(false);
  });

  it('stops vertical swipe handlers and keeps taps available for playback', () => {
    const viewer = addViewer();
    const video = viewer.querySelector('video')!;
    const nextReel = jest.fn();
    const play = jest.fn();
    viewer.addEventListener('touchmove', nextReel);
    viewer.addEventListener('touchend', nextReel);
    video.addEventListener('click', play);
    inject();
    touch(video, 'touchstart', 200, 500);
    expect(touch(video, 'touchmove', 200, 200).defaultPrevented).toBe(true);
    expect(touch(video, 'touchend', 200, 200).defaultPrevented).toBe(true);
    expect(nextReel).not.toHaveBeenCalled();
    touch(video, 'touchstart', 200, 500);
    expect(touch(video, 'touchend', 200, 500).defaultPrevented).toBe(false);
    video.dispatchEvent(new browser.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('holds the shared Reel position if Instagram tries to move its scroll container', async () => {
    const viewer = addViewer();
    inject();
    await settle();
    viewer.scrollTop = 742;
    viewer.dispatchEvent(new browser.Event('scroll'));
    expect(viewer.scrollTop).toBe(0);
  });

  it('leaves normal DM scrolling and inline attachments usable after closing the overlay', async () => {
    const viewer = addViewer();
    inject();
    await settle();
    viewer.remove();
    await settle();
    const thread = browser.document.getElementById('thread')!;
    touch(thread, 'touchstart', 200, 500);
    expect(touch(thread, 'touchmove', 200, 200).defaultPrevented).toBe(false);
    expect(thread.hasAttribute(locked)).toBe(false);
  });

  it.each(['/', '/person/', '/explore/'])('locks a Reels viewer outside DMs too, at %s', async (path) => {
    browser.history.replaceState({}, '', path);
    const viewer = addViewer();
    inject();
    await settle();
    expect(viewer.hasAttribute(locked)).toBe(true);
    touch(viewer.querySelector('video')!, 'touchstart', 200, 500);
    expect(touch(viewer.querySelector('video')!, 'touchmove', 200, 200).defaultPrevented).toBe(true);
  });

  it('keeps the Home feed scrolling: an ordinary, non-snapping list of videos is not a Reels viewer', async () => {
    browser.history.replaceState({}, '', '/');
    const feed = browser.document.createElement('div');
    feed.style.cssText = 'overflow-y:auto';
    feed.innerHTML = '<article><video></video></article><article><video></video></article>';
    feed.getBoundingClientRect = () => new browser.DOMRect(0, 0, 402, 812);
    feed.querySelectorAll('video').forEach((video, index) => { video.getBoundingClientRect = () => new browser.DOMRect(0, index * 500, 402, 500); });
    browser.document.body.appendChild(feed);
    inject();
    await settle();
    expect(feed.hasAttribute(locked)).toBe(false);
    touch(feed, 'touchstart', 200, 500);
    expect(touch(feed, 'touchmove', 200, 200).defaultPrevented).toBe(false);
  });

  it.each(['/reel/video-id/', '/person/reel/video-id/', '/reels/video-id/'])('stops swiping to the next Reel on %s, wherever it was opened from', (path) => {
    browser.history.replaceState({}, '', path);
    inject();
    const video = browser.document.querySelector('video')!;
    touch(video, 'touchstart', 200, 500);
    expect(touch(video, 'touchmove', 200, 200).defaultPrevented).toBe(true);
  });

  it('keeps comment sheets scrollable on a Reel page', () => {
    browser.history.replaceState({}, '', '/reel/video-id/');
    const sheet = browser.document.createElement('div');
    sheet.setAttribute('role', 'dialog');
    sheet.innerHTML = '<ul><li>comment</li></ul>';
    browser.document.body.appendChild(sheet);
    inject();
    const comment = sheet.querySelector('li')!;
    touch(comment, 'touchstart', 200, 500);
    expect(touch(comment, 'touchmove', 200, 200).defaultPrevented).toBe(false);
  });

  it('recognizes SPA navigation from a DM to a Reel without an anchor click', async () => {
    inject();
    browser.history.pushState({}, '', '/person/reel/shared-id/');
    await Promise.resolve();
    const video = browser.document.querySelector('video')!;
    touch(video, 'touchstart', 200, 500);
    expect(touch(video, 'touchmove', 200, 200).defaultPrevented).toBe(true);
  });

  it('releases the overlay when Reels blocking is disabled', async () => {
    const viewer = addViewer();
    inject();
    await settle();
    expect(viewer.hasAttribute(locked)).toBe(true);
    browser.__focusUpInstagram.update({ enabled: true, reels: false });
    await settle();
    expect(viewer.hasAttribute(locked)).toBe(false);
    touch(viewer, 'touchstart', 200, 500);
    expect(touch(viewer, 'touchmove', 200, 200).defaultPrevented).toBe(false);
  });
});
