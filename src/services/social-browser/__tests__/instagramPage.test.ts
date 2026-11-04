import { JSDOM } from 'jsdom';
import { createInstagramPageScript } from '../instagramPage';
import { parseSocialWebViewEvent } from '../messages';

type Entry = { target: Element; isIntersecting: boolean; intersectionRatio: number };
type Browser = Omit<Window & typeof globalThis, 'IntersectionObserver'> & { ReactNativeWebView: { postMessage: jest.Mock }; IntersectionObserver: unknown };

const AVATAR = 'https://scontent-waw2-1.cdninstagram.com/v/t51/123_n.jpg?stp=dst-jpg';
const tabBar = (avatar = AVATAR) => `<div id="bar"><a href="/">Home</a><a href="/explore/">Search</a><a href="/direct/inbox/">Messages</a><a href="/me.person/"><img src="${avatar}" alt="me.person's profile picture"></a></div>`;

describe('Instagram page script', () => {
  let dom: JSDOM;
  let browser: Browser;
  let observed: { callback: (entries: Entry[]) => void; targets: Element[] }[];
  const messages = () => browser.ReactNativeWebView.postMessage.mock.calls.map(([raw]) => parseSocialWebViewEvent(raw as string, 'instagram'));
  const open = (html: string, url = 'https://www.instagram.com/', switcher = true) => {
    dom = new JSDOM(`<body>${html}</body>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
    browser = dom.window as unknown as Browser;
    browser.ReactNativeWebView = { postMessage: jest.fn() };
    observed = [];
    browser.IntersectionObserver = class {
      targets: Element[] = [];
      constructor(callback: (entries: Entry[]) => void) { observed.push({ callback, targets: this.targets }); }
      observe(target: Element) { this.targets.push(target); }
    };
    browser.eval(createInstagramPageScript(switcher));
  };
  afterEach(() => dom.window.close());

  it('reports the signed-in account from the profile tab, never from a post author', () => {
    open(`<article><a href="/someone.else/"><img src="${AVATAR}"></a></article>${tabBar()}`);
    expect(messages()).toContainEqual({ type: 'ACCOUNT', platform: 'instagram', username: 'me.person', avatar: AVATAR });
    expect(messages().some((event) => event?.type === 'ACCOUNT' && event.username === 'someone.else')).toBe(false);
  });

  it('leaves out a profile picture that is not on Instagram’s image servers', () => {
    open(tabBar('https://tracker.example.com/pixel.jpg'));
    expect(messages()).toContainEqual({ type: 'ACCOUNT', platform: 'instagram', username: 'me.person', avatar: '' });
  });

  it('says whether Instagram shows its own bottom bar', () => {
    open('<header>Messages</header>', 'https://www.instagram.com/direct/inbox/');
    expect(messages()).toContainEqual({ type: 'NAV_BAR', platform: 'instagram', visible: false });

    open(tabBar());
    const bar = browser.document.getElementById('bar')!;
    bar.getBoundingClientRect = () => ({ top: browser.innerHeight - 50, bottom: browser.innerHeight, height: 50, width: 390, left: 0, right: 390, x: 0, y: 0, toJSON: () => ({}) });
    browser.ReactNativeWebView.postMessage.mockClear();
    (browser as unknown as { __focusUpInstagramPage: { scan: () => void; nav?: boolean } }).__focusUpInstagramPage.nav = undefined;
    (browser as unknown as { __focusUpInstagramPage: { scan: () => void } }).__focusUpInstagramPage.scan();
    expect(messages()).toContainEqual({ type: 'NAV_BAR', platform: 'instagram', visible: true });
  });

  it('opens Vaqtim’s switcher from the username menu instead of Instagram’s', () => {
    const header = '<div role="button" id="menu"><span>me.person</span><svg aria-label="Down chevron icon"><title>Down chevron icon</title></svg></div>';
    open(header + tabBar(), 'https://www.instagram.com/me.person/');
    const instagramMenu = jest.fn();
    browser.document.body.addEventListener('click', instagramMenu);
    browser.document.querySelector('#menu span')!.dispatchEvent(new browser.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(messages()).toContainEqual({ type: 'OPEN_ACCOUNTS', platform: 'instagram' });
    expect(instagramMenu).not.toHaveBeenCalled();
  });

  it('leaves Instagram’s menu alone when this build cannot switch accounts', () => {
    open('<div role="button" id="menu"><span>me.person</span><svg></svg></div>' + tabBar(), 'https://www.instagram.com/me.person/', false);
    const instagramMenu = jest.fn();
    browser.document.body.addEventListener('click', instagramMenu);
    browser.document.querySelector('#menu span')!.dispatchEvent(new browser.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(messages().some((event) => event?.type === 'OPEN_ACCOUNTS')).toBe(false);
    expect(instagramMenu).toHaveBeenCalled();
  });

  it('counts each home-feed post once when at least half of it was on screen', () => {
    jest.useFakeTimers();
    try {
      open(`<article id="a">one</article><article id="b">two</article>${tabBar()}`);
      const [watcher] = observed;
      const [a, b] = watcher!.targets;
      watcher!.callback([{ target: a!, isIntersecting: true, intersectionRatio: 0.6 }, { target: b!, isIntersecting: true, intersectionRatio: 0.2 }]);
      watcher!.callback([{ target: a!, isIntersecting: true, intersectionRatio: 1 }]);
      jest.advanceTimersByTime(1000);
      expect(messages().filter((event) => event?.type === 'POSTS_SEEN')).toEqual([{ type: 'POSTS_SEEN', platform: 'instagram', count: 1 }]);
    } finally { jest.useRealTimers(); }
  });
});
