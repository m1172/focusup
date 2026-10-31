import { JSDOM } from 'jsdom';
import { createBrowserViewportScript } from '../viewport';

describe('full-screen website viewport', () => {
  let dom: JSDOM;
  const insets = { top: 62, right: 0, bottom: 34, left: 0 };
  const inject = (fullScreen: boolean) => dom.window.eval(createBrowserViewportScript(fullScreen, insets, 'instagram'));

  beforeEach(() => {
    dom = new JSDOM('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=contain">', {
      url: 'https://www.instagram.com/', runScripts: 'outside-only', pretendToBeVisual: true,
    });
  });
  afterEach(async () => {
    await Promise.resolve();
    const state = (dom.window as unknown as { __focusUpViewport?: { observer?: MutationObserver; pageObserver?: MutationObserver; themeObserver?: MutationObserver; frame?: number } }).__focusUpViewport;
    state?.observer?.disconnect();
    state?.pageObserver?.disconnect();
    state?.themeObserver?.disconnect();
    if (state?.frame) dom.window.clearTimeout(state.frame);
    dom.window.close();
  });

  it('fills the viewport without removing the website’s scaling preferences', () => {
    inject(true);
    const document = dom.window.document;
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe('width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover');
    expect(document.documentElement.style.getPropertyValue('--focusup-safe-bottom')).toBe('34px');
    expect(document.documentElement.hasAttribute('data-focusup-fullscreen')).toBe(true);
  });

  it('updates an SPA viewport replacement and remains stable after reinjection', async () => {
    inject(true);
    inject(true);
    dom.window.document.querySelector('meta[name="viewport"]')!.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const document = dom.window.document;
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toContain('viewport-fit=cover');
    expect(document.querySelectorAll('#focusup-viewport-styles')).toHaveLength(1);
  });

  it('can restore native controls without reloading or changing the current page', () => {
    inject(true);
    const document = dom.window.document;
    const video = document.createElement('video');
    document.body.appendChild(video);
    dom.window.history.pushState({}, '', '/stories/person/123/');
    inject(false);
    expect(document.documentElement.hasAttribute('data-focusup-fullscreen')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--focusup-safe-bottom')).toBe('0px');
    expect(dom.window.location.pathname).toBe('/stories/person/123/');
    expect(document.querySelector('video')).toBe(video);
  });

  it('reports only the edge color and follows light/dark page changes', async () => {
    const browser = dom.window as unknown as Window & typeof globalThis & { ReactNativeWebView: { postMessage: jest.Mock } };
    browser.ReactNativeWebView = { postMessage: jest.fn() };
    browser.document.body.style.backgroundColor = 'white';
    inject(true);
    expect(browser.ReactNativeWebView.postMessage).toHaveBeenLastCalledWith(JSON.stringify({ type: 'PAGE_APPEARANCE', platform: 'instagram', backgroundColor: '#ffffff', isStory: false }));
    inject(true);
    expect(browser.ReactNativeWebView.postMessage).toHaveBeenCalledTimes(1);
    browser.document.body.style.backgroundColor = 'rgb(12, 16, 20)';
    await new Promise((resolve) => browser.requestAnimationFrame(() => browser.requestAnimationFrame(resolve)));
    expect(browser.ReactNativeWebView.postMessage).toHaveBeenLastCalledWith(JSON.stringify({ type: 'PAGE_APPEARANCE', platform: 'instagram', backgroundColor: '#0c1014', isStory: false }));
  });

  it('updates Story immersion during SPA navigation without reinjection and restores the edge on exit', async () => {
    const browser = dom.window as unknown as Window & typeof globalThis & { ReactNativeWebView: { postMessage: jest.Mock } };
    browser.ReactNativeWebView = { postMessage: jest.fn() };
    browser.document.body.style.backgroundColor = 'white';
    inject(true);
    browser.history.pushState({}, '', '/stories/person/123/');
    await Promise.resolve();
    expect(browser.ReactNativeWebView.postMessage).toHaveBeenLastCalledWith(JSON.stringify({ type: 'PAGE_APPEARANCE', platform: 'instagram', backgroundColor: '#0b1014', isStory: true }));
    browser.history.pushState({}, '', '/direct/inbox/');
    await Promise.resolve();
    expect(browser.ReactNativeWebView.postMessage).toHaveBeenLastCalledWith(JSON.stringify({ type: 'PAGE_APPEARANCE', platform: 'instagram', backgroundColor: '#ffffff', isStory: false }));
  });
});
