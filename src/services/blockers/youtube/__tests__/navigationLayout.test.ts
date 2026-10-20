import { JSDOM } from 'jsdom';
import { generateYouTubeBlockingScript } from '../generateScript';

type BrowserWindow = Window & typeof globalThis & {
  __focusUpYouTube?: { observer: MutationObserver };
};
const config = { shorts: true, homeRecommendations: false, recommendations: false, comments: false, sponsoredContent: false };
const hidden = 'data-focusup-youtube-hidden';
let dom: JSDOM;
let browser: BrowserWindow;
let document: Document;
const inject = (shorts = true, enabled = true) => browser.eval(generateYouTubeBlockingScript({ ...config, shorts }, enabled));

describe('YouTube Shorts navigation layout', () => {
  beforeEach(() => {
    dom = new JSDOM('', { url: 'https://m.youtube.com/', runScripts: 'outside-only', pretendToBeVisual: true });
    browser = dom.window as unknown as BrowserWindow;
    document = browser.document;
    browser.console.debug = jest.fn();
  });
  afterEach(() => {
    browser.__focusUpYouTube?.observer.disconnect();
    dom.window.close();
  });

  it.each(['tab-identifier', 'pivot-identifier'])('hides a localized mobile Shorts button identified by %s without a link', (attribute) => {
    document.body.innerHTML = `<ytm-pivot-bar-renderer><ytm-pivot-bar-item-renderer id="home">Home</ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer id="shorts" ${attribute}="shorts"><button aria-label="Krótkie filmy">Krótkie filmy</button></ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer id="subscriptions">Subscriptions</ytm-pivot-bar-item-renderer></ytm-pivot-bar-renderer>`;
    inject();
    expect(document.getElementById('shorts')?.getAttribute(hidden)).toBe('shorts');
    expect(browser.getComputedStyle(document.getElementById('shorts')!).display).toBe('none');
    for (const id of ['home', 'subscriptions']) {
      expect(document.getElementById(id)?.hasAttribute(hidden)).toBe(false);
      expect(browser.getComputedStyle(document.getElementById(id)!).flexGrow).toBe('1');
    }
  });

  it('removes the entire nested slot and redistributes fixed button widths in a wrapped bottom row', () => {
    document.body.innerHTML = '<ytm-pivot-bar-renderer><div id="row"><ytm-pivot-bar-item-renderer id="home" style="width: 33.33%">Home</ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer id="shorts" style="width: 33.33%"><span><a href="/shorts/?feature=share">Shorts</a></span></ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer id="you" style="width: 33.33%">You</ytm-pivot-bar-item-renderer></div></ytm-pivot-bar-renderer>';
    inject();
    expect(document.getElementById('shorts')?.getAttribute(hidden)).toBe('shorts');
    expect(browser.getComputedStyle(document.getElementById('row')!).display).toBe('flex');
    for (const id of ['home', 'you']) {
      const style = browser.getComputedStyle(document.getElementById(id)!);
      expect(style.flexGrow).toBe('1');
      expect(style.flexBasis).toBe('0%');
    }
    expect(document.querySelector('ytm-pivot-bar-renderer')?.hasAttribute(hidden)).toBe(false);
  });

  it('hides desktop guide slots without making the sidebar a horizontal row', () => {
    document.body.innerHTML = '<nav id="guide"><ytd-mini-guide-entry-renderer id="shorts"><a href="/shorts/">Shorts</a></ytd-mini-guide-entry-renderer><ytd-mini-guide-entry-renderer id="subscriptions"><a href="/feed/subscriptions">Subscriptions</a></ytd-mini-guide-entry-renderer></nav>';
    inject();
    expect(document.getElementById('shorts')?.getAttribute(hidden)).toBe('shorts');
    expect(document.getElementById('subscriptions')?.hasAttribute(hidden)).toBe(false);
    expect(document.getElementById('guide')?.hasAttribute('data-focusup-youtube-nav-row')).toBe(false);
  });

  it.each([[false, true], [true, false]])('restores the original buttons and spacing when shorts=%s and enabled=%s', (shorts, enabled) => {
    document.body.innerHTML = '<ytm-pivot-bar-renderer id="row"><ytm-pivot-bar-item-renderer>Home</ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer tab-identifier="shorts">Shorts</ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer>You</ytm-pivot-bar-item-renderer></ytm-pivot-bar-renderer>';
    inject();
    expect(document.querySelectorAll(`[${hidden}]`)).toHaveLength(1);
    expect(document.getElementById('row')?.hasAttribute('data-focusup-youtube-nav-row')).toBe(true);
    inject(shorts, enabled);
    expect(document.querySelectorAll(`[${hidden}], [data-focusup-youtube-nav-row]`)).toHaveLength(0);
  });

  it('filters navigation buttons and labels inserted after the first page load', async () => {
    inject();
    document.body.innerHTML = '<ytm-pivot-bar-renderer><ytm-pivot-bar-item-renderer>Home</ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer id="shorts"><button></button></ytm-pivot-bar-item-renderer><ytm-pivot-bar-item-renderer>You</ytm-pivot-bar-item-renderer></ytm-pivot-bar-renderer>';
    await new Promise<void>((resolve) => browser.requestAnimationFrame(() => browser.requestAnimationFrame(() => resolve())));
    document.querySelector('button')!.setAttribute('aria-label', 'Shorts');
    await new Promise<void>((resolve) => browser.requestAnimationFrame(() => browser.requestAnimationFrame(() => resolve())));
    expect(document.getElementById('shorts')?.getAttribute(hidden)).toBe('shorts');
    expect(browser.getComputedStyle(document.querySelector('ytm-pivot-bar-item-renderer')!).flexGrow).toBe('1');
  });
});
