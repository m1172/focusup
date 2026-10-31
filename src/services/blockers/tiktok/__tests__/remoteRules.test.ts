import { JSDOM } from 'jsdom';
import { generateTikTokBlockingScript } from '../generateScript';
import { validateRemoteBlockerConfig } from '../../../remote-config/remoteBlockerConfig';
import type { RemotePlatformRule } from '../../../../store/remoteBlockerConfigStore';

type BrowserWindow = Window & typeof globalThis & {
  __focusUpTikTok: { observer: MutationObserver; blockedFeature: (url: string, config: unknown) => string | null; config: unknown };
  ReactNativeWebView?: { postMessage: (value: string) => void };
};

describe('TikTok remote rules', () => {
  it('accepts TikTok rules and rejects unsafe ones', () => {
    const rule = { version: 2, enabled: true, features: { forYou: true }, selectors: { forYouNavigation: ['[data-e2e="nav-home-new"]'] }, routes: ['/foryou/new'] };
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { tiktok: rule } })).toEqual({ schemaVersion: 1, platforms: { tiktok: rule } });
    // Remote rules may only hide things: pressing buttons (promoDismiss) and message pages are refused.
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { tiktok: { version: 1, enabled: true, features: {}, selectors: { promoDismiss: ['[data-e2e="x"]'] } } } })).toBeNull();
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { tiktok: { version: 1, enabled: true, features: {}, routes: ['/messages'] } } })).toBeNull();
    expect(validateRemoteBlockerConfig({ schemaVersion: 1, platforms: { tiktok: { version: 1, enabled: true, features: {}, selectors: { forYouNavigation: ['body'] } } } })).toBeNull();
  });

  it('hides elements and blocks pages added by a rule', () => {
    const dom = new JSDOM('<nav><a id="home" data-e2e="nav-home-new" href="/home-v2">Home</a><a id="inbox" href="/inbox">Inbox</a></nav>', { url: 'https://www.tiktok.com/inbox', runScripts: 'outside-only', pretendToBeVisual: true });
    const browser = dom.window as unknown as BrowserWindow;
    browser.ReactNativeWebView = { postMessage: jest.fn() };
    const rule: RemotePlatformRule = { version: 1, enabled: true, features: {}, selectors: { forYouNavigation: ['[data-e2e="nav-home-new"]'] }, routes: ['/home-v2'] };
    browser.eval(generateTikTokBlockingScript({ forYou: true }, true, rule));
    expect(browser.document.getElementById('home')!.hasAttribute('data-focusup-tiktok-hidden')).toBe(true);
    expect(browser.document.getElementById('inbox')!.hasAttribute('data-focusup-tiktok-hidden')).toBe(false);
    const root = browser.__focusUpTikTok;
    expect(root.blockedFeature('https://www.tiktok.com/home-v2/', root.config)).toBe('forYou');
    expect(root.blockedFeature('https://www.tiktok.com/inbox', root.config)).toBeNull();
    root.observer.disconnect();
    dom.window.close();
  });
});

describe('TikTok bottom bar spacing', () => {
  it('hides the whole slot of a removed tab and marks the bar so the rest spread out', () => {
    const bar = '<nav id="bar">'
      + '<div id="homeSlot"><a data-e2e="home-icon" href="/foryou">Home</a></div>'
      + '<div id="discoverSlot"><a href="/discover">Discover</a></div>'
      + '<div id="createSlot"><button data-e2e="open-tiktok-icon">+</button></div>'
      + '<div id="inboxSlot"><a href="/inbox">Inbox</a></div>'
      + '<div id="profileSlot"><a href="/profile">Profile</a></div></nav>';
    const dom = new JSDOM(bar, { url: 'https://www.tiktok.com/inbox', runScripts: 'outside-only', pretendToBeVisual: true });
    const browser = dom.window as unknown as BrowserWindow;
    browser.ReactNativeWebView = { postMessage: jest.fn() };
    browser.eval(generateTikTokBlockingScript({ forYou: true, explore: false }, true));
    const hidden = (id: string) => browser.document.getElementById(id)!.hasAttribute('data-focusup-tiktok-hidden');
    expect(hidden('homeSlot')).toBe(true);
    expect(hidden('createSlot')).toBe(true);
    expect(hidden('discoverSlot')).toBe(false);
    expect(hidden('inboxSlot')).toBe(false);
    expect(browser.document.getElementById('bar')!.hasAttribute('data-focusup-tiktok-nav-row')).toBe(true);
    expect(browser.document.getElementById('focusup-tiktok-clean-styles')!.textContent).toContain('flex: 1 1 0%');
    browser.__focusUpTikTok.observer.disconnect();
    dom.window.close();
  });
});
