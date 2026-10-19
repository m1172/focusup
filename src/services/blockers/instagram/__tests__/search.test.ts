import { JSDOM } from 'jsdom';
import { generateInstagramBlockingScript } from '../generateScript';

type Browser = Window & typeof globalThis & {
  ReactNativeWebView: { postMessage: jest.Mock };
  __focusUpInstagram: { apply: (node: Document) => void; observer: MutationObserver; pendingSearch: boolean };
};

describe('Instagram bottom Search tab', () => {
  let dom: JSDOM;
  let browser: Browser;
  const nav = '<nav><a id="home" href="/">Home</a><a id="search" href="/explore/"><svg aria-label="Search"></svg></a><a href="/direct/inbox/">Messages</a><a href="/person/">Profile</a></nav>';
  const inject = (enabled = true, focusedSearch = true) => browser.eval(generateInstagramBlockingScript({ reels: true }, enabled, undefined, focusedSearch));
  const click = (id: string) => browser.document.getElementById(id)!.dispatchEvent(new browser.MouseEvent('click', { bubbles: true, cancelable: true }));

  beforeEach(() => {
    dom = new JSDOM(nav, { url: 'https://www.instagram.com/', runScripts: 'outside-only', pretendToBeVisual: true });
    browser = dom.window as unknown as Browser;
    browser.ReactNativeWebView = { postMessage: jest.fn() };
    browser.console.debug = jest.fn();
  });
  afterEach(() => { browser.__focusUpInstagram?.observer.disconnect(); dom.window.close(); });

  it('opens recent search when Instagram loads the search input after navigation', async () => {
    inject();
    browser.document.getElementById('search')!.addEventListener('click', (event) => {
      event.preventDefault(); // Instagram's SPA owns navigation.
      browser.history.pushState({}, '', '/explore/');
    });
    click('search');
    expect(browser.__focusUpInstagram.pendingSearch).toBe(true);
    const input = browser.document.createElement('input');
    input.placeholder = 'Search';
    const showRecent = jest.fn();
    input.addEventListener('focus', showRecent);
    browser.document.body.appendChild(input);
    await new Promise<void>((resolve) => browser.requestAnimationFrame(() => browser.requestAnimationFrame(() => resolve())));
    expect(browser.document.activeElement).toBe(browser.document.body);
    expect(showRecent).toHaveBeenCalledTimes(1);
    expect(input.hasAttribute('inputmode')).toBe(false);
    expect(browser.__focusUpInstagram.pendingSearch).toBe(false);
    expect(browser.sessionStorage.getItem('focusup-instagram-open-search')).toBeNull();
  });

  it('opens Recent immediately from Explore and survives reinjection without raising the keyboard', () => {
    browser.history.replaceState({}, '', '/explore/');
    browser.document.body.insertAdjacentHTML('afterbegin', '<input placeholder="Search">');
    const siteNavigation = jest.fn();
    browser.document.getElementById('search')!.addEventListener('click', siteNavigation);
    inject();
    inject();
    click('search');
    expect(browser.document.activeElement).toBe(browser.document.body);
    expect(siteNavigation).not.toHaveBeenCalled();
  });

  it('leaves normal Instagram Search untouched when Clean Mode is unavailable', () => {
    browser.history.replaceState({}, '', '/explore/');
    browser.document.body.insertAdjacentHTML('afterbegin', '<input placeholder="Search">');
    const siteNavigation = jest.fn((event: Event) => event.preventDefault());
    browser.document.getElementById('search')!.addEventListener('click', siteNavigation);
    inject(false);
    click('search');
    expect(siteNavigation).toHaveBeenCalledTimes(1);
    expect(browser.__focusUpInstagram.pendingSearch).toBe(false);
    expect(browser.document.activeElement).toBe(browser.document.body);
  });

  it('keeps focused search in Pro when free Reels protection is enabled', () => {
    browser.history.replaceState({}, '', '/explore/');
    browser.document.body.insertAdjacentHTML('afterbegin', '<input placeholder="Search"><button id="cancel">Cancel</button>');
    const siteSearch = jest.fn((event: Event) => event.preventDefault());
    const siteCancel = jest.fn();
    browser.document.getElementById('search')!.addEventListener('click', siteSearch);
    browser.document.getElementById('cancel')!.addEventListener('click', siteCancel);
    inject(true, false);
    click('search');
    click('cancel');
    expect(siteSearch).toHaveBeenCalledTimes(1);
    expect(siteCancel).toHaveBeenCalledTimes(1);
    expect(browser.__focusUpInstagram.pendingSearch).toBe(false);
    expect(browser.location.pathname).toBe('/explore/');
  });

  it.each(['Cancel', 'Отмена', 'Bekor qilish'])('sends %s to Home and allows Search to be reopened', (label) => {
    browser.history.replaceState({}, '', '/explore/');
    browser.document.body.insertAdjacentHTML('afterbegin', '<header><input placeholder="Search"><button id="cancel"><span>' + label + '</span></button></header>');
    const defaultCancel = jest.fn();
    browser.document.getElementById('cancel')!.addEventListener('click', defaultCancel);
    browser.document.getElementById('home')!.addEventListener('click', (event) => { event.preventDefault(); browser.history.pushState({}, '', '/'); });
    inject();
    click('search');
    click('cancel');
    expect(browser.location.pathname).toBe('/');
    expect(defaultCancel).not.toHaveBeenCalled();
    expect(browser.__focusUpInstagram.pendingSearch).toBe(false);
    expect(browser.sessionStorage.getItem('focusup-instagram-open-search')).toBeNull();
    browser.document.getElementById('search')!.addEventListener('click', (event) => { event.preventDefault(); browser.history.pushState({}, '', '/explore/'); });
    click('search');
    expect(browser.location.pathname).toBe('/explore/');
    expect(browser.__focusUpInstagram.pendingSearch).toBe(true);
  });

  it('preserves ordinary Explore links in posts', () => {
    browser.document.body.insertAdjacentHTML('beforeend', '<article><a id="caption" href="/explore/">Explore</a></article>');
    inject();
    let prevented = true;
    browser.document.getElementById('caption')!.addEventListener('click', (event) => { prevented = event.defaultPrevented; event.preventDefault(); });
    click('caption');
    expect(prevented).toBe(false);
    expect(browser.__focusUpInstagram.pendingSearch).toBe(false);
  });

  it('does not focus a hidden input while waiting for Instagram to render Search', () => {
    browser.history.replaceState({}, '', '/explore/');
    browser.sessionStorage.setItem('focusup-instagram-open-search', '1');
    browser.document.body.insertAdjacentHTML('afterbegin', '<input placeholder="Search" style="display:none">');
    inject();
    expect(browser.__focusUpInstagram.pendingSearch).toBe(true);
    expect(browser.document.activeElement).toBe(browser.document.body);
  });
});
